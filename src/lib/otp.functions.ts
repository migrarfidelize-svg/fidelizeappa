import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";

const sendOtpSchema = z.object({
  whatsapp: z.string().min(10).max(25),
  name: z.string().max(100).optional(), // Only for signup
});

export type OTPRequestErrorCode =
  | "rate_limited"
  | "whatsapp_not_configured"
  | "provider_unavailable"
  | "invalid_credentials"
  | "temporary_send_failure"
  | "server_configuration";

type OTPRequestResult =
  | { ok: true; phone: string }
  | { ok: false; error: { code: OTPRequestErrorCode; message: string } };

export class WhatsAppProviderResolutionError extends Error {
  constructor(
    public readonly code: "ambiguous_provider" | "invalid_credentials" | "server_configuration",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "WhatsAppProviderResolutionError";
  }
}

/**
 * Gets the active WhatsApp provider and its runtime config.
 */
export async function getActiveWhatsAppProvider(establishmentId?: string) {
  const { supabaseAdmin } =
    await import("@/integrations/supabase/client.server");

  let query = supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("category", "otp")
    .eq("enabled", true)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (establishmentId) {
    query = query.eq("establishment_id", establishmentId);
  }

  const { data: rows, error } = await query;

  if (error) {
    throw new WhatsAppProviderResolutionError(
      "server_configuration",
      "Falha ao consultar a integração WhatsApp.",
      { cause: error },
    );
  }

  const integrations = rows || [];
  let integration: (typeof integrations)[number] | undefined;

  if (establishmentId) {
    if (integrations.length > 1) {
      throw new WhatsAppProviderResolutionError(
        "ambiguous_provider",
        "Há mais de uma integração WhatsApp OTP ativa para este estabelecimento.",
      );
    }
    integration = integrations[0];
  } else {
    const explicitGlobal = integrations.filter((row: any) => {
      const config = row.config && typeof row.config === "object" ? row.config : {};
      return row.establishment_id === null || config.auth_scope === "global" || config.use_for_auth === true;
    });

    if (explicitGlobal.length === 1) integration = explicitGlobal[0];
    else if (explicitGlobal.length > 1) {
      throw new WhatsAppProviderResolutionError(
        "ambiguous_provider",
        "Configure exatamente uma integração WhatsApp OTP global para o login.",
      );
    }
  }

  if (!integration) return null;

  const { getProvider } =
    await import("./integrations/registry");

  const { decryptSecret } =
    await import("./integrations/crypt.server");

  let provider: any;
  try {
    provider = getProvider("otp", integration.provider) as any;
  } catch (cause) {
    throw new WhatsAppProviderResolutionError(
      "server_configuration",
      `Provider WhatsApp não registrado: ${integration.provider}`,
      { cause },
    );
  }

  const encryptedCredentials =
    (
      integration.credentials &&
      typeof integration.credentials === "object"
    )
      ? integration.credentials as Record<string, unknown>
      : {};

  const dbCredentials: Record<string, string> = {};

  for (
    const [field, rawValue]
    of Object.entries(encryptedCredentials)
  ) {
    if (typeof rawValue !== "string") continue;

    const value = rawValue.trim();

    if (!value) continue;

    try {
      dbCredentials[field] = await decryptSecret(value);
    } catch (cause) {
      throw new WhatsAppProviderResolutionError(
        "invalid_credentials",
        "Não foi possível descriptografar as credenciais do WhatsApp.",
        { cause },
      );
    }
  }

  return {
    integrationId: integration.id as string,
    provider,
    establishmentId: integration.establishment_id as string,
    runtime: {
      enabled: integration.enabled,
      mode: integration.mode,
      config:
        (integration.config || {}) as Record<string, unknown>,
      credentials_ref:
        (integration.credentials_ref || {}) as Record<string, string>,

      // INVARIANTE:
      // daqui para frente db_credentials SEMPRE contém
      // valores descriptografados.
      db_credentials: dbCredentials,
    },
  };
}

/**
 * Resolve the secret dedicated to a tenant's inbound WhatsApp webhook.  It is
 * deliberately separate from the provider token and is stored encrypted with
 * the other integration credentials.
 */
/** Reads an already configured secret. Safe for the unauthenticated webhook path. */
export async function getExistingWhatsAppWebhookSecret(establishmentId: string) {
  const active = await getActiveWhatsAppProvider(establishmentId);
  if (!active?.integrationId || active.establishmentId !== establishmentId) return null;

  const existing = active.runtime.db_credentials?.webhook_secret;
  if (typeof existing === "string" && existing.length > 0) return existing;
  return null;
}

/**
 * Creates the per-integration secret only after the caller has authorized the
 * establishment. Never call this from a public webhook request.
 */
export async function ensureWhatsAppWebhookSecret(establishmentId: string) {
  const active = await getActiveWhatsAppProvider(establishmentId);
  if (!active?.integrationId || active.establishmentId !== establishmentId) return null;

  const existing = active.runtime.db_credentials?.webhook_secret;
  if (typeof existing === "string" && existing.length > 0) return existing;

  const { encryptSecret } = await import("./integrations/crypt.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { randomBytes } = await import("node:crypto");
  const secret = randomBytes(32).toString("base64url");
  const encryptedSecret = await encryptSecret(secret);
  const { data: integration, error } = await supabaseAdmin.from("integrations")
    .select("credentials, establishment_id")
    .eq("id", active.integrationId)
    .eq("establishment_id", establishmentId)
    .single();
  if (error || !integration || integration.establishment_id !== establishmentId) throw error ?? new Error("WHATSAPP_INTEGRATION_NOT_FOUND");

  const credentials = integration.credentials && typeof integration.credentials === "object"
    ? integration.credentials as Record<string, unknown>
    : {};
  if (typeof credentials.webhook_secret === "string" && credentials.webhook_secret) {
    const { decryptSecret } = await import("./integrations/crypt.server");
    return decryptSecret(credentials.webhook_secret);
  }

  const saved = await supabaseAdmin.from("integrations").update({
    credentials: { ...credentials, webhook_secret: encryptedSecret },
  }).eq("id", active.integrationId).eq("establishment_id", establishmentId);
  if (saved.error) throw saved.error;
  return secret;
}

export async function hasValidWebhookSecret(expected: string, received: string | null | undefined) {
  if (!received || !expected) return false;
  const { timingSafeEqual } = await import("node:crypto");
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

function controlledRequestError(error: unknown): OTPRequestResult {
  const raw = error instanceof Error ? error.message : String(error);
  console.error("[OTP] request failed", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: raw,
  });

  if (error instanceof WhatsAppProviderResolutionError) {
    if (error.code === "invalid_credentials") {
      return { ok: false, error: { code: "invalid_credentials", message: "A credencial do WhatsApp é inválida. Avise o administrador." } };
    }
    return { ok: false, error: { code: "server_configuration", message: "Há um erro na configuração do envio por WhatsApp. Avise o administrador." } };
  }
  if (/Muitas tentativas|rate.?limit/i.test(raw)) {
    return { ok: false, error: { code: "rate_limited", message: "Muitas tentativas. Aguarde alguns minutos." } };
  }
  if (/AUTH_OTP_HMAC_SECRET|INTEGRATIONS_ENCRYPTION_KEY/i.test(raw)) {
    return { ok: false, error: { code: "server_configuration", message: "O servidor de autenticação não está configurado corretamente." } };
  }
  return { ok: false, error: { code: "temporary_send_failure", message: "Falha temporária ao enviar o código. Tente novamente em alguns minutos." } };
}

export async function requestOTPHandler(
  data: z.infer<typeof sendOtpSchema>,
  headers?: Headers,
): Promise<OTPRequestResult> {
    try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateOTP, normalizeWhatsApp } = await import("./otp.server");
    const { checkAuthRateLimit, clientIpFromHeaders } = await import("./auth-rate-limit.server");
    
    const ip = headers ? clientIpFromHeaders(headers) : null;
    const phone = normalizeWhatsApp(data.whatsapp);
    const identifier = `wa:${phone.replace(/\+/g, "")}`;

    // 1. Rate Limit Check
    const decision = await checkAuthRateLimit({ ip, identifier, action: "login" });
    if (!decision.allowed) {
      throw new Error(`Muitas tentativas. Aguarde alguns minutos.`);
    }

    // 2. Check if WhatsApp OTP is active and configured
    const active = await getActiveWhatsAppProvider();
    if (!active) {
      return { ok: false, error: { code: "whatsapp_not_configured", message: "A integração WhatsApp não está configurada." } };
    }

    // 3. Generate OTP with HMAC
    const { code, hash } = generateOTP(identifier);
    // 3b. Fetch Custom Template and Configs from system_settings
    const { data: settings } = await supabaseAdmin
      .from("system_settings")
      .select("*")
      .eq("namespace", "otp");
    
    const configMap = (settings || []).reduce((acc: any, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    const validityMinutes = configMap.validity_minutes || 10;
    const expiresAt = new Date(Date.now() + validityMinutes * 60_000).toISOString();

    const template = (configMap.template as any)?.text || "Afidelize\n\nSeu código de acesso é {{code}}.\n\nEle expira em {{minutes}} minutos.\n\nNão compartilhe este código.";
    const message = template
      .replace(/{{code}}/g, code)
      .replace(/{{minutes}}/g, validityMinutes.toString())
      .replace(/{{brand}}/g, "Afidelize");




    // 4. Store OTP in DB
    const { error: otpErr } = await supabaseAdmin.from("auth_otps").insert({
      identifier,
      code_hash: hash,
      expires_at: expiresAt,
      metadata: { name: data.name || null }
    });

    if (otpErr) throw otpErr;

    // 5. Send via WhatsApp
    const providerEnv = { ...process.env } as Record<string, string | undefined>;
    for (const [field, envName] of Object.entries(active.runtime.credentials_ref)) {
      const credential = active.runtime.db_credentials?.[field];
      if (credential) providerEnv[envName] = credential;
    }
    let res;
    try {
      res = await active.provider.sendTestMessage(active.runtime, providerEnv, phone, message);
    } catch (sendError) {
      await supabaseAdmin.from("auth_otps").update({ used: true })
        .eq("identifier", identifier).eq("code_hash", hash).eq("used", false);
      throw sendError;
    }
    if (!res.ok) {
      await supabaseAdmin
        .from("auth_otps")
        .update({ used: true })
        .eq("identifier", identifier)
        .eq("code_hash", hash)
        .eq("used", false);
      console.error(`[OTP] Provider ${active.provider.meta.id} rejected send`, {
        httpStatus: res.httpStatus,
        message: res.message,
      });
      const credentialFailure = res.httpStatus === 401 || res.httpStatus === 403 || /credencial|token|unauthorized|forbidden/i.test(res.message || "");
      return credentialFailure
        ? { ok: false, error: { code: "invalid_credentials", message: "A credencial do WhatsApp é inválida. Avise o administrador." } }
        : { ok: false, error: { code: "provider_unavailable", message: "O provedor WhatsApp está indisponível no momento." } };
    }

    return { ok: true, phone };
    } catch (error) {
      return controlledRequestError(error);
    }
}

export const requestOTP = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sendOtpSchema.parse(d))
  .handler(async ({ data }): Promise<OTPRequestResult> => {
    const request = getRequest();
    return requestOTPHandler(data, request?.headers);
  });

const verifyOtpSchema = z.object({
  whatsapp: z.string(),
  code: z.string().length(6),
});

export async function consumeValidOTP(
  supabaseAdmin: any,
  identifier: string,
  codeHash: string,
  now = new Date(),
) {
  const { data: otp, error: findErr } = await supabaseAdmin
    .from("auth_otps")
    .select("*")
    .eq("identifier", identifier)
    .eq("code_hash", codeHash)
    .eq("used", false)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr || !otp) return null;

  const { data: updatedOtp, error: updateErr } = await supabaseAdmin
    .from("auth_otps")
    .update({ used: true })
    .eq("id", otp.id)
    .eq("used", false)
    .select("id")
    .maybeSingle();
  if (updateErr) throw updateErr;
  return updatedOtp ? otp : null;
}

async function findAuthUserByEmail(
  supabaseAdmin: any,
  email: string
) {
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;
  let page = 1;

  while (true) {
    const {
      data,
      error
    } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];

    const found = users.find(
      (u: any) =>
        typeof u?.email === "string" &&
        u.email.toLowerCase() === normalizedEmail
    );

    if (found) {
      return found;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

export const verifyOTP = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => verifyOtpSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashOTP, normalizeWhatsApp } = await import("./otp.server");
    const { recordAuthAttempt, clientIpFromHeaders } = await import("./auth-rate-limit.server");
    
    const req = getRequest();
    const ip = req?.headers ? clientIpFromHeaders(req.headers) : null;
    const phone = normalizeWhatsApp(data.whatsapp);
    const identifier = `wa:${phone.replace(/\+/g, "")}`;
    const codeHash = hashOTP(data.code, identifier);

    // 1. Find, validate and consume OTP with a compare-and-set on used=false.
    const otp = await consumeValidOTP(supabaseAdmin, identifier, codeHash);
    if (!otp) {
      await recordAuthAttempt({ ip, identifier, action: "login", success: false });
      throw new Error("Código inválido ou expirado.");
    }

    // 2. Resolve User
    const syntheticEmail =
      `wa${phone.replace(/\D/g, "")}@carteira.fidelize.app`;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    let user;

    if (profile) {
      const {
        data: existingUser,
        error: getUserErr
      } =
        await supabaseAdmin.auth.admin.getUserById(profile.id);

      if (getUserErr) {
        throw getUserErr;
      }

      if (!existingUser?.user) {
        throw new Error(
          "Cadastro encontrado, mas usuário de autenticação não existe."
        );
      }

      user = existingUser.user;
    } else {
      const metadata =
        (otp.metadata as Record<string, any>) || {};

      const {
        data: newUser,
        error: createErr
      } =
        await supabaseAdmin.auth.admin.createUser({
          email: syntheticEmail,
          email_confirm: true,
          user_metadata: {
            full_name: metadata.name || "Cliente",
            phone,
            whatsapp: phone,
          },
        });

      if (!createErr && newUser?.user) {
        user = newUser.user;
      } else {
        /*
         * Recuperação idempotente:
         * se o Auth já tinha esse usuário, não tentar recriar.
         */
        const existingAuthUser =
          await findAuthUserByEmail(
            supabaseAdmin,
            syntheticEmail
          );

        if (!existingAuthUser) {
          throw createErr ||
            new Error(
              "Não foi possível localizar ou criar o usuário."
            );
        }

        user = existingAuthUser;
      }

      /*
       * Reparar/criar profile faltante.
       * O Auth é a identidade principal neste ponto.
       */
      const {
        error: profileErr
      } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: user.id,
            full_name:
              metadata.name ||
              user.user_metadata?.full_name ||
              "Cliente",
            phone,
            account_type: "customer",
          },
          {
            onConflict: "id"
          }
        );

      if (profileErr) {
        throw profileErr;
      }
    }


    // 4. Generate Magic Link session
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email!,
    });

    if (linkErr) throw linkErr;

    await recordAuthAttempt({ ip, identifier, action: "login", success: true });

    return { 
      ok: true, 
      hashed_token: link.properties.hashed_token,
      email: user.email
    };
  });
