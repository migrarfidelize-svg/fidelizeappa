import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const estInput = z.object({ establishment_id: z.string().uuid() });

async function assertManager(supabase: any, userId: string, estId: string) {
  const { data, error } = await supabase.rpc("has_establishment_role", {
    _user: userId,
    _est: estId,
    _min_role: "manager",
  });
  if (error) throw new Error("Falha ao validar permissões.");
  if (!data) throw new Error("Você não tem permissão para gerenciar chaves de API deste estabelecimento.");
}

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.establishment_id);
    const { data: rows, error } = await context.supabase
      .from("api_keys")
      .select("id, name, prefix, scopes, allowed_origins, rate_limit_per_minute, last_used_at, revoked_at, created_at")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
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
        provisioning: z.boolean().default(false),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.establishment_id);

    const { generateApiKey } = await import("@/lib/integrations/rest-api.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { raw, prefix, hash } = generateApiKey();

    // O escopo de provisionamento cria empresas/usuários fora do tenant atual:
    // somente super admin pode emitir uma chave com esse poder.
    const scopes = ["customers:read", "customers:write", "points:write"];
    if (data.provisioning) {
      const { data: isAdmin } = await context.supabase.rpc("is_super_admin", { _user: context.userId });
      if (!isAdmin) throw new Error("Apenas super admin pode criar chaves com escopo de provisionamento.");
      scopes.push("provisioning");
    }

    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        establishment_id: data.establishment_id,
        created_by: context.userId,
        name: data.name,
        prefix,
        key_hash: hash,
        scopes,
        allowed_origins: data.allowed_origins,
        rate_limit_per_minute: data.rate_limit_per_minute,
      })
      .select("id, name, prefix, scopes, allowed_origins, rate_limit_per_minute, created_at, revoked_at, last_used_at")
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
  .inputValidator((d: unknown) => estInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId, data.establishment_id);
    const { data: rows, error } = await context.supabase
      .from("api_request_logs")
      .select("id, method, path, status_code, ip, origin, key_prefix, duration_ms, error_code, created_at")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
