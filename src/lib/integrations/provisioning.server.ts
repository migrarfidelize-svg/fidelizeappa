/**
 * Provisionamento de contas via API REST privada.
 * Cria empresa (tenant) + usuário administrador + assinatura do plano
 * + liberação dos módulos, com senha temporária e auditoria.
 *
 * Server-only. Exige API Key com escopo "provisioning".
 */
import { randomBytes } from "node:crypto";

export type PlanKey = "starter" | "pro" | "premium";

/** Plano público (entrada da API) -> tier interno do banco. */
const PLAN_TIER: Record<PlanKey, string> = {
  starter: "starter",
  pro: "pro",
  premium: "enterprise",
};

/** Módulos liberados no provisionamento. */
export const PROVISION_MODULES = [
  "loyalty_card", // Cartão Fidelidade
  "loyalty_cards",
  "stamps",
  "digital_menu", // Cardápio Digital
  "linktree", // Árvore de Links
] as const;

export type ProvisionInput = {
  name: string;
  email: string;
  phone?: string | null;
  plan: PlanKey;
  source?: string | null;
};

export type ProvisionResult =
  | {
      ok: true;
      tenant_id: string;
      user_id: string;
      temporary_password: string;
      login_url: string;
      slug: string;
      plan: PlanKey;
      modules: string[];
    }
  | { ok: false; status: number; code: string; message: string };

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "empresa";
}

/** Senha temporária forte e legível (12 chars, sem caracteres ambíguos). */
export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `${out}#1`;
}

export async function provisionAccount(input: ProvisionInput, meta: {
  apiKeyId: string;
  apiKeyEstablishmentId: string;
  ip: string | null;
}): Promise<ProvisionResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = input.email.trim().toLowerCase();
  const tier = PLAN_TIER[input.plan];
  const source = (input.source ?? "api").slice(0, 60);

  // 1. Plano precisa existir e estar ativo
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id, slug, tier, name")
    .eq("tier", tier as never)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!plan) {
    return { ok: false, status: 409, code: "plan_unavailable", message: `Plano "${input.plan}" indisponível.` };
  }

  // 2. E-mail não pode já pertencer a um usuário
  const { data: existingList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const already = (existingList?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
  if (already) {
    return { ok: false, status: 409, code: "email_in_use", message: "Já existe um usuário com este e-mail." };
  }

  // 3. Slug único da empresa
  const base = slugify(input.name);
  let slug = base;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: taken } = await supabaseAdmin.from("establishments").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${randomBytes(2).toString("hex")}`;
  }

  // 4. Usuário administrador + senha temporária
  const temporaryPassword = generateTemporaryPassword();
  const { data: createdUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: input.name,
      phone: input.phone ?? "",
      account_type: "establishment",
      provisioned_by: source,
      must_change_password: true,
    },
  });
  if (userErr || !createdUser?.user?.id) {
    return { ok: false, status: 500, code: "user_creation_failed", message: userErr?.message ?? "Falha ao criar usuário." };
  }
  const userId = createdUser.user.id;

  const rollbackUser = async () => {
    try { await supabaseAdmin.auth.admin.deleteUser(userId); } catch { /* noop */ }
  };

  await supabaseAdmin.from("profiles").upsert(
    { id: userId, full_name: input.name, phone: input.phone ?? null, account_type: "establishment" } as never,
    { onConflict: "id" },
  );

  // 5. Empresa (tenant)
  const { data: est, error: estErr } = await supabaseAdmin
    .from("establishments")
    .insert({
      slug,
      name: input.name,
      email,
      phone: input.phone ?? null,
      whatsapp: input.phone ?? null,
      plan: tier,
      created_by: userId,
      active: true,
    } as never)
    .select("id, slug")
    .single();

  if (estErr || !est) {
    await rollbackUser();
    return { ok: false, status: 500, code: "tenant_creation_failed", message: estErr?.message ?? "Falha ao criar empresa." };
  }
  const tenantId = (est as { id: string; slug: string }).id;

  // 6. Vínculo do administrador
  const { error: memberErr } = await supabaseAdmin
    .from("establishment_members")
    .insert({ establishment_id: tenantId, user_id: userId, role: "owner", active: true } as never);
  if (memberErr) {
    await supabaseAdmin.from("establishments").delete().eq("id", tenantId);
    await rollbackUser();
    return { ok: false, status: 500, code: "member_creation_failed", message: memberErr.message };
  }

  // 7. Assinatura ativa do plano
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { error: subErr } = await supabaseAdmin.from("subscriptions").insert({
    establishment_id: tenantId,
    plan_id: (plan as { id: string }).id,
    tier: tier,
    status: "active",
    provider: "api_provisioning",
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    metadata: { source, api_key_id: meta.apiKeyId },
  } as never);
  if (subErr) {
    return { ok: false, status: 500, code: "subscription_failed", message: subErr.message };
  }

  // 8. Liberação dos módulos (override explícito, independente do plano)
  const modules = [...PROVISION_MODULES];
  await supabaseAdmin.from("establishment_feature_overrides").upsert(
    modules.map((feature_key) => ({
      establishment_id: tenantId,
      feature_key,
      enabled: true,
      note: `Provisionamento automático (${source})`,
    })) as never,
    { onConflict: "establishment_id,feature_key" },
  );

  // 9. Auditoria
  try {
    await supabaseAdmin.from("audit_logs").insert({
      establishment_id: tenantId,
      user_id: userId,
      action: "api_provision_account",
      entity_type: "establishment",
      entity_id: tenantId,
      ip: meta.ip,
      metadata: {
        source,
        plan: input.plan,
        tier,
        email,
        modules,
        api_key_id: meta.apiKeyId,
        provisioned_by_establishment: meta.apiKeyEstablishmentId,
      },
    } as never);
  } catch { /* auditoria nunca bloqueia */ }

  const { getPublicAppUrl } = await import("@/lib/app-url");
  const loginUrl = `${getPublicAppUrl()}/auth?email=${encodeURIComponent(email)}`;

  return {
    ok: true,
    tenant_id: tenantId,
    user_id: userId,
    temporary_password: temporaryPassword,
    login_url: loginUrl,
    slug: (est as { slug: string }).slug,
    plan: input.plan,
    modules,
  };
}

// ---------------------------------------------------------------- consulta

export type ProvisionLookupResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string };

/** GET /provisioning/:tenantId — tenant, plano, módulos, admin e status. */
export async function getProvisionedAccount(tenantId: string): Promise<ProvisionLookupResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("id, name, slug, email, phone, active, created_at")
    .eq("id", tenantId)
    .maybeSingle();
  if (!est) return { ok: false, status: 404, code: "tenant_not_found", message: "Tenant não encontrado." };

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, tier, status, provider, current_period_start, current_period_end, metadata, created_at")
    .eq("establishment_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: overrides } = await supabaseAdmin
    .from("establishment_feature_overrides")
    .select("feature_key, enabled")
    .eq("establishment_id", tenantId);

  const { data: owner } = await supabaseAdmin
    .from("establishment_members")
    .select("user_id, role, active, created_at")
    .eq("establishment_id", tenantId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let adminUser: Record<string, unknown> | null = null;
  if (owner) {
    const ownerRow = owner as { user_id: string; role: string; active: boolean };
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", ownerRow.user_id)
      .maybeSingle();
    adminUser = {
      user_id: ownerRow.user_id,
      role: ownerRow.role,
      active: ownerRow.active,
      name: (profile as { full_name?: string } | null)?.full_name ?? null,
      email: (profile as { email?: string } | null)?.email ?? null,
    };
  }

  const estRow = est as { id: string; name: string; slug: string; email: string | null; phone: string | null; active: boolean; created_at: string };
  const subRow = sub as { tier: string; status: string; provider: string | null; current_period_end: string | null; metadata: Record<string, unknown> | null } | null;

  return {
    ok: true,
    data: {
      tenant: {
        id: estRow.id,
        name: estRow.name,
        slug: estRow.slug,
        email: estRow.email,
        phone: estRow.phone,
        active: estRow.active,
        created_at: estRow.created_at,
      },
      plan: subRow
        ? {
            tier: subRow.tier,
            status: subRow.status,
            provider: subRow.provider,
            current_period_end: subRow.current_period_end,
            source: (subRow.metadata ?? {})["source"] ?? null,
          }
        : null,
      modules: ((overrides ?? []) as Array<{ feature_key: string; enabled: boolean }>)
        .filter((o) => o.enabled)
        .map((o) => o.feature_key),
      admin_user: adminUser,
      status: estRow.active && subRow?.status === "active" ? "active" : estRow.active ? "pending" : "inactive",
    },
  };
}

/** POST /provisioning/:tenantId/resend-access — nova senha temporária + e-mail. */
export async function resendProvisionedAccess(
  tenantId: string,
  meta: { apiKeyId: string; ip: string | null },
): Promise<ProvisionLookupResult> {
  const lookup = await getProvisionedAccount(tenantId);
  if (!lookup.ok) return lookup;

  const admin = lookup.data["admin_user"] as { user_id: string; email: string | null } | null;
  const tenant = lookup.data["tenant"] as { name: string; id: string };
  if (!admin?.user_id) {
    return { ok: false, status: 404, code: "admin_not_found", message: "Administrador do tenant não encontrado." };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(admin.user_id);
  const email = admin.email ?? authUser?.user?.email ?? null;
  if (!email) {
    return { ok: false, status: 422, code: "email_not_found", message: "E-mail do administrador não encontrado." };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(admin.user_id, {
    password: temporaryPassword,
  });
  if (pwErr) {
    return { ok: false, status: 500, code: "password_reset_failed", message: pwErr.message };
  }

  const { getPublicAppUrl } = await import("@/lib/app-url");
  const loginUrl = `${getPublicAppUrl()}/auth?email=${encodeURIComponent(email)}`;

  try {
    const { enqueueEmail } = await import("@/lib/email.server");
    await enqueueEmail({
      to: email,
      subject: `Seus dados de acesso — ${tenant.name}`,
      html: `<p>Olá!</p><p>Seguem seus dados de acesso a <strong>${tenant.name}</strong>:</p>
<p><strong>E-mail:</strong> ${email}<br/><strong>Senha temporária:</strong> ${temporaryPassword}</p>
<p>Acesse: <a href="${loginUrl}">${loginUrl}</a></p>
<p>Recomendamos alterar a senha no primeiro acesso.</p>`,
      text: `Acesso ${tenant.name}\nE-mail: ${email}\nSenha temporária: ${temporaryPassword}\n${loginUrl}`,
      template: "provisioning_resend_access",
      establishment_id: tenantId,
    });
  } catch { /* fila de e-mail nunca bloqueia a resposta */ }

  try {
    await supabaseAdmin.from("audit_logs").insert({
      establishment_id: tenantId,
      user_id: admin.user_id,
      action: "api_provision_resend_access",
      entity_type: "establishment",
      entity_id: tenantId,
      ip: meta.ip,
      metadata: { email, api_key_id: meta.apiKeyId },
    } as never);
  } catch { /* auditoria nunca bloqueia */ }

  return {
    ok: true,
    data: { success: true, tenant_id: tenantId, user_id: admin.user_id, email, temporary_password: temporaryPassword, login_url: loginUrl },
  };
}
