/**
 * Resolução das chaves do Cloudflare Turnstile por ambiente.
 *
 * Alternância feita apenas por variável de ambiente — sem editar código:
 *
 *   TURNSTILE_MODE = "production" (padrão) | "test" | "off"
 *
 * - production: usa TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY
 * - test:       usa as chaves públicas oficiais de teste da Cloudflare
 *               (sempre aprovam o desafio), ou TURNSTILE_TEST_SITE_KEY /
 *               TURNSTILE_TEST_SECRET_KEY se você quiser sobrescrever
 * - off:        desliga o captcha completamente
 */

export type TurnstileMode = "production" | "test" | "off";

/** Chaves públicas oficiais da Cloudflare para ambiente de testes (always pass). */
const CF_TEST_SITE_KEY = "1x00000000000000000000AA";
const CF_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

export function getTurnstileMode(): TurnstileMode {
  const raw = (process.env.TURNSTILE_MODE ?? "production").trim().toLowerCase();
  if (raw === "test" || raw === "sandbox" || raw === "teste") return "test";
  if (raw === "off" || raw === "disabled" || raw === "desligado") return "off";
  return "production";
}

export type ResolvedTurnstile = {
  mode: TurnstileMode;
  enabled: boolean;
  siteKey: string;
  secretKey: string;
  /** true quando o modo test está usando as chaves oficiais da Cloudflare. */
  usingCloudflareTestKeys: boolean;
};

export function resolveTurnstile(): ResolvedTurnstile {
  const mode = getTurnstileMode();

  if (mode === "off") {
    return { mode, enabled: false, siteKey: "", secretKey: "", usingCloudflareTestKeys: false };
  }

  if (mode === "test") {
    const siteKey = (process.env.TURNSTILE_TEST_SITE_KEY || CF_TEST_SITE_KEY).trim();
    const secretKey = (process.env.TURNSTILE_TEST_SECRET_KEY || CF_TEST_SECRET_KEY).trim();
    return {
      mode,
      enabled: Boolean(siteKey && secretKey),
      siteKey,
      secretKey,
      usingCloudflareTestKeys: siteKey === CF_TEST_SITE_KEY,
    };
  }

  const siteKey = (process.env.TURNSTILE_SITE_KEY ?? "").trim();
  const secretKey = (process.env.TURNSTILE_SECRET_KEY ?? "").trim();
  // Chaves ausentes ou placeholder (ex.: após remix do projeto): não bloqueia o login.
  const keysValid = TURNSTILE_KEY_RE.test(siteKey) && TURNSTILE_KEY_RE.test(secretKey);
  return {
    mode,
    enabled: keysValid,
    siteKey,
    secretKey,
    usingCloudflareTestKeys: false,
  };
}

export const TURNSTILE_KEY_RE = /^(0x|1x|2x|3x)[A-Za-z0-9_-]{18,60}$/;

/** Mascara uma chave para exibição segura no painel (ex.: 0x4AAA…5Y). */
export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 10) return `${key.slice(0, 4)}…`;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
