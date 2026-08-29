/**
 * Verify Mercado Pago's `x-signature` header.
 * Manifest template (per MP docs): `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * HMAC-SHA256 with the app's webhook secret, compared as hex in constant time.
 */
export async function verifyMercadoPagoSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
  /** Máx. idade do timestamp (ms) para bloquear replay. Default: 10min. 0 = desativa. */
  maxAgeMs?: number;
  /** Injeção para testes; default Date.now(). */
  now?: () => number;
}): Promise<boolean> {
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const { signatureHeader, requestId, dataId, secret } = opts;
  const maxAgeMs = opts.maxAgeMs ?? 10 * 60 * 1000;
  const now = opts.now ?? Date.now;
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  ) as Record<string, string>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // Replay protection: MP `ts` vem em milissegundos. Rejeita se muito antigo/futuro.
  if (maxAgeMs > 0) {
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) return false;
    const delta = Math.abs(now() - tsNum);
    if (delta > maxAgeMs) return false;
  }

  // Per docs do MP, o `data.id` no manifest deve estar em lowercase.
  const idForManifest = (dataId ?? "").toLowerCase();
  const manifest = `id:${idForManifest};request-id:${requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Classifica uma requisição chegando no webhook do Mercado Pago em:
 *  - "test"    → handshake/simulador (aceita sem HMAC)
 *  - "live"    → evento real (exige HMAC válido)
 *  - "unknown" → sem `live_mode` explícito e sem sinais de teste
 *
 * Também informa qual regra de detecção classificou como teste, para
 * uso em UI e logs de auditoria.
 */
export type MpRequestMode = "test" | "live" | "unknown";
export type MpDetectionRule =
  | "explicit_type_test"        // body.type === "test"
  | "explicit_action_test"      // body.action === "test.created"
  | "sandbox_dummy_id"          // live_mode:false && data.id === "123456"
  | "panel_simulator_ua"        // user-agent contém "restclient-node"
  | "live_mode_true"            // live_mode:true (e nenhum sinal de teste)
  | "live_mode_false"           // live_mode:false (fora dos casos acima)
  | "no_signal";                // nenhuma informação suficiente

export interface MpClassification {
  mode: MpRequestMode;
  isTest: boolean;
  detection: MpDetectionRule;
  /** Explicação legível em pt-BR do que foi identificado. */
  reason: string;
}

export type MpSecurityDecision =
  | { accepted: true; status: 200; error: null; reason: null; retryable: false }
  | { accepted: false; status: 401 | 503; error: "invalid_signature" | "missing_webhook_secret"; reason: string; retryable: false };

export function classifyMercadoPagoRequest(input: {
  eventType: string | null | undefined;
  action: string | null | undefined;
  liveMode: boolean | null | undefined;
  dataId: string | null | undefined;
  userAgent: string | null | undefined;
}): MpClassification {
  const { eventType, action, liveMode, dataId } = input;
  const userAgent = input.userAgent ?? "";
  const isPanelSimulator = /restclient-node/i.test(userAgent);

  if (eventType === "test") {
    return {
      mode: "test", isTest: true, detection: "explicit_type_test",
      reason: 'Body possui `type: "test"` (handshake explícito do painel MP).',
    };
  }
  if (action === "test.created") {
    return {
      mode: "test", isTest: true, detection: "explicit_action_test",
      reason: 'Body possui `action: "test.created"` (handshake explícito).',
    };
  }
  if (liveMode === false && dataId === "123456") {
    return {
      mode: "test", isTest: true, detection: "sandbox_dummy_id",
      reason: '`live_mode: false` com `data.id: "123456"` (payload dummy do sandbox MP).',
    };
  }
  if (isPanelSimulator) {
    return {
      mode: "test", isTest: true, detection: "panel_simulator_ua",
      reason: 'User-agent contém `restclient-node` — simulador "Testar URL" do painel MP (não assina o payload, mesmo com `live_mode: true`).',
    };
  }
  if (liveMode === true) {
    return {
      mode: "live", isTest: false, detection: "live_mode_true",
      reason: '`live_mode: true` sem sinais de teste — evento real; HMAC obrigatória.',
    };
  }
  if (liveMode === false) {
    return {
      mode: "test", isTest: true, detection: "live_mode_false",
      reason: '`live_mode: false` sem sinais adicionais — tratando como sandbox.',
    };
  }
  return {
    mode: "unknown", isTest: false, detection: "no_signal",
    reason: "Nenhuma informação suficiente para classificar (sem `live_mode`, sem UA de simulador, sem `type: test`).",
  };
}

export function evaluateMercadoPagoWebhookSecurity(input: {
  mode: MpRequestMode;
  signatureValid: boolean;
  hasWebhookSecret: boolean;
}): MpSecurityDecision {
  if (input.mode !== "live") {
    return { accepted: true, status: 200, error: null, reason: null, retryable: false };
  }
  if (!input.hasWebhookSecret) {
    return {
      accepted: false,
      status: 503,
      error: "missing_webhook_secret",
      reason: "Evento live bloqueado: MERCADOPAGO_WEBHOOK_SECRET não está configurado, então não é possível validar a assinatura HMAC.",
      retryable: false,
    };
  }
  if (!input.signatureValid) {
    return {
      accepted: false,
      status: 401,
      error: "invalid_signature",
      reason: "Assinatura HMAC inválida em evento live. Verifique se a Assinatura secreta cadastrada no Mercado Pago é exatamente o mesmo MERCADOPAGO_WEBHOOK_SECRET salvo no backend.",
      retryable: false,
    };
  }
  return { accepted: true, status: 200, error: null, reason: null, retryable: false };
}

export function isRetryableMercadoPagoWebhookError(error: string | null | undefined, responseStatus?: number | null): boolean {
  if (!error) return false;
  const normalized = error.toLowerCase();
  if (normalized.includes("invalid_signature") || normalized.includes("missing_webhook_secret")) return false;
  if (responseStatus === 401 || responseStatus === 403) return false;
  return true;
}

const ALLOWED_STATUSES = new Set([
  "pending", "in_process", "approved", "authorized", "rejected", "cancelled", "refunded", "charged_back",
]);

/** Map MP payment status → our internal payments.status; unknowns fall back to `pending`. */
export function mapMpStatusToPaymentStatus(s: string | undefined | null): string {
  if (!s) return "pending";
  return ALLOWED_STATUSES.has(s) ? s : "pending";
}

/** Map MP payment_type_id → our internal payments.method. */
export function mapMpMethod(paymentTypeId: string | undefined | null): "credit_card" | "boleto" | "pix" {
  if (paymentTypeId === "credit_card") return "credit_card";
  if (paymentTypeId === "ticket") return "boleto";
  return "pix";
}
