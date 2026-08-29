/**
 * Sincronização de ciclo de vida com o parceiro de origem (ex.: Ronnei).
 *
 * Quando uma conta provisionada via API (source = "ronnei") faz upgrade,
 * downgrade, cancelamento, suspensão ou reativação DENTRO da Fidelize,
 * disparamos um webhook assinado para o parceiro para que ele:
 *  - localize a assinatura original,
 *  - cancele a cobrança recorrente,
 *  - marque o usuário como migrado para a Fidelize,
 *  - registre auditoria e impeça cobrança duplicada.
 *
 * A partir da migração, a Fidelize é a fonte da verdade da assinatura
 * (marcamos `billing_owner: "fidelize"` nos metadados da assinatura).
 *
 * Server-only.
 */
import { createHmac, randomUUID } from "node:crypto";

export type LifecycleEvent =
  | "subscription.upgraded"
  | "subscription.downgraded"
  | "subscription.changed"
  | "subscription.cancelled"
  | "subscription.suspended"
  | "subscription.reactivated";

export type OriginInfo = {
  /** Origem do provisionamento (ex.: "ronnei"), quando houver. */
  source: string | null;
  /** true quando a Fidelize já é a fonte da verdade da assinatura. */
  migrated: boolean;
  /** true quando existe webhook configurado para essa origem. */
  syncEnabled: boolean;
};

/** Parceiros que aceitam sincronização de ciclo de vida. */
const PARTNERS: Record<string, { urlEnv: string; secretEnv: string; label: string }> = {
  ronnei: { urlEnv: "RONNEI_WEBHOOK_URL", secretEnv: "RONNEI_WEBHOOK_SECRET", label: "Ronnei" },
};

function partnerConfig(source: string | null) {
  if (!source) return null;
  const key = source.trim().toLowerCase();
  const cfg = PARTNERS[key];
  if (!cfg) return null;
  const url = process.env[cfg.urlEnv];
  const secret = process.env[cfg.secretEnv];
  if (!url) return { key, label: cfg.label, url: null as string | null, secret: secret ?? null };
  return { key, label: cfg.label, url, secret: secret ?? null };
}

/** Descobre a origem do provisionamento de um tenant e o estado da migração. */
export async function getProvisionOrigin(tenantId: string): Promise<OriginInfo> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let source: string | null = null;
  let migrated = false;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("metadata")
    .eq("establishment_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const meta = ((sub as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta["source"] === "string") source = meta["source"] as string;
  if (meta["billing_owner"] === "fidelize") migrated = true;
  if (!source && typeof meta["provisioned_by"] === "string") source = meta["provisioned_by"] as string;

  if (!source) {
    const { data: audit } = await supabaseAdmin
      .from("audit_logs")
      .select("metadata")
      .eq("establishment_id", tenantId)
      .eq("action", "api_provision_account")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const am = ((audit as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>;
    if (typeof am["source"] === "string") source = am["source"] as string;
  }

  const cfg = partnerConfig(source);
  return { source, migrated, syncEnabled: !!cfg?.url };
}

export type LifecycleSyncInput = {
  tenantId: string;
  event: LifecycleEvent;
  fromPlan?: string | null;
  toPlan?: string | null;
  reason?: string | null;
  actorUserId?: string | null;
  /** "app" (cliente na Fidelize), "admin", "payment_webhook" ... */
  origin?: string;
};

export type LifecycleSyncResult = {
  delivered: boolean;
  skipped?: "no_partner" | "not_configured";
  status?: number;
  attempts?: number;
  delivery_id?: string;
  error?: string;
};

/**
 * Dispara o webhook de ciclo de vida para o parceiro de origem.
 * Nunca lança: falhas ficam registradas em auditoria.
 */
export async function notifyOriginPartner(input: LifecycleSyncInput): Promise<LifecycleSyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const originInfo = await getProvisionOrigin(input.tenantId);
  const cfg = partnerConfig(originInfo.source);
  if (!cfg) return { delivered: false, skipped: "no_partner" };

  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("id, name, slug, email, phone, plan, active")
    .eq("id", input.tenantId)
    .maybeSingle();

  const deliveryId = randomUUID();
  const newPlan = input.toPlan ?? (est as { plan?: string } | null)?.plan ?? null;
  const payload = {
    // Contrato acordado com o Ronnei
    event: input.event,
    event_id: deliveryId,
    data: {
      email: (est as { email?: string } | null)?.email ?? null,
      tenant_id: input.tenantId,
      previous_plan: input.fromPlan ?? null,
      new_plan: newPlan,
      source: originInfo.source ?? cfg.key,
    },
    // Campos auxiliares (compatibilidade/auditoria)
    id: deliveryId,
    occurred_at: new Date().toISOString(),
    source_system: "fidelize",
    /** A partir deste evento a Fidelize é a fonte da verdade da assinatura. */
    subscription_owner: "fidelize",
    cancel_recurring_billing: input.event !== "subscription.reactivated",
    tenant: {
      id: input.tenantId,
      name: (est as { name?: string } | null)?.name ?? null,
      slug: (est as { slug?: string } | null)?.slug ?? null,
      email: (est as { email?: string } | null)?.email ?? null,
      phone: (est as { phone?: string } | null)?.phone ?? null,
      active: (est as { active?: boolean } | null)?.active ?? null,
    },
    plan: { from: input.fromPlan ?? null, to: newPlan },
    provisioning_source: originInfo.source,
    reason: input.reason ?? null,
    actor_user_id: input.actorUserId ?? null,
    triggered_by: input.origin ?? "app",
  };

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = cfg.secret
    ? `sha256=${createHmac("sha256", cfg.secret).update(`${timestamp}.${body}`).digest("hex")}`
    : null;

  let delivered = false;
  let status: number | undefined;
  let attempts = 0;
  let lastError: string | undefined;

  if (cfg.url) {
    for (let i = 0; i < 3 && !delivered; i++) {
      attempts = i + 1;
      try {
        if (i > 0) await new Promise((r) => setTimeout(r, i * 800));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(cfg.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-fidelize-event": input.event,
            "x-fidelize-delivery": deliveryId,
            "x-fidelize-timestamp": timestamp,
            ...(signature ? { "x-fidelize-signature": signature } : {}),
            // Compatibilidade com os métodos aceitos pelo Ronnei (shared secret).
            // O padrão definitivo continua sendo o HMAC x-fidelize-signature.
            ...(cfg.secret
              ? { "x-api-key": cfg.secret, authorization: `Bearer ${cfg.secret}` }
              : {}),
            origin: "https://fidelizeapp.lovable.app",
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        status = res.status;
        delivered = res.ok;
        if (!res.ok) lastError = `HTTP ${res.status}`;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  } else {
    lastError = `Webhook do parceiro ${cfg.label} não configurado.`;
  }

  // Fonte da verdade: após qualquer evento de ciclo de vida enviado ao parceiro,
  // a assinatura passa a ser gerida pela Fidelize (impede cobrança duplicada).
  try {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, metadata")
      .eq("establishment_id", input.tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) {
      const current = ((sub as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>;
      await supabaseAdmin
        .from("subscriptions")
        .update({
          metadata: {
            ...current,
            billing_owner: "fidelize",
            migrated_from: originInfo.source,
            migrated_at: current["migrated_at"] ?? new Date().toISOString(),
            last_partner_event: input.event,
            last_partner_delivery_id: deliveryId,
            last_partner_delivery_ok: delivered,
          },
        } as never)
        .eq("id", (sub as { id: string }).id);
    }
  } catch { /* nunca bloqueia */ }

  // Auditoria completa e imutável do disparo.
  try {
    await supabaseAdmin.from("audit_logs").insert({
      establishment_id: input.tenantId,
      user_id: input.actorUserId ?? null,
      action: delivered ? "partner_lifecycle_sync" : "partner_lifecycle_sync_failed",
      entity_type: "subscription",
      entity_id: input.tenantId,
      metadata: {
        partner: cfg.key,
        event: input.event,
        delivery_id: deliveryId,
        attempts,
        status_code: status ?? null,
        delivered,
        error: lastError ?? null,
        payload,
        triggered_by: input.origin ?? "app",
      },
    } as never);
  } catch { /* nunca bloqueia */ }

  if (!cfg.url) return { delivered: false, skipped: "not_configured", delivery_id: deliveryId, error: lastError };
  return { delivered, status, attempts, delivery_id: deliveryId, error: lastError };
}

/** Dispara sem nunca propagar erro (uso em fluxos de UI/webhook). */
export async function safeNotifyOriginPartner(input: LifecycleSyncInput): Promise<void> {
  try {
    await notifyOriginPartner(input);
  } catch { /* noop */ }
}
