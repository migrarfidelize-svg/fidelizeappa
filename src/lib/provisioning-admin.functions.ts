import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/admin.functions";

type AuditRow = {
  id: string;
  action: string;
  entity_id: string | null;
  establishment_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

/** Painel Admin > Provisionamentos: contas criadas via API e seu ciclo de vida. */
export const adminProvisioningOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: audits } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, entity_id, establishment_id, ip, metadata, created_at")
      .in("action", [
        "api_provision_account",
        "api_provision_resend_access",
        "api_change_plan",
        "api_suspend_account",
        "api_reactivate_account",
      ])
      .order("created_at", { ascending: false })
      .limit(1000);

    const rows = (audits ?? []) as AuditRow[];
    const provisions = rows.filter((r) => r.action === "api_provision_account");
    const tenantIds = Array.from(new Set(provisions.map((p) => p.entity_id).filter(Boolean))) as string[];

    let tenants: Array<{ id: string; name: string; slug: string; active: boolean; plan: string | null; created_at: string }> = [];
    if (tenantIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("establishments")
        .select("id, name, slug, active, plan, created_at")
        .in("id", tenantIds);
      tenants = (data ?? []) as typeof tenants;
    }
    const byId = new Map(tenants.map((t) => [t.id, t]));

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const createdToday = provisions.filter((p) => new Date(p.created_at) >= startOfDay).length;
    const active = tenants.filter((t) => t.active).length;
    const suspended = tenants.filter((t) => !t.active).length;
    // "Com erro": provisionamento registrado sem tenant existente (rollback ou exclusão posterior).
    const errored = provisions.filter((p) => !p.entity_id || !byId.has(p.entity_id)).length;

    const byPlan: Record<string, number> = {};
    for (const p of provisions) {
      const plan = String((p.metadata ?? {})["plan"] ?? "desconhecido");
      byPlan[plan] = (byPlan[plan] ?? 0) + 1;
    }

    return {
      created_today: createdToday,
      total: provisions.length,
      active,
      suspended,
      errored,
      by_plan: byPlan,
      last_provision: provisions[0]
        ? {
            id: provisions[0].id,
            tenant_id: provisions[0].entity_id,
            tenant_name: provisions[0].entity_id ? byId.get(provisions[0].entity_id)?.name ?? null : null,
            plan: (provisions[0].metadata ?? {})["plan"] ?? null,
            source: (provisions[0].metadata ?? {})["source"] ?? null,
            email: (provisions[0].metadata ?? {})["email"] ?? null,
            created_at: provisions[0].created_at,
          }
        : null,
      accounts: provisions.slice(0, 100).map((p) => {
        const t = p.entity_id ? byId.get(p.entity_id) : undefined;
        return {
          id: p.id,
          tenant_id: p.entity_id,
          name: t?.name ?? "(conta removida)",
          slug: t?.slug ?? null,
          plan: (p.metadata ?? {})["plan"] ?? t?.plan ?? null,
          source: (p.metadata ?? {})["source"] ?? null,
          email: (p.metadata ?? {})["email"] ?? null,
          status: !t ? "erro" : t.active ? "ativa" : "suspensa",
          created_at: p.created_at,
        };
      }),
      events: rows.slice(0, 100).map((r) => ({
        id: r.id,
        action: r.action,
        tenant_id: r.entity_id,
        tenant_name: r.entity_id ? byId.get(r.entity_id)?.name ?? null : null,
        ip: r.ip,
        api_key_id: (r.metadata ?? {})["api_key_id"] ?? null,
        payload: (r.metadata ?? {})["payload"] ?? null,
        response: (r.metadata ?? {})["response"] ?? null,
        created_at: r.created_at,
      })),
    };
  });

// ---------------------------------------------------------------- ações

import { z } from "zod";

const tenantInput = z.object({ tenant_id: z.string().uuid() });

/** Ações rápidas do painel: reenviar acesso / nova senha, suspender, reativar. */
export const adminProvisioningAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    tenantInput.extend({ action: z.enum(["resend_access", "new_password", "suspend", "reactivate"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { resendProvisionedAccess, suspendAccount, reactivateAccount } = await import(
      "@/lib/integrations/provisioning.server"
    );
    const meta = { apiKeyId: `admin:${context.userId}`, ip: null as string | null };

    const res =
      data.action === "suspend"
        ? await suspendAccount(data.tenant_id, "Suspensão pelo painel administrativo", meta)
        : data.action === "reactivate"
          ? await reactivateAccount(data.tenant_id, meta)
          : await resendProvisionedAccess(data.tenant_id, meta);

    if (!res.ok) throw new Error(res.message);
    return res.data as Record<string, unknown>;
  });

/** Detalhe do tenant + trilha de auditoria completa. */
export const adminProvisioningDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getProvisionedAccount } = await import("@/lib/integrations/provisioning.server");

    const lookup = await getProvisionedAccount(data.tenant_id);
    const { data: audits } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, ip, metadata, created_at")
      .eq("establishment_id", data.tenant_id)
      .order("created_at", { ascending: false })
      .limit(200);

    return {
      account: lookup.ok ? (lookup.data as Record<string, unknown>) : null,
      error: lookup.ok ? null : lookup.message,
      audit: ((audits ?? []) as AuditRow[]).map((a) => ({
        id: a.id,
        action: a.action,
        ip: a.ip,
        metadata: a.metadata,
        created_at: a.created_at,
      })),
    };
  });

// ------------------------------------------------ dashboard comercial

const PLAN_TIER: Record<string, string> = { starter: "starter", pro: "pro", premium: "enterprise" };

/** Receita estimada por plano, origens e evolução temporal dos provisionamentos. */
export const adminApiCommercial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(7).max(365).default(30) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: audits }, { data: plans }] = await Promise.all([
      supabaseAdmin
        .from("audit_logs")
        .select("id, entity_id, metadata, created_at")
        .eq("action", "api_provision_account")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin.from("plans").select("tier, name, price_monthly"),
    ]);

    const priceByTier = new Map<string, { name: string; price: number }>(
      ((plans ?? []) as Array<{ tier: string; name: string; price_monthly: number | string }>).map((p) => [
        p.tier,
        { name: p.name, price: Number(p.price_monthly ?? 0) },
      ]),
    );

    const rows = (audits ?? []) as Array<{ id: string; entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string }>;
    const total = rows.length;

    const planKeys = ["starter", "pro", "premium"] as const;
    const counts: Record<string, number> = { starter: 0, pro: 0, premium: 0, outros: 0 };
    for (const r of rows) {
      const plan = String((r.metadata ?? {})["plan"] ?? "").toLowerCase();
      if ((planKeys as readonly string[]).includes(plan)) counts[plan] = (counts[plan] ?? 0) + 1;
      else counts["outros"] = (counts["outros"] ?? 0) + 1;
    }

    const by_plan = planKeys.map((k) => {
      const tier = PLAN_TIER[k] ?? k;
      const info = priceByTier.get(tier);
      const accounts = counts[k] ?? 0;
      return {
        plan: k,
        label: info?.name ?? k,
        accounts,
        percent: total > 0 ? (accounts / total) * 100 : 0,
        price_monthly: info?.price ?? 0,
        revenue: accounts * (info?.price ?? 0),
      };
    });
    const revenue_total = by_plan.reduce((s, p) => s + p.revenue, 0);

    // Origens
    const sourceCounts = new Map<string, number>();
    const cutoffPrev = Date.now() - 2 * data.days * 86400_000;
    const cutoff = Date.now() - data.days * 86400_000;
    const sourceCurrent = new Map<string, number>();
    const sourcePrev = new Map<string, number>();
    for (const r of rows) {
      const raw = String((r.metadata ?? {})["source"] ?? "").trim().toLowerCase();
      const source = raw === "" ? "outros" : raw === "manual" || raw === "ronnei" ? raw : raw === "api" ? "api externa" : raw;
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
      const t = new Date(r.created_at).getTime();
      if (t >= cutoff) sourceCurrent.set(source, (sourceCurrent.get(source) ?? 0) + 1);
      else if (t >= cutoffPrev) sourcePrev.set(source, (sourcePrev.get(source) ?? 0) + 1);
    }
    const by_source = Array.from(sourceCounts.entries())
      .map(([source, count]) => {
        const cur = sourceCurrent.get(source) ?? 0;
        const prev = sourcePrev.get(source) ?? 0;
        return {
          source,
          count,
          percent: total > 0 ? (count / total) * 100 : 0,
          trend: prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Série temporal
    const series: Array<{ date: string; count: number }> = [];
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = new Date(r.created_at).toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      series.push({ date: d, count: map.get(d) ?? 0 });
    }

    return { total, by_plan, revenue_total, by_source, series };
  });

// ------------------------------------------------------ saúde da API

/** Saúde da integração: disponibilidade, latência e erros recentes. */
export const adminApiHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
    const cutoff24h = Date.now() - 86400_000;

    const [{ data: logs }, { data: keys }] = await Promise.all([
      supabaseAdmin
        .from("api_request_logs")
        .select("id, path, method, status_code, duration_ms, ip, error_code, created_at, api_key_id")
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(20000),
      supabaseAdmin.from("api_keys").select("id, name, sandbox, revoked_at, scopes"),
    ]);

    type Log = {
      id: string; path: string; method: string; status_code: number; duration_ms: number | null;
      ip: string | null; error_code: string | null; created_at: string; api_key_id: string | null;
    };
    const rows = (logs ?? []) as Log[];
    const last24 = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff24h);
    const avg = (arr: Log[]) => {
      const vals = arr.map((r) => r.duration_ms).filter((v): v is number => typeof v === "number");
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };
    const lastError = rows.find((r) => r.status_code >= 400) ?? null;
    const keyRows = (keys ?? []) as Array<{ id: string; name: string; sandbox: boolean; revoked_at: string | null; scopes: string[] | null }>;
    const activeKeys = keyRows.filter((k) => !k.revoked_at);

    return {
      online: true,
      auth_ok: activeKeys.length > 0,
      provisioning_ok: activeKeys.some((k) => (k.scopes ?? []).includes("provisioning")),
      sandbox_keys: activeKeys.filter((k) => k.sandbox).length,
      last_call_at: rows[0]?.created_at ?? null,
      requests_24h: last24.length,
      requests_7d: rows.length,
      errors_24h: last24.filter((r) => r.status_code >= 400).length,
      errors_7d: rows.filter((r) => r.status_code >= 400).length,
      avg_response_ms: avg(rows),
      avg_response_ms_24h: avg(last24),
      last_error: lastError
        ? {
            path: lastError.path,
            method: lastError.method,
            status_code: lastError.status_code,
            error_code: lastError.error_code,
            created_at: lastError.created_at,
          }
        : null,
    };
  });

// ------------------------------------------------- auditoria avançada

/** Logs de API globais com filtros e paginação. */
export const adminApiAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        days: z.number().int().min(1).max(180).default(7),
        endpoint: z.string().trim().max(200).optional(),
        origin: z.string().trim().max(200).optional(),
        api_key_id: z.string().uuid().optional(),
        status: z.enum(["all", "success", "client_error", "server_error"]).default("all"),
        page: z.number().int().min(1).max(500).default(1),
        page_size: z.number().int().min(10).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const from = (data.page - 1) * data.page_size;

    let query = supabaseAdmin
      .from("api_request_logs")
      .select("id, api_key_id, key_prefix, method, path, status_code, ip, origin, duration_ms, error_code, created_at", {
        count: "exact",
      })
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, from + data.page_size - 1);

    if (data.endpoint) query = query.ilike("path", `%${data.endpoint}%`);
    if (data.origin) query = query.ilike("origin", `%${data.origin}%`);
    if (data.api_key_id) query = query.eq("api_key_id", data.api_key_id);
    if (data.status === "success") query = query.lt("status_code", 400);
    if (data.status === "client_error") query = query.gte("status_code", 400).lt("status_code", 500);
    if (data.status === "server_error") query = query.gte("status_code", 500);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);

    const { data: keys } = await supabaseAdmin.from("api_keys").select("id, name").limit(500);

    return {
      rows: (rows ?? []) as Array<Record<string, unknown>>,
      total: count ?? 0,
      page: data.page,
      page_size: data.page_size,
      keys: (keys ?? []) as Array<{ id: string; name: string }>,
    };
  });
