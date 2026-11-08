import { afterEach, describe, expect, it } from "vitest";
import { signRedeemPayload, verifyRedeemSignature } from "./redeem-token.server";

const original = process.env.REDEEM_HMAC_SECRET;
afterEach(() => {
  if (original === undefined) delete process.env.REDEEM_HMAC_SECRET;
  else process.env.REDEEM_HMAC_SECRET = original;
});

describe("QR de recompensa - assinatura do servidor", () => {
  it("não aceita fallback previsível baseado na URL do projeto", () => {
    delete process.env.REDEEM_HMAC_SECRET;
    expect(() => signRedeemPayload("token")).toThrow(/segredo de resgate/i);
    process.env.REDEEM_HMAC_SECRET = "url-do-projeto";
    expect(() => signRedeemPayload("token")).toThrow(/segredo de resgate/i);
  });

  it("assina e verifica apenas com a chave privada correta", () => {
    process.env.REDEEM_HMAC_SECRET = "c2b96df1e0aa44ea837ad67db2eab13b171d8af63cc995b9";
    const payload = "eyJyaWQiOiJ0ZXN0In0";
    const sig = signRedeemPayload(payload);
    expect(verifyRedeemSignature(payload, sig)).toBe(true);
    expect(verifyRedeemSignature(payload + "x", sig)).toBe(false);
    expect(verifyRedeemSignature(payload, sig.slice(0, -1) + "x")).toBe(false);
  });

  it("não permite validar assinatura com segredo de outro ambiente", () => {
    process.env.REDEEM_HMAC_SECRET = "chave-aleatoria-diferente-11111111111111111111111111";
    const signed = signRedeemPayload("reward-1");
    process.env.REDEEM_HMAC_SECRET = "chave-aleatoria-diferente-22222222222222222222222222";
    expect(verifyRedeemSignature("reward-1", signed)).toBe(false);
  });

  it("rejeita assinatura truncada e bytes inválidos", () => {
    process.env.REDEEM_HMAC_SECRET = "12345678901234567890123456789012";
    expect(verifyRedeemSignature("reward-1", "")).toBe(false);
    expect(verifyRedeemSignature("reward-1", "not-base64")).toBe(false);
  });
});
