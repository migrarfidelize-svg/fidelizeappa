import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveWhatsAppProvider, getExistingWhatsAppWebhookSecret, hasValidWebhookSecret } from "@/lib/otp.functions";

export async function processWhatsAppWebhook(rawBody: string, requestedEstablishmentId?: string, webhookSecret?: string | null) {
  // Authentication intentionally precedes payload parsing and every CRM query.
  // establishment_id identifies the tenant; it is never authorization on its own.
  if (!requestedEstablishmentId) return new Response("Unauthorized", { status: 401 });
  let expectedSecret: string | null;
  try {
    expectedSecret = await getExistingWhatsAppWebhookSecret(requestedEstablishmentId);
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!expectedSecret || !(await hasValidWebhookSecret(expectedSecret, webhookSecret))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const active = await getActiveWhatsAppProvider(requestedEstablishmentId);
  if (!active?.establishmentId) return new Response("WhatsApp provider missing establishment", { status: 503 });
  const establishmentId = active.establishmentId;
  const normalized = active.provider.parseWebhook?.(payload, {});
  if (!normalized) return new Response("Ignored", { status: 200 });
  const phone = normalized.fromPhone.replace(/\D/g, "");
  if (!phone || !normalized.remoteMessageId) return new Response("Ignored", { status: 200 });

  const duplicate = await supabaseAdmin.from("crm_messages").select("id, conversation_id, establishment_id, body, processed_at")
    .eq("provider", active.provider.meta.id).eq("provider_message_id", normalized.remoteMessageId).maybeSingle();
  if (duplicate.error) return new Response("Database error", { status: 503 });
  if (duplicate.data) {
    if (duplicate.data.establishment_id !== establishmentId) return new Response("Provider message tenant mismatch", { status: 409 });
    if (duplicate.data.processed_at) return new Response("Duplicate", { status: 200 });
    try {
      const { ensureDefaultWhatsAppFlow } = await import("@/lib/crm/bootstrap.server");
      await ensureDefaultWhatsAppFlow(establishmentId);
      const { executeFlow } = await import("@/lib/crm/flow-engine.server");
      await executeFlow(duplicate.data.conversation_id, duplicate.data.body || "");
      const retried = await supabaseAdmin.from("crm_messages").update({ processed_at: new Date().toISOString() })
        .eq("id", duplicate.data.id).eq("establishment_id", establishmentId).is("processed_at", null);
      if (retried.error) throw retried.error;
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("[CRM webhook] retry failed");
      return new Response("Automation failed", { status: 503 });
    }
  }

  const existingContact = await (supabaseAdmin as any).from("crm_contacts").select("id")
    .eq("establishment_id", establishmentId).eq("phone", phone).maybeSingle();
  if (existingContact.error) return new Response("Failed to load contact", { status: 503 });
  const contactResult = await (supabaseAdmin as any).from("crm_contacts").upsert({
    establishment_id: establishmentId,
    phone,
    name: normalized.pushName || phone,
    name_source: "flow",
  }, { onConflict: "establishment_id,phone" }).select("id").single();
  if (contactResult.error || !contactResult.data) return new Response("Failed to persist contact", { status: 503 });

  let conversationResult = await supabaseAdmin.from("crm_conversations").select("id, status, metadata")
    .eq("establishment_id", establishmentId).eq("customer_phone", phone).maybeSingle();
  if (conversationResult.error) return new Response("Failed to load conversation", { status: 503 });
  if (!conversationResult.data) {
    const inserted = await supabaseAdmin.from("crm_conversations").insert({
      establishment_id: establishmentId, customer_phone: phone, contact_id: contactResult.data.id, status: "bot",
      metadata: { contact_is_new: !existingContact.data },
    }).select("id, status, metadata").single();
    if (inserted.error || !inserted.data) return new Response("Failed to persist conversation", { status: 503 });
    conversationResult = inserted;
  } else if (conversationResult.data.status === "closed") {
    const settings = await (supabaseAdmin as any).from("crm_agent_settings").select("config")
      .eq("establishment_id", establishmentId).maybeSingle();
    if (settings.error) return new Response("Failed to load agent settings", { status: 503 });
    const { afterHumanTransition } = await import("@/lib/crm/flow-engine.server");
    const transition = afterHumanTransition((settings.data?.config as any)?.behavior?.afterHuman);
    if (!transition.reopen) {
      conversationResult.data = { ...conversationResult.data, metadata: { ...((conversationResult.data.metadata as object) || {}), contact_is_new: false } };
    } else {
    const reopened = await supabaseAdmin.from("crm_conversations").update({
      status: "bot", closed_at: null, assigned_to: null, assigned_at: null,
      metadata: { ...(conversationResult.data.metadata as object ?? {}), flow_state: transition.restart ? null : (conversationResult.data.metadata as any)?.flow_state, support: null, contact_is_new: false },
    }).eq("id", conversationResult.data.id).eq("establishment_id", establishmentId).select("id, status, metadata").single();
    if (reopened.error || !reopened.data) return new Response("Failed to reopen conversation", { status: 503 });
    conversationResult = reopened;
    }
  }

  const conversation = conversationResult.data;
  if (!conversation) return new Response("Failed to persist conversation", { status: 503 });
  const messageResult = await supabaseAdmin.from("crm_messages").insert({
    conversation_id: conversation.id,
    establishment_id: establishmentId,
    body: normalized.text,
    direction: "inbound",
    provider: active.provider.meta.id,
    provider_message_id: normalized.remoteMessageId,
    message_type: "text",
    metadata: { media_url: normalized.mediaUrl ?? null, source: "webhook" },
  }).select("id").single();
  if (messageResult.error) {
    if (messageResult.error.code === "23505") return new Response("Duplicate", { status: 200 });
    return new Response("Failed to persist message", { status: 503 });
  }

  try {
    const { ensureDefaultWhatsAppFlow } = await import("@/lib/crm/bootstrap.server");
    await ensureDefaultWhatsAppFlow(establishmentId);
    const { executeFlow } = await import("@/lib/crm/flow-engine.server");
    await executeFlow(conversation.id, normalized.text);
    const processed = await supabaseAdmin.from("crm_messages").update({ processed_at: new Date().toISOString() })
      .eq("id", messageResult.data.id).eq("establishment_id", establishmentId);
    if (processed.error) throw processed.error;
  } catch (error) {
    console.error("[CRM webhook] automation failed");
    return new Response("Automation failed", { status: 503 });
  }
  return new Response("OK", { status: 200 });
}

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: { handlers: { POST: async ({ request }) => {
    const url = new URL(request.url);
    const secret = request.headers.get("x-whatsapp-webhook-secret") ?? url.searchParams.get("webhook_secret");
    return processWhatsAppWebhook(await request.text(), url.searchParams.get("establishment_id") ?? undefined, secret);
  } } },
});
