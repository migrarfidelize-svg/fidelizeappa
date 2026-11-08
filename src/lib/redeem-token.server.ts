import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Assinatura HMAC para o resgate da carteira.
 * A URL do Supabase e chaves publicáveis NUNCA são segredos.
 *
 * Configure REDEEM_HMAC_SECRET com 32+ bytes criptograficamente aleatórios
 * e compartilhe a mesma chave entre todos os processos da aplicação.
 * Ausente/inválido = falha segura (sem emissão ou resgate).
 */
function redeemSigningKey(): string {
  const secret = process.env.REDEEM_HMAC_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Segredo de resgate não configurado. Avise o administrador da Fidelize.");
  }
  return secret;
}

export function signRedeemPayload(payload: string): string {
  return createHmac("sha256", redeemSigningKey())
    .update(payload, "utf8")
    .digest("base64url");
}

export function verifyRedeemSignature(payload: string, signature: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  const expected = Buffer.from(signRedeemPayload(payload), "utf8");
  const actual = Buffer.from(signature, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
