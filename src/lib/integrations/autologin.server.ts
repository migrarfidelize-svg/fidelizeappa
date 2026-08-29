/**
 * Login automático (SSO) entre sistemas parceiros e a Fidelize.
 *
 * Emite tokens opacos de uso único, com validade curta (5 min), guardados
 * apenas como hash SHA-256 e vinculados ao usuário + tenant provisionado.
 * A troca do token pela sessão acontece em /auth/autologin.
 *
 * Server-only.
 */

export const AUTOLOGIN_TTL_SECONDS = 300;

async function sha256(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
}

async function randomToken(): Promise<string> {
  const { randomBytes } = await import("node:crypto");
  return randomBytes(32).toString("base64url");
}

export type IssueAutologinInput = {
  userId: string;
  email: string;
  establishmentId?: string | null;
  apiKeyId?: string | null;
  source?: string | null;
  ip?: string | null;
};

export type AutologinIssued = {
  token: string;
  url: string;
  expires_at: string;
  expires_in: number;
};

/** Cria um token de autologin e devolve a URL pronta para redirecionamento. */
export async function issueAutologinToken(input: IssueAutologinInput): Promise<AutologinIssued> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getPublicAppUrl } = await import("@/lib/app-url");

  const token = await randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + AUTOLOGIN_TTL_SECONDS * 1000).toISOString();

  const { error } = await supabaseAdmin.from("autologin_tokens").insert({
    token_hash: tokenHash,
    user_id: input.userId,
    establishment_id: input.establishmentId ?? null,
    email: input.email.toLowerCase(),
    api_key_id: input.apiKeyId ?? null,
    source: input.source ?? null,
    issued_ip: input.ip ?? null,
    expires_at: expiresAt,
  } as never);
  if (error) throw new Error(`autologin_issue_failed: ${error.message}`);

  const base = getPublicAppUrl();
  return {
    token,
    url: `${base}/auth/autologin?token=${encodeURIComponent(token)}`,
    expires_at: expiresAt,
    expires_in: AUTOLOGIN_TTL_SECONDS,
  };
}

export type AutologinConsumeResult =
  | { ok: true; email: string; token_hash: string; establishment_id: string | null }
  | { ok: false; code: "invalid" | "expired" | "used" | "failed"; message: string };

/**
 * Consome o token (uso único, atômico) e devolve um token_hash de magic link
 * do Supabase que o navegador troca por sessão via verifyOtp.
 */
export async function consumeAutologinToken(
  rawToken: string,
  ip: string | null,
): Promise<AutologinConsumeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = await sha256(rawToken);

  const { data: row } = await supabaseAdmin
    .from("autologin_tokens")
    .select("id, user_id, establishment_id, email, used_at, expires_at, source, api_key_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!row) return { ok: false, code: "invalid", message: "Link de acesso inválido." };
  const r = row as {
    id: string; user_id: string; establishment_id: string | null; email: string;
    used_at: string | null; expires_at: string; source: string | null; api_key_id: string | null;
  };

  if (r.used_at) return { ok: false, code: "used", message: "Este link de acesso já foi utilizado." };
  if (new Date(r.expires_at).getTime() < Date.now()) {
    return { ok: false, code: "expired", message: "Este link de acesso expirou." };
  }

  // Marca como usado de forma atômica (only-if-unused) — impede reuso concorrente.
  const { data: claimed } = await supabaseAdmin
    .from("autologin_tokens")
    .update({ used_at: new Date().toISOString(), used_ip: ip } as never)
    .eq("id", r.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, code: "used", message: "Este link de acesso já foi utilizado." };

  const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: r.email,
  });
  const hashed = link?.properties?.hashed_token;
  if (linkErr || !hashed) {
    return { ok: false, code: "failed", message: "Não foi possível iniciar a sessão automática." };
  }

  try {
    await supabaseAdmin.from("audit_logs").insert({
      establishment_id: r.establishment_id,
      user_id: r.user_id,
      action: "autologin_consumed",
      entity_type: "user",
      entity_id: r.user_id,
      ip,
      metadata: { email: r.email, source: r.source, api_key_id: r.api_key_id },
    } as never);
  } catch { /* auditoria nunca bloqueia */ }

  return { ok: true, email: r.email, token_hash: hashed, establishment_id: r.establishment_id };
}

/** Revoga todos os tokens ainda válidos de um usuário. */
export async function revokeAutologinTokens(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("autologin_tokens")
    .update({ used_at: new Date().toISOString() } as never)
    .eq("user_id", userId)
    .is("used_at", null);
}
