import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  verifyMercadoPagoSignature,
  mapMpStatusToPaymentStatus,
  mapMpMethod,
  classifyMercadoPagoRequest,
  evaluateMercadoPagoWebhookSecurity,
  isRetryableMercadoPagoWebhookError,
} from "@/lib/mercadopago-webhook";

const SECRET = "test_webhook_secret_123";

function signManifest(dataId: string, requestId: string, ts: string, secret = SECRET) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

// Testes desativam replay guard (maxAgeMs: 0) exceto onde exigido.
const noReplay = { maxAgeMs: 0 };

describe("verifyMercadoPagoSignature", () => {
  it("accepts a well-formed signature matching the manifest", async () => {
    const dataId = "1234567890";
    const requestId = "abcd-1234";
    const ts = "1737300000";
    const header = signManifest(dataId, requestId, ts);
    expect(
      await verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId, secret: SECRET, ...noReplay }),
    ).toBe(true);
  });

  it("normaliza data.id para lowercase antes de verificar", async () => {
    const requestId = "abcd-1234";
    const ts = "1737300000";
    // Assinatura gerada com id lowercase; header recebido com id em uppercase → ainda válido.
    const header = signManifest("abc123", requestId, ts);
    expect(
      await verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId: "ABC123", secret: SECRET, ...noReplay }),
    ).toBe(true);
  });

  it("rejects when the payload id is tampered with", async () => {
    const requestId = "abcd-1234";
    const ts = "1737300000";
    const header = signManifest("1234567890", requestId, ts);
    expect(
      await verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId: "9999999999", secret: SECRET, ...noReplay }),
    ).toBe(false);
  });

  it("rejects when signed with a different secret", async () => {
    const dataId = "1", requestId = "r", ts = "10";
    const header = signManifest(dataId, requestId, ts, "other_secret");
    expect(
      await verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId, secret: SECRET, ...noReplay }),
    ).toBe(false);
  });

  it("rejects when the signature header is missing pieces", async () => {
    expect(await verifyMercadoPagoSignature({ signatureHeader: null, requestId: "r", dataId: "1", secret: SECRET, ...noReplay })).toBe(false);
    expect(await verifyMercadoPagoSignature({ signatureHeader: "ts=1", requestId: "r", dataId: "1", secret: SECRET, ...noReplay })).toBe(false);
    expect(await verifyMercadoPagoSignature({ signatureHeader: "v1=abc", requestId: "r", dataId: "1", secret: SECRET, ...noReplay })).toBe(false);
  });

  it("rejects when secret is empty (production safety)", async () => {
    const header = signManifest("1", "r", "10");
    expect(await verifyMercadoPagoSignature({ signatureHeader: header, requestId: "r", dataId: "1", secret: "", ...noReplay })).toBe(false);
  });

  it("tolerates additional key/value pairs in the header", async () => {
    const dataId = "1", requestId = "r", ts = "10";
    const v1 = createHmac("sha256", SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
    const header = `ts=${ts},v1=${v1},extra=zzz`;
    expect(await verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId, secret: SECRET, ...noReplay })).toBe(true);
  });

  it("does not crash on invalid hex in v1", async () => {
    const header = "ts=1,v1=zzznothex";
    expect(await verifyMercadoPagoSignature({ signatureHeader: header, requestId: "r", dataId: "1", secret: SECRET, ...noReplay })).toBe(false);
  });

  it("rejeita ts fora da janela (replay guard)", async () => {
    const now = 1_737_300_000_000;
    const stale = String(now - 30 * 60 * 1000); // 30 min no passado
    const header = signManifest("1", "r", stale);
    expect(
      await verifyMercadoPagoSignature({ signatureHeader: header, requestId: "r", dataId: "1", secret: SECRET, now: () => now }),
    ).toBe(false);
  });

  it("aceita ts dentro da janela padrão", async () => {
    const now = 1_737_300_000_000;
    const ts = String(now - 60 * 1000); // 1 min atrás
    const header = signManifest("1", "r", ts);
    expect(
      await verifyMercadoPagoSignature({ signatureHeader: header, requestId: "r", dataId: "1", secret: SECRET, now: () => now }),
    ).toBe(true);
  });
});

describe("mapMpStatusToPaymentStatus (billing state machine)", () => {
  it.each([
    ["pending"], ["in_process"], ["approved"], ["authorized"],
    ["rejected"], ["cancelled"], ["refunded"], ["charged_back"],
  ])("passes through canonical status %s", (s) => {
    expect(mapMpStatusToPaymentStatus(s)).toBe(s);
  });

  it("falls back to pending for unknown / missing status", async () => {
    expect(mapMpStatusToPaymentStatus("wobble")).toBe("pending");
    expect(mapMpStatusToPaymentStatus(null)).toBe("pending");
    expect(mapMpStatusToPaymentStatus(undefined)).toBe("pending");
  });
});

describe("mapMpMethod", () => {
  it("maps credit_card / ticket / everything else", async () => {
    expect(mapMpMethod("credit_card")).toBe("credit_card");
    expect(mapMpMethod("ticket")).toBe("boleto");
    expect(mapMpMethod("pix")).toBe("pix");
    expect(mapMpMethod(undefined)).toBe("pix");
  });
});

describe("classifyMercadoPagoRequest — detecção do simulador vs evento real", () => {
  const REAL_UA = "MercadoPago WebHook v1.0 (Java/17)";
  const SIM_UA = "restclient-node/0.1.0";

  it("live_mode:true vindo do simulador do painel (UA restclient-node) → mode=test, regra=panel_simulator_ua", async () => {
    const c = classifyMercadoPagoRequest({
      eventType: "payment",
      action: "payment.updated",
      liveMode: true,
      dataId: "1234567890",
      userAgent: SIM_UA,
    });
    expect(c.mode).toBe("test");
    expect(c.isTest).toBe(true);
    expect(c.detection).toBe("panel_simulator_ua");
    expect(c.reason).toMatch(/restclient-node/i);
  });

  it("live_mode:true vindo de evento real (UA MercadoPago) → mode=live, regra=live_mode_true", async () => {
    const c = classifyMercadoPagoRequest({
      eventType: "payment",
      action: "payment.created",
      liveMode: true,
      dataId: "9876543210",
      userAgent: REAL_UA,
    });
    expect(c.mode).toBe("live");
    expect(c.isTest).toBe(false);
    expect(c.detection).toBe("live_mode_true");
  });

  it('body com type:"test" tem precedência sobre live_mode:true', async () => {
    const c = classifyMercadoPagoRequest({
      eventType: "test",
      action: null,
      liveMode: true,
      dataId: "1",
      userAgent: REAL_UA,
    });
    expect(c.mode).toBe("test");
    expect(c.detection).toBe("explicit_type_test");
  });

  it('action:"test.created" é reconhecido como handshake', async () => {
    const c = classifyMercadoPagoRequest({
      eventType: "payment",
      action: "test.created",
      liveMode: null,
      dataId: null,
      userAgent: null,
    });
    expect(c.detection).toBe("explicit_action_test");
    expect(c.isTest).toBe(true);
  });

  it('payload dummy do sandbox (live_mode:false + data.id:"123456") é teste', async () => {
    const c = classifyMercadoPagoRequest({
      eventType: "payment",
      action: null,
      liveMode: false,
      dataId: "123456",
      userAgent: REAL_UA,
    });
    expect(c.detection).toBe("sandbox_dummy_id");
  });

  it("sem live_mode, sem UA, sem type:test → unknown", async () => {
    const c = classifyMercadoPagoRequest({
      eventType: "payment",
      action: null,
      liveMode: null,
      dataId: "1",
      userAgent: null,
    });
    expect(c.mode).toBe("unknown");
    expect(c.detection).toBe("no_signal");
  });
});

describe("cenários end-to-end do handler MP: HMAC obrigatória apenas em live real", () => {
  const SECRET = "test_webhook_secret_123";
  const REAL_UA = "MercadoPago WebHook v1.0 (Java/17)";
  const SIM_UA = "restclient-node/0.1.0";

  it("simulador do painel (live_mode:true, sem HMAC) é aceito sem assinatura", async () => {
    const dataId = "1234567890";
    const c = classifyMercadoPagoRequest({
      eventType: "payment", action: "payment.updated", liveMode: true, dataId, userAgent: SIM_UA,
    });
    const signatureValid = await verifyMercadoPagoSignature({
      signatureHeader: null, requestId: null, dataId, secret: SECRET,
    });
    const security = evaluateMercadoPagoWebhookSecurity({
      mode: c.mode, signatureValid, hasWebhookSecret: true,
    });
    expect(security.accepted).toBe(true);
    expect(c.isTest).toBe(true);
  });

  it("evento live real com HMAC válido é aceito e processado", async () => {
    const dataId = "9876543210";
    const requestId = "req-real-1";
    const ts = String(Date.now());
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", SECRET).update(manifest).digest("hex");
    const signatureHeader = `ts=${ts},v1=${v1}`;

    const c = classifyMercadoPagoRequest({
      eventType: "payment", action: "payment.created", liveMode: true, dataId, userAgent: REAL_UA,
    });
    const signatureValid = await verifyMercadoPagoSignature({ signatureHeader, requestId, dataId, secret: SECRET });

    expect(c.mode).toBe("live");
    expect(signatureValid).toBe(true);
    const security = evaluateMercadoPagoWebhookSecurity({
      mode: c.mode, signatureValid, hasWebhookSecret: true,
    });
    expect(security.accepted).toBe(true);
  });

  it("evento live real SEM HMAC é rejeitado com 401", async () => {
    const dataId = "9876543210";
    const c = classifyMercadoPagoRequest({
      eventType: "payment", action: "payment.created", liveMode: true, dataId, userAgent: REAL_UA,
    });
    const signatureValid = await verifyMercadoPagoSignature({
      signatureHeader: null, requestId: null, dataId, secret: SECRET,
    });
    expect(c.mode).toBe("live");
    expect(signatureValid).toBe(false);
    const security = evaluateMercadoPagoWebhookSecurity({
      mode: c.mode, signatureValid, hasWebhookSecret: true,
    });
    expect(security.accepted).toBe(false);
    expect(security.status).toBe(401);
    expect(security.error).toBe("invalid_signature");
    expect(isRetryableMercadoPagoWebhookError(security.error, security.status)).toBe(false);
  });

  it("evento live real com HMAC inválida (secret errado) é rejeitado", async () => {
    const dataId = "9876543210";
    const requestId = "req-real-2";
    const ts = String(Date.now());
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", "outro_secret_qualquer").update(manifest).digest("hex");

    const c = classifyMercadoPagoRequest({
      eventType: "payment", action: "payment.created", liveMode: true, dataId, userAgent: REAL_UA,
    });
    const signatureValid = await verifyMercadoPagoSignature({
      signatureHeader: `ts=${ts},v1=${v1}`, requestId, dataId, secret: SECRET,
    });
    expect(c.mode).toBe("live");
    expect(signatureValid).toBe(false);
    const security = evaluateMercadoPagoWebhookSecurity({
      mode: c.mode, signatureValid, hasWebhookSecret: true,
    });
    expect(security.accepted).toBe(false);
    expect(security.error).toBe("invalid_signature");
    expect(isRetryableMercadoPagoWebhookError(security.error, security.status)).toBe(false);
  });

  it("evento live real é bloqueado quando o Webhook Secret não está configurado", async () => {
    const c = classifyMercadoPagoRequest({
      eventType: "payment", action: "payment.created", liveMode: true, dataId: "9876543210", userAgent: REAL_UA,
    });
    const security = evaluateMercadoPagoWebhookSecurity({
      mode: c.mode, signatureValid: false, hasWebhookSecret: false,
    });
    expect(security.accepted).toBe(false);
    expect(security.status).toBe(503);
    expect(security.error).toBe("missing_webhook_secret");
    expect(isRetryableMercadoPagoWebhookError(security.error, security.status)).toBe(false);
  });
});

describe("novos processadores de webhook (order.* e subscription_preapproval)", () => {
  const REAL_UA = "MercadoPago Webhook v1.0";
  it("order.processed em live exige HMAC válido para ser aceito", async () => {
    const c = classifyMercadoPagoRequest({
      eventType: "order", action: "order.processed", liveMode: true, dataId: "ORD-123", userAgent: REAL_UA,
    });
    expect(c.mode).toBe("live");
    const security = evaluateMercadoPagoWebhookSecurity({
      mode: c.mode, signatureValid: false, hasWebhookSecret: true,
    });
    expect(security.accepted).toBe(false);
    expect(security.error).toBe("invalid_signature");
  });

  it("subscription_preapproval em live com HMAC válido é aceito", async () => {
    const c = classifyMercadoPagoRequest({
      eventType: "subscription_preapproval", action: null, liveMode: true, dataId: "PRE-987", userAgent: REAL_UA,
    });
    expect(c.mode).toBe("live");
    const security = evaluateMercadoPagoWebhookSecurity({
      mode: c.mode, signatureValid: true, hasWebhookSecret: true,
    });
    expect(security.accepted).toBe(true);
  });

  it("order.created sem live_mode e sem UA real é classificado como teste (handshake)", async () => {
    const c = classifyMercadoPagoRequest({
      eventType: "order", action: "order.created", liveMode: null, dataId: "ORD-XYZ",
      userAgent: "restclient-node/5.3.0",
    });
    expect(c.mode).toBe("test");
  });
});

