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

/**
 * Módulos que o provisionamento antigo liberava por override fixo, independente
 * do plano. Mantido apenas para limpar essas liberações legadas — hoje os
 * módulos vêm exclusivamente de `plan_features`, igual à compra padrão.
 */
export const LEGACY_PROVISION_MODULES = [
  "loyalty_card",
  "loyalty_cards",
  "stamps",
  "digital_menu",
  "linktree",
] as const;

/** Módulos incluídos no plano (mesma fonte usada pela compra padrão). */
async function listPlanModules(
  supabaseAdmin: { from: (t: string) => any },
  planId: string,
): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("plan_features")
    .select("feature_key, enabled")
    .eq("plan_id", planId);
  return ((data ?? []) as Array<{ feature_key: string; enabled: boolean }>)
    .filter((f) => f.enabled)
    .map((f) => f.feature_key);
}

/** Remove liberações fixas criadas por provisionamentos antigos. */
async function clearLegacyOverrides(
  supabaseAdmin: { from: (t: string) => any },
  tenantId: string,
) {
  await supabaseAdmin
    .from("establishment_feature_overrides")
    .delete()
    .eq("establishment_id", tenantId)
    .in("feature_key", [...LEGACY_PROVISION_MODULES]);
}


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

/**
 * URL de acesso com login automático (magic link de uso único) e a senha
 * temporária no fragmento (#) — o fragmento nunca é enviado ao servidor;
 * a página `/acesso` exibe a senha oculta com botão de revelar/copiar.
 * Se o magic link falhar, cai no login normal com o e-mail pré-preenchido.
 */
export async function buildAccessUrl(email: string, temporaryPassword: string): Promise<string> {
  const { getPublicAppUrl } = await import("@/lib/app-url");
  const base = getPublicAppUrl();
  const secret = Buffer.from(temporaryPassword, "utf8").toString("base64url");
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) throw new Error(error?.message ?? "magic link indisponível");
    return `${base}/acesso?t=${encodeURIComponent(tokenHash)}&e=${encodeURIComponent(email)}#p=${secret}`;
  } catch {
    return `${base}/acesso?e=${encodeURIComponent(email)}#p=${secret}`;
  }
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

  // 8. Módulos: exatamente os do plano contratado (mesma regra da compra padrão).
  //    Nenhum override fixo é criado — o gate usa `plan_features`.
  const modules = await listPlanModules(supabaseAdmin as never, (plan as { id: string }).id);


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

  const loginUrl = await buildAccessUrl(email, temporaryPassword);

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
    .select("id, plan_id, tier, status, provider, current_period_start, current_period_end, metadata, created_at")
    .eq("establishment_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const planModules = (sub as { plan_id?: string | null } | null)?.plan_id
    ? await listPlanModules(supabaseAdmin as never, (sub as { plan_id: string }).plan_id)
    : [];


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

  const loginUrl = await buildAccessUrl(email, temporaryPassword);

  try {
    const { enqueueEmail } = await import("@/lib/email.server");
    await enqueueEmail({
      to: email,
      subject: `Seus dados de acesso — ${tenant.name}`,
      html: `<p>Olá!</p><p>Seu acesso a <strong>${tenant.name}</strong> está pronto.</p>
<p><strong>E-mail:</strong> ${email}</p>
<p><a href="${loginUrl}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#5b3fa8;color:#fff;text-decoration:none;font-weight:600">Entrar automaticamente</a></p>
<p>O botão faz o login automático e mostra sua senha temporária (oculta, clique para revelar). O link é de uso único.</p>
<p>Recomendamos alterar a senha no primeiro acesso.</p>`,
      text: `Acesso ${tenant.name}\nE-mail: ${email}\nEntre por: ${loginUrl}`,
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

// ------------------------------------------------- ciclo de vida da conta

async function writeLifecycleAudit(params: {
  tenantId: string;
  action: string;
  ip: string | null;
  apiKeyId: string;
  apiKeyEstablishmentId?: string | null;
  payload: Record<string, unknown>;
  response: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      establishment_id: params.tenantId,
      action: params.action,
      entity_type: "establishment",
      entity_id: params.tenantId,
      ip: params.ip,
      metadata: {
        api_key_id: params.apiKeyId,
        called_by_establishment: params.apiKeyEstablishmentId ?? null,
        payload: params.payload,
        response: params.response,
        at: new Date().toISOString(),
      },
    } as never);
  } catch { /* auditoria nunca bloqueia */ }
}

export type LifecycleMeta = { apiKeyId: string; apiKeyEstablishmentId?: string | null; ip: string | null };

/** POST /change-plan — troca o plano do tenant e reativa os módulos. */
export async function changeAccountPlan(
  tenantId: string,
  plan: PlanKey,
  meta: LifecycleMeta,
): Promise<ProvisionLookupResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tier = PLAN_TIER[plan];

  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("id, name, slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (!est) return { ok: false, status: 404, code: "tenant_not_found", message: "Tenant não encontrado." };

  const { data: planRow } = await supabaseAdmin
    .from("plans")
    .select("id, tier, name")
    .eq("tier", tier as never)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!planRow) return { ok: false, status: 409, code: "plan_unavailable", message: `Plano "${plan}" indisponível.` };

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("establishment_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sub) {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan_id: (planRow as { id: string }).id,
        tier,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      } as never)
      .eq("id", (sub as { id: string }).id);
    if (error) return { ok: false, status: 500, code: "plan_change_failed", message: error.message };
  } else {
    const { error } = await supabaseAdmin.from("subscriptions").insert({
      establishment_id: tenantId,
      plan_id: (planRow as { id: string }).id,
      tier,
      status: "active",
      provider: "api_provisioning",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      metadata: { api_key_id: meta.apiKeyId, source: "api_change_plan" },
    } as never);
    if (error) return { ok: false, status: 500, code: "plan_change_failed", message: error.message };
  }

  await supabaseAdmin.from("establishments").update({ plan: tier } as never).eq("id", tenantId);

  // Módulos passam a seguir o novo plano; liberações fixas legadas são removidas
  // para que downgrade/upgrade reflitam exatamente o plano contratado.
  await clearLegacyOverrides(supabaseAdmin as never, tenantId);
  const modules = await listPlanModules(supabaseAdmin as never, (planRow as { id: string }).id);


  const response = { success: true, tenant_id: tenantId, plan, tier, modules, status: "active" };
  await writeLifecycleAudit({
    tenantId,
    action: "api_change_plan",
    ip: meta.ip,
    apiKeyId: meta.apiKeyId,
    apiKeyEstablishmentId: meta.apiKeyEstablishmentId ?? null,
    payload: { tenant_id: tenantId, plan },
    response,
  });
  return { ok: true, data: response };
}

/** POST /suspend-account — desativa o tenant e coloca a assinatura em pausa. */
export async function suspendAccount(
  tenantId: string,
  reason: string | null,
  meta: LifecycleMeta,
): Promise<ProvisionLookupResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("id, active")
    .eq("id", tenantId)
    .maybeSingle();
  if (!est) return { ok: false, status: 404, code: "tenant_not_found", message: "Tenant não encontrado." };

  const { error } = await supabaseAdmin.from("establishments").update({ active: false } as never).eq("id", tenantId);
  if (error) return { ok: false, status: 500, code: "suspend_failed", message: error.message };

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "canceled" } as never)
    .eq("establishment_id", tenantId)
    .eq("status", "active");

  const response = { success: true, tenant_id: tenantId, status: "suspended", reason: reason ?? null };
  await writeLifecycleAudit({
    tenantId,
    action: "api_suspend_account",
    ip: meta.ip,
    apiKeyId: meta.apiKeyId,
    apiKeyEstablishmentId: meta.apiKeyEstablishmentId ?? null,
    payload: { tenant_id: tenantId, reason },
    response,
  });
  return { ok: true, data: response };
}

/** POST /reactivate-account — reativa o tenant e a assinatura mais recente. */
export async function reactivateAccount(
  tenantId: string,
  meta: LifecycleMeta,
): Promise<ProvisionLookupResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("id, active")
    .eq("id", tenantId)
    .maybeSingle();
  if (!est) return { ok: false, status: 404, code: "tenant_not_found", message: "Tenant não encontrado." };

  const { error } = await supabaseAdmin.from("establishments").update({ active: true } as never).eq("id", tenantId);
  if (error) return { ok: false, status: 500, code: "reactivate_failed", message: error.message };

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("establishment_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sub) {
    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      } as never)
      .eq("id", (sub as { id: string }).id);
  }

  const response = { success: true, tenant_id: tenantId, status: "active" };
  await writeLifecycleAudit({
    tenantId,
    action: "api_reactivate_account",
    ip: meta.ip,
    apiKeyId: meta.apiKeyId,
    apiKeyEstablishmentId: meta.apiKeyEstablishmentId ?? null,
    payload: { tenant_id: tenantId },
    response,
  });
  return { ok: true, data: response };
}
