import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Types ----------
export type PlanRow = {
  id: string;
  tier: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number | null;
  price_yearly: number | null;
  currency: string;
  customer_limit: number | null;
  employee_limit: number | null;
  campaign_limit: number | null;
  unit_limit: number | null;
  stamp_limit: number | null;
  email_limit: number | null;
  storage_limit_mb: number | null;
  ticket_limit: number | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  trial_days: number;
  button_text: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanFeature = {
  id: string;
  plan_id: string;
  feature_key: string;
  feature_name: string;
  enabled: boolean;
  limit_value: number | null;
};

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("app_roles").select("id").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores da plataforma.");
}

// ---------- Public: list active plans (marketing + merchant view) ----------
export const listActivePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: plans, error } = await supabase.from("plans")
      .select("*").eq("is_active", true).order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (plans ?? []).map((p: any) => p.id);
    const { data: features } = ids.length
      ? await supabase.from("plan_features").select("*").in("plan_id", ids).eq("enabled", true)
      : { data: [] as PlanFeature[] };
    const byPlan = new Map<string, PlanFeature[]>();
    for (const f of (features ?? []) as PlanFeature[]) {
      const arr = byPlan.get(f.plan_id) ?? [];
      arr.push(f);
      byPlan.set(f.plan_id, arr);
    }
    return (plans as PlanRow[]).map(p => ({ ...p, features: byPlan.get(p.id) ?? [] }));
  });

// ---------- Admin: list ALL plans ----------
export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: plans, error } = await context.supabase.from("plans")
      .select("*").order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (plans ?? []).map((p: any) => p.id);
    const { data: features } = ids.length
      ? await context.supabase.from("plan_features").select("*").in("plan_id", ids)
      : { data: [] as PlanFeature[] };
    const byPlan = new Map<string, PlanFeature[]>();
    for (const f of (features ?? []) as PlanFeature[]) {
      const arr = byPlan.get(f.plan_id) ?? [];
      arr.push(f);
      byPlan.set(f.plan_id, arr);
    }
    // count subscribers per tier
    const { data: subs } = await context.supabase.from("establishments").select("plan");
    const subsByTier = new Map<string, number>();
    for (const s of subs ?? []) {
      subsByTier.set(s.plan, (subsByTier.get(s.plan) ?? 0) + 1);
    }
    return (plans as PlanRow[]).map(p => ({
      ...p,
      features: byPlan.get(p.id) ?? [],
      subscribers: subsByTier.get(p.tier) ?? 0,
    }));
  });

// ---------- Admin: update plan basic fields ----------
const planUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(80),
  description: z.string().max(400).nullable().optional(),
  price_monthly: z.number().min(0).nullable().optional(),
  price_yearly: z.number().min(0).nullable().optional(),
  customer_limit: z.number().int().min(0).nullable().optional(),
  employee_limit: z.number().int().min(0).nullable().optional(),
  campaign_limit: z.number().int().min(0).nullable().optional(),
  is_featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  button_text: z.string().max(40).nullable().optional(),
  trial_days: z.number().int().min(0).max(365).optional(),
});

export const adminUpdatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { id, ...patch } = data;
    // strip undefined; keep nulls (except for price_monthly which is non-null in schema)
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (k === "price_monthly" && v === null) continue;
      clean[k] = v;
    }
    const { data: upd, error } = await context.supabase.from("plans")
      .update(clean as any).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return upd;
  });

// ---------- Admin: toggle a feature on a plan ----------
export const adminToggleFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    plan_id: z.string().uuid(),
    feature_key: z.string().min(1).max(60),
    feature_name: z.string().min(1).max(120),
    enabled: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: prev } = await context.supabase.from("plan_features")
      .select("enabled").eq("plan_id", data.plan_id).eq("feature_key", data.feature_key).maybeSingle();
    const previous = prev?.enabled ?? null;
    const { data: upsert, error } = await context.supabase.from("plan_features")
      .upsert({
        plan_id: data.plan_id,
        feature_key: data.feature_key,
        feature_name: data.feature_name,
        enabled: data.enabled,
      }, { onConflict: "plan_id,feature_key" })
      .select("*").single();
    if (error) throw new Error(error.message);
    // Audit log (global — no establishment_id)
    const { data: planRow } = await context.supabase.from("plans")
      .select("tier, name").eq("id", data.plan_id).maybeSingle();
    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      action: data.enabled ? "plan_feature_enable" : "plan_feature_disable",
      entity_type: "plan_feature",
      entity_id: data.plan_id,
      metadata: {
        plan_id: data.plan_id,
        plan_tier: planRow?.tier ?? null,
        plan_name: planRow?.name ?? null,
        feature_key: data.feature_key,
        feature_name: data.feature_name,
        previous_enabled: previous,
        new_enabled: data.enabled,
      } as never,
    });
    return upsert;
  });

// ---------- Admin: update a plan feature's numeric limit ----------
export const adminUpdateFeatureLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    plan_id: z.string().uuid(),
    feature_key: z.string().min(1).max(60),
    feature_name: z.string().min(1).max(120),
    limit_value: z.number().int().min(0).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: prev } = await context.supabase.from("plan_features")
      .select("enabled, limit_value").eq("plan_id", data.plan_id).eq("feature_key", data.feature_key).maybeSingle();
    const { data: upsert, error } = await context.supabase.from("plan_features")
      .upsert({
        plan_id: data.plan_id,
        feature_key: data.feature_key,
        feature_name: data.feature_name,
        enabled: prev?.enabled ?? true,
        limit_value: data.limit_value,
      }, { onConflict: "plan_id,feature_key" })
      .select("*").single();
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({
      user_id: context.userId,
      action: "plan_feature_limit_update",
      entity_type: "plan_feature",
      entity_id: data.plan_id,
      metadata: {
        plan_id: data.plan_id,
        feature_key: data.feature_key,
        previous_limit: prev?.limit_value ?? null,
        new_limit: data.limit_value,
      } as never,
    });
    return upsert;
  });

// Preview impact of toggling a plan feature (count of establishments on that tier)
export const adminPlanFeatureImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    plan_id: z.string().uuid(),
    feature_key: z.string().min(1).max(60),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: plan } = await context.supabase.from("plans")
      .select("id, tier, name").eq("id", data.plan_id).maybeSingle();
    if (!plan) throw new Error("Plano não encontrado.");
    const { count } = await context.supabase.from("establishments")
      .select("id", { count: "exact", head: true }).eq("plan", plan.tier);
    const { data: current } = await context.supabase.from("plan_features")
      .select("enabled").eq("plan_id", data.plan_id).eq("feature_key", data.feature_key).maybeSingle();
    return {
      plan_tier: plan.tier,
      plan_name: plan.name,
      establishments_count: count ?? 0,
      currently_enabled: current?.enabled ?? false,
    };
  });

// ---------- Merchant: change plan (upgrade / downgrade) ----------
const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3, business: 4 };

export const changeEstablishmentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan_slug: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only owner can change billing plans
    const { data: role } = await supabase.from("establishment_members")
      .select("role").eq("establishment_id", data.establishment_id).eq("user_id", userId).maybeSingle();
    if (!role || role.role !== "owner") throw new Error("Apenas o dono da empresa pode alterar o plano.");

    const { data: est } = await supabase.from("establishments")
      .select("id, name, plan").eq("id", data.establishment_id).maybeSingle();
    if (!est) throw new Error("Empresa não encontrada.");

    const { data: newPlan } = await supabase.from("plans")
      .select("id, tier, slug, name, price_monthly, is_active, archived_at")
      .eq("slug", data.plan_slug).maybeSingle();
    if (!newPlan || !newPlan.is_active || newPlan.archived_at) throw new Error("Plano indisponível.");

    const fromTier: string = est.plan;
    const toTier: string = newPlan.tier;
    if (fromTier === toTier) {
      return { ok: true, unchanged: true, tier: toTier as any, kind: "same" as const };
    }

    const fromRank = PLAN_RANK[fromTier] ?? 0;
    const toRank = PLAN_RANK[toTier] ?? 0;
    const kind: "upgrade" | "downgrade" | "plan_change" =
      toRank > fromRank ? "upgrade" : toRank < fromRank ? "downgrade" : "plan_change";

    // 🔒 Regra de cobrança: esta função só aplica downgrades (ou mudanças para planos
    // gratuitos). Qualquer plano pago só pode ser ativado pelo webhook do provedor
    // depois do pagamento confirmado — senão qualquer dono poderia se auto-promover.
    const price = Number(newPlan.price_monthly ?? 0);
    if (price > 0 && kind !== "downgrade") {
      throw new Error("Planos pagos são ativados apenas após a confirmação do pagamento. Use o checkout na página de planos.");
    }

    // Snapshot feature availability BEFORE the change so we can detect unlocks after it.
    const reviewsBefore = await hasFeature(supabase, data.establishment_id, "public_reviews");

    // 1) Update establishment plan (trigger tg_establishment_subscription_events logs a subscription_events row automatically with actor_id = auth.uid())
    const { error: updErr } = await supabase.from("establishments")
      .update({ plan: toTier as any }).eq("id", data.establishment_id);
    if (updErr) throw new Error(updErr.message);

    // 2) Upsert current subscription row (subscriptions table). RLS only exposes SELECT to members, so we use the admin client after ownership was verified above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();

    const { data: existingSub } = await supabaseAdmin.from("subscriptions")
      .select("id, provider, current_period_start, current_period_end").eq("establishment_id", data.establishment_id).maybeSingle();

    // Downgrade nunca cria período pago novo: preserva a vigência atual.
    const periodStart = existingSub?.current_period_start ?? now.toISOString();
    const periodEnd = existingSub?.current_period_end ?? null;
    const nextStatus = price > 0 ? "active" : "cancelled";

    if (existingSub) {
      await supabaseAdmin.from("subscriptions").update({
        plan_id: newPlan.id,
        tier: toTier as any,
        status: nextStatus,
        provider: existingSub.provider ?? "manual",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: price === 0,
        metadata: { last_change_by: userId, last_change_kind: kind, last_change_at: now.toISOString() } as never,
      }).eq("id", existingSub.id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        establishment_id: data.establishment_id,
        plan_id: newPlan.id,
        tier: toTier as any,
        status: nextStatus,
        provider: "manual",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: price === 0,
        metadata: { created_by: userId, created_kind: kind } as never,
      });
    }


    // 3) Enrich the subscription_events row the trigger just wrote (add human message + actor for audit clarity).
    // Trigger message is generic; we replace with an intent-rich one when possible.
    const nice = `${kind === "upgrade" ? "Upgrade" : kind === "downgrade" ? "Downgrade" : "Alteração"} de plano: ${fromTier} → ${toTier} realizado pelo dono da empresa.`;
    await supabaseAdmin.from("subscription_events")
      .update({ message: nice, actor_id: userId })
      .eq("establishment_id", data.establishment_id)
      .eq("from_plan", fromTier)
      .eq("to_plan", toTier)
      .is("acknowledged_at", null)
      .gte("created_at", new Date(now.getTime() - 60_000).toISOString());

    // 4) Audit log
    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id,
      user_id: userId,
      action: kind === "upgrade" ? "plan_upgrade" : kind === "downgrade" ? "plan_downgrade" : "plan_change",
      entity_type: "subscription",
      entity_id: data.establishment_id,
      metadata: { from_plan: fromTier, to_plan: toTier, plan_id: newPlan.id, plan_name: newPlan.name } as never,
    });

    // 4.1) Sincronização de ciclo de vida com o parceiro de origem (ex.: Ronnei)
    {
      const { safeNotifyOriginPartner } = await import("@/lib/integrations/lifecycle-sync.server");
      await safeNotifyOriginPartner({
        tenantId: data.establishment_id,
        event:
          kind === "upgrade" ? "subscription.upgraded"
          : kind === "downgrade" ? "subscription.downgraded"
          : "subscription.changed",
        fromPlan: fromTier,
        toPlan: toTier,
        actorUserId: userId,
        origin: "app",
      });
    }


    // 5) Feature-unlock notifications (e.g. Avaliações públicas)
    try {
      const reviewsAfter = await hasFeature(supabase, data.establishment_id, "public_reviews");
      if (!reviewsBefore && reviewsAfter) {
        const { data: estFull } = await supabaseAdmin.from("establishments")
          .select("name, slug").eq("id", data.establishment_id).maybeSingle();
        const { data: ownerRow } = await supabaseAdmin.from("establishment_members")
          .select("user_id").eq("establishment_id", data.establishment_id)
          .eq("role", "owner").eq("active", true).limit(1).maybeSingle();
        if (ownerRow?.user_id && estFull) {
          const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(ownerRow.user_id);
          const email = ownerUser?.user?.email;
          if (email) {
            const { data: profile } = await supabaseAdmin.from("profiles")
              .select("full_name").eq("id", ownerRow.user_id).maybeSingle();
            const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "https://app.fidelize.com.br";
            const { sendTemplateEmail } = await import("./email.server");
            await sendTemplateEmail({
              to: email,
              template: "reviews_feature_unlocked",
              variables: {
                owner_name: profile?.full_name ?? "",
                establishment_name: estFull.name,
                plan_name: newPlan.name,
                public_review_url: `${appUrl}/avaliar/${estFull.slug}`,
                app_reviews_url: `${appUrl}/app/avaliacoes`,
              },
              actor_id: userId,
              establishment_id: data.establishment_id,
            }).catch(() => {/* swallow – não bloqueia o upgrade */});
          }
        }
      }
    } catch { /* não bloqueia o upgrade */ }

    return { ok: true, tier: toTier as any, kind, from: fromTier, to: toTier, plan_name: newPlan.name };
  });


// ---------- Feature gating (backend) ----------
export async function hasFeature(
  supabase: any,
  establishmentId: string,
  featureKey: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_plan_feature", {
    _est: establishmentId,
    _feature: featureKey,
  });

  if (error) {
    console.error("[hasFeature] entitlement lookup failed", {
      code: error.code,
      message: error.message,
      establishmentId,
      featureKey,
    });

    throw new Error("FEATURE_CHECK_FAILED");
  }

  return data === true;
}


const FEATURE_LABELS: Record<string, string> = {
  customer_import: "Importação de clientes (CSV)",
  customer_export: "Exportação de clientes",
  csv_pdf_export: "Exportação CSV / PDF",
  auto_campaigns: "Campanhas automáticas",
  advanced_reports: "Relatórios avançados",
  api: "Acesso à API",
  webhooks: "Webhooks",
  custom_branding: "Personalização de marca",
  remove_branding: "Remover marca Fidelize",

  custom_stamp_icons: "Ícones de carimbo personalizados",
  multi_units: "Múltiplas unidades",
  email_marketing: "E-mail marketing",
  whatsapp_notifications: "Notificações via WhatsApp",
  qr_generator: "Gerador de QR Code / material impresso",
  public_reviews: "Avaliações públicas de atendimento (QR + página)",
};

export async function assertFeature(supabase: any, establishmentId: string, featureKey: string) {
  const ok = await hasFeature(supabase, establishmentId, featureKey);
  if (!ok) {
    throw new Error(`Este recurso não está disponível para este estabelecimento. Faça upgrade do plano ou solicite uma liberação administrativa.`);
  }
}


// Client-callable feature check (used to hide/disable UI)
export const checkMyFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        feature_key: z.string().min(1).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Multi-tenant check: user must belong to establishment or be super admin
    const { data: member, error: memberError } = await supabase
      .from("establishment_members")
      .select("id")
      .eq("establishment_id", data.establishment_id)
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();

    if (memberError) {
      console.error("[checkMyFeature] membership lookup failed", {
        code: memberError.code,
        message: memberError.message,
        establishmentId: data.establishment_id,
        userId,
      });
      throw new Error("FEATURE_CHECK_FAILED");
    }

    if (!member) {
      const { data: admin, error: adminError } = await supabase.rpc(
        "is_super_admin",
        { _user: userId },
      );
      if (adminError) {
        console.error("[checkMyFeature] is_super_admin lookup failed", {
          code: adminError.code,
          message: adminError.message,
          userId,
        });
        throw new Error("FEATURE_CHECK_FAILED");
      }
      if (!admin) throw new Error("FORBIDDEN");
    }

    const ok = await hasFeature(supabase, data.establishment_id, data.feature_key);

    const { data: viaPlan, error: viaPlanError } = await supabase.rpc(
      "has_plan_feature_strict",
      {
        _est: data.establishment_id,
        _feature: data.feature_key,
      },
    );

    if (viaPlanError) {
      console.error("[checkMyFeature] strict plan lookup failed", {
        code: viaPlanError.code,
        message: viaPlanError.message,
        establishmentId: data.establishment_id,
        featureKey: data.feature_key,
      });
      throw new Error("FEATURE_CHECK_FAILED");
    }

    return {
      allowed: ok,
      feature_key: data.feature_key,
      via_plan: !!viaPlan,
      via_override: ok && !viaPlan,
    };
  });




// ---------- Usage vs limits ----------
export const getMyPlanUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: est } = await supabase.from("establishments").select("plan").eq("id", data.establishment_id).maybeSingle();
    if (!est) throw new Error("Empresa não encontrada.");
    const { data: plan } = await supabase.from("plans").select("*").eq("tier", est.plan).maybeSingle();
    const [{ count: customers }, { count: campaigns }, { count: employees }] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("establishment_id", data.establishment_id),
      supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("establishment_id", data.establishment_id),
      supabase.from("establishment_members").select("id", { count: "exact", head: true }).eq("establishment_id", data.establishment_id).eq("active", true),
    ]);
    return {
      plan: plan as PlanRow | null,
      usage: {
        customers: customers ?? 0,
        campaigns: campaigns ?? 0,
        employees: employees ?? 0,
      },
    };
  });

// ---------- Internal helper: enforce a limit ----------
// Not a server fn — imported by other server fns (loyalty.functions.ts).
export async function enforceLimit(
  supabase: any,
  establishmentId: string,
  kind: "customers" | "campaigns" | "employees",
  incrementBy = 1,
) {
  const { data: est } = await supabase.from("establishments").select("plan").eq("id", establishmentId).maybeSingle();
  if (!est) throw new Error("Empresa não encontrada.");
  const { data: plan } = await supabase.from("plans").select("customer_limit, campaign_limit, employee_limit, name").eq("tier", est.plan).maybeSingle();
  if (!plan) return; // no plan row → don't block
  const table = kind === "customers" ? "customers" : kind === "campaigns" ? "campaigns" : "establishment_members";
  const limit = kind === "customers" ? plan.customer_limit : kind === "campaigns" ? plan.campaign_limit : plan.employee_limit;
  if (limit === null || limit === undefined) return; // ilimitado
  let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId);
  if (table === "establishment_members") query = query.eq("active", true);
  const { count } = await query;
  const current = count ?? 0;
  if (current + incrementBy > limit) {
    const label = kind === "customers" ? "clientes" : kind === "campaigns" ? "campanhas" : "funcionários";
    throw new Error(`Limite do plano ${plan.name} atingido: ${limit} ${label}. Faça upgrade para adicionar mais.`);
  }
}

// ---------- Super Admin: reconcile/repair feature reads across the platform ----------
// Cross-checks each establishment's plan against plan_features and returns
// authoritative access map + optionally emits a broadcast that forces the
// merchant client (see src/routes/_authenticated/app.tsx) to refetch.
export const adminReconcileFeatureAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    feature_key: z.string().min(1).max(60),
    dry_run: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabase } = context;

    // 1. Read all plans + feature enablement
    const { data: plans, error: pErr } = await supabase.from("plans").select("id, tier, name");
    if (pErr) throw new Error(pErr.message);
    const { data: pf, error: fErr } = await supabase.from("plan_features")
      .select("plan_id, feature_key, enabled").eq("feature_key", data.feature_key);
    if (fErr) throw new Error(fErr.message);
    const enabledByTier = new Map<string, boolean>();
    for (const p of plans ?? []) {
      const row = (pf ?? []).find((x: any) => x.plan_id === p.id);
      enabledByTier.set(p.tier, !!row?.enabled);
    }

    // 2. All establishments and their plan tier
    const { data: ests, error: eErr } = await supabase.from("establishments")
      .select("id, name, slug, plan, active");
    if (eErr) throw new Error(eErr.message);

    const knownTiers = new Set((plans ?? []).map((p: any) => p.tier));
    const missingPlanFeatureTiers = (plans ?? [])
      .filter((p: any) => !(pf ?? []).some((x: any) => x.plan_id === p.id))
      .map((p: any) => p.tier);

    // Divergence detection — surfaces cases the naïve mapping would silently
    // fail closed on. Two categories:
    //   • orphan_tier: establishment.plan does not match any row in `plans`.
    //     Would be treated as blocked forever, even for paying tiers.
    //   • missing_plan_feature_row: the tier exists but plan_features has no
    //     row for this feature_key, so `has_plan_feature` returns false even
    //     when the intent is "enabled". Repair inserts the row explicitly.
    const rows = (ests ?? []).map((e: any) => {
      const divergence =
        !knownTiers.has(e.plan)
          ? "orphan_tier"
          : missingPlanFeatureTiers.includes(e.plan)
            ? "missing_plan_feature_row"
            : null;
      return {
        id: e.id,
        name: e.name,
        slug: e.slug,
        plan_tier: e.plan,
        active: e.active,
        feature_allowed: enabledByTier.get(e.plan) ?? false,
        divergence,
      };
    });

    const divergences = rows.filter((r) => r.divergence);

    // Broadcast a NOTIFY-like signal via realtime channel so merchant
    // clients invalidate their cache immediately (non-persistent).
    // Even in dry_run we broadcast, since it only refreshes reads.
    try {
      const channel = supabase.channel(`feature-reconcile-${data.feature_key}`);
      await channel.subscribe();
      await channel.send({
        type: "broadcast",
        event: "reconcile",
        payload: { feature_key: data.feature_key, ts: new Date().toISOString() },
      });
      await supabase.removeChannel(channel);
    } catch {
      // realtime not required for correctness — the postgres_changes on
      // plan_features already refreshes clients when we touch the row below.
    }

    let repaired = 0;
    if (!data.dry_run) {
      // Touch every plan_features row for this feature to force a postgres_changes
      // event to every merchant subscriber, guaranteeing UI + cache sync.
      for (const p of plans ?? []) {
        const cur = (pf ?? []).find((x: any) => x.plan_id === p.id);
        const enabled = cur?.enabled ?? false;
        const { error: upErr } = await supabase.from("plan_features").upsert({
          plan_id: p.id,
          feature_key: data.feature_key,
          feature_name: data.feature_key === "public_reviews" ? "Avaliações públicas de atendimento (QR + página)" : data.feature_key,
          enabled,
        }, { onConflict: "plan_id,feature_key" });
        if (!upErr) repaired += 1;
      }
      // Audit
      await supabase.from("audit_logs").insert({
        user_id: context.userId,
        action: "feature_reconcile",
        entity_type: "plan_feature",
        entity_id: null,
        metadata: {
          feature_key: data.feature_key,
          plans_touched: repaired,
          establishments_scanned: rows.length,
          divergences_before_repair: divergences.length,
        } as never,
      });
    }

    return {
      feature_key: data.feature_key,
      dry_run: data.dry_run,
      plans_summary: Array.from(enabledByTier.entries()).map(([tier, enabled]) => ({ tier, enabled })),
      establishments: rows,
      divergences,
      divergence_count: divergences.length,
      total_allowed: rows.filter((r) => r.feature_allowed).length,
      total_blocked: rows.filter((r) => !r.feature_allowed).length,
      repaired_rows: repaired,
    };
  });
