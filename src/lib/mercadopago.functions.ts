import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getPublicAppUrl } from "@/lib/app-url";

const MP_API = "https://api.mercadopago.com";

function inferMercadoPagoTestAccount(account: any): boolean {
  const nickname = String(account?.nickname ?? "");
  const email = String(account?.email ?? "");
  const tags = Array.isArray(account?.tags) ? account.tags.map((tag: unknown) => String(tag).toLowerCase()) : [];
  return /^TESTUSER/i.test(nickname) || /test_user|testuser/i.test(email) || tags.includes("test_user");
}

function looksLikeMercadoPagoTestEmail(email: string | null | undefined): boolean {
  return /(^|[+._-])test[_-]?user|testuser\.com/i.test(email ?? "");
}

function formatMpCredentialMismatchMessage(details: { configuredEnvironment?: string | null; accountNickname?: string | null }) {
  const nickname = details.accountNickname ? ` (${details.accountNickname})` : "";
  const environment = details.configuredEnvironment === "sandbox" ? "Sandbox/Teste" : "Produção";
  return `Configuração Mercado Pago incompatível: o Access Token cadastrado em /hash/integracoes pertence a um usuário de teste${nickname}, mas o painel está em ${environment}. Para receber pagamentos reais, atualize o Access Token em /hash/integracoes → Pagamentos → Mercado Pago (aba Credenciais) com um token de produção da conta real. Para simular, mude o ambiente para Sandbox/Teste e use um comprador de teste do Mercado Pago.`;
}

async function mpFetch(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const { requireMercadoPagoAccessToken } = await import("./mercadopago-credentials.server");
  const token = await requireMercadoPagoAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${MP_API}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const rawMsg = body?.message ?? body?.error ?? text ?? `MP ${res.status}`;
    const msgStr = typeof rawMsg === "string" ? rawMsg : JSON.stringify(rawMsg);
    if (res.status === 401 && /unauthorized use of live credentials/i.test(msgStr)) {
      throw new Error(
        "Mercado Pago recusou o pagamento: as credenciais e o comprador parecem estar em ambientes diferentes, ou o pagador é o próprio titular da conta que recebe. Se a conexão em /hash/integracoes mostrar TESTUSER, troque o Access Token para um de produção de uma conta real. Em produção, use e-mail/CPF/CNPJ reais e diferentes da conta recebedora.",
      );
    }
    throw new Error(`Mercado Pago (${res.status}): ${msgStr}`);
  }
  return body;
}

async function assertOwner(supabase: any, userId: string, establishmentId: string) {
  const { data } = await supabase.from("establishment_members")
    .select("role").eq("establishment_id", establishmentId).eq("user_id", userId).eq("active", true).maybeSingle();
  if (!data || data.role !== "owner") throw new Error("Apenas o dono da empresa pode gerenciar a assinatura.");
}

async function getPlanOrThrow(supabase: any, slug: string) {
  const { data: plan } = await supabase.from("plans")
    .select("id, slug, tier, name, price_monthly, is_active, archived_at, features")
    .eq("slug", slug).maybeSingle();
  if (!plan || !plan.is_active || plan.archived_at) throw new Error("Plano indisponível.");
  const f = (plan as any).features;
  if (f && typeof f === "object" && (f.sales_contact || f.quote_flow)) {
    throw new Error("Este plano é contratado com o time comercial. Fale com vendas para receber a proposta.");
  }
  return plan;
}

// Bloqueia proativamente cenários que geram 401 "Unauthorized use of live credentials".
async function assertMercadoPagoPaymentReady(payerEmail: string | null | undefined) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { loadMercadoPagoCredentials } = await import("./mercadopago-credentials.server");
  const credentials = await loadMercadoPagoCredentials(true);
  const { data } = await supabaseAdmin
    .from("payment_settings")
    .select("account_email, account_nickname, environment")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const acctEmail = ((data as any)?.account_email as string | null) ?? null;
  const storedNickname = ((data as any)?.account_nickname as string | null) ?? null;
  const env = credentials.mode ?? ((data as any)?.environment as string | null) ?? "production";

  const account = await mpFetch("/users/me");
  const accountNickname = (account?.nickname as string | null) ?? storedNickname;
  const isTestAccount = inferMercadoPagoTestAccount(account);
  const isSandbox = env === "sandbox";

  if (!isSandbox && isTestAccount) {
    throw new Error(formatMpCredentialMismatchMessage({ configuredEnvironment: env, accountNickname }));
  }

  // Sandbox/Teste não deve bloquear a criação no backend: o painel já orienta o
  // lojista a usar comprador TESTUSER, mas deixamos o Mercado Pago responder
  // para evitar falsos positivos com formatos de e-mail de teste novos.

  if (!isSandbox && payerEmail && looksLikeMercadoPagoTestEmail(payerEmail)) {
    throw new Error("Ambiente de produção detectado. Use um e-mail real do comprador, não um comprador de teste do Mercado Pago.");
  }

  if (payerEmail && env !== "sandbox" && acctEmail && acctEmail.trim().toLowerCase() === payerEmail.trim().toLowerCase()) {
    throw new Error(
      `Não é permitido pagar para si mesmo em produção. O e-mail informado (${payerEmail}) é o mesmo da conta Mercado Pago que recebe (${acctEmail}). Use um e-mail diferente para simular/cobrar essa assinatura.`
    );
  }
}

// ----------- Account hint (auth-only): mostra ao lojista o e-mail do titular MP a evitar -----------
export const getMercadoPagoAccountHint = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadMercadoPagoCredentials } = await import("./mercadopago-credentials.server");
    const credentials = await loadMercadoPagoCredentials(true);
    const { data } = await supabaseAdmin
      .from("payment_settings")
      .select("account_email, account_nickname, environment, last_test_message")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const nickname = ((data as any)?.account_nickname as string | null) ?? null;
    const lastMessage = ((data as any)?.last_test_message as string | null) ?? null;
    const inferredTestAccount = /^TESTUSER/i.test(nickname ?? "") || /TESTUSER/i.test(lastMessage ?? "");
    const environment = credentials.mode ?? ((data as any)?.environment as string | null) ?? "production";
    const configurationIssue = environment !== "sandbox" && inferredTestAccount
      ? formatMpCredentialMismatchMessage({ configuredEnvironment: environment, accountNickname: nickname ?? lastMessage })
      : null;
    return {
      account_email: ((data as any)?.account_email as string | null) ?? null,
      account_nickname: nickname,
      environment,
      account_is_test_user: inferredTestAccount,
      configuration_issue: configurationIssue,
    };
  });

// ----------- Public key (client-safe) -----------

export const getMercadoPagoPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { loadMercadoPagoCredentials } = await import("./mercadopago-credentials.server");
  const creds = await loadMercadoPagoCredentials(true);
  const source = creds.sources.public_key;
  return {
    public_key: creds.public_key,
    source: source === "db_integration" ? ("db" as const)
          : source === "db_payment_settings" ? ("db" as const)
          : source === "env" ? ("env" as const)
          : null,
  };
});

// ----------- PIX -----------
export const createPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan_slug: z.string().min(1),
    payer_email: z.string().email().optional(),
    payer_doc: z.string().min(6).max(20).optional(),
    payer_first_name: z.string().max(60).optional(),
    payer_last_name: z.string().max(60).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await assertOwner(supabase, userId, data.establishment_id);
    const plan = await getPlanOrThrow(supabase, data.plan_slug);
    const { computeUpgradeCharge } = await import("@/lib/plan-proration.server");
    const quote = await computeUpgradeCharge(data.establishment_id, plan as never);
    const amount = quote.amount;
    if (!(amount > 0)) throw new Error("Este plano não é cobrado (grátis) — nada a pagar.");

    const idempotencyKey = crypto.randomUUID();
    const payerEmail = data.payer_email ?? claims?.email ?? `pagador+${data.establishment_id}@fidelize.app`;
    await assertMercadoPagoPaymentReady(payerEmail);
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

    const mp = await mpFetch("/v1/payments", {
      method: "POST",
      idempotencyKey,
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Assinatura ${plan.name} — Fidelize`,
        payment_method_id: "pix",
        date_of_expiration: expiresAt,
        payer: {
          email: payerEmail,
          first_name: data.payer_first_name,
          last_name: data.payer_last_name,
          identification: data.payer_doc ? { type: data.payer_doc.length > 11 ? "CNPJ" : "CPF", number: data.payer_doc.replace(/\D/g, "") } : undefined,
        },
        metadata: {
          establishment_id: data.establishment_id,
          plan_slug: data.plan_slug,
          plan_id: plan.id,
        },
        notification_url: publicWebhookUrl(),
      }),
    });

    const qr = mp?.point_of_interaction?.transaction_data ?? {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      establishment_id: data.establishment_id,
      plan_id: plan.id,
      plan_slug: plan.slug,
      mp_payment_id: String(mp.id),
      mp_order_id: mp.order?.id ? String(mp.order.id) : null,
      amount,
      currency: mp.currency_id ?? "BRL",
      method: "pix",
      status: mp.status ?? "pending",
      status_detail: mp.status_detail ?? null,
      pix_qr_code: qr.qr_code ?? null,
      pix_qr_code_base64: qr.qr_code_base64 ?? null,
      pix_copy_paste: qr.qr_code ?? null,
      pix_expires_at: expiresAt,
      payer_email: payerEmail,
      payer_doc: data.payer_doc ?? null,
      idempotency_key: idempotencyKey,
      raw: mp,
    } as never);

    return {
      mp_payment_id: String(mp.id),
      status: mp.status as string,
      amount,
      qr_code: qr.qr_code ?? null,
      qr_code_base64: qr.qr_code_base64 ?? null,
      ticket_url: qr.ticket_url ?? null,
      expires_at: expiresAt,
    };
  });

// ----------- Cartão de crédito -----------
export const createCardPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan_slug: z.string().min(1),
    token: z.string().min(10),                       // gerado pelo SDK no browser
    payment_method_id: z.string().min(2),            // ex: 'visa','master'
    installments: z.number().int().min(1).max(12),
    issuer_id: z.string().optional(),
    payer_email: z.string().email(),
    payer_doc_type: z.enum(["CPF","CNPJ"]).default("CPF"),
    payer_doc_number: z.string().min(6).max(20),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, data.establishment_id);
    const plan = await getPlanOrThrow(supabase, data.plan_slug);
    const { computeUpgradeCharge } = await import("@/lib/plan-proration.server");
    const quote = await computeUpgradeCharge(data.establishment_id, plan as never);
    const amount = quote.amount;
    if (!(amount > 0)) throw new Error("Este plano não é cobrado (grátis) — nada a pagar.");
    await assertMercadoPagoPaymentReady(data.payer_email);

    const idempotencyKey = crypto.randomUUID();


    const mp = await mpFetch("/v1/payments", {
      method: "POST",
      idempotencyKey,
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Assinatura ${plan.name} — Fidelize`,
        token: data.token,
        installments: data.installments,
        payment_method_id: data.payment_method_id,
        issuer_id: data.issuer_id,
        payer: {
          email: data.payer_email,
          identification: { type: data.payer_doc_type, number: data.payer_doc_number.replace(/\D/g, "") },
        },
        statement_descriptor: "FIDELIZE",
        metadata: {
          establishment_id: data.establishment_id,
          plan_slug: data.plan_slug,
          plan_id: plan.id,
        },
        notification_url: publicWebhookUrl(),
      }),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      establishment_id: data.establishment_id,
      plan_id: plan.id,
      plan_slug: plan.slug,
      mp_payment_id: String(mp.id),
      mp_order_id: mp.order?.id ? String(mp.order.id) : null,
      amount,
      currency: mp.currency_id ?? "BRL",
      method: "credit_card",
      status: mp.status ?? "pending",
      status_detail: mp.status_detail ?? null,
      card_last4: mp.card?.last_four_digits ?? null,
      card_brand: mp.payment_method_id ?? null,
      installments: data.installments,
      payer_email: data.payer_email,
      payer_doc: data.payer_doc_number,
      idempotency_key: idempotencyKey,
      raw: mp,
    } as never);

    return {
      mp_payment_id: String(mp.id),
      status: mp.status as string,
      status_detail: mp.status_detail as string,
      amount,
    };
  });

// ----------- Boleto -----------
export const createBoletoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan_slug: z.string().min(1),
    payer_email: z.string().email(),
    payer_first_name: z.string().max(60),
    payer_last_name: z.string().max(60),
    payer_doc_number: z.string().min(11).max(14),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, data.establishment_id);
    const plan = await getPlanOrThrow(supabase, data.plan_slug);
    const { computeUpgradeCharge } = await import("@/lib/plan-proration.server");
    const quote = await computeUpgradeCharge(data.establishment_id, plan as never);
    const amount = quote.amount;
    if (!(amount > 0)) throw new Error("Este plano não é cobrado (grátis).");
    await assertMercadoPagoPaymentReady(data.payer_email);

    const idempotencyKey = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();

    const mp = await mpFetch("/v1/payments", {
      method: "POST",
      idempotencyKey,
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Assinatura ${plan.name} — Fidelize`,
        payment_method_id: "bolbradesco",
        date_of_expiration: expiresAt,
        payer: {
          email: data.payer_email,
          first_name: data.payer_first_name,
          last_name: data.payer_last_name,
          identification: { type: data.payer_doc_number.length > 11 ? "CNPJ" : "CPF", number: data.payer_doc_number.replace(/\D/g, "") },
        },
        metadata: {
          establishment_id: data.establishment_id,
          plan_slug: data.plan_slug,
          plan_id: plan.id,
        },
        notification_url: publicWebhookUrl(),
      }),
    });

    const boletoUrl = mp?.transaction_details?.external_resource_url ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      establishment_id: data.establishment_id,
      plan_id: plan.id,
      plan_slug: plan.slug,
      mp_payment_id: String(mp.id),
      amount,
      currency: mp.currency_id ?? "BRL",
      method: "boleto",
      status: mp.status ?? "pending",
      status_detail: mp.status_detail ?? null,
      boleto_url: boletoUrl,
      pix_expires_at: expiresAt,
      payer_email: data.payer_email,
      payer_doc: data.payer_doc_number,
      idempotency_key: idempotencyKey,
      raw: mp,
    } as never);

    return { mp_payment_id: String(mp.id), status: mp.status, boleto_url: boletoUrl, expires_at: expiresAt, amount };
  });

// ----------- Status polling -----------
export const getPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    mp_payment_id: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // valida acesso ao pagamento (RLS)
    const { data: pay } = await supabase.from("payments")
      .select("id, establishment_id, status, method, amount, plan_slug, receipt_url, pix_qr_code, pix_qr_code_base64, pix_copy_paste, pix_expires_at, boleto_url, mp_payment_id")
      .eq("mp_payment_id", data.mp_payment_id).maybeSingle();
    if (!pay) throw new Error("Pagamento não encontrado.");
    await assertOwner(supabase, userId, pay.establishment_id);

    // consulta autoritativa no MP
    const mp = await mpFetch(`/v1/payments/${data.mp_payment_id}`);
    // atualiza status espelho (o webhook é a fonte da verdade para ativar plano)
    if (mp.status && mp.status !== pay.status) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("payments").update({
        status: mp.status,
        status_detail: mp.status_detail ?? null,
        raw: mp,
        approved_at: mp.status === "approved" ? new Date().toISOString() : null,
        receipt_url: mp?.transaction_details?.external_resource_url ?? pay.receipt_url,
      } as never).eq("id", pay.id);
    }
    return {
      mp_payment_id: String(mp.id),
      status: mp.status,
      status_detail: mp.status_detail,
      amount: mp.transaction_amount,
    };
  });

// ----------- Histórico -----------
export const listMyPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(25),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("payments")
      .select("*", { count: "exact" })
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false });
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const fromIdx = (data.page - 1) * data.page_size;
    const toIdx = fromIdx + data.page_size - 1;
    const { data: rows, count } = await q.range(fromIdx, toIdx);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, page_size: data.page_size };
  });

// ----------- Cancelar assinatura -----------
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, data.establishment_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscriptions").update({
      status: "cancelled",
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
    } as never).eq("establishment_id", data.establishment_id);
    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id,
      user_id: userId,
      action: "subscription_cancelled",
      entity_type: "subscription",
      entity_id: data.establishment_id,
      metadata: { at: new Date().toISOString() } as never,
    });
    const { safeNotifyOriginPartner } = await import("@/lib/integrations/lifecycle-sync.server");
    await safeNotifyOriginPartner({
      tenantId: data.establishment_id,
      event: "subscription.cancelled",
      actorUserId: userId,
      origin: "app",
    });
    return { ok: true };
  });

// ----------- Admin: test connection -----------
export const adminTestMercadoPagoConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Apenas Super Administradores podem testar.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadMercadoPagoCredentials } = await import("./mercadopago-credentials.server");
    const credentials = await loadMercadoPagoCredentials(true);
    const { data: settings } = await supabaseAdmin
      .from("payment_settings")
      .select("environment")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const configuredEnvironment = credentials.mode ?? ((settings as any)?.environment as string | null) ?? "production";
    try {
      const me = await mpFetch("/users/me");
      const isTestAccount = inferMercadoPagoTestAccount(me);
      const accountLabel = me.nickname ?? me.email ?? me.id;
      const hasEnvironmentMismatch = configuredEnvironment !== "sandbox" && isTestAccount;
      const message = hasEnvironmentMismatch
        ? formatMpCredentialMismatchMessage({ configuredEnvironment, accountNickname: me.nickname ?? null })
        : `Conectado como ${accountLabel}`;
      await supabaseAdmin.from("payment_settings").update({
        last_tested_at: new Date().toISOString(),
        last_test_status: hasEnvironmentMismatch ? "error" : "ok",
        last_test_message: message,
        webhook_url: publicWebhookUrl(),
        account_id: me.id ? String(me.id) : null,
        account_email: me.email ?? null,
        account_nickname: me.nickname ?? null,
      } as never).neq("id", "00000000-0000-0000-0000-000000000000");
      const result = { ok: !hasEnvironmentMismatch, account: { id: me.id, email: me.email, nickname: me.nickname, site_id: me.site_id, live_mode: !isTestAccount, is_test_user: isTestAccount }, configuration_issue: hasEnvironmentMismatch ? message : null };
      if (hasEnvironmentMismatch) throw new Error(message);
      return result;
    } catch (e: any) {
      await supabaseAdmin.from("payment_settings").update({
        last_tested_at: new Date().toISOString(),
        last_test_status: "error",
        last_test_message: e?.message ?? String(e),
      } as never).neq("id", "00000000-0000-0000-0000-000000000000");
      throw e;
    }
  });

export const adminGetPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("payment_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const { loadMercadoPagoCredentials } = await import("./mercadopago-credentials.server");
    const creds = await loadMercadoPagoCredentials(true);
    const hasToken = !!creds.access_token;
    const hasSecret = !!creds.webhook_secret;
    const canonicalUrl = publicWebhookUrl();
    const storedUrl = ((data as any)?.webhook_url as string | null) ?? null;
    const norm = (u: string | null) => (u ?? "").replace(/\/+$/, "").toLowerCase();
    const stale = !!storedUrl && norm(storedUrl) !== norm(canonicalUrl);

    // Auditar divergência (dedupe: máx 1 log/hora por par de URLs)
    let lastDivergenceAt: string | null = null;
    if (stale) {
      const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("audit_logs")
        .select("id, created_at, metadata")
        .eq("action", "mp_webhook_url_divergence")
        .gte("created_at", oneHourAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sameRecent =
        recent &&
        norm(((recent as any).metadata?.stored_url as string) ?? "") === norm(storedUrl) &&
        norm(((recent as any).metadata?.canonical_url as string) ?? "") === norm(canonicalUrl);
      if (!sameRecent) {
        const { data: inserted } = await supabaseAdmin.from("audit_logs").insert({
          user_id: userId,
          action: "mp_webhook_url_divergence",
          entity_type: "payment_settings",
          metadata: {
            stored_url: storedUrl,
            canonical_url: canonicalUrl,
            detected_at: new Date().toISOString(),
          } as never,
        } as never).select("created_at").maybeSingle();
        lastDivergenceAt = ((inserted as any)?.created_at as string) ?? new Date().toISOString();
      } else {
        lastDivergenceAt = (recent as any).created_at as string;
      }
    }

    const publicKeySource: "env" | "db" | null =
      creds.sources.public_key === "env" ? "env"
      : creds.sources.public_key ? "db"
      : null;
    const accountNickname = ((data as any)?.account_nickname as string | null) ?? null;
    const lastTestMessage = ((data as any)?.last_test_message as string | null) ?? null;
    const accountIsTestUser = /^TESTUSER/i.test(accountNickname ?? "") || /TESTUSER/i.test(lastTestMessage ?? "");
    const effectiveEnvironment = creds.mode ?? ((data as any)?.environment ?? "production");
    const configurationIssue = effectiveEnvironment !== "sandbox" && accountIsTestUser
      ? formatMpCredentialMismatchMessage({ configuredEnvironment: effectiveEnvironment, accountNickname: accountNickname ?? lastTestMessage })
      : null;

    const effectiveSettings = {
      ...((data as Record<string, unknown> | null) ?? {}),
      environment: effectiveEnvironment,
      public_key: creds.public_key ?? ((data as any)?.public_key as string | null) ?? "",
    };

    return {
      settings: effectiveSettings,
      legacy_settings: data,
      effective_environment: effectiveEnvironment,
      webhook_url: canonicalUrl,
      stored_webhook_url: storedUrl,
      webhook_url_stale: stale,
      settings_updated_at: ((data as any)?.updated_at as string | null) ?? null,
      last_divergence_at: lastDivergenceAt,
      credentials: {
        has_access_token: hasToken,
        has_webhook_secret: hasSecret,
        has_public_key: !!creds.public_key,
        public_key_source: publicKeySource,
        access_token_source: creds.sources.access_token,
        webhook_secret_source: creds.sources.webhook_secret,
      },
      mp_account_is_test_user: accountIsTestUser,
      configuration_issue: configurationIssue,
    };
  });


export const adminUpdatePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    environment: z.enum(["sandbox","production"]),
    public_key: z.string().max(200).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cleanPublicKey = data.public_key?.trim() || null;
    const { count, error } = await supabaseAdmin.from("payment_settings").update({
      environment: data.environment,
      public_key: cleanPublicKey,
      webhook_url: publicWebhookUrl(),
      updated_at: new Date().toISOString(),
    } as never, { count: "exact" }).neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
    if (!count) {
      const { error: insertError } = await supabaseAdmin.from("payment_settings").insert({
        environment: data.environment,
        public_key: cleanPublicKey,
        webhook_url: publicWebhookUrl(),
      } as never);
      if (insertError) throw insertError;
    }

    const { data: existingIntegration } = await (supabaseAdmin as any)
      .from("integrations")
      .select("credentials")
      .eq("category", "payments")
      .eq("provider", "mercadopago")
      .maybeSingle();
    const mergedCredentials: Record<string, string> = { ...(((existingIntegration as any)?.credentials ?? {}) as Record<string, string>) };
    if (cleanPublicKey) mergedCredentials.public_key = cleanPublicKey;
    else delete mergedCredentials.public_key;
    const { error: integrationError } = await (supabaseAdmin as any)
      .from("integrations")
      .upsert({
        category: "payments",
        provider: "mercadopago",
        mode: data.environment,
        credentials: mergedCredentials,
        updated_by: userId,
      }, { onConflict: "category,provider" });
    if (integrationError) throw new Error(integrationError.message);

    try {
      const { invalidateMercadoPagoCredentialsCache } = await import("./mercadopago-credentials.server");
      invalidateMercadoPagoCredentialsCache();
    } catch { /* noop */ }

    return { ok: true };
  });

// ----------- Admin: sync stored webhook URL to canonical -----------
export const adminSyncWebhookUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const canonical = publicWebhookUrl();
    const { data: before } = await supabaseAdmin.from("payment_settings").select("webhook_url").limit(1).maybeSingle();
    const storedBefore = ((before as any)?.webhook_url as string | null) ?? null;
    await supabaseAdmin.from("payment_settings").update({
      webhook_url: canonical,
      updated_at: new Date().toISOString(),
    } as never).neq("id", "00000000-0000-0000-0000-000000000000");
    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: "mp_webhook_url_synced",
        entity_type: "payment_settings",
        metadata: { from: storedBefore, to: canonical, at: new Date().toISOString() } as never,
      } as never);
    } catch { /* noop */ }
    return { ok: true, from: storedBefore, to: canonical };
  });

// ----------- Admin: simulate a real event delivery -----------
export const adminSendWebhookTestEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");

    const url = publicWebhookUrl();
    const started = Date.now();
    const probeId = `probe-${Date.now()}`;
    const body = {
      type: "test",
      action: "test.created",
      live_mode: false,
      data: { id: "123456" },
      _probe: probeId,
    };

    let status: number | null = null;
    let responseText = "";
    let networkError: string | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "user-agent": "Fidelize-Webhook-Probe/1.0",
        },
        body: JSON.stringify(body),
      });
      status = res.status;
      responseText = (await res.text()).slice(0, 200);
    } catch (e: any) {
      networkError = e?.message ?? String(e);
    }
    const latency = Date.now() - started;

    // Confirmar que o handler gravou em payment_logs após o started
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sinceIso = new Date(started - 2000).toISOString();
    const { data: logs } = await supabaseAdmin
      .from("payment_logs")
      .select("id, created_at, mode, processed, response_status, reason, payload")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20);
    const match = (logs ?? []).find((r: any) => r?.payload?._probe === probeId) ?? null;

    const ok = status !== null && status >= 200 && status < 300 && !!match;
    const message = networkError
      ? `Falha de rede: ${networkError}`
      : !status || status < 200 || status >= 300
        ? `Endpoint respondeu HTTP ${status ?? "?"}. Verifique se a rota está publicada em ${url}.`
        : match
          ? `Evento sintético entregue e persistido em payment_logs em ${latency}ms.`
          : `HTTP ${status} recebido, mas o log de webhook não foi encontrado. Verifique se o handler gravou o evento.`;

    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: "mp_webhook_probe",
        entity_type: "payment_settings",
        metadata: {
          url, ok, status, latency_ms: latency, probe_id: probeId, match_id: (match as any)?.id ?? null,
        } as never,
      } as never);
    } catch { /* noop */ }

    return {
      ok,
      url,
      status,
      latency_ms: latency,
      body_snippet: responseText,
      log_matched: !!match,
      log_id: (match as any)?.id ?? null,
      log_processed: (match as any)?.processed ?? null,
      message,
      checked_at: new Date().toISOString(),
    };
  });

function publicWebhookUrl(): string {
  return `${getPublicAppUrl()}/api/public/webhooks/mercadopago`;
}

// ----------- Admin: dual probe (unsigned simulator + signed live) -----------
export const adminSendWebhookDualTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");

    const { createHmac } = await import("crypto");
    const url = publicWebhookUrl();
    const { loadMercadoPagoCredentials } = await import("./mercadopago-credentials.server");
    const secret = (await loadMercadoPagoCredentials(true)).webhook_secret ?? "";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    async function findLog(probeId: string, sinceMs: number) {
      const sinceIso = new Date(sinceMs - 2000).toISOString();
      const { data: logs } = await supabaseAdmin
        .from("payment_logs")
        .select("id, created_at, mode, processed, response_status, reason, signature_valid, live_mode, payload")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(30);
      return (logs ?? []).find((r: any) => r?.payload?._probe === probeId) ?? null;
    }

    async function send(payload: Record<string, unknown>, headers: Record<string, string>) {
      const started = Date.now();
      let status: number | null = null;
      let body_snippet = "";
      let network_error: string | null = null;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "user-agent": "Fidelize-Webhook-Probe/1.0", ...headers },
          body: JSON.stringify(payload),
        });
        status = res.status;
        body_snippet = (await res.text()).slice(0, 200);
      } catch (e: any) {
        network_error = e?.message ?? String(e);
      }
      return { started, status, body_snippet, network_error, latency_ms: Date.now() - started };
    }

    // --- Path A: unsigned simulator (test/handshake) ---
    const probeA = `probe-sim-${Date.now()}`;
    const payloadA = { type: "test", action: "test.created", live_mode: false, data: { id: "123456" }, _probe: probeA };
    const sendA = await send(payloadA, {});
    const logA = await findLog(probeA, sendA.started);
    const okA =
      sendA.status !== null && sendA.status >= 200 && sendA.status < 300 && !!logA && (logA as any).processed === true;

    // --- Path B: HMAC-signed live event ---
    const probeB = `probe-live-${Date.now()}`;
    const dataIdB = probeB.toLowerCase();
    const ts = Date.now().toString();
    const requestId = probeB;
    const manifest = `id:${dataIdB};request-id:${requestId};ts:${ts};`;
    const signature = secret ? createHmac("sha256", secret).update(manifest).digest("hex") : "";
    const payloadB = {
      type: "webhook_probe",
      action: "probe.signed",
      live_mode: true,
      data: { id: dataIdB },
      _probe: probeB,
    };
    const headersB: Record<string, string> = { "x-request-id": requestId };
    if (secret) headersB["x-signature"] = `ts=${ts},v1=${signature}`;
    const sendB = await send(payloadB, headersB);
    const logB = await findLog(probeB, sendB.started);
    const okB = !!secret &&
      sendB.status !== null && sendB.status >= 200 && sendB.status < 300 &&
      !!logB && (logB as any).signature_valid === true && (logB as any).processed === true;

    const summary = {
      has_webhook_secret: !!secret,
      checked_at: new Date().toISOString(),
      url,
    };

    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: "mp_webhook_dual_probe",
        entity_type: "payment_settings",
        metadata: {
          url,
          simulator: { ok: okA, status: sendA.status, log_id: (logA as any)?.id ?? null, latency_ms: sendA.latency_ms },
          live: { ok: okB, status: sendB.status, log_id: (logB as any)?.id ?? null, latency_ms: sendB.latency_ms, has_secret: !!secret },
        } as never,
      } as never);
    } catch { /* noop */ }

    return {
      ...summary,
      simulator: {
        ok: okA,
        path: "sem HMAC (handshake do painel MP)",
        path_explanation:
          "Payload disparado como o botão \"Testar URL\" do painel Mercado Pago: sem cabeçalho x-signature. O handler classifica como TESTE e aceita sem verificar HMAC porque combina duas regras — `type:\"test\"` no body e `action:\"test.created\"`.",
        detection_rule: "explicit_type_test + explicit_action_test",
        expected_log_mode: "test",
        expected_signature_valid: false,
        status: sendA.status,
        latency_ms: sendA.latency_ms,
        body_snippet: sendA.body_snippet,
        network_error: sendA.network_error,
        log_matched: !!logA,
        log_id: (logA as any)?.id ?? null,
        log_processed: (logA as any)?.processed ?? null,
        log_mode: (logA as any)?.mode ?? null,
        signature_valid: (logA as any)?.signature_valid ?? null,
        message: sendA.network_error
          ? `Falha de rede: ${sendA.network_error}`
          : okA
            ? `Handshake aceito sem assinatura (HTTP ${sendA.status}, ${sendA.latency_ms}ms) — caminho SEM HMAC.`
            : `Simulador falhou (HTTP ${sendA.status ?? "?"}). Log ${logA ? "encontrado" : "ausente"}.`,
      },
      live: {
        ok: okB,
        path: "com HMAC (evento live real)",
        path_explanation:
          "Payload com `live_mode:true` e cabeçalhos `x-request-id` + `x-signature` (ts + v1) assinados via HMAC-SHA256 com `MERCADOPAGO_WEBHOOK_SECRET`. O handler classifica como LIVE (regra `live_mode_true`, sem simulador) e SÓ aceita se a assinatura conferir com o manifesto `id:<data.id>;request-id:<id>;ts:<ts>;`.",
        detection_rule: "live_mode_true (sem UA restclient-node)",
        expected_log_mode: "live",
        expected_signature_valid: true,
        status: sendB.status,
        latency_ms: sendB.latency_ms,
        body_snippet: sendB.body_snippet,
        network_error: sendB.network_error,
        log_matched: !!logB,
        log_id: (logB as any)?.id ?? null,
        log_processed: (logB as any)?.processed ?? null,
        log_mode: (logB as any)?.mode ?? null,
        signature_valid: (logB as any)?.signature_valid ?? null,
        has_secret: !!secret,
        message: !secret
          ? "MERCADOPAGO_WEBHOOK_SECRET não configurado — não é possível assinar o payload."
          : sendB.network_error
            ? `Falha de rede: ${sendB.network_error}`
            : sendB.status === 401
              ? `HTTP 401 — assinatura rejeitada. Confirme se o secret salvo bate com o do painel MP.`
              : okB
                ? `Evento assinado aceito e validado (HTTP ${sendB.status}, ${sendB.latency_ms}ms) — caminho COM HMAC.`
                : `HTTP ${sendB.status ?? "?"}. Log ${logB ? `signature_valid=${(logB as any).signature_valid}` : "ausente"}.`,
      },
    };
  });

// ----------- Admin: recommended webhook events -----------
export const RECOMMENDED_MP_EVENTS: Array<{ key: string; label: string; required: boolean; description: string }> = [
  { key: "payment", label: "Pagamentos (payment)", required: true, description: "Cobre PIX, cartão e boleto — indispensável para ativar planos após aprovação." },
  { key: "merchant_order", label: "Ordens (merchant_order)", required: true, description: "Reconciliação de pedidos (útil para renovações e estornos parciais)." },
  { key: "subscription_preapproval", label: "Assinaturas recorrentes (opcional)", required: false, description: "Só habilite quando migrar para preapproval/recorrência automática." },
  { key: "chargebacks", label: "Chargebacks (opcional)", required: false, description: "Recebe eventos de contestação; recomendado ativar em produção." },
];

export const adminGetWebhookGuide = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    return { events: RECOMMENDED_MP_EVENTS, webhook_url: publicWebhookUrl() };
  });

// ----------- Admin: webhook delivery logs -----------
export const adminListWebhookLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(50),
    only_errors: z.boolean().default(false),
    event_type: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("payment_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (data.only_errors) q = q.not("error", "is", null);
    if (data.event_type) q = q.eq("event_type", data.event_type);
    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;
    const { data: rows, count } = await q.range(from, to);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, page_size: data.page_size };
  });

// ----------- Admin: validate webhook URL (handshake) -----------
export const adminValidateWebhookUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const url = publicWebhookUrl();
    const started = Date.now();
    const result: {
      url: string; ok: boolean; status: number | null; latency_ms: number;
      https: boolean; reachable: boolean; message: string; body_snippet?: string | null;
    } = { url, ok: false, status: null, latency_ms: 0, https: url.startsWith("https://"), reachable: false, message: "" };

    if (!result.https) {
      result.message = "URL não é HTTPS. Mercado Pago exige HTTPS público (localhost não é aceito).";
      return result;
    }
    try {
      const res = await fetch(url, { method: "GET", headers: { "user-agent": "Fidelize-Webhook-Handshake/1.0" } });
      const text = await res.text();
      result.status = res.status;
      result.reachable = true;
      result.latency_ms = Date.now() - started;
      result.body_snippet = text.slice(0, 200);
      result.ok = res.status >= 200 && res.status < 300;
      result.message = result.ok
        ? `Endpoint respondeu ${res.status} em ${result.latency_ms}ms. Pronto para o Mercado Pago.`
        : res.status === 404
          ? `Endpoint respondeu 404. A URL configurada (${url}) provavelmente ainda não está publicada — publique o app ou aponte PUBLIC_APP_URL para a URL de preview (…-dev.lovable.app).`
          : `Endpoint respondeu ${res.status}. Verifique se a rota está publicada.`;
    } catch (e: any) {
      result.latency_ms = Date.now() - started;
      result.message = `Falha ao alcançar o endpoint: ${e?.message ?? String(e)}. Publique o app antes de validar o webhook em produção.`;
    }

    // Auditar handshake
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: "mp_webhook_handshake",
        entity_type: "payment_settings",
        metadata: { url, ok: result.ok, status: result.status, latency_ms: result.latency_ms } as never,
      } as never);
    } catch { /* noop */ }

    return result;
  });

// ----------- Admin: webhook health summary -----------
export const adminGetWebhookHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const url = publicWebhookUrl();
    const { loadMercadoPagoCredentials } = await import("./mercadopago-credentials.server");
    const mpCreds = await loadMercadoPagoCredentials(true);
    const hasSecret = !!mpCreds.webhook_secret;
    const hasToken = !!mpCreds.access_token;

    const [{ data: lastTest }, { data: lastLive }, { data: lastFail }, { count: pending }] = await Promise.all([
      supabaseAdmin.from("payment_logs").select("*").eq("mode", "test").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("payment_logs").select("*").eq("mode", "live").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("payment_logs").select("*").not("error", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("payment_logs").select("id", { count: "exact", head: true }).not("error", "is", null).eq("processed", false),
    ]);

    const ready = hasToken && hasSecret && url.startsWith("https://");

    return {
      webhook_url: url,
      https: url.startsWith("https://"),
      has_access_token: hasToken,
      has_webhook_secret: hasSecret,
      ready,
      last_test: lastTest ?? null,
      last_live: lastLive ?? null,
      last_failure: lastFail ?? null,
      pending_retries: pending ?? 0,
    };
  });

// ----------- Admin: trigger retry queue manually -----------
export const adminRetryWebhookQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { retryFailedWebhooks } = await import("@/routes/api/public/webhooks/mercadopago");
    // Força retry imediato ignorando janela agendada:
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payment_logs").update({ next_retry_at: new Date().toISOString() } as never)
      .not("error", "is", null)
      .neq("error", "invalid_signature")
      .neq("error", "missing_webhook_secret")
      .eq("processed", false)
      .is("next_retry_at", null as never);
    const result = await retryFailedWebhooks(100);
    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: "mp_webhook_retry_manual",
        entity_type: "payment_logs",
        metadata: result as never,
      } as never);
    } catch { /* noop */ }
    return result;
  });

// ----------- Admin: HMAC rejection telemetry (real-time alerts source) -----------
export const adminGetHmacTelemetry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const iso = (ms: number) => new Date(now - ms).toISOString();
    const H1 = iso(60 * 60 * 1000);
    const H24 = iso(24 * 60 * 60 * 1000);
    const D7 = iso(7 * 24 * 60 * 60 * 1000);

    const base = () => supabaseAdmin
      .from("payment_logs")
      .select("id", { count: "exact", head: true })
      .eq("mode", "live")
      .eq("signature_valid", false)
      .in("error", ["invalid_signature", "missing_webhook_secret"]);

    const [{ count: c1h }, { count: c24h }, { count: c7d }, { data: recent }, { data: last }] = await Promise.all([
      base().gte("created_at", H1),
      base().gte("created_at", H24),
      base().gte("created_at", D7),
      supabaseAdmin.from("payment_logs")
        .select("id, created_at, mp_id, event_type, error, response_status, headers, live_mode")
        .eq("mode", "live").eq("signature_valid", false)
        .in("error", ["invalid_signature", "missing_webhook_secret"])
        .order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("payment_logs")
        .select("id, created_at, mp_id, error")
        .eq("mode", "live").eq("signature_valid", false)
        .in("error", ["invalid_signature", "missing_webhook_secret"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    return {
      last_1h: c1h ?? 0,
      last_24h: c24h ?? 0,
      last_7d: c7d ?? 0,
      last_at: last?.created_at ?? null,
      last_error: last?.error ?? null,
      recent: recent ?? [],
      has_webhook_secret: !!(await (await import("./mercadopago-credentials.server")).loadMercadoPagoCredentials(true)).webhook_secret,
    };
  });



