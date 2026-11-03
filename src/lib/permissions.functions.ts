import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PERMISSION_CATALOG, defaultPreset, type MemberRole, type PermissionAction } from "@/lib/permissions";

async function assertManager(supabase: any, userId: string, estId: string) {
  const { data, error } = await supabase.rpc("has_establishment_role", {
    _user: userId, _est: estId, _min_role: "manager",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem permissão");
}

// Lista todos os membros do estabelecimento (com overrides quando existirem).
export const listEstablishmentMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId, data.establishment_id);

    const { data: members, error } = await supabase
      .from("establishment_members")
      .select("id, user_id, role, active, display_name, invited_email, created_at")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (members ?? []).map((m: any) => m.id);
    let overridesByMember: Record<string, Record<string, boolean>> = {};
    if (ids.length) {
      const { data: perms } = await supabase
        .from("member_permissions")
        .select("member_id, overrides")
        .in("member_id", ids);
      for (const p of perms ?? []) {
        overridesByMember[(p as any).member_id] = ((p as any).overrides ?? {}) as Record<string, boolean>;
      }
    }

    return (members ?? []).map((m: any) => ({
      ...m,
      overrides: overridesByMember[m.id] ?? {},
      override_count: Object.keys(overridesByMember[m.id] ?? {}).length,
    }));
  });

// ------------------------------------------------------------------
// Permissões efetivas do usuário logado no estabelecimento ativo.
// Retorna um mapa { action: boolean } cobrindo todas as ações do catálogo.
// ------------------------------------------------------------------
export const getMyPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // JWT already verified. Get the authoritative role and this user's own
    // membership through the server-only DB client, avoiding PGRST303.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: superRow, error: superError }, { data: member, error: memberError }] = await Promise.all([
      supabaseAdmin.from("app_roles").select("user_id")
        .eq("user_id", userId).eq("role", "super_admin").maybeSingle(),
      supabaseAdmin.from("establishment_members").select("id, role, active")
        .eq("establishment_id", data.establishment_id).eq("user_id", userId).maybeSingle(),
    ]);
    if (superError || memberError) throw new Error("Falha ao verificar as permissões.");
    const isSuper = Boolean(superRow);
    const role = (member?.role ?? "staff") as MemberRole;
    const active = !!member?.active;
    if (!active && !isSuper) throw new Error("Sem acesso a este estabelecimento.");
    const supabase = supabaseAdmin;

    let overrides: Record<string, boolean> = {};
    if (member?.id) {
      const { data: perm } = await supabase
        .from("member_permissions")
        .select("overrides")
        .eq("member_id", member.id)
        .maybeSingle();
      overrides = (perm?.overrides ?? {}) as Record<string, boolean>;
    }

    const permissions: Record<PermissionAction, boolean> = {} as any;
    for (const entry of PERMISSION_CATALOG) {
      let allowed = false;
      if (isSuper || role === "owner") allowed = true;
      else if (!active) allowed = false;
      else if (entry.action in overrides) allowed = overrides[entry.action] === true;
      else allowed = defaultPreset(role, entry.action);
      permissions[entry.action] = allowed;
    }

    return { role, active, isSuper, permissions };
  });

// ------------------------------------------------------------------
// Overrides de um membro específico (para o painel do dono/gerente editar).
// ------------------------------------------------------------------
export const getMemberPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    member_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId, data.establishment_id);

    const { data: member } = await supabase
      .from("establishment_members")
      .select("id, role, active, display_name, invited_email, user_id")
      .eq("id", data.member_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();

    if (!member) throw new Error("Membro não encontrado");

    const { data: perm } = await supabase
      .from("member_permissions")
      .select("overrides, updated_at")
      .eq("member_id", data.member_id)
      .maybeSingle();

    return {
      member,
      overrides: (perm?.overrides ?? {}) as Record<string, boolean>,
      updated_at: perm?.updated_at ?? null,
    };
  });

// ------------------------------------------------------------------
// Salvar overrides. `overrides` contém apenas chaves que divergem do padrão.
// ------------------------------------------------------------------
export const updateMemberPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    member_id: z.string().uuid(),
    overrides: z.record(z.string(), z.boolean()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId, data.establishment_id);

    // Sanitiza: só chaves do catálogo, exclui ownerOnly.
    const validKeys = new Set(
      PERMISSION_CATALOG.filter((p) => !p.ownerOnly).map((p) => p.action)
    );
    const clean: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(data.overrides)) {
      if (validKeys.has(k as PermissionAction)) clean[k] = !!v;
    }

    // Confirma que o membro pertence ao estabelecimento
    const { data: mem } = await supabase
      .from("establishment_members")
      .select("id, role")
      .eq("id", data.member_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (!mem) throw new Error("Membro não encontrado");
    if (mem.role === "owner") throw new Error("O dono tem acesso total e não pode ter permissões editadas.");

    const { error } = await supabase
      .from("member_permissions")
      .upsert({
        member_id: data.member_id,
        establishment_id: data.establishment_id,
        overrides: clean,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      }, { onConflict: "member_id" });

    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id,
      user_id: userId,
      action: "team.permissions_updated",
      entity_type: "establishment_member",
      entity_id: data.member_id,
      metadata: { overrides: clean },
    });

    return { ok: true };
  });

// Restaurar padrão do papel (limpa os overrides).
export const resetMemberPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    member_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId, data.establishment_id);
    const { error } = await supabase
      .from("member_permissions")
      .delete()
      .eq("member_id", data.member_id)
      .eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id,
      user_id: userId,
      action: "team.permissions_reset",
      entity_type: "establishment_member",
      entity_id: data.member_id,
      metadata: {},
    });
    return { ok: true };
  });
