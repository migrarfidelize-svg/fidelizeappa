import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TRIAL_FEATURES = [
  { key: "dashboard", label: "Painel de indicadores", group: "Fundamentos" },
  { key: "loyalty_card", label: "Cartão fidelidade digital", group: "Fidelidade" },
  { key: "loyalty_cards", label: "Cartões digitais", group: "Fidelidade" },
  { key: "stamps", label: "Carimbos", group: "Fidelidade" },
  { key: "rewards", label: "Recompensas", group: "Fidelidade" },
  { key: "campaigns", label: "Campanhas", group: "Fidelidade" },
  { key: "customers", label: "Cadastro de clientes", group: "Clientes" },
  { key: "customer_crm", label: "CRM de clientes", group: "Clientes" },
  { key: "reports", label: "Relatórios", group: "Resultados" },
  { key: "advanced_reports", label: "Relatórios avançados", group: "Resultados" },
  { key: "public_reviews", label: "Avaliações públicas", group: "Reputação" },
  { key: "qr_generator", label: "Gerador de QR Code", group: "Reputação" },
  { key: "qrcode", label: "QR Codes", group: "Reputação" },
  { key: "digital_menu", label: "Cardápio digital", group: "Vitrine digital" },
  { key: "digital_catalog", label: "Catálogo digital", group: "Vitrine digital" },
  { key: "push_notifications", label: "Notificações push", group: "Comunicação" },
  { key: "email_marketing", label: "E-mail marketing", group: "Comunicação" },
  { key: "branding", label: "Identidade visual", group: "Personalização" },
  { key: "custom_branding", label: "Marca e cores personalizadas", group: "Personalização" },
  { key: "custom_stamp_icons", label: "Ícones personalizados", group: "Personalização" },
  { key: "history", label: "Histórico de atividades", group: "Resultados" },
  { key: "whatsapp_inbox", label: "Atendimento WhatsApp", group: "Comunicação" },
] as const;

export const TRIAL_STARTER_FEATURES = [
  "dashboard", "loyalty_card", "loyalty_cards", "stamps", "rewards",
  "campaigns", "customers", "customer_crm", "qr_generator", "qrcode",
  "public_reviews", "reports", "branding", "custom_branding",
  "digital_catalog",
];

const featureKeys = TRIAL_FEATURES.map((f) => f.key) as string[];
const safeFeatures = z.array(z.string()).max(40).transform((keys) =>
  [...new Set(keys.filter((key) => featureKeys.includes(key)))]
);

const linkSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(400).optional().nullable(),
  plan_id: z.string().uuid(),
  duration_days: z.number().int().min(1).max(365),
  feature_keys: safeFeatures,
  max_signups: z.number().int().min(1).max(500),
  expires_at: z.string().datetime().nullable(),
  active: z.boolean().default(true),
});

const tokenSchema = z.string().min(24).max(128).regex(/^[a-zA-Z0-9_-]+$/);

async function adminDb(supabase: any, userId: string) {
  const { data, error } = await supabase.from("app_roles")
    .select("id").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (error || !data) throw new Error("Acesso restrito ao administrador Fidelize.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const adminGetTrialDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context.supabase, context.userId);
    const [linksRes, visitsRes, claimsRes, plansRes] = await Promise.all([
      db.from("trial_invite_links").select("*").order("created_at", { ascending: false }),
      db.from("trial_invite_visits").select("id,link_id,visitor_id,first_seen_at,last_seen_at,referrer,utm_source,utm_medium,utm_campaign").order("first_seen_at", { ascending: false }).limit(1000),
      db.from("trial_invite_claims").select("*").order("claimed_at", { ascending: false }).limit(500),
      db.from("plans").select("id,name,tier,slug,is_active").eq("is_active", true).order("display_order"),
    ]);
    for (const result of [linksRes, visitsRes, claimsRes, plansRes]) {
      if (result.error) throw new Error(result.error.message);
    }
    const claims = await Promise.all((claimsRes.data ?? []).map(async (claim: any) => {
      const { data: profile } = await db.from("profiles").select("full_name,account_type").eq("id", claim.user_id).maybeSingle();
      const { data: person } = await db.auth.admin.getUserById(claim.user_id);
      const { data: est } = claim.establishment_id
        ? await db.from("establishments").select("name,slug").eq("id", claim.establishment_id).maybeSingle()
        : { data: null };
      return {
        ...claim,
        customer_name: profile?.full_name ?? null,
        customer_email: person?.user?.email ?? null,
        establishment_name: est?.name ?? null,
        establishment_slug: est?.slug ?? null,
      };
    }));
    return {
      links: linksRes.data ?? [],
      visits: visitsRes.data ?? [],
      claims,
      plans: plansRes.data ?? [],
    };
  });

export const adminCreateTrialLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => linkSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.supabase, context.userId);
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(24).toString("hex");
    const { data: row, error } = await db.from("trial_invite_links")
      .insert({ ...data, token, created_by: context.userId }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminUpdateTrialLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => linkSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context.supabase, context.userId);
    const { id, ...payload } = data;
    const { data: previous } = await db.from("trial_invite_links").select("signup_count").eq("id", id).single();
    if (!previous) throw new Error("Link não encontrado.");
    if (payload.max_signups < previous.signup_count) throw new Error("Limite menor que cadastros já realizados.");
    const { data: row, error } = await db.from("trial_invite_links")
      .update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getTrialInvitePublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: link } = await db.from("trial_invite_links")
      .select("id,title,description,plan_id,duration_days,feature_keys,max_signups,signup_count,expires_at,active")
      .eq("token", data.token).maybeSingle();
    if (!link) return { available: false as const, reason: "Este convite não existe." };
    const available = link.active && link.signup_count < link.max_signups &&
      (!link.expires_at || new Date(link.expires_at).getTime() > Date.now());
    if (!available) return { available: false as const, reason: "Este convite já expirou ou atingiu o limite de cadastros." };
    const { data: plan } = await db.from("plans").select("name").eq("id", link.plan_id).maybeSingle();
    return {
      available: true as const,
      title: link.title,
      description: link.description,
      plan_name: plan?.name ?? "Avaliação",
      duration_days: link.duration_days,
      feature_keys: link.feature_keys,
      remaining: link.max_signups - link.signup_count,
    };
  });

export const registerTrialInviteVisit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: tokenSchema,
    visitor_id: z.string().uuid(),
    referrer: z.string().max(500).optional(),
    utm_source: z.string().max(80).optional(),
    utm_medium: z.string().max(80).optional(),
    utm_campaign: z.string().max(80).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: link } = await db.from("trial_invite_links")
      .select("id,active,expires_at,max_signups,signup_count").eq("token",data.token).maybeSingle();
    if (!link?.active || link.signup_count >= link.max_signups ||
      (link.expires_at && new Date(link.expires_at) <= new Date())) {
      return { ok: false as const };
    }
    const { error } = await db.from("trial_invite_visits").upsert({
      link_id: link.id, visitor_id: data.visitor_id,
      referrer: data.referrer ?? null,
      utm_source: data.utm_source ?? null,
      utm_medium: data.utm_medium ?? null,
      utm_campaign: data.utm_campaign ?? null,
    }, { onConflict: "link_id,visitor_id", ignoreDuplicates: true });
    if (error) return { ok: false as const };
    return { ok: true as const };
  });

export const claimTrialInviteForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    token: tokenSchema, visitor_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("claim_trial_invite", {
      _token: data.token, _user: context.userId, _visitor: data.visitor_id,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; claimed?: boolean; already_claimed?: boolean };
  });
