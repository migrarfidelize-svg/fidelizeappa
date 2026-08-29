import { createFileRoute } from "@tanstack/react-router";
import { mapAsaasStatus, mapAsaasBillingTypeToMethod } from "@/lib/asaas.functions";
import {
  authorizeAsaasWebhook,
  buildSubscriptionPeriod,
  decidePaymentTransition,
  isReconcilableAsaasEvent,
  parseAsaasExternalReference,
} from "@/lib/asaas-webhook";

/**
 * Webhook oficial do Asaas.
 * Ref: https://docs.asaas.com/reference/receba-notificacoes-por-webhook
 *
 * Autenticação: cabeçalho `asaas-access-token` deve bater com o token
 * configurado em /hash/integracoes → Asaas → Webhook Token.
 * (O Asaas envia o token exatamente como você cadastrar no painel deles.)
 *
 * A rota vive em /api/public/* — a autorização vem do header + consulta
 * autoritativa via API do Asaas com o Access Token do painel.
 */

async function fetchAsaasPayment(paymentId: string) {
  const { requireAsaasAccessToken } = await import("@/lib/asaas-credentials.server");
  const { token, base } = await requireAsaasAccessToken();
  const res = await fetch(`${base}/payments/${paymentId}`, {
    headers: {
      access_token: token,
      accept: "application/json",
      "User-Agent": "Fidelize/1.0 (+asaas-webhook)",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Asaas GET /payments/${paymentId} ${res.status}: ${text}`);
  return JSON.parse(text) as any;
}

async function logAsaasWebhook(row: {
  event: string;
  payment_id: string | null;
  signature_valid: boolean;
  processed: boolean;
  error: string | null;
  payload: any;
  headers: any;
  response_status: number | null;
  reason?: string | null;
  mode?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("payment_logs").insert({
    provider: "asaas",
    event_type: row.event,
    mp_resource: "payment",
    mp_id: row.payment_id,
    action: row.event,
    signature_valid: row.signature_valid,
    processed: row.processed,
    error: row.error,
    payload: row.payload as never,
    headers: row.headers as never,
    response_status: row.response_status,
    reason: row.reason ?? null,
    mode: row.mode ?? null,
  } as never);
}

async function reconcileAsaasPayment(remotePayment: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const paymentId = String(remotePayment.id);
  const newStatus = mapAsaasStatus(String(remotePayment.status ?? "PENDING"));
  const approvedAt = newStatus === "approved" ? new Date().toISOString() : null;

  const { data: existing } = await supabaseAdmin
    .from("payments")
    .select("id, establishment_id, plan_slug, plan_id, status")
    .eq("provider", "asaas")
    .eq("provider_payment_id", paymentId)
    .maybeSingle();


  const update: Record<string, unknown> = {
    status: newStatus,
    status_detail: remotePayment.status ?? null,
    receipt_url: remotePayment.invoiceUrl ?? remotePayment.transactionReceiptUrl ?? null,
    boleto_url: remotePayment.bankSlipUrl ?? null,
    raw: remotePayment,
    updated_at: new Date().toISOString(),
  };
  if (approvedAt) update.approved_at = approvedAt;

  let estId: string | null = existing?.establishment_id ?? null;
  let planSlug: string | null = existing?.plan_slug ?? null;
  const ref = parseAsaasExternalReference(remotePayment.externalReference);
  if (ref) {
    estId = estId ?? ref.establishmentId;
    planSlug = planSlug ?? ref.planSlug;
  }

  if (existing) {
    await supabaseAdmin.from("payments").update(update as never).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("payments").insert({
      provider: "asaas",
      provider_payment_id: paymentId,
      amount: Number(remotePayment.value ?? 0),
      currency: "BRL",
      method: mapAsaasBillingTypeToMethod(String(remotePayment.billingType ?? "")),
      status: newStatus,
      status_detail: remotePayment.status ?? null,
      receipt_url: remotePayment.invoiceUrl ?? null,
      boleto_url: remotePayment.bankSlipUrl ?? null,
      payer_email: remotePayment.customer ? null : null,
      establishment_id: estId,
      plan_slug: planSlug,
      raw: remotePayment as never,
    } as never);
  }

  const decision = decidePaymentTransition({
    previousStatus: (existing as any)?.status ?? null,
    newStatus,
    establishmentId: estId,
    planSlug,
  });

  {
    if (decision.shouldActivate) {
      await activatePlanAsaas(estId as string, planSlug as string, paymentId);
    }
    if (decision.shouldNotifySale) {
      const { notifyAdminsOfSale } = await import("@/lib/admin-sales-notify.server");
      await notifyAdminsOfSale({
        establishmentId: estId,
        planSlug,
        amount: Number(remotePayment.value ?? 0),
        currency: "BRL",
        provider: "asaas",
        paymentId,
      });
    }
  }

}

async function activatePlanAsaas(establishmentId: string, planSlug: string, providerPaymentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: plan } = await supabaseAdmin
    .from("plans").select("id, tier, name, price_monthly").eq("slug", planSlug).maybeSingle();
  if (!plan) return;
  const { data: est } = await supabaseAdmin
    .from("establishments").select("id, name, plan").eq("id", establishmentId).maybeSingle();
  if (!est) return;

  const fromTier = est.plan as string;
  const toTier = plan.tier as string;
  await supabaseAdmin.from("establishments").update({ plan: toTier as any }).eq("id", establishmentId);

  const period = buildSubscriptionPeriod(new Date());
  const { data: existingSub } = await supabaseAdmin
    .from("subscriptions").select("id").eq("establishment_id", establishmentId).maybeSingle();

  const subPayload: Record<string, unknown> = {
    plan_id: plan.id,
    tier: toTier as any,
    status: "active",
    provider: "asaas",
    external_id: providerPaymentId,
    current_period_start: period.start,
    current_period_end: period.end,
    next_billing_date: period.end,
    cancel_at_period_end: false,
  };
  if (existingSub) {
    await supabaseAdmin.from("subscriptions").update(subPayload as never).eq("id", existingSub.id);
  } else {
    await supabaseAdmin.from("subscriptions").insert({ establishment_id: establishmentId, ...subPayload } as never);
  }

  // Ao ativar o plano, cria recursos iniciais
  const { ensureEstablishmentInitialResources } = await import("@/lib/loyalty.functions");
  await ensureEstablishmentInitialResources(establishmentId);

  await supabaseAdmin.from("audit_logs").insert({
    establishment_id: establishmentId,
    action: fromTier === toTier ? "subscription_renewed" : "plan_activated",
    entity_type: "subscription",
    entity_id: establishmentId,
    metadata: { from_plan: fromTier, to_plan: toTier, provider: "asaas", asaas_payment_id: providerPaymentId } as any,
  });

  if (fromTier !== toTier) {
    const { safeNotifyOriginPartner } = await import("@/lib/integrations/lifecycle-sync.server");
    await safeNotifyOriginPartner({
      tenantId: establishmentId,
      event: (PLAN_SYNC_RANK[toTier] ?? 0) < (PLAN_SYNC_RANK[fromTier] ?? 0)
        ? "subscription.downgraded"
        : "subscription.upgraded",
      fromPlan: fromTier,
      toPlan: toTier,
      origin: "payment_webhook",
    });
  }
}

const PLAN_SYNC_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3, business: 4 };

export const Route = createFileRoute("/api/public/webhooks/asaas")({
  server: {
    handlers: {
      GET: async () => new Response("Asaas webhook OK", { status: 200 }),
      POST: async ({ request }) => {
        const rawBody = await request.text();
        let body: any = {};
        try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }

        const providedToken = request.headers.get("asaas-access-token") ?? request.headers.get("Asaas-Access-Token");
        const event: string = String(body?.event ?? "unknown");
        const payment: any = body?.payment ?? null;
        const paymentId: string | null = payment?.id ? String(payment.id) : null;

        const { loadAsaasCredentials } = await import("@/lib/asaas-credentials.server");
        const creds = await loadAsaasCredentials(true);
        const expected = creds.webhook_token;

        const headersLog = {
          "asaas-access-token": providedToken ? "present" : null,
          "user-agent": request.headers.get("user-agent"),
        };

        // Autenticação: se o admin configurou webhook_token, exige match exato.
        const auth = authorizeAsaasWebhook({ expectedToken: expected, providedToken });
        if (!auth.ok) {
          await logAsaasWebhook({
            event, payment_id: paymentId,
            signature_valid: false, processed: false,
            error: auth.error,
            payload: body, headers: headersLog,
            response_status: auth.status,
            reason: auth.reason,
            mode: creds.mode,
          });
          return new Response("invalid token", { status: auth.status });
        }

        try {
          let handled = true;
          if (isReconcilableAsaasEvent(event, paymentId)) {
            // Consulta autoritativa; se falhar (rate-limit, User-Agent, etc.),
            // usamos o próprio payload — o header asaas-access-token já
            // autenticou a origem quando webhook_token está configurado.
            let remote: any = null;
            try {
              remote = await fetchAsaasPayment(paymentId as string);
            } catch (fetchErr) {
              remote = payment;
              await logAsaasWebhook({
                event, payment_id: paymentId,
                signature_valid: auth.signatureValid, processed: false,
                error: (fetchErr as Error)?.message ?? String(fetchErr),
                payload: body, headers: headersLog,
                response_status: 200,
                reason: "Falha na consulta autoritativa; reconciliando via payload do webhook.",
                mode: creds.mode,
              });
            }
            await reconcileAsaasPayment(remote);
          } else {
            handled = false;
          }

          await logAsaasWebhook({
            event, payment_id: paymentId,
            signature_valid: auth.signatureValid,
            processed: true,
            error: null,
            payload: body, headers: headersLog,
            response_status: 200,
            reason: handled ? `Evento ${event} reconciliado com Asaas.` : `Evento ${event} recebido sem processador dedicado.`,
            mode: creds.mode,
          });
          return new Response("ok", { status: 200 });
        } catch (e: any) {
          await logAsaasWebhook({
            event, payment_id: paymentId,
            signature_valid: auth.signatureValid,
            processed: false,
            error: e?.message ?? String(e),
            payload: body, headers: headersLog,
            response_status: 200,
            mode: creds.mode,
          });
          // 200 evita reenvios agressivos; reprocessamento manual via admin.
          return new Response("logged", { status: 200 });
        }
      },
    },
  },
});
