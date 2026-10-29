import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Estado do convite para o dono do estabelecimento. Nunca retorna o token do convite. */
export const getMyTrialAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: membership, error: memberError } = await context.supabase
      .from("establishment_members")
      .select("id")
      .eq("establishment_id", data.establishment_id)
      .eq("user_id", context.userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (memberError || !membership) throw new Error("Sem acesso a este estabelecimento.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: subscription, error } = await db.from("subscriptions")
      .select("provider,status,current_period_end")
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (error) throw new Error("Falha ao consultar plano de acesso.");
    if (subscription?.provider !== "trial_invite") return { trial: false as const };

    const { data: claim } = await db.from("trial_invite_claims")
      .select("started_at,ends_at,link_id,granted_features")
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    const { data: invite } = claim?.link_id
      ? await db.from("trial_invite_links")
        .select("feature_keys,title")
        .eq("id", claim.link_id).maybeSingle()
      : { data: null };
    const endsAt = subscription.current_period_end ?? claim?.ends_at ?? null;
    return {
      trial: true as const,
      active: subscription.status === "trialing" && !!endsAt && new Date(endsAt).getTime() > Date.now(),
      ends_at: endsAt,
      started_at: claim?.started_at ?? null,
      title: invite?.title ?? "Experiência Fidelize",
      features: (claim?.granted_features ?? []) as string[],
    };
  });

/** Mapeia seções do painel para os recursos concedidos. Pagamentos e suporte ficam acessíveis. */
export const TRIAL_ROUTE_FEATURES: Record<string, string[]> = {
  "/app/analytics": ["reports", "advanced_reports"],
  "/app/qr": ["qrcode", "qr_generator"],
  "/app/clientes": ["customers", "customer_crm"],
  "/app/equipe": ["multi_unit"],
  "/app/carimbar": ["stamps"],
  "/app/campanhas": ["campaigns"],
  "/app/wallet": ["loyalty_card", "loyalty_cards"],
  "/app/linktree": ["bio_commerce"],
  "/app/avaliacoes": ["public_reviews", "reviews"],
  "/app/cardapio": ["digital_menu"],
  "/app/catalogo": ["digital_catalog"],
  "/app/pedidos": ["digital_catalog"],
  "/app/retencao": ["auto_campaigns"],
  "/app/notificacoes": ["push_notifications"],
  "/app/promocoes": ["campaigns"],
  "/app/mensagens": ["email_marketing"],
  "/app/anuncios": ["ads_management"],
  "/app/pagamentos": ["billing.manage"],
};

export function trialCanOpenRoute(pathname: string, features: string[]) {
  const route = Object.keys(TRIAL_ROUTE_FEATURES)
    .sort((a,b)=>b.length-a.length)
    .find((base) => pathname === base || pathname.startsWith(base + "/"));
  if (!route) return true;
  return TRIAL_ROUTE_FEATURES[route].some((key) => features.includes(key));
}
