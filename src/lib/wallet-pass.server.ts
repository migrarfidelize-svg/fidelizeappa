// Modelo de dados compartilhado entre Apple Wallet e Google Wallet.
// Server-only: usa supabaseAdmin. Nunca importar de código de cliente.
import type { Json } from "@/integrations/supabase/types";

export type WalletFieldFlags = {
  customer: boolean;
  code: boolean;
  stamps: boolean;
  points: boolean;
  tier: boolean;
  reward: boolean;
  expiry: boolean;
  contact: boolean;
};

export const DEFAULT_WALLET_FIELDS: WalletFieldFlags = {
  customer: true, code: true, stamps: true, points: true,
  tier: true, reward: true, expiry: true, contact: true,
};

export type WalletSettings = {
  establishment_id: string;
  google_enabled: boolean;
  apple_enabled: boolean;
  logo_url: string | null;
  hero_image_url: string | null;
  background_color: string;
  foreground_color: string;
  label_color: string;
  front_text: string | null;
  back_text: string | null;
  custom_message: string | null;
  show_qr: boolean;
  show_barcode: boolean;
  barcode_format: string;
  fields: WalletFieldFlags;
  validity_days: number | null;
  proximity_enabled: boolean;
  proximity_latitude: number | null;
  proximity_longitude: number | null;
  proximity_message: string | null;
};

export type WalletPassModel = {
  establishment: {
    id: string; name: string; slug: string; logo_url: string | null;
    phone: string | null; whatsapp: string | null; address: string | null; email: string | null;
    primary_color: string | null;
  };
  customer: { id: string; name: string; code: string; tier: string | null; access_token: string; user_id: string | null };
  card: { id: string; stamps: number; campaign_name: string; stamps_required: number; reward_title: string } | null;
  points: number;
  expiresAt: string | null;
  settings: WalletSettings;
};

export function defaultWalletSettings(establishment_id: string, primary?: string | null): WalletSettings {
  return {
    establishment_id,
    google_enabled: true,
    apple_enabled: true,
    logo_url: null,
    hero_image_url: null,
    background_color: primary || "#5B21B6",
    foreground_color: "#FFFFFF",
    label_color: "#E9D5FF",
    front_text: null,
    back_text: null,
    custom_message: null,
    show_qr: true,
    show_barcode: false,
    barcode_format: "QR_CODE",
    fields: DEFAULT_WALLET_FIELDS,
    validity_days: null,
    proximity_enabled: false,
    proximity_latitude: null,
    proximity_longitude: null,
    proximity_message: null,
  };
}

function normalizeSettings(row: Record<string, unknown> | null, estId: string, primary: string | null): WalletSettings {
  const base = defaultWalletSettings(estId, primary);
  if (!row) return base;
  const fields = { ...DEFAULT_WALLET_FIELDS, ...((row.fields as Json as WalletFieldFlags) ?? {}) };
  return { ...base, ...(row as unknown as WalletSettings), fields };
}

/** Carrega o modelo completo do passe a partir do access_token do cliente. */
export async function loadPassModelByToken(token: string): Promise<WalletPassModel | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, name, code, tier, access_token, user_id, establishment_id, visits_count")
    .eq("access_token", token)
    .maybeSingle();
  if (!customer) return null;

  return loadPassModelByCustomer(customer.id);
}

/** Carrega o modelo completo do passe a partir do id do cliente. */
export async function loadPassModelByCustomer(customerId: string): Promise<WalletPassModel | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, name, code, tier, access_token, user_id, establishment_id, visits_count")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return null;

  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("id, name, slug, logo_url, phone, whatsapp, address, email, primary_color")
    .eq("id", customer.establishment_id)
    .maybeSingle();
  if (!est) return null;

  const { data: settingsRow } = await supabaseAdmin
    .from("wallet_settings")
    .select("*")
    .eq("establishment_id", est.id)
    .maybeSingle();

  const { data: cards } = await supabaseAdmin
    .from("loyalty_cards")
    .select("id, stamps, campaigns:campaigns(name, stamps_required, reward_title)")
    .eq("customer_id", customer.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const raw = cards?.[0];
  const campaign = raw?.campaigns as unknown as { name: string; stamps_required: number; reward_title: string } | null;

  const { data: reward } = await supabaseAdmin
    .from("rewards")
    .select("expires_at")
    .eq("card_id", raw?.id ?? "00000000-0000-0000-0000-000000000000")
    .is("redeemed_at", null)
    .not("expires_at", "is", null)
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const settings = normalizeSettings(settingsRow as Record<string, unknown> | null, est.id, est.primary_color);

  let expiresAt: string | null = reward?.expires_at ?? null;
  if (!expiresAt && settings.validity_days && settings.validity_days > 0) {
    expiresAt = new Date(Date.now() + settings.validity_days * 86400_000).toISOString();
  }

  return {
    establishment: est,
    customer: {
      id: customer.id, name: customer.name, code: customer.code,
      tier: (customer.tier as string | null) ?? null,
      access_token: customer.access_token, user_id: customer.user_id,
    },
    card: raw && campaign
      ? { id: raw.id, stamps: raw.stamps ?? 0, campaign_name: campaign.name, stamps_required: campaign.stamps_required, reward_title: campaign.reward_title }
      : null,
    points: customer.visits_count ?? 0,
    expiresAt,
    settings,
  };
}

export function tierLabel(tier: string | null): string {
  switch (tier) {
    case "diamante": return "Diamante";
    case "ouro": return "Ouro";
    case "prata": return "Prata";
    case "bronze": return "Bronze";
    default: return "Bronze";
  }
}

export function hexToRgbCss(hex: string | null | undefined, fallback: string): string {
  const h = (hex || "").trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}

/**
 * Garante um registro único de passe (por cliente + plataforma) e devolve
 * serial + auth token. Nunca reaproveita serial entre clientes.
 */
export async function ensurePassRecord(args: {
  model: WalletPassModel;
  platform: "apple" | "google";
  googleObjectId?: string | null;
  googleClassId?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { model, platform } = args;

  const { data: existing } = await supabaseAdmin
    .from("wallet_passes")
    .select("*")
    .eq("customer_id", model.customer.id)
    .eq("platform", platform)
    .maybeSingle();

  if (existing) {
    await supabaseAdmin
      .from("wallet_passes")
      .update({
        card_id: model.card?.id ?? null,
        status: "active",
        last_synced_at: new Date().toISOString(),
        ...(args.googleObjectId ? { google_object_id: args.googleObjectId } : {}),
        ...(args.googleClassId ? { google_class_id: args.googleClassId } : {}),
      })
      .eq("id", existing.id);
    return existing;
  }

  const serial = `${platform === "apple" ? "AP" : "GW"}-${model.customer.id}`;
  const { data: created, error } = await supabaseAdmin
    .from("wallet_passes")
    .insert({
      establishment_id: model.establishment.id,
      customer_id: model.customer.id,
      card_id: model.card?.id ?? null,
      platform,
      serial_number: serial,
      google_object_id: args.googleObjectId ?? null,
      google_class_id: args.googleClassId ?? null,
      last_synced_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return created;
}
