import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachEstablishmentCore, AttachEstablishmentError, type AttachDb } from "@/lib/my-wallet-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * PostgREST versions with a stale validator clock can reject a valid user
 * access token as PGRST303 ("JWT issued at future"). Authentication is still
 * validated by requireSupabaseAuth via Supabase Auth / getClaims.
 *
 * During that *specific* upstream outage, wallet GET handlers may read through
 * the server-only service role. Every private query MUST still be scoped to
 * context.userId or to IDs obtained from that user's scoped records.
 * Do not use this helper in mutation handlers or other generic endpoints.
 */
async function getWalletReadClient(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
}): Promise<SupabaseClient<Database>> {
  const { error } = await context.supabase
    .from("customers")
    .select("id")
    .eq("user_id", context.userId)
    .limit(1);

  if (!error) return context.supabase;
  if (error.code !== "PGRST303" || !/JWT issued at future/i.test(error.message)) {
    throw error;
  }

  console.warn("[wallet] PostgREST clock skew (PGRST303); switching scoped reads to server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}


// Reexporta o erro para consumidores existentes.
export { AttachEstablishmentError };

/** Returns the current user's account type using the DB helper. */
export const getMyAccountType = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("my_account_type");
    if (error) throw error;
    return (data as "customer" | "establishment" | "super_admin" | null) ?? "customer";
  });

/** Full wallet: every customer row bound to the current user + progress. */
export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const readDb = await getWalletReadClient(context);
    const { data: rows, error } = await readDb
      .from("customers")
      .select(
        `id, name, code, access_token, last_visit_at, visits_count, tier, pinned_at,
         establishment:establishments!inner(
           id, slug, name, logo_url, primary_color, address, phone, whatsapp,
           instagram, active, segment, qr_destination
         )`,
      )
      .eq("user_id", context.userId)
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("last_visit_at", { ascending: false, nullsFirst: false });
    if (error) throw error;

    const customerIds = (rows ?? []).map((r) => r.id);
    if (!customerIds.length) return [];

    // Load cards + campaigns for progress
    const { data: cards, error: cardsError } = await readDb
      .from("loyalty_cards")
      .select(
        `id, customer_id, stamps, cycle, updated_at,
         campaign:campaigns!inner(id, name, stamps_required, reward_title, reward_description, active, stamp_icon, primary_color, accent_color)`,
      )
      .in("customer_id", customerIds);

    if (cardsError) {
      throw cardsError;
    }

    return (rows ?? []).map((r) => {
      const myCards = (cards ?? []).filter((c) => c.customer_id === r.id);
      const best =
        myCards
          .filter((c) => (c.campaign as { active: boolean }).active)
          .sort((a, b) => {
            const aReq = (a.campaign as { stamps_required: number }).stamps_required || 1;
            const bReq = (b.campaign as { stamps_required: number }).stamps_required || 1;
            return b.stamps / bReq - a.stamps / aReq;
          })[0] ?? myCards[0];
      return {
        customer: {
          id: r.id,
          name: r.name,
          code: r.code,
          token: r.access_token,
          lastVisitAt: r.last_visit_at,
          visitsCount: r.visits_count,
          tier: r.tier,
          pinned: !!(r as unknown as { pinned_at: string | null }).pinned_at,
        },
        establishment: r.establishment,
        card: best
          ? {
              id: best.id,
              stamps: best.stamps,
              cycle: best.cycle,
              updatedAt: best.updated_at,
              campaign: best.campaign,
            }
          : null,
        cardsCount: myCards.length,
      };
    });
  });

/**
 * Attaches `access_token`-owned customer to the current auth user.
 * Idempotent; no-op if already linked to this user; errors if linked to someone else.
 */
export const claimCustomerByToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("customers")
      .select("id, user_id, establishment_id, establishments!inner(slug)")
      .eq("access_token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Cartão não encontrado.");
    if (row.user_id && row.user_id !== context.userId) {
      throw new Error("Este cartão já está vinculado a outra conta.");
    }
    if (!row.user_id) {
      // Prevent breaking the (establishment_id, user_id) unique constraint:
      // if the user already has ANOTHER customer row in this establishment,
      // keep the existing one and just return.
      const { data: existing } = await supabaseAdmin
        .from("customers")
        .select("id, establishments!inner(slug)")
        .eq("user_id", context.userId)
        .eq("establishment_id", row.establishment_id)
        .maybeSingle();
      if (existing) {
        return { ok: true as const, slug: (existing.establishments as { slug: string }).slug };
      }
      const { error: updErr } = await supabaseAdmin
        .from("customers")
        .update({ user_id: context.userId })
        .eq("id", row.id);
      if (updErr) throw updErr;
    }
    return { ok: true as const, slug: (row.establishments as { slug: string }).slug };
  });

/**
 * Vincula o usuário autenticado ao estabelecimento (pelo slug), reutilizando
 * a linha em `customers` que já exista para o par (establishment, user) ou
 * "adotando" uma linha órfã com o mesmo telefone do profile. Cria também um
 * `loyalty_card` na primeira campanha ativa quando ainda não existir.
 * Idempotente — pode ser chamado várias vezes sem efeitos colaterais.
 */
export const attachEstablishmentBySlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEstablishmentBySlug } = await import("./establishment-resolution.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Adapter fino: converte as chamadas do core em queries do supabaseAdmin.
    const db: AttachDb = {
      async getEstablishmentBySlug(slug) {
        const res = await resolveEstablishmentBySlug(slug);

        switch (res.status) {
          case "ACTIVE":
            if (!res.establishment) {
              throw new Error("NOT_FOUND");
            }
            return res.establishment;

          case "INACTIVE":
            throw new Error("INACTIVE");

          case "NOT_FOUND":
            throw new Error("NOT_FOUND");

          case "DATABASE_ERROR":
            throw new Error("DATABASE_ERROR");

          default:
            throw new Error("DATABASE_ERROR");
        }
      },
      async getProfile(userId) {
        const { data } = await supabaseAdmin
          .from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();
        return data ?? null;
      },
      async getMyCustomer(userId, estId) {
        const { data } = await supabaseAdmin
          .from("customers").select("id")
          .eq("establishment_id", estId).eq("user_id", userId).maybeSingle();
        return data ?? null;
      },
      async findOrphanByPhone(estId, phoneDigits) {
        const { data } = await supabaseAdmin
          .from("customers").select("id")
          .eq("establishment_id", estId).eq("phone", phoneDigits).is("user_id", null).maybeSingle();
        return data ?? null;
      },
      async linkOrphan(customerId, userId) {
        const { error } = await supabaseAdmin
          .from("customers").update({ user_id: userId }).eq("id", customerId);
        if (error) throw error;
      },
      async createCustomer(input) {
        const { data, error } = await supabaseAdmin
          .from("customers")
          .insert({
            establishment_id: input.establishmentId,
            user_id: input.userId,
            name: input.name,
            phone: input.phone,
            marketing_opt_in: false,
          })
          .select("id")
          .single();
        if (error) throw error;
        return data;
      },
      async createConsent(input) {
        const { consentContext } = await import("./consent.server");
        await supabaseAdmin.from("consents").insert({
          customer_id: input.customerId,
          establishment_id: input.establishmentId,
          marketing_opt_in: false,
          ...consentContext("wallet_signup"),
        });
      },
      async getFirstActiveCampaign(estId) {
        const { data } = await supabaseAdmin
          .from("campaigns").select("id")
          .eq("establishment_id", estId).eq("active", true)
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        return data ?? null;
      },
      async getCard(customerId, campaignId) {
        const { data } = await supabaseAdmin
          .from("loyalty_cards").select("id")
          .eq("customer_id", customerId).eq("campaign_id", campaignId).maybeSingle();
        return data ?? null;
      },
      async createCard(input) {
        const { error } = await supabaseAdmin.from("loyalty_cards").insert({
          customer_id: input.customerId,
          campaign_id: input.campaignId,
          establishment_id: input.establishmentId,
          stamps: 0,
          cycle: 1,
        });
        if (error) throw error;
      },
      async insertAuditLog(row) {
        await supabaseAdmin.from("audit_logs").insert({
          establishment_id: row.establishmentId,
          user_id: row.userId,
          action: row.action,
          entity_type: row.entityType,
          entity_id: row.entityId,
          metadata: row.metadata as never,
        });
      },
    };

    return attachEstablishmentCore(db, { userId: context.userId, slug: data.slug });
  });
export const setWalletFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        customerId: z.string().uuid(),
        pinned: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: customer, error } = await context.supabase
      .from("customers")
      .update({
        pinned_at: data.pinned ? new Date().toISOString() : null,
      })
      .eq("id", data.customerId)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (!customer) {
      throw new Error("Cliente não encontrado.");
    }

    return {
      ok: true,
      pinned: data.pinned,
    };
  });
/** Wallet detail: one establishment's card for the current user. */
export const getMyEstablishmentCard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const readDb = await getWalletReadClient(context);
  const normalizedSlug = data.slug.trim().toLowerCase();

  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );

  const { data: establishment, error: establishmentError } =
    await supabaseAdmin
      .from("establishments")
      .select("id")
      .eq("slug", normalizedSlug)
      .maybeSingle();

  if (establishmentError) throw establishmentError;
  if (!establishment) return null;

  const { data: row, error } = await readDb
    .from("customers")
    .select(
      `id, name, code, access_token, last_visit_at, visits_count, tier, referral_code,
       establishment:establishments!inner(
         id, slug, name, logo_url, primary_color, address, phone, whatsapp,
         instagram, active, description
       )`,
    )
    .eq("user_id", context.userId)
    .eq("establishment_id", establishment.id)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;


    const { data: cards } = await readDb
      .from("loyalty_cards")
      .select(
        `id, stamps, cycle, updated_at, created_at,
         campaign:campaigns!inner(id, name, stamps_required, reward_title, reward_description, active, stamp_icon, primary_color, accent_color, rules, stamp_validity_days, reward_validity_days)`,
      )
      .eq("customer_id", row.id)
      .order("updated_at", { ascending: false });

    const cardIds = (cards ?? []).map((c) => c.id);

    // Recent stamps for this establishment (all campaigns of this customer).
    let recentStamps: Array<{ id: string; createdAt: string; reverted: boolean; campaignName: string | null }> = [];
    let redeemedRewards: Array<{ id: string; unlockedAt: string; redeemedAt: string; campaignName: string; rewardTitle: string }> = [];
    if (cardIds.length) {
      const { data: sRows } = await readDb
        .from("stamps")
        .select("id, card_id, created_at, reverted_at")
        .in("card_id", cardIds)
        .order("created_at", { ascending: false })
        .limit(30);
      const cardName = new Map(
        (cards ?? []).map((c) => [c.id, (c.campaign as { name: string }).name]),
      );
      recentStamps = (sRows ?? []).map((s) => ({
        id: s.id,
        createdAt: s.created_at,
        reverted: !!s.reverted_at,
        campaignName: cardName.get(s.card_id) ?? null,
      }));

      const { data: rRows } = await readDb
        .from("rewards")
        .select("id, card_id, unlocked_at, redeemed_at, campaign:campaigns!inner(name, reward_title)")
        .in("card_id", cardIds)
        .not("redeemed_at", "is", null)
        .order("redeemed_at", { ascending: false })
        .limit(20);
      redeemedRewards = (rRows ?? []).map((r) => ({
        id: r.id,
        unlockedAt: r.unlocked_at,
        redeemedAt: r.redeemed_at as string,
        campaignName: (r.campaign as { name: string }).name,
        rewardTitle: (r.campaign as { reward_title: string }).reward_title,
      }));
    }

    // Cardápio digital: só oferecemos o atalho quando a vitrine está publicada
    // e o recurso está liberado no plano do lojista.
    let hasMenu = false;
    try {
      const { isShowcaseDestinationValid } = await import("@/lib/qr-target.server");
      hasMenu = await isShowcaseDestinationValid(
        readDb,
        (row.establishment as unknown as { id: string }).id,
        "menu"
      );
    } catch {
      hasMenu = false;
    }

    return {
      customer: {
        id: row.id,
        name: row.name,
        code: row.code,
        token: row.access_token,
        lastVisitAt: row.last_visit_at,
        visitsCount: row.visits_count,
        tier: row.tier,
        referralCode: row.referral_code,
      },

      establishment: row.establishment,
      hasMenu,
      cards: cards ?? [],
      recentStamps,
      redeemedRewards,
    };
  });


/** Rewards ready to redeem for the current user (across all cards). */
export const getMyRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const readDb = await getWalletReadClient(context);
    const { data: customers, error: cErr } = await readDb
      .from("customers")
      .select(`id, establishment:establishments!inner(id, slug, name, logo_url, primary_color, active)`)
      .eq("user_id", context.userId);
    if (cErr) throw cErr;
    const ids = (customers ?? []).map((c) => c.id);
    if (!ids.length) return [] as Array<{
      cardId: string; rewardId: string | null; expiresAt: string | null; stamps: number;
      required: number; reward: string;
      campaignName: string; icon: string; establishment: any; ready: boolean; pct: number;
    }>;

    const { data: cards, error } = await readDb
      .from("loyalty_cards")
      .select(`id, customer_id, stamps, updated_at,
        campaign:campaigns!inner(id, name, stamps_required, reward_title, active, stamp_icon, primary_color)`)
      .in("customer_id", ids);
    if (error) throw error;

    // Pending rewards (unlocked, not redeemed) — used to obtain reward_id for temp redeem QR
    // e para avisar o cliente quando o prêmio está perto de expirar.
    const cardIds = (cards ?? []).map((c) => c.id);
    const pendingByCard = new Map<string, { id: string; expiresAt: string | null }>();
    if (cardIds.length) {
      const { data: rewardsRows } = await readDb
        .from("rewards")
        .select("id, card_id, redeemed_at, unlocked_at, expires_at")
        .in("card_id", cardIds)
        .is("redeemed_at", null)
        .order("unlocked_at", { ascending: false });
      for (const r of rewardsRows ?? []) {
        if (!pendingByCard.has(r.card_id)) {
          pendingByCard.set(r.card_id, {
            id: r.id,
            expiresAt: (r as { expires_at: string | null }).expires_at ?? null,
          });
        }
      }
    }

    const custMap = new Map((customers ?? []).map((c) => [c.id, c.establishment]));
    return (cards ?? [])
      .filter((c) => (c.campaign as { active: boolean }).active)
      .map((c) => {
        const req = (c.campaign as { stamps_required: number }).stamps_required || 1;
        const pct = Math.min(100, Math.round((c.stamps / req) * 100));
        const pending = pendingByCard.get(c.id) ?? null;
        return {
          cardId: c.id,
          rewardId: pending?.id ?? null,
          expiresAt: pending?.expiresAt ?? null,
          stamps: c.stamps,
          required: req,
          pct,
          ready: c.stamps >= req,
          reward: (c.campaign as { reward_title: string }).reward_title,
          campaignName: (c.campaign as { name: string }).name,
          icon: (c.campaign as { stamp_icon: string }).stamp_icon,
          establishment: custMap.get(c.customer_id),
        };
      })
      .sort((a, b) => Number(b.ready) - Number(a.ready) || b.pct - a.pct);

  });

/** Chronological history of stamps across all cards for the current user. */
export const getMyHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const readDb = await getWalletReadClient(context);
    const { data: customers, error: cErr } = await readDb
      .from("customers")
      .select(`id, establishment:establishments!inner(id, slug, name, logo_url, primary_color)`)
      .eq("user_id", context.userId);
    if (cErr) throw cErr;
    const custIds = (customers ?? []).map((c) => c.id);
    type HistoryItem = {
      id: string;
      kind: "stamp" | "redeem" | "achievement";
      createdAt: string;
      reverted: boolean;
      establishment: any;
      campaignName: string | null;
      rewardTitle: string | null;
      achievement?: { code: string; title: string; description: string; icon: string; rarity: string } | null;
    };

    // Conquistas do usuário (independem de ter cartão)
    const [{ data: myAchievs }, { data: catalog }] = await Promise.all([
      readDb
        .from("customer_achievements")
        .select("achievement_code, unlocked_at")
        .eq("user_id", context.userId)
        .order("unlocked_at", { ascending: false })
        .limit(30),
      readDb
        .from("achievements")
        .select("code, title, description, icon, rarity")
        .eq("is_active", true),
    ]);
    const catMap = new Map((catalog ?? []).map((c) => [c.code, c]));
    const achievementItems: HistoryItem[] = [];
    for (const a of myAchievs ?? []) {
      const meta = catMap.get(a.achievement_code);
      if (!meta) continue;
      achievementItems.push({
        id: `a:${a.achievement_code}`,
        kind: "achievement",
        createdAt: a.unlocked_at,
        reverted: false,
        establishment: null,
        campaignName: null,
        rewardTitle: null,
        achievement: {
          code: meta.code,
          title: meta.title,
          description: meta.description,
          icon: meta.icon,
          rarity: meta.rarity,
        },
      });
    }

    if (!custIds.length) {
      return achievementItems as HistoryItem[];
    }

    const { data: cards } = await readDb
      .from("loyalty_cards")
      .select(`id, customer_id, campaign:campaigns!inner(name, reward_title)`)
      .in("customer_id", custIds);
    const cardMap = new Map((cards ?? []).map((c) => [c.id, {
      customerId: c.customer_id,
      campaignName: (c.campaign as { name: string }).name,
      rewardTitle: (c.campaign as { reward_title: string }).reward_title,
    }]));
    const cardIds = (cards ?? []).map((c) => c.id);
    if (!cardIds.length) return achievementItems as HistoryItem[];

    const [{ data: stamps, error }, { data: redemptions }] = await Promise.all([
      readDb
        .from("stamps")
        .select(`id, card_id, created_at, reverted_at`)
        .in("card_id", cardIds)
        .order("created_at", { ascending: false })
        .limit(120),
      readDb
        .from("rewards")
        .select(`id, card_id, redeemed_at`)
        .in("card_id", cardIds)
        .not("redeemed_at", "is", null)
        .order("redeemed_at", { ascending: false })
        .limit(60),
    ]);
    if (error) throw error;

    const custEstMap = new Map((customers ?? []).map((c) => [c.id, c.establishment]));
    const stampItems: HistoryItem[] = (stamps ?? []).map((s) => {
      const c = cardMap.get(s.card_id);
      return {
        id: `s:${s.id}`,
        kind: "stamp",
        createdAt: s.created_at,
        reverted: !!s.reverted_at,
        establishment: c ? custEstMap.get(c.customerId) : null,
        campaignName: c?.campaignName ?? null,
        rewardTitle: null,
      };
    });
    const redeemItems: HistoryItem[] = (redemptions ?? []).map((r) => {
      const c = cardMap.get(r.card_id);
      return {
        id: `r:${r.id}`,
        kind: "redeem",
        createdAt: r.redeemed_at as string,
        reverted: false,
        establishment: c ? custEstMap.get(c.customerId) : null,
        campaignName: c?.campaignName ?? null,
        rewardTitle: c?.rewardTitle ?? null,
      };
    });
    return [...stampItems, ...redeemItems, ...achievementItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });


/**
 * Lista estabelecimentos ativos que o usuário ainda NÃO tem na carteira,
 * ordenados por atividade recente. Base do canal "Descobrir".
 * Sem coordenadas geo por ora — retornamos address/city para exibição.
 */
export const getDiscoveryEstablishments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const readDb = await getWalletReadClient(context);
    // Estabelecimentos onde o usuário já tem cartão/registro — não excluímos,
    // apenas marcamos como "já visitados" para o cliente ver novidades/promoções.
    const { data: mine } = await readDb
      .from("customers")
      .select("establishment_id")
      .eq("user_id", context.userId);
    const visited = new Set((mine ?? []).map((r) => r.establishment_id));

    const { data, error } = await readDb
      .from("establishments")
      .select("id, slug, name, logo_url, primary_color, address, city, description, segment, plan, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;

    const estIds = (data ?? []).map((e) => e.id);
    const tiers = Array.from(new Set((data ?? []).map((e) => e.plan).filter(Boolean)));

    const [promoted, plansResult, showcasesResult] = await Promise.all([
      fetchPromotedEstablishmentIds(readDb),
      readDb.from("plans").select("id, tier").in("tier", tiers),
      estIds.length
        ? readDb
            .from("restaurant_menus")
            .select("establishment_id, kind")
            .in("establishment_id", estIds)
            .eq("status", "published")
        : { data: [] },
    ]);

    const planIds = (plansResult.data ?? []).map((p) => p.id);
    const tierToPlanId = new Map<string, string>((plansResult.data ?? []).map((p) => [p.tier as string, p.id]));

    const { data: features } = await readDb
      .from("plan_features")
      .select("plan_id, feature_key, enabled")
      .in("plan_id", planIds)
      .in("feature_key", ["digital_menu", "digital_catalog"]);

    const featureEnabled = new Map<string, Map<string, boolean>>();
    for (const f of features ?? []) {
      const m = featureEnabled.get(f.plan_id) ?? new Map();
      m.set(f.feature_key, f.enabled);
      featureEnabled.set(f.plan_id, m);
    }

    const showcasesByEst = new Map<string, Set<string>>();
    for (const s of showcasesResult.data ?? []) {
      const set = showcasesByEst.get(s.establishment_id) ?? new Set();
      set.add(s.kind);
      showcasesByEst.set(s.establishment_id, set);
    }

    function showcaseEnabled(estId: string, tier: string, kind: "menu" | "catalog") {
      const planId = tierToPlanId.get(tier);
      if (!planId) return false;
      const featureKey = kind === "menu" ? "digital_menu" : "digital_catalog";
      if (!featureEnabled.get(planId)?.get(featureKey)) return false;
      return showcasesByEst.get(estId)?.has(kind) ?? false;
    }

    return (data ?? []).map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      logo_url: e.logo_url,
      primary_color: e.primary_color,
      address: e.address,
      city: e.city,
      description: e.description,
      segment: e.segment,
      visited: visited.has(e.id),
      has_promotion: promoted.has(e.id),
      has_menu: showcaseEnabled(e.id, e.plan, "menu"),
      has_catalog: showcaseEnabled(e.id, e.plan, "catalog"),
    }));
  });

/**
 * IDs de estabelecimentos com promoções ativas agora (respeita janela de vigência).
 * Usa a política pública `Public reads active promotions`.
 */
async function fetchPromotedEstablishmentIds(
  supabase: { from: (t: string) => unknown },
): Promise<Set<string>> {
  const nowIso = new Date().toISOString();
  const { data } = (await (supabase.from("promotions") as unknown as {
    select: (s: string) => {
      eq: (c: string, v: unknown) => {
        or: (f: string) => { or: (f: string) => Promise<{ data: { establishment_id: string }[] | null }> };
      };
    };
  })
    .select("establishment_id")
    .eq("active", true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)) as { data: { establishment_id: string }[] | null };
  return new Set((data ?? []).map((r) => r.establishment_id));
}

/** IDs de estabelecimentos com promoção ativa agora — usado para destacar na carteira. */
export const getPromotedEstablishmentIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const readDb = await getWalletReadClient(context);
    const set = await fetchPromotedEstablishmentIds(readDb);
    return Array.from(set);
  });

/**
 * Resolve login de cliente pelo WhatsApp. Design consciente: no fluxo
 * /carteira o WhatsApp é o único identificador/PIN. Se o usuário existir
 * com e-mail real (cadastros antigos ou vindos por QR/site), reencaixamos
 * a senha nas credenciais sintéticas do fluxo carteira e devolvemos o
 * e-mail correto para o cliente conseguir entrar apenas com o WhatsApp.
 * Retorna { found: false } quando não existe conta associada ao número.
 */
export const resolveWalletLoginByWhatsapp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ whatsapp: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const digits = data.whatsapp.replace(/\D/g, "");
    if (digits.length < 10) return { found: false as const };
    const last8 = digits.slice(-8);
    const syntheticEmail = `wa${digits}@carteira.fidelize.app`;
    const syntheticPassword = `wa_${digits}_fidelize_v1`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const samePhone = (phone?: string | null) => {
      const normalized = (phone ?? "").replace(/\D/g, "");
      return normalized === digits || (last8.length === 8 && normalized.endsWith(last8));
    };

    let targetUserId: string | null = null;
    let email: string | null = null;
    let displayName = "Cliente";

    // 1) Procura uma conta existente pelo telefone do perfil.
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .not("phone", "is", null)
      .limit(2000);
    const profileMatch = (profiles ?? []).find((p) => samePhone(p.phone));
    if (profileMatch?.id) {
      targetUserId = profileMatch.id;
      displayName = profileMatch.full_name ?? displayName;
    }

    // 2) Se ainda não achou, procura na base de clientes dos estabelecimentos.
    // Isso cobre clientes criados pelo lojista/importação CSV, onde e-mail é opcional
    // e `user_id` pode estar vazio até o primeiro acesso à carteira.
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, name, phone, user_id, establishment_id, created_at")
      .not("phone", "is", null)
      .order("created_at", { ascending: true })
      .limit(3000);
    const matchingCustomers = (customers ?? []).filter((c) => samePhone(c.phone));

    if (!targetUserId) {
      const linkedCustomer = matchingCustomers.find((c) => c.user_id);
      if (linkedCustomer?.user_id) {
        targetUserId = linkedCustomer.user_id;
        displayName = linkedCustomer.name ?? displayName;
      }
    }

    if (!targetUserId && matchingCustomers.length) {
      displayName = matchingCustomers[0].name ?? displayName;
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: syntheticPassword,
        email_confirm: true,
        user_metadata: { full_name: displayName, phone: digits, whatsapp: digits },
      });
      if (createErr || !created?.user?.id) throw new Error(createErr?.message ?? "Não foi possível ativar a carteira.");
      targetUserId = created.user.id;
      email = syntheticEmail;
    }

    if (!targetUserId) return { found: false as const };

    // Descobre o e-mail real no auth.users; se a conta foi criada agora, já temos o sintético.
    if (!email) {
      const { data: userRes, error: uErr } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (uErr || !userRes?.user?.email) return { found: false as const };
      email = userRes.user.email;
    }

    // Reencaixa a senha para a senha sintética do fluxo carteira,
    // e garante e-mail confirmado (sem exigir clique de confirmação).
    await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: syntheticPassword,
      email_confirm: true,
      user_metadata: { full_name: displayName, phone: digits, whatsapp: digits },
    });

    await supabaseAdmin.from("profiles").upsert(
      { id: targetUserId, full_name: displayName, phone: digits, account_type: "customer" },
      { onConflict: "id" },
    );

    // Vincula todos os cadastros órfãos com o mesmo WhatsApp, sem quebrar o
    // vínculo caso já exista outro cliente do mesmo usuário no estabelecimento.
    for (const customer of matchingCustomers) {
      if (customer.user_id) continue;
      const { data: existing } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("establishment_id", customer.establishment_id)
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (existing?.id) continue;
      await supabaseAdmin.from("customers").update({ user_id: targetUserId }).eq("id", customer.id);
    }

    return { found: true as const, email, password: syntheticPassword };
  });

