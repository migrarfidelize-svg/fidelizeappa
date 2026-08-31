import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Funções públicas usadas pelo cliente final na tela do cartão.
 * Toda a lógica sensível (credenciais, assinatura) vive em módulos *.server.ts
 * importados dinamicamente dentro do handler.
 */

const tokenSchema = z.object({ token: z.string().min(10).max(120) });
const tokenOriginSchema = tokenSchema.extend({ origin: z.string().min(1).max(200) });

function safeOrigin(input: string): string {
  try {
    const u = new URL(input);
    return `${u.protocol}//${u.host}`;
  } catch {
    return process.env.PUBLISHED_APP_URL || process.env.PUBLIC_APP_URL || "https://afidelize.app";
  }
}

/** Diz quais carteiras estão realmente disponíveis para este cartão. */
export const getWalletCapabilities = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { loadPassModelByToken } = await import("@/lib/wallet-pass.server");
    const { readAppleCreds } = await import("@/lib/pkpass.server");
    const { readGoogleCreds } = await import("@/lib/google-wallet.server");

    const model = await loadPassModelByToken(data.token);
    if (!model) return { apple: false, google: false, found: false };

    return {
      found: true,
      apple: !!readAppleCreds() && model.settings.apple_enabled,
      google: !!readGoogleCreds() && model.settings.google_enabled,
    };
  });

/** Cria/atualiza o objeto no Google e devolve o link "Salvar no Google Wallet". */
export const getGoogleWalletLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenOriginSchema.parse(d))
  .handler(async ({ data }) => {
    const { loadPassModelByToken, ensurePassRecord } = await import("@/lib/wallet-pass.server");
    const { readGoogleCreds, upsertGooglePass, buildSaveUrl } = await import("@/lib/google-wallet.server");

    const creds = readGoogleCreds();
    if (!creds) return { configured: false as const, saveUrl: null as string | null };

    const model = await loadPassModelByToken(data.token);
    if (!model) throw new Error("Cartão não encontrado.");
    if (!model.settings.google_enabled) return { configured: false as const, saveUrl: null };

    const origin = safeOrigin(data.origin);
    const { objectId, classId } = await upsertGooglePass(model, origin);
    await ensurePassRecord({ model, platform: "google", googleObjectId: objectId, googleClassId: classId });

    return { configured: true as const, saveUrl: buildSaveUrl(creds, objectId, origin) };
  });

/** pass.json não assinado — usado apenas como fallback de download/depuração. */
export const getPassJson = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenOriginSchema.parse(d))
  .handler(async ({ data }) => {
    const { loadPassModelByToken } = await import("@/lib/wallet-pass.server");
    const { buildApplePassJson } = await import("@/lib/apple-pass.server");
    const model = await loadPassModelByToken(data.token);
    if (!model) throw new Error("Cartão não encontrado.");
    const pass = buildApplePassJson({
      model,
      origin: safeOrigin(data.origin),
      passTypeId: process.env.APPLE_PASS_TYPE_ID || "pass.app.fidelize.card",
      teamId: process.env.APPLE_TEAM_ID || "FIDELIZE",
      serialNumber: `PREVIEW-${model.customer.id}`,
      authenticationToken: "preview",
    });
    return { json: JSON.stringify(pass, null, 2) };
  });
