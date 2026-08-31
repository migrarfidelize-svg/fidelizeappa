import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ */
/* Autorização / resolução de tenant                                   */
/* ------------------------------------------------------------------ */

export type InboxAuth = {
  establishmentId: string;
  isSuper: boolean;
  role: "owner" | "manager" | "staff" | "super";
};

/**
 * Resolve o estabelecimento a partir da sessão (painel do lojista).
 * Superadmin pode informar explicitamente outro estabelecimento (context switcher).
 */
export async function authorizeInbox(
  supabase: any,
  userId: string,
  establishmentId?: string | null,
): Promise<InboxAuth> {
  const { data: isSuper } = await supabase.rpc("is_super_admin", { _user: userId });

  if (isSuper) {
    if (establishmentId) {
      const { data: est } = await supabase.from("establishments").select("id").eq("id", establishmentId).maybeSingle();
      if (!est) throw new Error("Estabelecimento não encontrado.");
      return { establishmentId, isSuper: true, role: "super" };
    }
    const { data: membership } = await supabase
      .from("establishment_members")
      .select("establishment_id, role")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (membership?.establishment_id) {
      return { establishmentId: membership.establishment_id, isSuper: true, role: "super" };
    }
    const { data: first } = await supabase.from("establishments").select("id").eq("active", true).order("name").limit(1).maybeSingle();
    if (!first) throw new Error("Nenhum estabelecimento disponível.");
    return { establishmentId: first.id, isSuper: true, role: "super" };
  }

  let target = establishmentId ?? null;
  let role: "owner" | "manager" | "staff" | null = null;

  if (target) {
    const { data: membership } = await supabase
      .from("establishment_members")
      .select("role")
      .eq("user_id", userId)
      .eq("establishment_id", target)
      .eq("active", true)
      .maybeSingle();
    if (!membership) throw new Error("Você não tem acesso a este estabelecimento.");
    role = membership.role;
  } else {
    const { data: membership } = await supabase
      .from("establishment_members")
      .select("establishment_id, role")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!membership?.establishment_id) throw new Error("Nenhum estabelecimento vinculado à sua conta.");
    target = membership.establishment_id;
    role = membership.role;
  }

  const { data: allowed } = await supabase.rpc("member_can", { _user: userId, _est: target, _action: "inbox.use" });
  if (!allowed) throw new Error("Você não tem permissão para usar o Atendimento.");

  return { establishmentId: target!, isSuper: false, role: role ?? "staff" };
}

async function assertManage(supabase: any, userId: string, establishmentId: string) {
  const { data: allowed } = await supabase.rpc("member_can", {
    _user: userId,
    _est: establishmentId,
    _action: "settings.integrations",
  });
  if (!allowed) throw new Error("Apenas gerentes ou proprietários podem alterar esta configuração.");
}

const tenant = z.object({ establishmentId: z.string().uuid().optional().nullable() });

async function logEvent(
  admin: any,
  establishmentId: string,
  conversationId: string,
  event: string,
  fromStatus: string | null,
  toStatus: string | null,
  actorId: string | null,
  metadata: Record<string, unknown> = {},
  source = "agent",
) {
  await admin.from("crm_conversation_events").insert({
    establishment_id: establishmentId,
    conversation_id: conversationId,
    event,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id: actorId,
    source,
    metadata,
  });
}

/* ------------------------------------------------------------------ */
/* Contexto                                                            */
/* ------------------------------------------------------------------ */

export const getInboxContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenant.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: est } = await supabaseAdmin
      .from("establishments")
      .select("id, name, slug")
      .eq("id", auth.establishmentId)
      .maybeSingle();

    const { data: canManage } = await supabase.rpc("member_can", {
      _user: userId,
      _est: auth.establishmentId,
      _action: "settings.integrations",
    });

    let establishments: { id: string; name: string }[] = [];
    if (auth.isSuper) {
      const { data: list } = await supabaseAdmin
        .from("establishments")
        .select("id, name")
        .eq("active", true)
        .order("name")
        .limit(300);
      establishments = list ?? [];
    }

    return {
      establishmentId: auth.establishmentId,
      establishmentName: est?.name ?? "",
      userId,
      isSuper: auth.isSuper,
      canManage: !!canManage,
      establishments,
    };
  });

/* ------------------------------------------------------------------ */
/* Conversas                                                           */
/* ------------------------------------------------------------------ */

const filtersSchema = tenant.extend({
  status: z.enum(["all", "bot", "waiting", "assigned", "paused", "closed", "mine", "unassigned"]).optional(),
  search: z.string().optional(),
  queueId: z.string().uuid().nullable().optional(),
  agentId: z.string().uuid().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).nullable().optional(),
  tagId: z.string().uuid().nullable().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const listInboxConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filtersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    let query = admin
      .from("crm_conversations")
      .select(
        "id, customer_phone, status, priority, assigned_to, assigned_at, closed_at, last_message_at, created_at, metadata, contact_id, queue_id, bot_paused, first_response_at, waiting_since, sla_due_at, unread_count, contact:crm_contacts(id, name, phone, email)",
      )
      .eq("establishment_id", auth.establishmentId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 100);

    const status = data.status ?? "all";
    if (status === "mine") query = query.eq("assigned_to", userId).neq("status", "closed");
    else if (status === "unassigned") query = query.is("assigned_to", null).neq("status", "closed");
    else if (status !== "all") query = query.eq("status", status);
    else query = query.neq("status", "closed");

    if (data.queueId) query = query.eq("queue_id", data.queueId);
    if (data.agentId) query = query.eq("assigned_to", data.agentId);
    if (data.priority) query = query.eq("priority", data.priority);
    if (data.search) query = query.ilike("customer_phone", `%${data.search.replace(/\D/g, "")}%`);

    const { data: rows, error } = await query;
    if (error) throw error;

    const ids = (rows ?? []).map((r: any) => r.id);
    const previews: Record<string, { body: string; created_at: string; direction: string }> = {};
    if (ids.length) {
      const { data: msgs } = await admin
        .from("crm_messages")
        .select("conversation_id, body, created_at, direction")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .limit(ids.length * 4);
      for (const m of msgs ?? []) {
        if (!previews[m.conversation_id]) previews[m.conversation_id] = m;
      }
    }

    const tagMap: Record<string, { id: string; name: string; color: string | null }[]> = {};
    if (ids.length && data.tagId !== undefined) {
      const { data: tags } = await admin
        .from("crm_conversation_tags")
        .select("conversation_id, tag:crm_tags(id, name, color)")
        .in("conversation_id", ids);
      for (const t of tags ?? []) {
        (tagMap[t.conversation_id] ||= []).push(t.tag);
      }
    }

    let list = (rows ?? []).map((r: any) => ({
      ...r,
      preview: previews[r.id] ?? null,
      tags: tagMap[r.id] ?? [],
    }));

    if (data.tagId) list = list.filter((c: any) => c.tags.some((t: any) => t?.id === data.tagId));

    // Ordenação operacional: SLA vencido → espera → prioridade → atividade
    const rank = (c: any) => {
      const overdue = c.sla_due_at && new Date(c.sla_due_at).getTime() < Date.now() && c.status !== "closed";
      const prio = { urgent: 0, high: 1, medium: 2, low: 3 }[c.priority as string] ?? 2;
      return (overdue ? 0 : 1) * 1000 + (c.status === "waiting" ? 0 : 100) + prio;
    };
    list.sort((a: any, b: any) => {
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime();
    });

    return list;
  });

export const getInboxStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenant.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const est = auth.establishmentId;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const base = () => admin.from("crm_conversations").select("*", { count: "exact", head: true }).eq("establishment_id", est);
    const [waiting, assigned, bot, paused, closedToday, mine, overdue] = await Promise.all([
      base().eq("status", "waiting"),
      base().eq("status", "assigned"),
      base().eq("status", "bot"),
      base().eq("status", "paused"),
      base().eq("status", "closed").gte("closed_at", today.toISOString()),
      base().eq("assigned_to", userId).neq("status", "closed"),
      base().neq("status", "closed").lt("sla_due_at", new Date().toISOString()),
    ]);

    return {
      waiting: waiting.count ?? 0,
      assigned: assigned.count ?? 0,
      bot: bot.count ?? 0,
      paused: paused.count ?? 0,
      closedToday: closedToday.count ?? 0,
      mine: mine.count ?? 0,
      slaOverdue: overdue.count ?? 0,
    };
  });

export const getInboxConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenant.extend({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const est = auth.establishmentId;

    const { data: conversation, error } = await admin
      .from("crm_conversations")
      .select("*, contact:crm_contacts(id, name, phone, email, notes)")
      .eq("id", data.conversationId)
      .eq("establishment_id", est)
      .maybeSingle();
    if (error) throw error;
    if (!conversation) throw new Error("Conversa não encontrada.");

    const [messages, notes, events, tags] = await Promise.all([
      admin.from("crm_messages").select("*").eq("conversation_id", data.conversationId).eq("establishment_id", est).order("created_at"),
      admin.from("crm_internal_notes").select("*").eq("conversation_id", data.conversationId).eq("establishment_id", est).order("created_at"),
      admin.from("crm_conversation_events").select("*").eq("conversation_id", data.conversationId).eq("establishment_id", est).order("created_at"),
      admin.from("crm_conversation_tags").select("tag:crm_tags(id, name, color)").eq("conversation_id", data.conversationId),
    ]);

    const history = [
      ...(messages.data ?? []).map((m: any) => ({ ...m, kind: "message" })),
      ...(notes.data ?? []).map((n: any) => ({ ...n, kind: "note", body: n.content, direction: "internal" })),
      ...(events.data ?? []).map((e: any) => ({ ...e, kind: "event", direction: "system" })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Ficha 360º — cliente de fidelidade pelo telefone
    const phone = (conversation.customer_phone || "").replace(/\D/g, "");
    let customer: any = null;
    if (phone) {
      const { data: found } = await admin
        .from("customers")
        .select("id, name, phone, email, tier, visits_count, last_visit_at, created_at, blocked")
        .eq("establishment_id", est)
        .ilike("phone", `%${phone.slice(-8)}%`)
        .limit(1)
        .maybeSingle();
      customer = found ?? null;
    }

    let loyalty: { cards: number; stamps: number } | null = null;
    if (customer?.id) {
      const [cards, stamps] = await Promise.all([
        admin.from("loyalty_cards").select("*", { count: "exact", head: true }).eq("customer_id", customer.id),
        admin.from("stamps").select("*", { count: "exact", head: true }).eq("customer_id", customer.id),
      ]);
      loyalty = { cards: cards.count ?? 0, stamps: stamps.count ?? 0 };
    }

    const { count: previousConversations } = await admin
      .from("crm_conversations")
      .select("*", { count: "exact", head: true })
      .eq("establishment_id", est)
      .eq("customer_phone", conversation.customer_phone);

    await admin
      .from("crm_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId)
      .eq("establishment_id", est);

    return {
      conversation,
      history,
      tags: (tags.data ?? []).map((t: any) => t.tag).filter(Boolean),
      customer,
      loyalty,
      previousConversations: previousConversations ?? 0,
      viewerId: userId,
    };
  });

/* ------------------------------------------------------------------ */
/* Máquina de estados                                                  */
/* ------------------------------------------------------------------ */

export const INBOX_TRANSITIONS: Record<string, string[]> = {
  bot: ["assigned", "waiting", "closed"],
  waiting: ["assigned", "bot", "closed"],
  assigned: ["assigned", "paused", "bot", "waiting", "closed"],
  paused: ["assigned", "bot", "waiting", "closed"],
  closed: ["waiting", "assigned", "bot"],
};

export function canTransition(from: string, to: string) {
  return (INBOX_TRANSITIONS[from] ?? []).includes(to);
}

const actionSchema = tenant.extend({
  conversationId: z.string().uuid(),
  action: z.enum(["takeover", "transfer", "return_to_bot", "pause", "resume", "close", "reopen", "to_queue"]),
  assigneeId: z.string().uuid().nullable().optional(),
  queueId: z.string().uuid().nullable().optional(),
  closeReasonId: z.string().uuid().nullable().optional(),
  closeNote: z.string().max(1000).optional(),
});

export const inboxTransition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => actionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const est = auth.establishmentId;
    const now = new Date().toISOString();

    const { data: conv } = await admin
      .from("crm_conversations")
      .select("id, status, assigned_to, metadata, queue_id")
      .eq("id", data.conversationId)
      .eq("establishment_id", est)
      .maybeSingle();
    if (!conv) throw new Error("Conversa não encontrada.");

    const from = conv.status as string;
    let to = from;
    const patch: Record<string, unknown> = { updated_at: now };

    if (data.action === "takeover") {
      to = "assigned";
      if (!canTransition(from, to)) throw new Error(`Transição inválida: ${from} → ${to}.`);
      // compare-and-set: só assume se ninguém assumiu antes
      const { data: won } = await admin
        .from("crm_conversations")
        .update({ status: "assigned", assigned_to: userId, assigned_at: now, bot_paused: true, updated_at: now })
        .eq("id", conv.id)
        .eq("establishment_id", est)
        .is("assigned_to", null)
        .select("id")
        .maybeSingle();
      if (!won) {
        if (conv.assigned_to === userId) return { ok: true, alreadyMine: true };
        throw new Error("Esta conversa já foi assumida por outro atendente.");
      }
      await logEvent(admin, est, conv.id, "takeover", from, to, userId);
      return { ok: true };
    }

    if (data.action === "transfer") {
      to = "assigned";
      if (!data.assigneeId) throw new Error("Selecione o atendente de destino.");
      const { data: member } = await admin
        .from("establishment_members")
        .select("user_id")
        .eq("establishment_id", est)
        .eq("user_id", data.assigneeId)
        .eq("active", true)
        .maybeSingle();
      if (!member) throw new Error("O destinatário não é um atendente ativo.");
      Object.assign(patch, { status: to, assigned_to: data.assigneeId, assigned_at: now, bot_paused: true });
    } else if (data.action === "to_queue") {
      to = "waiting";
      Object.assign(patch, { status: to, assigned_to: null, assigned_at: null, queue_id: data.queueId ?? null, waiting_since: now, bot_paused: true });
    } else if (data.action === "return_to_bot") {
      to = "bot";
      Object.assign(patch, { status: to, assigned_to: null, assigned_at: null, bot_paused: false, paused_at: null,
        metadata: { ...((conv.metadata as object) || {}), support: null } });
    } else if (data.action === "pause") {
      to = "paused";
      Object.assign(patch, { status: to, paused_at: now, bot_paused: true });
    } else if (data.action === "resume") {
      to = "assigned";
      Object.assign(patch, { status: to, paused_at: null, assigned_to: conv.assigned_to ?? userId, assigned_at: conv.assigned_to ? undefined : now, bot_paused: true });
    } else if (data.action === "close") {
      to = "closed";
      Object.assign(patch, {
        status: to,
        closed_at: now,
        close_reason_id: data.closeReasonId ?? null,
        close_note: data.closeNote ?? null,
        bot_paused: false,
        metadata: { ...((conv.metadata as object) || {}), support: { ...(((conv.metadata as any)?.support) || {}), active: false } },
      });
      await admin
        .from("crm_support_tickets")
        .update({ status: "resolved", resolved_at: now })
        .eq("conversation_id", conv.id)
        .eq("establishment_id", est)
        .in("status", ["open", "in_progress"]);
    } else if (data.action === "reopen") {
      to = "waiting";
      Object.assign(patch, { status: to, closed_at: null, waiting_since: now, close_reason_id: null, close_note: null });
    }

    if (!canTransition(from, to)) throw new Error(`Transição inválida: ${from} → ${to}.`);
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

    const { error } = await admin.from("crm_conversations").update(patch).eq("id", conv.id).eq("establishment_id", est);
    if (error) throw error;

    await logEvent(admin, est, conv.id, data.action, from, to, userId, {
      assigneeId: data.assigneeId ?? null,
      queueId: data.queueId ?? null,
      closeReasonId: data.closeReasonId ?? null,
    });

    return { ok: true };
  });

export const inboxSetPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    tenant.extend({ conversationId: z.string().uuid(), priority: z.enum(["low", "medium", "high", "urgent"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin
      .from("crm_conversations")
      .update({ priority: data.priority })
      .eq("id", data.conversationId)
      .eq("establishment_id", auth.establishmentId);
    if (error) throw error;
    await logEvent(admin, auth.establishmentId, data.conversationId, "priority", null, null, userId, { priority: data.priority });
    return { ok: true };
  });

export const inboxToggleTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    tenant.extend({ conversationId: z.string().uuid(), tagId: z.string().uuid(), attach: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: conv } = await admin
      .from("crm_conversations").select("id").eq("id", data.conversationId).eq("establishment_id", auth.establishmentId).maybeSingle();
    if (!conv) throw new Error("Conversa não encontrada.");
    const { data: tag } = await admin
      .from("crm_tags").select("id").eq("id", data.tagId).eq("establishment_id", auth.establishmentId).maybeSingle();
    if (!tag) throw new Error("Etiqueta não encontrada.");

    if (data.attach) {
      await admin.from("crm_conversation_tags").upsert(
        { conversation_id: data.conversationId, tag_id: data.tagId, establishment_id: auth.establishmentId },
        { onConflict: "conversation_id,tag_id" },
      );
    } else {
      await admin.from("crm_conversation_tags").delete().eq("conversation_id", data.conversationId).eq("tag_id", data.tagId);
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Mensagens e notas                                                   */
/* ------------------------------------------------------------------ */

export const inboxSendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    tenant.extend({ conversationId: z.string().uuid(), body: z.string().min(1).max(4000), isNote: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const est = auth.establishmentId;
    const now = new Date().toISOString();

    const { data: conv } = await admin
      .from("crm_conversations")
      .select("id, customer_phone, status, assigned_to, first_response_at")
      .eq("id", data.conversationId)
      .eq("establishment_id", est)
      .maybeSingle();
    if (!conv) throw new Error("Conversa não encontrada.");

    if (data.isNote) {
      const { error } = await admin.from("crm_internal_notes").insert({
        conversation_id: conv.id, establishment_id: est, author_id: userId, content: data.body,
      });
      if (error) throw error;
      return { ok: true, note: true };
    }

    const { getActiveWhatsAppProvider } = await import("../otp.functions");
    const active = await getActiveWhatsAppProvider(est);
    if (!active) throw new Error("Nenhum canal de WhatsApp ativo neste estabelecimento.");

    const providerEnv = { ...process.env } as Record<string, string | undefined>;
    for (const [field, envName] of Object.entries(active.runtime.credentials_ref || {})) {
      const credential = active.runtime.db_credentials?.[field];
      if (credential) providerEnv[envName] = credential;
    }

    const res = await active.provider.sendTestMessage(active.runtime, providerEnv, conv.customer_phone, data.body);
    if (!res.ok) throw new Error(res.message || "Falha ao enviar a mensagem pelo WhatsApp.");

    const { error: msgErr } = await admin.from("crm_messages").insert({
      conversation_id: conv.id,
      establishment_id: est,
      body: data.body,
      direction: "outbound",
      provider: active.provider.meta.id,
      provider_message_id: res.providerMessageId || `agent-${crypto.randomUUID()}`,
      message_type: "text",
      metadata: { source: "agent", author_id: userId },
    });
    if (msgErr) throw msgErr;

    const patch: Record<string, unknown> = { last_message_at: now, bot_paused: true, updated_at: now };
    if (conv.status !== "closed") {
      patch.status = "assigned";
      patch.assigned_to = conv.assigned_to ?? userId;
      if (!conv.assigned_to) patch.assigned_at = now;
    }
    if (!conv.first_response_at) patch.first_response_at = now;
    await admin.from("crm_conversations").update(patch).eq("id", conv.id).eq("establishment_id", est);

    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Filas, motivos, agentes                                             */
/* ------------------------------------------------------------------ */

export const listInboxSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenant.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const est = auth.establishmentId;

    const [queues, reasons, tags, members, presence] = await Promise.all([
      admin.from("crm_queues").select("*").eq("establishment_id", est).order("priority", { ascending: false }).order("name"),
      admin.from("crm_close_reasons").select("*").eq("establishment_id", est).eq("active", true).order("sort_order"),
      admin.from("crm_tags").select("id, name, color").eq("establishment_id", est).order("name"),
      admin.from("establishment_members").select("user_id, role, active").eq("establishment_id", est).eq("active", true),
      admin.from("crm_agent_presence").select("*").eq("establishment_id", est),
    ]);

    const userIds = (members.data ?? []).map((m: any) => m.user_id);
    const profiles: Record<string, { name: string | null }> = {};
    if (userIds.length) {
      const { data: rows } = await admin.from("profiles").select("id, full_name").in("id", userIds);
      for (const p of rows ?? []) profiles[p.id] = { name: p.full_name };
    }

    return {
      queues: queues.data ?? [],
      closeReasons: reasons.data ?? [],
      tags: tags.data ?? [],
      agents: (members.data ?? []).map((m: any) => ({
        userId: m.user_id,
        role: m.role,
        name: profiles[m.user_id]?.name ?? "Atendente",
        presence: (presence.data ?? []).find((p: any) => p.user_id === m.user_id) ?? null,
      })),
    };
  });

export const saveInboxQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    tenant.extend({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(60),
      color: z.string().max(20).optional(),
      priority: z.number().int().min(0).max(10).optional(),
      slaFirstResponseMin: z.number().int().min(1).max(1440).optional(),
      slaResolutionMin: z.number().int().min(1).max(10080).optional(),
      active: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    await assertManage(supabase, userId, auth.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const row = {
      establishment_id: auth.establishmentId,
      name: data.name,
      color: data.color ?? "#6366f1",
      priority: data.priority ?? 0,
      sla_first_response_min: data.slaFirstResponseMin ?? 15,
      sla_resolution_min: data.slaResolutionMin ?? 240,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await admin.from("crm_queues").update(row).eq("id", data.id).eq("establishment_id", auth.establishmentId);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await admin.from("crm_queues").insert(row).select("id").single();
    if (error) throw error;
    return { ok: true, id: created.id };
  });

export const deleteInboxQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenant.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    await assertManage(supabase, userId, auth.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("crm_queues").delete().eq("id", data.id).eq("establishment_id", auth.establishmentId);
    if (error) throw error;
    return { ok: true };
  });

export const saveInboxCloseReason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    tenant.extend({ id: z.string().uuid().optional(), name: z.string().min(1).max(60), sortOrder: z.number().int().optional(), active: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    await assertManage(supabase, userId, auth.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const row = {
      establishment_id: auth.establishmentId,
      name: data.name,
      sort_order: data.sortOrder ?? 0,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await admin.from("crm_close_reasons").update(row).eq("id", data.id).eq("establishment_id", auth.establishmentId);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await admin.from("crm_close_reasons").insert(row).select("id").single();
    if (error) throw error;
    return { ok: true, id: created.id };
  });

export const setMyInboxPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    tenant.extend({ status: z.enum(["online", "away", "offline"]), capacity: z.number().int().min(1).max(50).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await (supabaseAdmin as any).from("crm_agent_presence").upsert(
      {
        establishment_id: auth.establishmentId,
        user_id: userId,
        status: data.status,
        capacity: data.capacity ?? 5,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "establishment_id,user_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Relatórios                                                          */
/* ------------------------------------------------------------------ */

export const getInboxReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenant.extend({ days: z.number().int().min(1).max(90).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const auth = await authorizeInbox(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const est = auth.establishmentId;
    const days = data.days ?? 14;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data: convs } = await admin
      .from("crm_conversations")
      .select("id, status, created_at, closed_at, first_response_at, assigned_to, waiting_since, sla_due_at, queue_id")
      .eq("establishment_id", est)
      .gte("created_at", since)
      .limit(5000);

    const { data: msgs } = await admin
      .from("crm_messages")
      .select("direction, created_at")
      .eq("establishment_id", est)
      .gte("created_at", since)
      .limit(20000);

    const rows = convs ?? [];
    const firstResponses = rows
      .filter((c: any) => c.first_response_at)
      .map((c: any) => (new Date(c.first_response_at).getTime() - new Date(c.created_at).getTime()) / 60000);
    const resolutions = rows
      .filter((c: any) => c.closed_at)
      .map((c: any) => (new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 60000);
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

    const byDay: Record<string, { day: string; opened: number; closed: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      byDay[d] = { day: d, opened: 0, closed: 0 };
    }
    for (const c of rows) {
      const o = String(c.created_at).slice(0, 10);
      if (byDay[o]) byDay[o].opened++;
      if (c.closed_at) {
        const k = String(c.closed_at).slice(0, 10);
        if (byDay[k]) byDay[k].closed++;
      }
    }

    const perAgent: Record<string, number> = {};
    for (const c of rows) if (c.assigned_to) perAgent[c.assigned_to] = (perAgent[c.assigned_to] ?? 0) + 1;

    return {
      days,
      total: rows.length,
      closed: rows.filter((c: any) => c.status === "closed").length,
      open: rows.filter((c: any) => c.status !== "closed").length,
      avgFirstResponseMin: avg(firstResponses),
      avgResolutionMin: avg(resolutions),
      slaBreaches: rows.filter((c: any) => c.sla_due_at && c.status !== "closed" && new Date(c.sla_due_at).getTime() < Date.now()).length,
      inbound: (msgs ?? []).filter((m: any) => m.direction === "inbound").length,
      outbound: (msgs ?? []).filter((m: any) => m.direction === "outbound").length,
      series: Object.values(byDay),
      perAgent,
    };
  });
