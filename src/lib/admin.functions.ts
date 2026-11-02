import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Check platform privileges against the trusted server database client.
 * Call only after requireSupabaseAuth has verified the user's bearer JWT.
 * Avoids PostgREST PGRST303 on an otherwise-valid user JWT.
 */
export async function assertSuperAdmin(_supabase: any, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error("Não foi possível validar a permissão administrativa.");
  if (!data) throw new Error("Acesso restrito: apenas administradores da plataforma.");
}

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [role, total] = await Promise.all([
      supabaseAdmin.from("app_roles").select("user_id")
        .eq("user_id", userId).eq("role", "super_admin").maybeSingle(),
      supabaseAdmin.from("app_roles").select("user_id", { count: "exact", head: true })
        .eq("role", "super_admin"),
    ]);
    if (role.error || total.error) {
      throw new Error("Não foi possível verificar as permissões administrativas.");
    }
    return { isAdmin: Boolean(role.data), canBootstrap: total.count === 0, userId };
  });

export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("app_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");
    if ((count ?? 0) > 0) throw new Error("Já existe um administrador da plataforma.");
    const { error } = await supabaseAdmin.from("app_roles").insert({ user_id: userId, role: "super_admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await assertSuperAdmin(context.supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prodData } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("namespace", "system")
      .eq("key", "production_mode")
      .maybeSingle();
    
    const prod = (prodData?.value as any) || { enabled: false, production_started_at: null };
    const cutoff = prod.enabled && prod.production_started_at ? prod.production_started_at : "1970-01-01T00:00:00Z";

    const [
      { count: estTotal },
      { count: estActive },
      { count: estBlocked },
      { count: customersTotal },
      { count: stampsTotal },
      { count: rewardsTotal },
      { count: rewardsRedeemed },
      { data: byPlan },
      { data: recentStamps },
      { data: recentEsts },
    ] = await Promise.all([
      supabaseAdmin.from("establishments").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("establishments").select("*", { count: "exact", head: true }).eq("active", true),
      supabaseAdmin.from("establishments").select("*", { count: "exact", head: true }).eq("active", false),
      supabaseAdmin.from("customers").select("*", { count: "exact", head: true }).gte("created_at", cutoff),
      supabaseAdmin.from("stamps").select("*", { count: "exact", head: true }).is("reverted_at", null).gte("created_at", cutoff),
      supabaseAdmin.from("rewards").select("*", { count: "exact", head: true }).gte("created_at", cutoff),
      supabaseAdmin.from("rewards").select("*", { count: "exact", head: true }).not("redeemed_at", "is", null).gte("redeemed_at", cutoff),
      supabaseAdmin.from("establishments").select("plan"),
      supabaseAdmin.from("stamps").select("created_at").is("reverted_at", null).gte("created_at", cutoff).gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
      supabaseAdmin.from("establishments").select("id, name, slug, plan, active, created_at").order("created_at", { ascending: false }).limit(6),
    ]);

    const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 };
    (byPlan ?? []).forEach((r: { plan: string }) => { planCounts[r.plan] = (planCounts[r.plan] ?? 0) + 1; });

    const map = new Map<string, number>();
    (recentStamps ?? []).forEach((s: { created_at: string }) => {
      const d = new Date(s.created_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    });
    const series: { day: string; carimbos: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      series.push({ day: d.slice(5), carimbos: map.get(d) ?? 0 });
    }

    // Real MRR: sum of price_monthly for establishments with an active paid subscription
    const { data: plans } = await supabaseAdmin.from("plans").select("tier, price_monthly");
    const priceMap = new Map<string, number>((plans ?? []).map((p: any) => [p.tier, Number(p.price_monthly)]));
    const { data: activeSubs } = await supabaseAdmin
      .from("subscriptions")
      .select("establishment_id, tier")
      .eq("status", "active");
    const seen = new Set<string>();
    let mrr = 0;
    (activeSubs ?? []).forEach((s: any) => {
      if (seen.has(s.establishment_id)) return;
      seen.add(s.establishment_id);
      mrr += priceMap.get(s.tier) ?? 0;
    });

    return {
      estTotal: estTotal ?? 0,
      estActive: estActive ?? 0,
      estBlocked: estBlocked ?? 0,
      customersTotal: customersTotal ?? 0,
      stampsTotal: stampsTotal ?? 0,
      rewardsTotal: rewardsTotal ?? 0,
      rewardsRedeemed: rewardsRedeemed ?? 0,
      planCounts,
      series,
      recentEsts: recentEsts ?? [],
      mrr,
    };
  });

export const adminListEstablishments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    query: z.string().trim().max(80).optional(),
    status: z.enum(["all", "active", "blocked"]).default("all"),
    plan: z.enum(["all", "free", "starter", "pro", "enterprise", "business"]).default("all"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    let q = supabase.from("establishments").select("id, name, slug, plan, active, phone, email, created_at, created_by").order("created_at", { ascending: false }).limit(200);
    if (data.status === "active") q = q.eq("active", true);
    if (data.status === "blocked") q = q.eq("active", false);
    if (data.plan !== "all") q = q.eq("plan", data.plan);
    if (data.query) q = q.or(`name.ilike.%${data.query}%,slug.ilike.%${data.query}%,email.ilike.%${data.query}%`);

    const { data: ests, error } = await q;
    if (error) throw new Error(error.message);
    if (!ests?.length) return [];

    const ids = ests.map(e => e.id);
    const ownerIds = ests.map(e => e.created_by).filter(Boolean) as string[];
    const [{ data: customerCounts }, { data: stampCounts }, { data: owners }] = await Promise.all([
      supabase.from("customers").select("establishment_id").in("establishment_id", ids),
      supabase.from("stamps").select("establishment_id").in("establishment_id", ids).is("reverted_at", null),
      ownerIds.length ? supabase.from("profiles").select("id, full_name").in("id", ownerIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const cc = new Map<string, number>();
    (customerCounts ?? []).forEach((r: any) => cc.set(r.establishment_id, (cc.get(r.establishment_id) ?? 0) + 1));
    const sc = new Map<string, number>();
    (stampCounts ?? []).forEach((r: any) => sc.set(r.establishment_id, (sc.get(r.establishment_id) ?? 0) + 1));
    const om = new Map<string, string>();
    (owners ?? []).forEach((p: any) => om.set(p.id, p.full_name));

    return ests.map(e => ({
      ...e,
      customers: cc.get(e.id) ?? 0,
      stamps: sc.get(e.id) ?? 0,
      owner_name: e.created_by ? om.get(e.created_by) ?? null : null,
    }));
  });

export const adminSetEstablishmentActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabase.from("establishments").update({ active: data.active }).eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id, user_id: userId,
      action: data.active ? "admin_unblock" : "admin_block", entity_type: "establishment", entity_id: data.establishment_id,
      metadata: {} as never,
    });
    return { ok: true };
  });

export const adminSetEstablishmentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan: z.enum(["free", "starter", "pro", "enterprise", "business"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabase.from("establishments").update({ plan: data.plan }).eq("id", data.establishment_id);
    if (error) throw new Error(error.message);

    // O acesso é decidido pela tabela de assinaturas (fonte única). Mudança manual
    // do super admin = cortesia: cria/atualiza a assinatura correspondente.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const oneYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const { data: planRow } = await supabaseAdmin.from("plans")
      .select("id").eq("tier", data.plan as any).order("is_active", { ascending: false }).limit(1).maybeSingle();
    const { data: sub } = await supabaseAdmin.from("subscriptions")
      .select("id").eq("establishment_id", data.establishment_id).maybeSingle();
    const payload: Record<string, unknown> = {
      plan_id: planRow?.id ?? null,
      tier: data.plan as any,
      status: data.plan === "free" ? "cancelled" : "active",
      provider: "courtesy",
      current_period_start: now.toISOString(),
      current_period_end: data.plan === "free" ? null : oneYear.toISOString(),
      cancel_at_period_end: data.plan === "free",
      metadata: { courtesy: data.plan !== "free", set_by: userId, set_at: now.toISOString() } as never,
    };
    if (sub) await supabaseAdmin.from("subscriptions").update(payload as never).eq("id", sub.id);
    else await supabaseAdmin.from("subscriptions").insert({ establishment_id: data.establishment_id, ...payload } as never);

    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id, user_id: userId,
      action: "admin_change_plan", entity_type: "establishment", entity_id: data.establishment_id,
      metadata: { plan: data.plan, subscription_synced: true } as never,
    });
    return { ok: true };
  });


export const adminDeleteEstablishment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data: est } = await supabase.from("establishments").select("name, plan, slug").eq("id", data.establishment_id).maybeSingle();
    // Log BEFORE delete because cascade wipes audit rows tied to establishment
    await supabase.from("audit_logs").insert({
      establishment_id: null, user_id: userId,
      action: "admin_delete_establishment", entity_type: "establishment", entity_id: data.establishment_id,
      metadata: { name: est?.name, slug: est?.slug, plan: est?.plan } as never,
    });
    const { error } = await supabase.from("establishments").delete().eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────── Detail view ───────────────
export const adminGetEstablishmentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();

    const [
      { data: est },
      { count: customersTotal },
      { count: customersNew },
      { count: stampsTotal },
      { count: stamps30 },
      { count: rewards30 },
      { data: recentStamps },
      { data: campaigns },
      { data: members },
    ] = await Promise.all([
      supabase.from("establishments").select("id, name, slug, plan, active, phone, email, created_at, created_by").eq("id", data.establishment_id).maybeSingle(),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("establishment_id", data.establishment_id),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("establishment_id", data.establishment_id).gte("created_at", since),
      supabase.from("stamps").select("*", { count: "exact", head: true }).eq("establishment_id", data.establishment_id).is("reverted_at", null),
      supabase.from("stamps").select("*", { count: "exact", head: true }).eq("establishment_id", data.establishment_id).is("reverted_at", null).gte("created_at", since),
      supabase.from("rewards").select("*", { count: "exact", head: true }).eq("establishment_id", data.establishment_id).not("redeemed_at", "is", null).gte("redeemed_at", since),
      supabase.from("stamps").select("created_at").eq("establishment_id", data.establishment_id).is("reverted_at", null).gte("created_at", since),
      supabase.from("campaigns").select("id, name, stamps_required, active").eq("establishment_id", data.establishment_id),
      supabase.from("establishment_members").select("user_id, role, active, display_name, invited_email, created_at").eq("establishment_id", data.establishment_id),
    ]);

    if (!est) throw new Error("Estabelecimento não encontrado");

    const map = new Map<string, number>();
    (recentStamps ?? []).forEach((s: { created_at: string }) => {
      const d = new Date(s.created_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    });
    const series: { day: string; carimbos: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      series.push({ day: d.slice(5), carimbos: map.get(d) ?? 0 });
    }

    const memberIds = Array.from(new Set((members ?? []).map((m: any) => m.user_id)));
    const [{ data: events }, { data: audits }, { data: memberProfiles }] = await Promise.all([
      supabase.from("subscription_events").select("id, event_type, from_plan, to_plan, message, created_at, acknowledged_at").eq("establishment_id", data.establishment_id).order("created_at", { ascending: false }).limit(30),
      supabase.from("audit_logs").select("id, action, entity_type, entity_id, metadata, created_at, user_id").or(`establishment_id.eq.${data.establishment_id},entity_id.eq.${data.establishment_id}`).order("created_at", { ascending: false }).limit(30),
      memberIds.length > 0
        ? supabase.from("profiles").select("id, full_name, account_type").in("id", memberIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map<string, { full_name: string | null; account_type: string }>();
    (memberProfiles ?? []).forEach((p: any) => pmap.set(p.id, { full_name: p.full_name, account_type: p.account_type }));
    const membersEnriched = (members ?? []).map((m: any) => ({
      ...m,
      full_name: pmap.get(m.user_id)?.full_name ?? null,
      account_type: pmap.get(m.user_id)?.account_type ?? "customer",
    }));

    return {
      establishment: est,
      metrics: {
        customersTotal: customersTotal ?? 0,
        customersNew30: customersNew ?? 0,
        stampsTotal: stampsTotal ?? 0,
        stamps30: stamps30 ?? 0,
        rewards30: rewards30 ?? 0,
      },
      series,
      campaigns: campaigns ?? [],
      members: membersEnriched,
      events: events ?? [],
      audits: audits ?? [],
    };
  });

// ─────────────── Membership management ───────────────
export const adminDemoteMemberToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    user_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { error: e1 } = await supabase
      .from("establishment_members")
      .update({ active: false })
      .eq("establishment_id", data.establishment_id)
      .eq("user_id", data.user_id);
    if (e1) throw new Error(e1.message);

    const { count } = await supabase
      .from("establishment_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", data.user_id)
      .eq("active", true);

    let profileUpdated = false;
    if ((count ?? 0) === 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: e2 } = await supabaseAdmin
        .from("profiles")
        .update({ account_type: "customer" })
        .eq("id", data.user_id);
      if (e2) throw new Error(e2.message);
      profileUpdated = true;
    }

    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id, user_id: userId,
      action: "admin_demote_member_to_customer", entity_type: "user", entity_id: data.user_id,
      metadata: { profile_updated: profileUpdated } as never,
    });
    return { ok: true, profile_updated: profileUpdated };
  });


// ─────────────── Alerts / events ───────────────
export const adminListSubscriptionEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ onlyUnack: z.boolean().default(false), limit: z.number().int().min(1).max(200).default(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    let q = supabase.from("subscription_events")
      .select("id, establishment_id, event_type, from_plan, to_plan, message, created_at, acknowledged_at, actor_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.onlyUnack) q = q.is("acknowledged_at", null);
    const { data: evs, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((evs ?? []).map(e => e.establishment_id)));
    const { data: ests } = ids.length
      ? await supabase.from("establishments").select("id, name, slug").in("id", ids)
      : { data: [] as any[] };
    const nameMap = new Map<string, { name: string; slug: string }>();
    (ests ?? []).forEach((e: any) => nameMap.set(e.id, { name: e.name, slug: e.slug }));
    return (evs ?? []).map(e => ({ ...e, establishment: nameMap.get(e.establishment_id) ?? null }));
  });

export const adminAckSubscriptionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabase.from("subscription_events")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
      .eq("id", data.event_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminReportPaymentFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    message: z.string().trim().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data: est } = await supabase.from("establishments").select("plan").eq("id", data.establishment_id).maybeSingle();
    const { error } = await supabase.from("subscription_events").insert({
      establishment_id: data.establishment_id,
      event_type: "payment_failed",
      from_plan: est?.plan ?? null,
      to_plan: est?.plan ?? null,
      actor_id: userId,
      message: data.message ?? "Falha de pagamento reportada",
    });
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id, user_id: userId,
      action: "admin_report_payment_failure", entity_type: "establishment", entity_id: data.establishment_id,
      metadata: { message: data.message ?? null } as never,
    });
    return { ok: true };
  });

export const adminListAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(200).default(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data: logs, error } = await supabase.from("audit_logs")
      .select("id, action, entity_type, entity_id, establishment_id, user_id, metadata, created_at")
      .like("action", "admin_%")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((logs ?? []).map(l => l.user_id).filter(Boolean))) as string[];
    const estIds = Array.from(new Set((logs ?? []).flatMap(l => [l.establishment_id, l.entity_id]).filter(Boolean))) as string[];
    const [{ data: profs }, { data: ests }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
      estIds.length ? supabase.from("establishments").select("id, name, slug").in("id", estIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pm = new Map<string, string>();
    (profs ?? []).forEach((p: any) => pm.set(p.id, p.full_name));
    const em = new Map<string, { name: string; slug: string }>();
    (ests ?? []).forEach((e: any) => em.set(e.id, { name: e.name, slug: e.slug }));
    return (logs ?? []).map(l => ({
      ...l,
      actor_name: l.user_id ? pm.get(l.user_id) ?? null : null,
      establishment: em.get(l.establishment_id ?? l.entity_id ?? "") ?? null,
    }));
  });


// ─────────────── Financial ───────────────
export const adminGetFinancial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400_000).toISOString();
    const last12start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const last12startIso = last12start.toISOString();

    const [
      { data: plans },
      { data: ests },
      { data: subs },
      { data: events12 },
      { data: paidPayments },
    ] = await Promise.all([
      supabase.from("plans").select("tier, name, price_monthly, price_yearly, currency"),
      supabase.from("establishments").select("id, name, slug, plan, active, created_at").is("archived_at", null),
      supabase.from("subscriptions").select("id, establishment_id, tier, status, provider, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at, created_at"),
      supabase.from("subscription_events").select("id, establishment_id, event_type, from_plan, to_plan, created_at").gte("created_at", last12startIso).order("created_at", { ascending: false }),
      supabase.from("payments").select("amount, approved_at, plan_slug, establishment_id, status").in("status", ["approved", "paid"]).gte("approved_at", last12startIso),
    ]);

    const priceMap = new Map<string, number>((plans ?? []).map((p: any) => [p.tier, Number(p.price_monthly ?? 0)]));
    const planNames = new Map<string, string>((plans ?? []).map((p: any) => [p.tier, p.name]));
    const estMap = new Map<string, any>((ests ?? []).map((e: any) => [e.id, e]));

    // REAL MRR: only establishments with an active paid subscription
    const revenueByPlan: Record<string, { count: number; mrr: number; name: string }> = {};
    let mrr = 0;
    let activePaying = 0;
    const countedEst = new Set<string>();
    (subs ?? []).forEach((s: any) => {
      if (s.status !== "active") return;
      if (countedEst.has(s.establishment_id)) return;
      countedEst.add(s.establishment_id);
      const price = priceMap.get(s.tier) ?? 0;
      const key = s.tier;
      if (!revenueByPlan[key]) revenueByPlan[key] = { count: 0, mrr: 0, name: planNames.get(key) ?? key };
      revenueByPlan[key].count += 1;
      revenueByPlan[key].mrr += price;
      mrr += price;
      if (price > 0) activePaying += 1;
    });

    // Realized revenue series: last 12 months of approved payments
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const months: { month: string; mrrNew: number; churn: number; net: number; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: monthKey(d), mrrNew: 0, churn: 0, net: 0, revenue: 0 });
    }
    (paidPayments ?? []).forEach((p: any) => {
      if (!p.approved_at) return;
      const k = monthKey(new Date(p.approved_at));
      const row = months.find(m => m.month === k);
      if (row) row.revenue += Number(p.amount ?? 0);
    });
    (events12 ?? []).forEach((ev: any) => {
      const k = monthKey(new Date(ev.created_at));
      const row = months.find(m => m.month === k);
      if (!row) return;
      const toPrice = priceMap.get(ev.to_plan) ?? 0;
      const fromPrice = priceMap.get(ev.from_plan) ?? 0;
      if (ev.event_type === "upgrade" || ev.event_type === "reactivate") row.mrrNew += Math.max(0, toPrice - fromPrice);
      else if (ev.event_type === "downgrade") row.churn += Math.max(0, fromPrice - toPrice);
      else if (ev.event_type === "cancel") row.churn += fromPrice;
    });
    months.forEach(m => { m.net = m.mrrNew - m.churn; });

    // Upcoming renewals (next 30 days) from subscriptions
    const upcoming = (subs ?? [])
      .filter((s: any) => s.status === "active" && s.current_period_end && s.current_period_end <= in30 && s.current_period_end >= now.toISOString())
      .map((s: any) => {
        const est = estMap.get(s.establishment_id);
        return {
          id: s.id,
          establishment_id: s.establishment_id,
          establishment_name: est?.name ?? "—",
          establishment_slug: est?.slug ?? "",
          tier: s.tier,
          amount: priceMap.get(s.tier) ?? 0,
          current_period_end: s.current_period_end,
          cancel_at_period_end: !!s.cancel_at_period_end,
          provider: s.provider,
        };
      })
      .sort((a, b) => a.current_period_end.localeCompare(b.current_period_end));

    // Top revenue establishments: real, from active subscriptions
    const topRevenue = Array.from(countedEst).map(id => {
      const est = estMap.get(id);
      const sub = (subs ?? []).find((s: any) => s.establishment_id === id && s.status === "active");
      const tier = sub?.tier ?? est?.plan ?? "free";
      return { id, name: est?.name ?? "—", slug: est?.slug ?? "", plan: tier, mrr: priceMap.get(tier) ?? 0 };
    }).sort((a, b) => b.mrr - a.mrr).slice(0, 10);

    // Trial subscriptions ending soon
    const trials = (subs ?? [])
      .filter((s: any) => s.trial_ends_at && s.status !== "canceled")
      .map((s: any) => {
        const est = estMap.get(s.establishment_id);
        return {
          id: s.id,
          establishment_name: est?.name ?? "—",
          establishment_slug: est?.slug ?? "",
          tier: s.tier,
          trial_ends_at: s.trial_ends_at,
        };
      })
      .sort((a, b) => a.trial_ends_at.localeCompare(b.trial_ends_at))
      .slice(0, 10);

    const totalEst = ests?.length ?? 0;
    const activeEst = (ests ?? []).filter((e: any) => e.active).length;
    const arpu = activePaying > 0 ? mrr / activePaying : 0;

    // Churn rate 30d: real cancels / active subs at start of window
    const cutoff30 = new Date(now.getTime() - 30 * 86400_000).toISOString();
    const cancels30 = (events12 ?? []).filter((e: any) => e.event_type === "cancel" && e.created_at >= cutoff30).length;
    const churnRate = activePaying > 0 ? (cancels30 / activePaying) * 100 : 0;

    // Realized revenue totals
    const revenue30 = (paidPayments ?? []).filter((p: any) => p.approved_at && p.approved_at >= cutoff30).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const revenue12m = (paidPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

    return {
      mrr, arr: mrr * 12, arpu, activePaying, totalEst, activeEst,
      revenueByPlan, months, upcoming, topRevenue, trials, churnRate, cancels30,
      revenue30, revenue12m,
    };
  });

// ============ Admin: Payments listing (pagination, search, sort) ============
export const adminListPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    q: z.string().trim().max(120).optional(),
    status: z.string().max(40).optional(),
    provider: z.string().max(40).optional(),
    method: z.string().max(40).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    sort: z.enum(["created_at", "amount", "status", "approved_at"]).default("created_at"),
    dir: z.enum(["asc", "desc"]).default("desc"),
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(25),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("payments")
      .select("id, establishment_id, plan_slug, amount, currency, method, status, status_detail, provider, mp_payment_id, provider_payment_id, payer_email, payer_doc, card_last4, card_brand, installments, created_at, approved_at", { count: "exact" });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.provider && data.provider !== "all") q = q.eq("provider", data.provider);
    if (data.method && data.method !== "all") q = q.eq("method", data.method);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.q) {
      const term = data.q.replace(/[%,()]/g, " ").trim();
      q = q.or([
        `payer_email.ilike.%${term}%`,
        `payer_doc.ilike.%${term}%`,
        `mp_payment_id.ilike.%${term}%`,
        `provider_payment_id.ilike.%${term}%`,
        `plan_slug.ilike.%${term}%`,
      ].join(","));
    }
    q = q.order(data.sort, { ascending: data.dir === "asc", nullsFirst: false });
    const fromIdx = (data.page - 1) * data.page_size;
    const toIdx = fromIdx + data.page_size - 1;
    const { data: rows, count, error } = await q.range(fromIdx, toIdx);
    if (error) throw new Error(error.message);
    const estIds = Array.from(new Set((rows ?? []).map((r: any) => r.establishment_id).filter(Boolean)));
    let ests: Record<string, { id: string; name: string; slug: string }> = {};
    if (estIds.length) {
      const { data: er } = await supabaseAdmin.from("establishments").select("id, name, slug").in("id", estIds);
      (er ?? []).forEach((e: any) => { ests[e.id] = e; });
    }
    return { rows: rows ?? [], total: count ?? 0, page: data.page, page_size: data.page_size, establishments: ests };
  });

export const adminGetPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay, error } = await supabaseAdmin.from("payments").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!pay) throw new Error("Pagamento não encontrado");
    const { data: est } = pay.establishment_id
      ? await supabaseAdmin.from("establishments").select("id, name, slug, plan").eq("id", pay.establishment_id).maybeSingle()
      : { data: null };
    const { data: sub } = pay.subscription_id
      ? await supabaseAdmin.from("subscriptions").select("id, status, plan_slug, current_period_start, current_period_end").eq("id", pay.subscription_id).maybeSingle()
      : { data: null };
    const mpKey = pay.mp_payment_id ?? pay.provider_payment_id ?? null;
    const { data: logs } = mpKey
      ? await supabaseAdmin.from("payment_logs")
          .select("id, created_at, event_type, action, mp_id, response_status, signature_valid, processed, reason, error, mode, live_mode, provider")
          .eq("mp_id", String(mpKey)).order("created_at", { ascending: false }).limit(50)
      : { data: [] as any[] };
    return { payment: pay, establishment: est, subscription: sub, logs: logs ?? [] };
  });

// ─────────────── Users (system-wide) ───────────────
export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    query: z.string().trim().default(""),
    account_type: z.enum(["all", "customer", "establishment", "super_admin"]).default("all"),
    establishment_id: z.string().uuid().optional().nullable(),
    status: z.enum(["all", "with_wallet", "no_activity", "active_member", "onboarding_pending"]).default("all"),
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(20),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pre-filter user_ids when establishment_id is set
    let restrictIds: string[] | null = null;
    if (data.establishment_id) {
      const { data: mems } = await supabaseAdmin
        .from("establishment_members")
        .select("user_id")
        .eq("establishment_id", data.establishment_id);
      restrictIds = Array.from(new Set((mems ?? []).map((m: any) => m.user_id).filter(Boolean)));
      if (!restrictIds.length) return { users: [], total: 0, page: data.page, page_size: data.page_size };
    }

    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;

    let q = supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, avatar_url, account_type, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.account_type !== "all") q = q.eq("account_type", data.account_type);
    if (restrictIds) q = q.in("id", restrictIds);
    if (data.query) {
      const like = `%${data.query}%`;
      q = q.or(`full_name.ilike.${like},phone.ilike.${like}`);
    }

    const { data: profiles, count, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    let emails: Record<string, string> = {};
    let memberships: Record<string, Array<{ establishment_id: string; role: string; active: boolean; name: string | null }>> = {};
    let roles: Record<string, string[]> = {};
    let walletCounts: Record<string, number> = {};

    if (ids.length) {
      const results = await Promise.all(
        ids.map((id) => supabaseAdmin.auth.admin.getUserById(id).then((r) => ({ id, email: r.data.user?.email ?? null })).catch(() => ({ id, email: null })))
      );
      emails = Object.fromEntries(results.map((r) => [r.id, r.email ?? ""]));

      const [{ data: mems }, { data: appRoles }, { data: cust }] = await Promise.all([
        supabaseAdmin.from("establishment_members").select("user_id, establishment_id, role, active, establishments!inner(name)").in("user_id", ids),
        supabaseAdmin.from("app_roles").select("user_id, role").in("user_id", ids),
        supabaseAdmin.from("customers").select("id, user_id").in("user_id", ids),
      ]);
      for (const m of (mems ?? []) as Array<{ user_id: string; establishment_id: string; role: string; active: boolean; establishments: { name: string | null } | null }>) {
        (memberships[m.user_id] ??= []).push({
          establishment_id: m.establishment_id,
          role: m.role, active: m.active,
          name: m.establishments?.name ?? null,
        });
      }
      for (const r of (appRoles ?? []) as Array<{ user_id: string; role: string }>) {
        (roles[r.user_id] ??= []).push(r.role);
      }

      const custByUser = new Map<string, string[]>();
      for (const c of (cust ?? []) as Array<{ id: string; user_id: string | null }>) {
        if (c.user_id) {
          const arr = custByUser.get(c.user_id) ?? [];
          arr.push(c.id);
          custByUser.set(c.user_id, arr);
        }
      }
      const custIds = Array.from(custByUser.values()).flat();
      if (custIds.length) {
        const { data: cards } = await supabaseAdmin.from("loyalty_cards").select("customer_id").in("customer_id", custIds);
        const cardByCust = new Set((cards ?? []).map((c: any) => c.customer_id));
        for (const [uid, cs] of custByUser.entries()) {
          walletCounts[uid] = cs.filter((id) => cardByCust.has(id)).length;
        }
      }
    }

    function deriveStatus(p: { id: string; account_type: string }): {
      code: "with_wallet" | "no_activity" | "active_member" | "onboarding_pending" | "admin";
      label: string;
    } {
      if (p.account_type === "super_admin") return { code: "admin", label: "Super admin" };
      if (p.account_type === "establishment") {
        const hasActive = (memberships[p.id] ?? []).some((m) => m.active);
        return hasActive
          ? { code: "active_member", label: "Estabelecimento ativo" }
          : { code: "onboarding_pending", label: "Onboarding pendente" };
      }
      return (walletCounts[p.id] ?? 0) > 0
        ? { code: "with_wallet", label: "Carteira ativa" }
        : { code: "no_activity", label: "Login sem atividade" };
    }

    const enriched = (profiles ?? []).map((p) => {
      const st = deriveStatus(p);
      return {
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        avatar_url: p.avatar_url,
        account_type: p.account_type as "customer" | "establishment" | "super_admin",
        created_at: p.created_at,
        email: emails[p.id] ?? "",
        memberships: memberships[p.id] ?? [],
        app_roles: roles[p.id] ?? [],
        status: st.code,
        status_label: st.label,
      };
    });

    const users = data.status === "all" ? enriched : enriched.filter((u) => u.status === data.status);

    return { users, total: data.status === "all" ? (count ?? 0) : users.length, page: data.page, page_size: data.page_size };
  });

export const adminSetUserAccountType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    account_type: z.enum(["customer", "establishment", "super_admin"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    if (data.user_id === userId && data.account_type !== "super_admin") {
      throw new Error("Você não pode remover seu próprio acesso de super administrador.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // read current state
    const { data: prev, error: eR } = await supabaseAdmin
      .from("profiles").select("account_type").eq("id", data.user_id).single();
    if (eR) throw new Error(eR.message);
    const previous = prev?.account_type as string | null;

    // profile account_type
    const { error: eU } = await supabaseAdmin
      .from("profiles").update({ account_type: data.account_type }).eq("id", data.user_id);
    if (eU) throw new Error(eU.message);

    // when converting AWAY from establishment, deactivate memberships
    if (data.account_type !== "establishment") {
      await supabaseAdmin
        .from("establishment_members")
        .update({ active: false })
        .eq("user_id", data.user_id)
        .eq("active", true);
    }

    // super_admin role sync
    if (data.account_type === "super_admin") {
      await supabaseAdmin.from("app_roles")
        .upsert({ user_id: data.user_id, role: "super_admin" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("app_roles")
        .delete().eq("user_id", data.user_id).eq("role", "super_admin");
    }

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "admin_set_user_account_type",
      entity_type: "user",
      entity_id: data.user_id,
      metadata: { from: previous, to: data.account_type } as never,
    });

    return { ok: true, from: previous, to: data.account_type };
  });

export const adminListOrphanCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      query: z.string().optional().default(""),
      establishment_id: z.string().uuid().optional().nullable(),
      page: z.number().int().min(1).default(1),
      page_size: z.number().int().min(1).max(100).default(20),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;

    let q = supabaseAdmin
      .from("customers")
      .select("id, name, phone, email, establishment_id, visits_count, last_visit_at, created_at, establishments(name)", { count: "exact" })
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.establishment_id) q = q.eq("establishment_id", data.establishment_id);
    if (data.query.trim()) {
      const term = `%${data.query.trim()}%`;
      q = q.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
    }

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    return {
      customers: (rows ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        establishment_id: r.establishment_id,
        establishment_name: r.establishments?.name ?? null,
        visits_count: r.visits_count ?? 0,
        last_visit_at: r.last_visit_at,
        created_at: r.created_at,
      })),
      total: count ?? 0,
    };
  });

/**
 * Cria (ou reaproveita) uma conta de login para um cliente órfão
 * usando as credenciais sintéticas do fluxo /carteira (WhatsApp = PIN).
 * Retorna e-mail sintético + senha para o admin repassar ao cliente.
 */
export const adminLinkOrphanCustomerToAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ customer_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cust, error: cErr } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone, email, user_id, establishment_id")
      .eq("id", data.customer_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cust) throw new Error("Cliente não encontrado.");
    if (cust.user_id) throw new Error("Este cliente já possui conta de login.");
    const digits = String(cust.phone ?? "").replace(/\D/g, "");
    if (digits.length < 10) throw new Error("Cliente sem WhatsApp válido (DDD + número).");

    const syntheticEmail = `wa${digits}@carteira.fidelize.app`;
    const syntheticPassword = `wa_${digits}_fidelize_v1`;

    // Reaproveita usuário existente com o mesmo WhatsApp, se houver
    let targetUserId: string | null = null;
    {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone", cust.phone ?? "")
        .maybeSingle();
      if (existing?.id) targetUserId = existing.id;
    }
    let createdNow = false;
    if (!targetUserId) {
      const { data: created, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: { full_name: cust.name ?? "", phone: cust.phone ?? "", whatsapp: cust.phone ?? "" },
      });
      if (uErr || !created?.user?.id) throw new Error(uErr?.message ?? "Falha ao criar login.");
      targetUserId = created.user.id;
      createdNow = true;
    }

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: targetUserId,
        full_name: cust.name ?? "",
        phone: cust.phone ?? "",
        account_type: "customer",
      }, { onConflict: "id" });
    if (pErr) throw new Error(pErr.message);

    const { error: linkErr } = await supabaseAdmin
      .from("customers")
      .update({ user_id: targetUserId })
      .eq("id", cust.id);
    if (linkErr) throw new Error(linkErr.message);

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "admin_link_orphan_customer",
      entity_type: "customer",
      entity_id: cust.id,
      metadata: { user_id: targetUserId, created_new_user: createdNow, establishment_id: cust.establishment_id } as never,
    });

    return {
      ok: true,
      user_id: targetUserId,
      created_new_user: createdNow,
      credentials: { email: syntheticEmail, password: syntheticPassword },
    };
  });

/**
 * Move (vincula) um cliente órfão — sem conta de login — para outro
 * estabelecimento cadastrado. Só permite se o cliente ainda não possui
 * user_id (senão o vínculo passa pelo fluxo multi-loja do /carteira).
 * Remove cartões antigos ligados a campanhas de outros estabelecimentos
 * para evitar registros órfãos.
 */
export const adminReassignOrphanCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      customer_id: z.string().uuid(),
      target_establishment_id: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cust, error: cErr } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone, user_id, establishment_id")
      .eq("id", data.customer_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cust) throw new Error("Cliente não encontrado.");
    if (cust.user_id) {
      throw new Error("Cliente já possui conta de login. Use o fluxo de multi-loja em vez de mover.");
    }
    if (cust.establishment_id === data.target_establishment_id) {
      throw new Error("O cliente já pertence a este estabelecimento.");
    }

    const { data: target, error: tErr } = await supabaseAdmin
      .from("establishments")
      .select("id, name, active")
      .eq("id", data.target_establishment_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!target) throw new Error("Estabelecimento de destino não encontrado.");
    if (!target.active) throw new Error("Estabelecimento de destino está inativo.");

    // Evita conflito com o UNIQUE (establishment_id, phone) do destino.
    if (cust.phone) {
      const { data: clash } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("establishment_id", data.target_establishment_id)
        .eq("phone", cust.phone)
        .maybeSingle();
      if (clash?.id) {
        throw new Error("Já existe um cliente com este WhatsApp no estabelecimento de destino.");
      }
    }

    // Limpa cartões antigos ligados a campanhas do estabelecimento anterior.
    const { data: oldCards } = await supabaseAdmin
      .from("loyalty_cards")
      .select("id, campaign:campaigns!inner(establishment_id)")
      .eq("customer_id", cust.id);
    const staleIds = (oldCards ?? [])
      .filter((c: any) => c.campaign?.establishment_id !== data.target_establishment_id)
      .map((c: any) => c.id);
    if (staleIds.length) {
      await supabaseAdmin.from("loyalty_cards").delete().in("id", staleIds);
    }

    const { error: uErr } = await supabaseAdmin
      .from("customers")
      .update({ establishment_id: data.target_establishment_id })
      .eq("id", cust.id);
    if (uErr) throw new Error(uErr.message);

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "admin_reassign_orphan_customer",
      entity_type: "customer",
      entity_id: cust.id,
      metadata: {
        from_establishment_id: cust.establishment_id,
        to_establishment_id: data.target_establishment_id,
        to_establishment_name: target.name,
        removed_cards: staleIds.length,
      } as never,
    });

    return { ok: true, moved_to: target.name, removed_cards: staleIds.length };
  });


/**
 * Retorna toda a carteira de um usuário (cliente final) para inspeção pelo
 * super admin: estabelecimentos vinculados, progresso do cartão em cada um
 * e os últimos carimbos recebidos.
 */
export const adminGetUserWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, account_type, created_at")
      .eq("id", data.user_id)
      .maybeSingle();

    const { data: rows, error } = await supabaseAdmin
      .from("customers")
      .select(
        `id, name, code, access_token, phone, email, visits_count, last_visit_at, tier, created_at,
         establishment:establishments!inner(
           id, slug, name, logo_url, primary_color, active
         )`,
      )
      .eq("user_id", data.user_id)
      .order("last_visit_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    const customerIds = (rows ?? []).map((r: any) => r.id);
    if (!customerIds.length) {
      return { profile: profile ?? null, items: [], recentStamps: [] as any[] };
    }

    const { data: cards } = await supabaseAdmin
      .from("loyalty_cards")
      .select(
        `id, customer_id, stamps, cycle, updated_at, created_at,
         campaign:campaigns!inner(
           id, name, stamps_required, reward_title, reward_description,
           active, stamp_icon, primary_color, accent_color
         )`,
      )
      .in("customer_id", customerIds);

    const cardIds = (cards ?? []).map((c: any) => c.id);
    const { data: stamps } = cardIds.length
      ? await supabaseAdmin
          .from("stamps")
          .select("id, card_id, created_at, reverted_at, note")
          .in("card_id", cardIds)
          .order("created_at", { ascending: false })
          .limit(80)
      : { data: [] as any[] };

    const items = (rows ?? []).map((r: any) => {
      const myCards = (cards ?? []).filter((c: any) => c.customer_id === r.id);
      const best =
        myCards
          .filter((c: any) => (c.campaign as { active: boolean }).active)
          .sort((a: any, b: any) => {
            const aReq = (a.campaign as { stamps_required: number }).stamps_required || 1;
            const bReq = (b.campaign as { stamps_required: number }).stamps_required || 1;
            return b.stamps / bReq - a.stamps / aReq;
          })[0] ?? myCards[0];

      const totalStamps = myCards.reduce(
        (acc: number, c: any) => acc + ((c.cycle ?? 0) * ((c.campaign as any).stamps_required ?? 0) + (c.stamps ?? 0)),
        0,
      );

      return {
        customer: {
          id: r.id,
          name: r.name,
          code: r.code,
          token: r.access_token,
          phone: r.phone,
          email: r.email,
          lastVisitAt: r.last_visit_at,
          visitsCount: r.visits_count,
          tier: r.tier,
          createdAt: r.created_at,
        },
        establishment: r.establishment,
        card: best
          ? {
              id: best.id,
              stamps: best.stamps,
              cycle: best.cycle,
              updatedAt: best.updated_at,
              campaign: best.campaign,
            }
          : null,
        cardsCount: myCards.length,
        totalStamps,
      };
    });

    const custMap = new Map(items.map((i) => [i.customer.id, i.establishment]));
    const cardCustomer = new Map((cards ?? []).map((c: any) => [c.id, c.customer_id]));

    const recentStamps = (stamps ?? []).map((s: any) => {
      const custId = cardCustomer.get(s.card_id) ?? null;
      const est = custId ? custMap.get(custId) : null;
      return {
        id: s.id,
        cardId: s.card_id,
        createdAt: s.created_at,
        revertedAt: s.reverted_at,
        note: s.note ?? null,
        establishment: est,
      };
    });

    return { profile: profile ?? null, items, recentStamps };
  });
