import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { API_SCOPES, DEFAULT_API_SCOPES, normalizeScopes } from "@/lib/integrations/scopes";

const estInput = z.object({ establishment_id: z.string().uuid() });

/**
 * A gestão de chaves/logs de API é exclusiva dos administradores da
 * plataforma — donos de estabelecimento e equipe não têm acesso.
 */
async function assertManager(supabase: any, userId: string, _estId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error("Falha ao validar permissões.");
  if (data !== true) throw new Error("Acesso restrito aos administradores da plataforma.");
}

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.establishment_id);
    const { data: rows, error } = await context.supabase
      .from("api_keys")
      .select("id, name, prefix, scopes, sandbox, key_type, allowed_origins, rate_limit_per_minute, last_used_at, revoked_at, created_at")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const keys = (rows ?? []) as Array<Record<string, unknown>>;

    // Total de requisições por chave (logs imutáveis)
    const { data: logRows } = await context.supabase
      .from("api_request_logs")
      .select("api_key_id, ip, path, created_at")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false })
      .limit(50000);
    const counts = new Map<string, number>();
    const lastCall = new Map<string, { ip: string | null; path: string | null; created_at: string }>();
    for (const l of (logRows ?? []) as Array<{ api_key_id: string | null; ip: string | null; path: string | null; created_at: string }>) {
      if (!l.api_key_id) continue;
      counts.set(l.api_key_id, (counts.get(l.api_key_id) ?? 0) + 1);
      if (!lastCall.has(l.api_key_id)) lastCall.set(l.api_key_id, { ip: l.ip, path: l.path, created_at: l.created_at });
    }

    return keys.map((k) => ({
      ...k,
      scopes: normalizeScopes(k["scopes"] as string[] | null),
      sandbox: Boolean(k["sandbox"]),
      key_type: (k["key_type"] as string) ?? "browser",
      requests_total: counts.get(String(k["id"])) ?? 0,
      last_ip: lastCall.get(String(k["id"]))?.ip ?? null,
      last_endpoint: lastCall.get(String(k["id"]))?.path ?? null,
      status: k["revoked_at"] ? "revoked" : "active",
    }));
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        name: z.string().trim().min(2).max(60),
        rate_limit_per_minute: z.number().int().min(10).max(6000).default(120),
        allowed_origins: z.array(z.string().trim().min(3).max(200)).max(20).default([]),
        scopes: z.array(z.enum(API_SCOPES)).max(API_SCOPES.length).optional(),
        sandbox: z.boolean().default(false),
        key_type: z.enum(["browser", "server"]).default("browser"),
        provisioning: z.boolean().default(false),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.establishment_id);

    const { generateApiKey } = await import("@/lib/integrations/rest-api.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { raw, prefix, hash } = generateApiKey();

    const requested = new Set<string>(
      data.scopes && data.scopes.length > 0 ? data.scopes : DEFAULT_API_SCOPES,
    );
    if (data.provisioning) requested.add("provisioning");

    // O escopo de provisionamento cria empresas/usuários fora do tenant atual:
    // somente super admin pode emitir uma chave com esse poder.
    if (requested.has("provisioning")) {
      const { data: isAdmin } = await context.supabase.rpc("is_super_admin", { _user: context.userId });
      if (!isAdmin) throw new Error("Apenas super admin pode criar chaves com escopo de provisionamento.");
    }
    const scopes = Array.from(requested);

    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        establishment_id: data.establishment_id,
        created_by: context.userId,
        name: data.name,
        prefix,
        key_hash: hash,
        scopes,
        sandbox: data.sandbox,
        key_type: data.key_type,
        allowed_origins: data.allowed_origins,
        rate_limit_per_minute: data.rate_limit_per_minute,
      })
      .select("id, name, prefix, scopes, sandbox, key_type, allowed_origins, rate_limit_per_minute, created_at, revoked_at, last_used_at")
      .single();
    if (error) throw new Error(error.message);

    // A chave em texto puro é retornada UMA ÚNICA VEZ.
    return { key: row, secret: raw };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.establishment_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listApiRequestLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        days: z.number().int().min(1).max(180).default(7),
        endpoint: z.string().trim().max(200).optional(),
        status: z.enum(["all", "success", "client_error", "server_error"]).default("all"),
        api_key_id: z.string().uuid().optional(),
        limit: z.number().int().min(10).max(500).default(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.establishment_id);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    let query = context.supabase
      .from("api_request_logs")
      .select("id, api_key_id, method, path, status_code, ip, origin, key_prefix, duration_ms, error_code, created_at")
      .eq("establishment_id", data.establishment_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.endpoint) query = query.ilike("path", `%${data.endpoint}%`);
    if (data.api_key_id) query = query.eq("api_key_id", data.api_key_id);
    if (data.status === "success") query = query.lt("status_code", 400);
    if (data.status === "client_error") query = query.gte("status_code", 400).lt("status_code", 500);
    if (data.status === "server_error") query = query.gte("status_code", 500);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Estatísticas do painel de integrações. */
export const getIntegrationsStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.establishment_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 30 * 86400_000).toISOString();

    const [{ data: keys }, { data: logs }, { data: audits }] = await Promise.all([
      context.supabase
        .from("api_keys")
        .select("id, revoked_at, sandbox")
        .eq("establishment_id", data.establishment_id),
      context.supabase
        .from("api_request_logs")
        .select("status_code, created_at")
        .eq("establishment_id", data.establishment_id)
        .gte("created_at", since)
        .limit(50000),
      supabaseAdmin
        .from("audit_logs")
        .select("id, action, entity_id, metadata, created_at")
        .in("action", ["api_provision_account", "api_provision_resend_access"])
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const keyRows = (keys ?? []) as Array<{ id: string; revoked_at: string | null; sandbox: boolean }>;
    const logRows = (logs ?? []) as Array<{ status_code: number }>;
    const auditRows = (audits ?? []) as Array<{
      id: string; action: string; entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string;
    }>;

    const provisions = auditRows.filter((a) => a.action === "api_provision_account");
    const byPlan: Record<string, number> = {};
    for (const p of provisions) {
      const plan = String((p.metadata ?? {})["plan"] ?? "desconhecido");
      byPlan[plan] = (byPlan[plan] ?? 0) + 1;
    }

    return {
      keys_total: keyRows.length,
      keys_active: keyRows.filter((k) => !k.revoked_at).length,
      keys_sandbox: keyRows.filter((k) => k.sandbox).length,
      requests_30d: logRows.length,
      failures_30d: logRows.filter((l) => l.status_code >= 400).length,
      accounts_provisioned: provisions.length,
      provisions_by_plan: byPlan,
      recent_provisions: provisions.slice(0, 10).map((p) => ({
        id: p.id,
        tenant_id: p.entity_id,
        plan: (p.metadata ?? {})["plan"] ?? null,
        source: (p.metadata ?? {})["source"] ?? null,
        email: (p.metadata ?? {})["email"] ?? null,
        created_at: p.created_at,
      })),
    };
  });
