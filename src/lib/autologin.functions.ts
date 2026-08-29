import { createServerFn } from "@tanstack/react-start";

/**
 * Troca o token de autologin (uso único, 5 min) por um token_hash de magic link
 * que o navegador usa em supabase.auth.verifyOtp para abrir a sessão.
 */
export const exchangeAutologinToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => ({ token: String(input?.token ?? "").slice(0, 200) }))
  .handler(async ({ data }) => {
    if (!data.token) {
      return { ok: false as const, code: "invalid", message: "Link de acesso inválido." };
    }
    const { getRequest } = await import("@tanstack/react-start/server");
    const { consumeAutologinToken } = await import("@/lib/integrations/autologin.server");

    const headers = getRequest()?.headers;
    const fwd = headers?.get("x-forwarded-for");
    const ip = headers?.get("cf-connecting-ip") || (fwd ? fwd.split(",")[0]!.trim() : null) || null;

    const result = await consumeAutologinToken(data.token, ip);
    if (!result.ok) return { ok: false as const, code: result.code, message: result.message };
    return { ok: true as const, email: result.email, token_hash: result.token_hash };
  });
