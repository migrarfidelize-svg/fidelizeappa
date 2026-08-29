import { createFileRoute } from "@tanstack/react-router";
import {
  verifyMercadoPagoSignature,
  mapMpStatusToPaymentStatus,
  mapMpMethod,
  classifyMercadoPagoRequest,
  evaluateMercadoPagoWebhookSecurity,
  isRetryableMercadoPagoWebhookError,
} from "@/lib/mercadopago-webhook";

// Webhook oficial do Mercado Pago.
// Ref: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
//
// Validação de assinatura (obrigatória em produção):
//   Header: x-signature: ts=<timestamp>,v1=<hex_hmac_sha256>
//   Header: x-request-id: <uuid>
//   Query:  data.id=<resource_id>
//   Template: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
//   Chave HMAC = MERCADOPAGO_WEBHOOK_SECRET (segredo da assinatura da app)
//
// A rota está sob /api/public/*, portanto passa o gate de autenticação:
// segurança vem da validação HMAC + consulta autoritativa no MP com Access Token.

const MP_API = "https://api.mercadopago.com";

async function fetchPaymentFromMP(paymentId: string, accessToken: string) {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MP GET /v1/payments/${paymentId} ${res.status}: ${text}`);
  return JSON.parse(text) as any;
}

async function fetchMerchantOrderFromMP(orderId: string, accessToken: string) {
  const res = await fetch(`${MP_API}/merchant_orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MP GET /merchant_orders/${orderId} ${res.status}: ${text}`);
  return JSON.parse(text) as any;
}

async function fetchOrderFromMP(orderId: string, accessToken: string) {
  // Novo Orders API (Point/Checkout Bricks). Ref: developers.mercadopago.com/pt/reference/orders
  const res = await fetch(`${MP_API}/v1/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MP GET /v1/orders/${orderId} ${res.status}: ${text}`);
  return JSON.parse(text) as any;
}

async function fetchPreapprovalFromMP(preapprovalId: string, accessToken: string) {
  const res = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MP GET /preapproval/${preapprovalId} ${res.status}: ${text}`);
  return JSON.parse(text) as any;
}






async function processPaymentEvent(paymentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { requireMercadoPagoAccessToken } = await import("@/lib/mercadopago-credentials.server");
  const accessToken = await requireMercadoPagoAccessToken();

  const mp = await fetchPaymentFromMP(paymentId, accessToken);

  // Cobrança avulsa de anúncio patrocinado: fluxo próprio, não mexe em assinatura.
  if (mp.metadata?.kind === "sponsored_ad") {
    const status = mapMpStatusToPaymentStatus(mp.status);
    const { settleAdOrderPaid } = await import("@/lib/sponsored-ads-payments.server");
    if (status === "approved") {
      await settleAdOrderPaid(String(mp.id), mp.status ?? "approved");
    } else {
      await supabaseAdmin
        .from("sponsored_ad_orders")
        .update({ gateway_status: mp.status ?? null, updated_at: new Date().toISOString() })
        .eq("external_payment_id", String(mp.id));
    }
    return;
  }

  // Localiza pagamento no banco (foi criado no ato do createPix/Card)
  const { data: pay } = await supabaseAdmin
    .from("payments")
    .select("id, establishment_id, plan_id, plan_slug, subscription_id, status")
    .eq("mp_payment_id", String(mp.id))
    .maybeSingle();


  const newStatus = mapMpStatusToPaymentStatus(mp.status);
  const approvedAt = newStatus === "approved" ? new Date().toISOString() : null;

  const updatePayload: any = {
    status: newStatus,
    status_detail: mp.status_detail ?? null,
    mp_order_id: mp.order?.id ? String(mp.order.id) : null,
    raw: mp,
    updated_at: new Date().toISOString(),
  };
  if (approvedAt) updatePayload.approved_at = approvedAt;
  if (mp.transaction_details?.external_resource_url) updatePayload.receipt_url = mp.transaction_details.external_resource_url;

  if (pay) {
    await supabaseAdmin.from("payments").update(updatePayload).eq("id", pay.id);
  } else {
    // Fallback: pagamento chegou pelo webhook sem registro prévio (raro; ex: cobrança externa) — grava mesmo assim.
    await supabaseAdmin.from("payments").insert({
      mp_payment_id: String(mp.id),
      amount: mp.transaction_amount ?? 0,
      currency: mp.currency_id ?? "BRL",
      method: mapMpMethod(mp.payment_type_id),
      status: newStatus,
      status_detail: mp.status_detail ?? null,
      payer_email: mp.payer?.email ?? null,
      establishment_id: mp.metadata?.establishment_id ?? null,
      plan_slug: mp.metadata?.plan_slug ?? null,
      raw: mp,
    });
  }

  // Se aprovado, ativa o plano pela metadata do MP (fonte da verdade).
  if (newStatus === "approved") {
    const estId: string | null = pay?.establishment_id ?? mp.metadata?.establishment_id ?? null;
    const planSlug: string | null = pay?.plan_slug ?? mp.metadata?.plan_slug ?? null;
    if (estId && planSlug) {
      await activatePlan(estId, planSlug, String(mp.id));
    }
    // Notifica os super admins apenas na transição para aprovado (webhook pode repetir).
    if (pay?.status !== "approved") {
      const { notifyAdminsOfSale } = await import("@/lib/admin-sales-notify.server");
      await notifyAdminsOfSale({
        establishmentId: estId,
        planSlug,
        amount: mp.transaction_amount ?? null,
        currency: mp.currency_id ?? "BRL",
        provider: "mercadopago",
        paymentId: String(mp.id),
      });
    }
  }

}

async function processMerchantOrderEvent(orderId: string) {
  const { requireMercadoPagoAccessToken } = await import("@/lib/mercadopago-credentials.server");
  const accessToken = await requireMercadoPagoAccessToken();

  const order = await fetchMerchantOrderFromMP(orderId, accessToken);
  const paymentIds = Array.from(new Set(
    ((order?.payments ?? []) as any[])
      .map((payment) => payment?.id)
      .filter((id): id is string | number => id !== null && id !== undefined)
      .map((id) => String(id)),
  ));

  if (paymentIds.length === 0) {
    throw new Error(`Merchant order ${orderId} sem pagamentos associados para reconciliar.`);
  }

  for (const paymentId of paymentIds) {
    await processPaymentEvent(paymentId);
  }
}

async function processOrderEvent(orderId: string) {
  // Orders API (Point/Checkout Bricks). Reconcilia via os pagamentos internos do order.
  const { requireMercadoPagoAccessToken } = await import("@/lib/mercadopago-credentials.server");
  const accessToken = await requireMercadoPagoAccessToken();

  const order = await fetchOrderFromMP(orderId, accessToken);
  const payments = (order?.transactions?.payments ?? []) as any[];
  const paymentIds = Array.from(new Set(
    payments
      .map((payment) => payment?.id)
      .filter((id): id is string | number => id !== null && id !== undefined)
      .map((id) => String(id)),
  ));

  if (paymentIds.length === 0) {
    // Ordens podem chegar sem pagamentos ainda (ex: created/processing). Sem erro — apenas nada a reconciliar agora.
    return;
  }

  for (const paymentId of paymentIds) {
    try {
      await processPaymentEvent(paymentId);
    } catch (e) {
      // Alguns payment IDs de Orders podem ser sintéticos (ex.: PAY01...). Ignora erros individuais para não travar o order.
      console.warn(`[mp-webhook] falha ao processar pagamento ${paymentId} do order ${orderId}:`, e);
    }
  }
}

async function processSubscriptionPreapprovalEvent(preapprovalId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { requireMercadoPagoAccessToken } = await import("@/lib/mercadopago-credentials.server");
  const accessToken = await requireMercadoPagoAccessToken();

  const preapproval = await fetchPreapprovalFromMP(preapprovalId, accessToken);

  // Localiza subscription pelo mp_subscription_id (preferido) ou external_id (fallback).
  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id, establishment_id, plan_id, tier, status")
    .or(`mp_subscription_id.eq.${preapprovalId},external_id.eq.${preapprovalId}`)
    .maybeSingle();

  const rawStatus = String(preapproval?.status ?? "").toLowerCase();
  // authorized → active; paused → past_due; cancelled/finished → cancelled
  const mapped = rawStatus === "authorized" ? "active"
    : rawStatus === "paused" ? "past_due"
    : rawStatus === "cancelled" || rawStatus === "finished" ? "cancelled"
    : rawStatus || "pending";

  const nextPayment = preapproval?.next_payment_date ? new Date(preapproval.next_payment_date).toISOString() : null;

  if (existing) {
    const updatePayload: any = {
      status: mapped,
      mp_subscription_id: preapprovalId,
      next_billing_date: nextPayment,
      cancel_at_period_end: mapped === "cancelled",
      updated_at: new Date().toISOString(),
    };
    if (mapped === "cancelled") updatePayload.cancelled_at = new Date().toISOString();
    await supabaseAdmin.from("subscriptions").update(updatePayload).eq("id", existing.id);

    // Se cancelado, registra evento e opcionalmente desativa establishment.
    if (mapped === "cancelled") {
      await supabaseAdmin.from("subscription_events").insert({
        establishment_id: existing.establishment_id,
        event_type: "cancel",
        message: `Assinatura MP ${preapprovalId} cancelada via preapproval.`,
      } as never);
    }
  }
  // Se não existe, registra apenas o log — não criamos subscription "órfã" sem estabelecimento.
}


async function activatePlan(establishmentId: string, planSlug: string, mpPaymentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id, tier, name, price_monthly")
    .eq("slug", planSlug)
    .maybeSingle();
  if (!plan) return;

  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("id, name, plan")
    .eq("id", establishmentId)
    .maybeSingle();
  if (!est) return;

  const fromTier = est.plan as string;
  const toTier = plan.tier as string;

  await supabaseAdmin.from("establishments").update({ plan: toTier as any }).eq("id", establishmentId);

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const { data: existingSub } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  const subPayload: any = {
    plan_id: plan.id,
    tier: toTier as any,
    status: "active",
    provider: "mercadopago",
    current_period_start: now.toISOString(),
    current_period_end: nextMonth.toISOString(),
    next_billing_date: nextMonth.toISOString(),
    mp_last_payment_id: mpPaymentId,
    cancel_at_period_end: false,
  };

  let subscriptionId: string | null = null;
  if (existingSub) {
    subscriptionId = existingSub.id;
    await supabaseAdmin.from("subscriptions").update(subPayload).eq("id", existingSub.id);
  } else {
    const { data: newSub } = await supabaseAdmin
      .from("subscriptions")
      .insert({ establishment_id: establishmentId, ...subPayload })
      .select("id")
      .maybeSingle();
    subscriptionId = newSub?.id ?? null;
  }

  if (subscriptionId) {
    await supabaseAdmin.from("payments")
      .update({ subscription_id: subscriptionId, plan_id: plan.id })
      .eq("mp_payment_id", mpPaymentId);
  }

  // Ao ativar o plano, cria também os recursos iniciais (recompensas, campanhas) que exigem RLS.
  const { ensureEstablishmentInitialResources } = await import("@/lib/loyalty.functions");
  await ensureEstablishmentInitialResources(establishmentId);

  // Audit
  await supabaseAdmin.from("audit_logs").insert({
    establishment_id: establishmentId,
    action: fromTier === toTier ? "subscription_renewed" : "plan_activated",
    entity_type: "subscription",
    entity_id: establishmentId,
    metadata: { from_plan: fromTier, to_plan: toTier, mp_payment_id: mpPaymentId, provider: "mercadopago" } as any,
  });

  // Sincroniza ciclo de vida com o parceiro de origem (ex.: Ronnei)
  if (fromTier !== toTier) {
    const RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3, business: 4 };
    const { safeNotifyOriginPartner } = await import("@/lib/integrations/lifecycle-sync.server");
    await safeNotifyOriginPartner({
      tenantId: establishmentId,
      event: (RANK[toTier] ?? 0) < (RANK[fromTier] ?? 0) ? "subscription.downgraded" : "subscription.upgraded",
      fromPlan: fromTier,
      toPlan: toTier,
      origin: "payment_webhook",
    });
  }


  // Enfileira e-mail de confirmação (Resend via email_queue)
  const { data: owner } = await supabaseAdmin
    .from("establishment_members")
    .select("user_id")
    .eq("establishment_id", establishmentId)
    .eq("role", "owner")
    .eq("active", true)
    .maybeSingle();
  let ownerEmail: string | null = null;
  if (owner?.user_id) {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(owner.user_id);
    ownerEmail = u?.user?.email ?? null;
  }
  if (ownerEmail) {
    await supabaseAdmin.from("email_queue").insert({
      to_email: ownerEmail,
      subject: `Pagamento aprovado — Plano ${plan.name}`,
      html: `<p>Olá!</p><p>Recebemos seu pagamento e o plano <strong>${plan.name}</strong> já está ativo em <strong>${est.name}</strong>.</p><p>Próxima cobrança: ${nextMonth.toLocaleDateString("pt-BR")}</p><p>Obrigado por usar a Fidelize!</p>`,
      status: "queued",
      metadata: { kind: "payment_approved", establishment_id: establishmentId, plan_slug: planSlug, mp_payment_id: mpPaymentId } as never,
    } as never);
  }
}

async function logWebhook(row: {
  event_type: string;
  mp_resource: string | null;
  mp_id: string | null;
  action: string | null;
  live_mode: boolean | null;
  signature_valid: boolean;
  processed: boolean;
  error: string | null;
  payload: any;
  headers: any;
  mode?: string | null;
  reason?: string | null;
  response_status?: number | null;
  next_retry_at?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payment_logs").insert(row as never);
  } catch (e) {
    console.error("payment_logs insert failed", e);
  }
}

/** Backoff (ms): 1min, 5min, 15min, 1h, 6h, 24h — 6 tentativas máx. */
const RETRY_BACKOFF_MS = [60_000, 5*60_000, 15*60_000, 60*60_000, 6*60*60_000, 24*60*60_000];
export const RETRY_MAX_ATTEMPTS = RETRY_BACKOFF_MS.length;

function nextRetryAt(attempt: number): string | null {
  if (attempt >= RETRY_BACKOFF_MS.length) return null;
  return new Date(Date.now() + RETRY_BACKOFF_MS[attempt]).toISOString();
}

export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      GET: async () => new Response("Mercado Pago webhook OK", { status: 200 }),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const rawBody = await request.text();
        const requestId = request.headers.get("x-request-id");
        const signatureHeader = request.headers.get("x-signature");
        const { loadMercadoPagoCredentials } = await import("@/lib/mercadopago-credentials.server");
        const mpCreds = await loadMercadoPagoCredentials(true);
        const secret = mpCreds.webhook_secret ?? "";

        let body: any = {};
        try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }

        const eventType: string = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "unknown";
        const dataId: string | null =
          url.searchParams.get("data.id") ??
          url.searchParams.get("id") ??
          body?.data?.id?.toString() ??
          null;
        const action: string | null = body?.action ?? null;
        const liveMode: boolean | null = typeof body?.live_mode === "boolean" ? body.live_mode : null;

        const userAgent = request.headers.get("user-agent") ?? "";
        const classification = classifyMercadoPagoRequest({
          eventType, action, liveMode, dataId, userAgent,
        });
        const { mode, isTest } = classification;

        const signatureValid = await verifyMercadoPagoSignature({
          signatureHeader, requestId, dataId, secret,
        });

        const logRow = {
          event_type: eventType,
          mp_resource: eventType,
          mp_id: dataId,
          action,
          live_mode: liveMode,
          signature_valid: signatureValid,
          processed: false,
          error: null as string | null,
          payload: body,
          headers: {
            "x-request-id": requestId,
            "x-signature": signatureHeader ? "present" : null,
            "user-agent": userAgent,
            "detection_rule": classification.detection,
          },
          mode,
        };

        // HMAC obrigatória para eventos live. Testes do painel MP não são assinados.
        const security = evaluateMercadoPagoWebhookSecurity({
          mode,
          signatureValid,
          hasWebhookSecret: !!secret,
        });
        if (!security.accepted) {
          await logWebhook({
            ...logRow,
            error: security.error,
            reason: security.reason,
            response_status: security.status,
            next_retry_at: null,
          });
          return new Response(security.error, { status: security.status });
        }

        if (isTest) {
          await logWebhook({
            ...logRow,
            processed: true,
            reason: `Handshake/teste aceito sem HMAC. Regra: ${classification.detection} — ${classification.reason}`,
            response_status: 200,
          });
          return new Response("test ok", { status: 200 });
        }

        try {
          let handled = true;
          if ((eventType === "payment" || eventType.startsWith("payment")) && dataId) {
            await processPaymentEvent(dataId);
          } else if (eventType === "merchant_order" && dataId) {
            await processMerchantOrderEvent(dataId);
          } else if ((eventType === "order" || eventType.startsWith("order")) && dataId) {
            await processOrderEvent(dataId);
          } else if (eventType === "subscription_preapproval" && dataId) {
            await processSubscriptionPreapprovalEvent(dataId);
          } else {
            handled = false;
          }
          await logWebhook({
            ...logRow,
            processed: true,
            reason: !handled
              ? `Evento ${eventType} recebido; sem processador dedicado (nenhuma ação financeira aplicável).`
              : eventType === "merchant_order"
                ? `Merchant order ${dataId} reconciliada com pagamentos associados.`
                : (eventType === "order" || eventType.startsWith("order"))
                  ? `Order ${dataId} reconciliada via Orders API.`
                  : eventType === "subscription_preapproval"
                    ? `Preapproval ${dataId} sincronizada (status ${eventType}).`
                    : `Evento ${eventType} processado com sucesso.`,
            response_status: 200,
          });
          return new Response("ok", { status: 200 });

        } catch (e: any) {
          const errMsg = e?.message ?? String(e);
          const retryAt = nextRetryAt(0);
          await logWebhook({
            ...logRow,
            error: errMsg,
            reason: `Falha ao processar; agendado para retry ${retryAt ?? "(sem mais tentativas)"}`,
            response_status: 200,
            next_retry_at: retryAt,
          });
          // 200 para o MP não gerar loop nativo — reprocessamento é nosso via cron.
          return new Response("logged", { status: 200 });
        }
      },
    },
  },
});

// ----------- Retry worker (exportado para o endpoint /api/public/hooks/mercadopago-retry) -----------
export async function retryFailedWebhooks(limit = 20): Promise<{
  picked: number; recovered: number; failed: number; details: Array<{ id: string; mp_id: string | null; ok: boolean; error?: string }>;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowIso = new Date().toISOString();

  const { data: pending } = await supabaseAdmin
    .from("payment_logs")
    .select("id, mp_id, event_type, retry_count, payload, error, response_status")
    .not("error", "is", null)
    .eq("processed", false)
    .neq("error", "invalid_signature")
    .neq("error", "missing_webhook_secret")
    .lte("next_retry_at", nowIso)
    .lt("retry_count", RETRY_MAX_ATTEMPTS)
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  const rows = pending ?? [];
  const details: Array<{ id: string; mp_id: string | null; ok: boolean; error?: string }> = [];
  let recovered = 0, failed = 0;

  for (const r of rows as any[]) {
    const attempt = (r.retry_count ?? 0) + 1;
    try {
      if (!isRetryableMercadoPagoWebhookError(r.error, r.response_status)) {
        await supabaseAdmin.from("payment_logs").update({
          reason: "Falha de segurança/configuração não entra na fila de retry automático.",
          next_retry_at: null,
          last_retry_at: nowIso,
        } as never).eq("id", r.id);
        failed++;
        details.push({ id: r.id, mp_id: r.mp_id, ok: false, error: r.error ?? "non_retryable" });
        continue;
      }
      const et = String(r.event_type ?? "");
      if ((et === "payment" || et.startsWith("payment")) && r.mp_id) {
        await processPaymentEvent(String(r.mp_id));
      } else if (et === "merchant_order" && r.mp_id) {
        await processMerchantOrderEvent(String(r.mp_id));
      } else if ((et === "order" || et.startsWith("order")) && r.mp_id) {
        await processOrderEvent(String(r.mp_id));
      } else if (et === "subscription_preapproval" && r.mp_id) {
        await processSubscriptionPreapprovalEvent(String(r.mp_id));
      } else {
        throw new Error(`Evento ${et || "(sem tipo)"} não possui processador de retry.`);
      }

      await supabaseAdmin.from("payment_logs").update({
        processed: true,
        error: null,
        reason: `Recuperado no retry #${attempt}.`,
        response_status: 200,
        retry_count: attempt,
        last_retry_at: nowIso,
        next_retry_at: null,
      } as never).eq("id", r.id);
      recovered++;
      details.push({ id: r.id, mp_id: r.mp_id, ok: true });
    } catch (e: any) {
      const errMsg = e?.message ?? String(e);
      const next = nextRetryAt(attempt);
      await supabaseAdmin.from("payment_logs").update({
        error: errMsg,
        reason: next
          ? `Retry #${attempt} falhou; próxima tentativa ${next}.`
          : `Retry #${attempt} falhou; limite de tentativas atingido.`,
        retry_count: attempt,
        last_retry_at: nowIso,
        next_retry_at: next,
      } as never).eq("id", r.id);
      failed++;
      details.push({ id: r.id, mp_id: r.mp_id, ok: false, error: errMsg });
    }
  }

  return { picked: rows.length, recovered, failed, details };
}

