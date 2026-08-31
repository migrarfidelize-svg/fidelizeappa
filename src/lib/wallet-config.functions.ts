import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Configuração da Carteira Digital por estabelecimento (painel do lojista). */

const settingsSchema = z.object({
  establishment_id: z.string().uuid(),
  google_enabled: z.boolean(),
  apple_enabled: z.boolean(),
  logo_url: z.string().url().max(500).nullable().or(z.literal("")).transform((v) => v || null),
  hero_image_url: z.string().url().max(500).nullable().or(z.literal("")).transform((v) => v || null),
  background_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  foreground_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  label_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  front_text: z.string().max(120).nullable(),
  back_text: z.string().max(1000).nullable(),
  custom_message: z.string().max(500).nullable(),
  show_qr: z.boolean(),
  show_barcode: z.boolean(),
  barcode_format: z.enum(["QR_CODE", "CODE_128", "PDF_417", "AZTEC"]),
  fields: z.object({
    customer: z.boolean(), code: z.boolean(), stamps: z.boolean(), points: z.boolean(),
    tier: z.boolean(), reward: z.boolean(), expiry: z.boolean(), contact: z.boolean(),
  }),
  validity_days: z.number().int().min(0).max(3650).nullable(),
});

export const getWalletSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("wallet_settings")
      .select("*")
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();

    const { data: est } = await context.supabase
      .from("establishments")
      .select("primary_color, logo_url")
      .eq("id", data.establishment_id)
      .maybeSingle();

    const { count } = await context.supabase
      .from("wallet_passes")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", data.establishment_id)
      .eq("status", "active");

    return {
      settings: row,
      defaults: { primary_color: est?.primary_color ?? "#5B21B6", logo_url: est?.logo_url ?? null },
      activePasses: count ?? 0,
      serverReady: {
        google: !!process.env.GOOGLE_WALLET_ISSUER_ID && !!process.env.GOOGLE_WALLET_SA_EMAIL && !!process.env.GOOGLE_WALLET_SA_PRIVATE_KEY,
        apple: !!process.env.APPLE_PASS_TYPE_ID && !!process.env.APPLE_PASS_CERT_P12_BASE64,
      },
    };
  });

export const saveWalletSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("member_can", {
      _user: context.userId, _est: data.establishment_id, _action: "settings.manage",
    });
    if (!allowed) throw new Error("Sem permissão para alterar as configurações da carteira.");

    const { error } = await context.supabase
      .from("wallet_settings")
      .upsert({ ...data, fields: data.fields }, { onConflict: "establishment_id" });
    if (error) throw error;
    return { ok: true };
  });

/** Reenvia os dados atualizados para todos os passes ativos da empresa. */
export const resyncWalletPasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid(), origin: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("member_can", {
      _user: context.userId, _est: data.establishment_id, _action: "settings.manage",
    });
    if (!allowed) throw new Error("Sem permissão.");

    let origin = process.env.PUBLISHED_APP_URL || "https://afidelize.app";
    try { const u = new URL(data.origin); origin = `${u.protocol}//${u.host}`; } catch { /* usa padrão */ }

    const { syncEstablishmentWallets } = await import("@/lib/wallet-sync.server");
    const results = await syncEstablishmentWallets(data.establishment_id, origin);
    return { total: results.length, updated: results.filter((r) => r.google === "updated" || r.apple === "flagged").length };
  });
