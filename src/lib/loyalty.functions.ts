import { assertActiveSubscription } from "@/lib/subscription-guard";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceLimit } from "@/lib/plans.functions";
import type { Database } from "@/integrations/supabase/types";
import { resolveEstablishmentBySlug } from "./establishment-resolution.server";

// ---------- Public: get establishment by slug ----------
export const getEstablishmentBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) =>
    z.object({
      slug: z.string().min(1).max(80),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const res = await resolveEstablishmentBySlug(data.slug);

    if (res.status === "ACTIVE") {
      if (!res.establishment) {
        throw new Error("NOT_FOUND");
      }
      return { 
        establishment: res.establishment, 
        campaigns: res.campaigns ?? [] 
      };
    }

    if (res.status === "INACTIVE") {
      throw new Error("INACTIVE");
    }

    if (res.status === "NOT_FOUND") {
      throw new Error("NOT_FOUND");
    }

    throw new Error("DATABASE_ERROR");
  });

// ---------- Public: create or fetch customer + card ----------
export const registerOrLoginCustomer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    campaign_id: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(10).max(11),
    email: z.string().email().max(120).optional().or(z.literal("")).transform(v => v || undefined),
    marketing_opt_in: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ensure campaign belongs to establishment and is active
    const {
      data: campaign,
      error: campaignError
    } = await supabaseAdmin
      .from("campaigns")
      .select("id, establishment_id")
      .eq("id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .eq("active", true)
      .maybeSingle();

    if (campaignError) {
      console.error(
        "[registerOrLoginCustomer] campaign lookup failed",
        {
          code: campaignError.code,
          message: campaignError.message,
          establishmentId: data.establishment_id,
          campaignId: data.campaign_id
        }
      );

      throw new Error("DATABASE_ERROR");
    }

    if (!campaign) {
      throw new Error("CAMPAIGN_NOT_FOUND");
    }

    // Try find existing
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("establishment_id", data.establishment_id)
      .eq("phone", data.phone)
      .maybeSingle();

    let customer = existing;
    if (!customer) {
      const { data: created, error: e1 } = await supabaseAdmin
        .from("customers")
        .insert({
          establishment_id: data.establishment_id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          marketing_opt_in: data.marketing_opt_in,
        })
        .select("*")
        .single();
      if (e1) throw new Error(e1.message);
      customer = created;
      const { consentContext } = await import("./consent.server");
      await supabaseAdmin.from("consents").insert({
        customer_id: customer.id,
        establishment_id: data.establishment_id,
        marketing_opt_in: data.marketing_opt_in,
        ...consentContext("loyalty_join"),
      });
    }

    // Ensure loyalty card exists (strictly scoped by establishment_id)
    const { data: card } = await supabaseAdmin
      .from("loyalty_cards")
      .select("*")
      .eq("customer_id", customer!.id)
      .eq("campaign_id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    let cardRow = card;
    if (!cardRow) {
      const { data: nc, error: ec } = await supabaseAdmin
        .from("loyalty_cards")
        .insert({
          customer_id: customer!.id,
          campaign_id: data.campaign_id,
          establishment_id: data.establishment_id,
          stamps: 0, cycle: 1,
        }).select("*").single();
      if (ec) throw new Error(ec.message);
      cardRow = nc;
    }
    return { access_token: customer!.access_token, card_id: cardRow!.id };
  });

// ---------- Public: fetch card details by token ----------
export const getCardByToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(20).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer } = await supabaseAdmin
      .from("customers").select("*").eq("access_token", data.token).maybeSingle();
    if (!customer) return null;
    const { data: est } = await supabaseAdmin
      .from("establishments").select("id, slug, name, logo_url, primary_color, accent_color").eq("id", customer.establishment_id).single();
    const { data: cards } = await supabaseAdmin
      .from("loyalty_cards").select("*, campaigns(*)").eq("customer_id", customer.id);
    const { data: recentStamps } = await supabaseAdmin
      .from("stamps").select("id, card_id, created_at, cycle, reverted_at").in("card_id", (cards ?? []).map(c => c.id)).order("created_at", { ascending: false }).limit(20);
    const { data: rewards } = await supabaseAdmin
      .from("rewards").select("*").in("card_id", (cards ?? []).map(c => c.id)).order("unlocked_at", { ascending: false });
    return { customer, establishment: est, cards: cards ?? [], stamps: recentStamps ?? [], rewards: rewards ?? [] };
  });

// ---------- Authenticated: staff add stamp ----------
async function auditLog(estId: string, userId: string, action: string, entity: string, entityId: string, meta: Record<string, unknown> = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    establishment_id: estId, user_id: userId, action, entity_type: entity, entity_id: entityId,
    metadata: meta as never,
  });
}

export const addStamp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    card_id: z.string().uuid(),
    note: z.string().max(200).optional(),
    pin: z.string().regex(/^\d{4,6}$/).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertFeature } = await import("./plans.functions");
    
    const { data: card, error } = await supabase.from("loyalty_cards").select("*, campaigns(*)").eq("id", data.card_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!card) throw new Error("Cartão não encontrado");

    await assertFeature(supabase, card.establishment_id, "stamps");

    // PIN gate (if enabled in settings)
    const { data: settings } = await supabase.from("establishment_settings").select("security").eq("establishment_id", card.establishment_id).maybeSingle();
    const requirePin = (settings as any)?.security?.require_pin_to_stamp === true;
    if (requirePin) {
      if (!data.pin) throw new Error("PIN obrigatório para carimbar");
      const { data: member } = await supabase.from("establishment_members").select("pin_hash").eq("establishment_id", card.establishment_id).eq("user_id", userId).maybeSingle();
      if (!member?.pin_hash) throw new Error("Você ainda não definiu seu PIN em Configurações › Segurança");
      const { scryptSync, timingSafeEqual } = await import("crypto");
      const [salt, hash] = String(member.pin_hash).split("$");
      const derived = scryptSync(data.pin, salt, 32);
      const okPin = derived.length === Buffer.from(hash, "hex").length && timingSafeEqual(derived, Buffer.from(hash, "hex"));
      if (!okPin) throw new Error("PIN incorreto");
    }


    // Rate limit: no stamp in last 10s
    const { data: last } = await supabase.from("stamps").select("created_at").eq("card_id", card.id).is("reverted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Date.now() - new Date(last.created_at).getTime() < 10_000) {
      throw new Error("Aguarde alguns segundos antes de adicionar outro carimbo.");
    }

    const campaign = card.campaigns as { stamps_required: number; reward_validity_days: number | null; id: string };
    const newStamps = card.stamps + 1;
    const completed = newStamps >= campaign.stamps_required;

    const { error: insErr } = await supabase.from("stamps").insert({
      card_id: card.id, establishment_id: card.establishment_id, added_by: userId, cycle: card.cycle,
    });
    if (insErr) throw new Error("Não foi possível registrar o carimbo: " + insErr.message);

    if (completed) {
      const expires = campaign.reward_validity_days ? new Date(Date.now() + campaign.reward_validity_days * 86400_000).toISOString() : null;
      const { error: rErr } = await supabase.from("rewards").insert({
        card_id: card.id, campaign_id: campaign.id, establishment_id: card.establishment_id,
        cycle: card.cycle, expires_at: expires,
      });
      if (rErr) throw new Error("Falha ao criar recompensa: " + rErr.message);
      const { data: upd, error: uErr } = await supabase.from("loyalty_cards")
        .update({ stamps: 0, cycle: card.cycle + 1 }).eq("id", card.id).select("id");
      if (uErr) throw new Error("Falha ao atualizar cartão: " + uErr.message);
      if (!upd || upd.length === 0) throw new Error("Cartão não atualizado (sem permissão ou não encontrado).");
    } else {
      const { data: upd, error: uErr } = await supabase.from("loyalty_cards")
        .update({ stamps: newStamps }).eq("id", card.id).select("id, stamps");
      if (uErr) throw new Error("Falha ao atualizar cartão: " + uErr.message);
      if (!upd || upd.length === 0) throw new Error("Cartão não atualizado (sem permissão ou não encontrado).");
    }
    const { data: cust } = await supabase.from("customers").select("visits_count").eq("id", card.customer_id).single();
    await supabase.from("customers").update({
      last_visit_at: new Date().toISOString(),
      visits_count: (cust?.visits_count ?? 0) + 1,
    }).eq("id", card.customer_id);

    await auditLog(card.establishment_id, userId, "stamp_added", "loyalty_card", card.id, { completed, new_stamps: completed ? 0 : newStamps });

    // Fire-and-forget push notification to the customer (never blocks or throws).
    try {
      const { sendPushToCustomer } = await import("@/lib/push.server");
      // Deep-link para o cartão específico na /carteira
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: est } = await supabaseAdmin
        .from("establishments")
        .select("slug")
        .eq("id", card.establishment_id)
        .maybeSingle();
      const deepLink = est?.slug ? `/carteira/${est.slug}` : "/carteira";

      if (completed) {
        await sendPushToCustomer(
          card.customer_id,
          {
            title: "🎉 Recompensa liberada!",
            body: "Parabéns! Você completou seu cartão. Retire sua recompensa na próxima visita.",
            url: deepLink,
            tag: `reward-${card.id}`,
          },
          "reward",
        );
      } else {
        const remaining = campaign.stamps_required - newStamps;
        await sendPushToCustomer(
          card.customer_id,
          {
            title: "Novo carimbo adicionado! ⭐",
            body:
              remaining === 1
                ? "Falta só 1 carimbo para o seu prêmio!"
                : `Faltam ${remaining} carimbos para o seu prêmio.`,
            url: deepLink,
            tag: `stamp-${card.id}`,
          },
          "stamp",
        );
      }
    } catch { /* push falhas nunca bloqueiam */ }

    try {
      const { maybeNotifyStampGoalReached } = await import("@/lib/merchant-notify.server");
      await maybeNotifyStampGoalReached(card.establishment_id);
    } catch { /* noop */ }

    // Atualiza automaticamente o cartão salvo no Google/Apple Wallet.
    try {
      const { syncCustomerWalletSafe } = await import("@/lib/wallet-sync.server");
      await syncCustomerWalletSafe(card.customer_id);
    } catch { /* noop */ }


    return { completed, stamps: completed ? 0 : newStamps, required: campaign.stamps_required, cycle: completed ? card.cycle + 1 : card.cycle };

  });

export const undoLastStamp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ card_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: last } = await supabase.from("stamps").select("*").eq("card_id", data.card_id).is("reverted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last) throw new Error("Nenhum carimbo para desfazer");
    if (Date.now() - new Date(last.created_at).getTime() > 60_000) throw new Error("Prazo para desfazer expirou (60s)");
    const { data: updSt, error: sErr } = await supabase.from("stamps").update({ reverted_at: new Date().toISOString(), reverted_by: userId }).eq("id", last.id).select("id");
    if (sErr) throw new Error(sErr.message);
    if (!updSt || updSt.length === 0) throw new Error("Sem permissão para desfazer este carimbo.");
    const { data: card } = await supabase.from("loyalty_cards").select("*").eq("id", data.card_id).single();
    const { error: cErr } = await supabase.from("loyalty_cards").update({ stamps: Math.max(0, card!.stamps - 1) }).eq("id", data.card_id);
    if (cErr) throw new Error(cErr.message);
    await auditLog(card!.establishment_id, userId, "stamp_undone", "loyalty_card", data.card_id, {});
    try {
      const { syncCustomerWalletSafe } = await import("@/lib/wallet-sync.server");
      await syncCustomerWalletSafe(card!.customer_id);
    } catch { /* noop */ }
    return { ok: true };
  });

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reward_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertFeature } = await import("./plans.functions");

    const { data: reward } = await supabase.from("rewards").select("*").eq("id", data.reward_id).maybeSingle();
    if (!reward) throw new Error("Recompensa não encontrada");
    
    await assertFeature(supabase, reward.establishment_id, "loyalty_card");

    if (reward.redeemed_at) throw new Error("Já resgatada");
    await supabase.from("rewards").update({ redeemed_at: new Date().toISOString(), redeemed_by: userId }).eq("id", data.reward_id);
    await auditLog(reward.establishment_id, userId, "reward_redeemed", "reward", data.reward_id, {});
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: c } = await supabaseAdmin.from("loyalty_cards").select("customer_id").eq("id", reward.card_id).maybeSingle();
      if (c?.customer_id) {
        const { syncCustomerWalletSafe } = await import("@/lib/wallet-sync.server");
        await syncCustomerWalletSafe(c.customer_id);
      }
    } catch { /* noop */ }
    return { ok: true };
  });

// ---------- Authenticated: search customers ----------
export const searchCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    query: z.string().trim().min(1).max(80),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = data.query;
    const isPhone = /^\d+$/.test(q);
    const filter = isPhone
      ? `phone.ilike.%${q}%,code.ilike.%${q}%`
      : `name.ilike.%${q}%,phone.ilike.%${q}%,code.ilike.%${q}%,email.ilike.%${q}%`;
    const { data: customers, error } = await supabase.from("customers")
      .select("id, name, phone, code, email, visits_count, last_visit_at")
      .eq("establishment_id", data.establishment_id)
      .or(filter)
      .limit(20);
    if (error) throw new Error(error.message);
    return customers ?? [];
  });

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    query: z.string().trim().max(80).optional().default(""),
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(20),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;
    let query = supabase.from("customers")
      .select("id, name, phone, code, email, visits_count, last_visit_at", { count: "exact" })
      .eq("establishment_id", data.establishment_id);
    const q = data.query.trim();
    if (q) {
      const isPhone = /^\d+$/.test(q);
      const filter = isPhone
        ? `phone.ilike.%${q}%,code.ilike.%${q}%`
        : `name.ilike.%${q}%,phone.ilike.%${q}%,code.ilike.%${q}%,email.ilike.%${q}%`;
      query = query.or(filter);
    }
    const { data: customers, error, count } = await query
      .order("last_visit_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { customers: customers ?? [], total: count ?? 0, page: data.page, page_size: data.page_size };
  });

// ---------- Advanced list with filters (Customers base) ----------
export const listCustomersAdvanced = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    query: z.string().trim().max(80).optional().default(""),
    status: z.enum(["all", "active", "blocked", "opt_in", "recent", "inactive"]).optional().default("all"),
    campaign_id: z.string().uuid().optional().nullable(),
    sort: z.enum(["last_visit", "created", "name", "visits"]).optional().default("last_visit"),
    dir: z.enum(["asc", "desc"]).optional().default("desc"),
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(20),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;
    let query = supabase.from("customers")
      .select("id, name, phone, code, email, birthdate, visits_count, last_visit_at, created_at, blocked, marketing_opt_in, notes", { count: "exact" })
      .eq("establishment_id", data.establishment_id);
    const q = data.query.trim();
    if (q) {
      const isPhone = /^\d+$/.test(q);
      const filter = isPhone
        ? `phone.ilike.%${q}%,code.ilike.%${q}%`
        : `name.ilike.%${q}%,phone.ilike.%${q}%,code.ilike.%${q}%,email.ilike.%${q}%`;
      query = query.or(filter);
    }
    if (data.status === "active") query = query.eq("blocked", false);
    if (data.status === "blocked") query = query.eq("blocked", true);
    if (data.status === "opt_in") query = query.eq("marketing_opt_in", true);
    if (data.status === "recent") query = query.gte("last_visit_at", new Date(Date.now() - 30 * 86400_000).toISOString());
    if (data.status === "inactive") query = query.or(`last_visit_at.is.null,last_visit_at.lt.${new Date(Date.now() - 60 * 86400_000).toISOString()}`);
    if (data.campaign_id) {
      const { data: ids } = await supabase.from("loyalty_cards").select("customer_id").eq("campaign_id", data.campaign_id);
      const cids = (ids ?? []).map((r: { customer_id: string }) => r.customer_id);
      if (cids.length === 0) return { customers: [], total: 0, page: data.page, page_size: data.page_size };
      query = query.in("id", cids);
    }
    const col = data.sort === "last_visit" ? "last_visit_at" : data.sort === "created" ? "created_at" : data.sort === "name" ? "name" : "visits_count";
    query = query.order(col, { ascending: data.dir === "asc", nullsFirst: false });
    const { data: customers, error, count } = await query.range(from, to);
    if (error) throw new Error(error.message);
    return { customers: customers ?? [], total: count ?? 0, page: data.page, page_size: data.page_size };
  });

export const getCustomerStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const est = data.establishment_id;
    const now = Date.now();
    const [total, blocked, optin, recent, newMonth] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("establishment_id", est),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("establishment_id", est).eq("blocked", true),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("establishment_id", est).eq("marketing_opt_in", true),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("establishment_id", est).gte("last_visit_at", new Date(now - 30 * 86400_000).toISOString()),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("establishment_id", est).gte("created_at", new Date(now - 30 * 86400_000).toISOString()),
    ]);
    return {
      total: total.count ?? 0,
      blocked: blocked.count ?? 0,
      opt_in: optin.count ?? 0,
      active_30d: recent.count ?? 0,
      new_30d: newMonth.count ?? 0,
    };
  });

export const getCustomerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: customer, error } = await supabase.from("customers").select("*").eq("id", data.customer_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("Cliente não encontrado");
    const { data: cards } = await supabase.from("loyalty_cards").select("*, campaigns(id, name, stamps_required, reward_title, stamp_icon, active)").eq("customer_id", customer.id);
    const cardIds = (cards ?? []).map((c: { id: string }) => c.id);
    const [stamps, rewards, consents] = await Promise.all([
      cardIds.length ? supabase.from("stamps").select("id, card_id, created_at, cycle, reverted_at, added_by").in("card_id", cardIds).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] as any[] }),
      cardIds.length ? supabase.from("rewards").select("*").in("card_id", cardIds).order("unlocked_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
      supabase.from("consents").select("*").eq("customer_id", customer.id).order("created_at", { ascending: false }),
    ]);
    return {
      customer,
      cards: cards ?? [],
      stamps: (stamps.data ?? []) as any[],
      rewards: (rewards.data ?? []) as any[],
      consents: (consents.data ?? []) as any[],
    };
  });

const customerInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\d{10,11}$/, "Telefone inválido"),
  email: z.string().trim().email().max(120).optional().or(z.literal("")).transform(v => v || null),
  birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).transform(v => v || null),
  notes: z.string().max(1000).optional().or(z.literal("")).transform(v => v || null),
  marketing_opt_in: z.boolean().default(false),
});

export const createCustomerRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    campaign_id: z.string().uuid().optional().nullable(),
    ...customerInputSchema.shape,
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertActiveSubscription(context.supabase, (data as any).establishment_id);
    const { supabase } = context;
    // Plan limit check
    await enforceLimit(supabase, data.establishment_id, "customers", 1);
    // dedupe by phone
    const { data: dup } = await supabase.from("customers").select("id").eq("establishment_id", data.establishment_id).eq("phone", data.phone).maybeSingle();
    if (dup) throw new Error("Já existe um cliente com este telefone.");
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const access_token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: created, error } = await supabase.from("customers").insert({
      establishment_id: data.establishment_id,
      name: data.name, phone: data.phone, email: data.email, birthdate: data.birthdate,
      notes: data.notes, marketing_opt_in: data.marketing_opt_in,
      code, access_token,
    }).select("*").single();
    if (error) throw new Error(error.message);
    if (data.campaign_id) {
      const { error: ce } = await supabase.from("loyalty_cards").insert({
        customer_id: created.id, campaign_id: data.campaign_id,
        establishment_id: data.establishment_id, stamps: 0, cycle: 1,
      });
      if (ce) throw new Error("Cliente criado mas cartão falhou: " + ce.message);
    }
    await auditLog(data.establishment_id, context.userId, "customer_created", "customer", created.id, { name: created.name });
    return created;
  });

export const updateCustomerRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    customer_id: z.string().uuid(),
    ...customerInputSchema.shape,
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: upd, error } = await supabase.from("customers").update({
      name: data.name, phone: data.phone, email: data.email, birthdate: data.birthdate,
      notes: data.notes, marketing_opt_in: data.marketing_opt_in,
    }).eq("id", data.customer_id).select("*").single();
    if (error) throw new Error(error.message);
    await auditLog(upd.establishment_id, context.userId, "customer_updated", "customer", upd.id, {});
    return upd;
  });

export const setCustomerBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid(), blocked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: upd, error } = await supabase.from("customers").update({ blocked: data.blocked }).eq("id", data.customer_id).select("id, establishment_id, blocked").single();
    if (error) throw new Error(error.message);
    await auditLog(upd.establishment_id, context.userId, data.blocked ? "customer_blocked" : "customer_unblocked", "customer", upd.id, {});
    return upd;
  });

export const deleteCustomerRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: c } = await supabase.from("customers").select("id, establishment_id, name").eq("id", data.customer_id).maybeSingle();
    if (!c) throw new Error("Cliente não encontrado");
    const { error } = await supabase.from("customers").delete().eq("id", data.customer_id);
    if (error) throw new Error("Sem permissão ou erro ao excluir: " + error.message);
    await auditLog(c.establishment_id, context.userId, "customer_deleted", "customer", c.id, { name: c.name });
    return { ok: true };
  });

// ---------- Bulk actions ----------
export const bulkSetBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    customer_ids: z.array(z.string().uuid()).min(1).max(500),
    blocked: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: upd, error } = await supabase.from("customers")
      .update({ blocked: data.blocked })
      .eq("establishment_id", data.establishment_id)
      .in("id", data.customer_ids)
      .select("id");
    if (error) throw new Error(error.message);
    const affected = upd?.length ?? 0;
    if (affected === 0) throw new Error("Nenhum cliente atualizado (sem permissão).");
    for (const row of upd ?? []) {
      await auditLog(data.establishment_id, userId, data.blocked ? "customer_blocked" : "customer_unblocked", "customer", row.id, { bulk: true });
    }
    return { affected };
  });

export const bulkDeleteCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    customer_ids: z.array(z.string().uuid()).min(1).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.from("customers")
      .delete()
      .eq("establishment_id", data.establishment_id)
      .in("id", data.customer_ids)
      .select("id, name");
    if (error) throw new Error("Sem permissão ou erro ao excluir: " + error.message);
    const affected = rows?.length ?? 0;
    if (affected === 0) throw new Error("Nenhum cliente excluído.");
    for (const r of rows ?? []) {
      await auditLog(data.establishment_id, userId, "customer_deleted", "customer", r.id, { bulk: true, name: r.name });
    }
    return { affected };
  });

// ---------- CSV import ----------
const csvRowSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(80),
  phone: z.string().trim().transform(s => s.replace(/\D/g, "")).pipe(z.string().regex(/^\d{10,11}$/, "Telefone inválido")),
  email: z.string().trim().email("E-mail inválido").max(120).optional().or(z.literal("")).transform(v => v || null),
  birthdate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD").optional().or(z.literal("")).transform(v => v || null),
  notes: z.string().max(1000).optional().or(z.literal("")).transform(v => v || null),
  marketing_opt_in: z.union([z.boolean(), z.string()]).optional().transform(v => {
    if (typeof v === "boolean") return v;
    if (!v) return false;
    return ["1", "true", "sim", "yes", "s", "y"].includes(String(v).trim().toLowerCase());
  }),
});

export const importCustomersCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    rows: z.array(z.record(z.string())).min(1).max(2000),
    dry_run: z.boolean().default(false),
    campaign_id: z.string().uuid().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertActiveSubscription(context.supabase, (data as any).establishment_id);
    const { supabase, userId } = context;
    const { assertFeature } = await import("./plans.functions");
    await assertFeature(supabase, data.establishment_id, "customer_import");
    // Validate + normalize
    type Ok = { line: number; row: z.infer<typeof csvRowSchema> };
    type Err = { line: number; error: string; raw: Record<string, string> };
    const valid: Ok[] = [];
    const errors: Err[] = [];
    const seenPhones = new Set<string>();
    const duplicatesInFile: Err[] = [];
    data.rows.forEach((raw, idx) => {
      const parsed = csvRowSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push({ line: idx + 2, error: parsed.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; "), raw });
        return;
      }
      if (seenPhones.has(parsed.data.phone)) {
        duplicatesInFile.push({ line: idx + 2, error: "Telefone duplicado no arquivo", raw });
        return;
      }
      seenPhones.add(parsed.data.phone);
      valid.push({ line: idx + 2, row: parsed.data });
    });

    // Check DB dedupe
    const phones = valid.map(v => v.row.phone);
    let existingPhones = new Set<string>();
    if (phones.length) {
      const { data: existing } = await supabase.from("customers")
        .select("phone").eq("establishment_id", data.establishment_id).in("phone", phones);
      existingPhones = new Set((existing ?? []).map(e => e.phone));
    }
    const toInsert = valid.filter(v => !existingPhones.has(v.row.phone));
    const dupsInDb = valid.filter(v => existingPhones.has(v.row.phone))
      .map(v => ({ line: v.line, error: "Telefone já cadastrado", raw: Object.fromEntries(Object.entries(v.row).map(([k,val])=>[k,String(val ?? "")])) }));

    const summary = {
      total: data.rows.length,
      valid: toInsert.length,
      errors: errors.length,
      duplicates_in_file: duplicatesInFile.length,
      duplicates_in_db: dupsInDb.length,
    };
    const preview = {
      errors: errors.slice(0, 50),
      duplicates_in_file: duplicatesInFile.slice(0, 50),
      duplicates_in_db: dupsInDb.slice(0, 50),
      sample: toInsert.slice(0, 10).map(v => v.row),
    };

    if (data.dry_run || toInsert.length === 0) {
      return { dry_run: true, summary, preview, inserted: 0 };
    }

    // Plan limit check for real import
    await enforceLimit(supabase, data.establishment_id, "customers", toInsert.length);

    // Insert in chunks
    let inserted = 0;
    const chunkSize = 100;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const payload = chunk.map(v => ({
        establishment_id: data.establishment_id,
        name: v.row.name, phone: v.row.phone, email: v.row.email,
        birthdate: v.row.birthdate, notes: v.row.notes,
        marketing_opt_in: v.row.marketing_opt_in ?? false,
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        access_token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
      }));
      const { data: ins, error } = await supabase.from("customers").insert(payload).select("id");
      if (error) throw new Error("Falha ao inserir: " + error.message);
      inserted += ins?.length ?? 0;
      if (data.campaign_id && ins?.length) {
        const cardPayload = ins.map(r => ({
          customer_id: r.id, campaign_id: data.campaign_id!,
          establishment_id: data.establishment_id, stamps: 0, cycle: 1,
        }));
        await supabase.from("loyalty_cards").insert(cardPayload);
      }
    }
    await auditLog(data.establishment_id, userId, "customers_imported", "customer", data.establishment_id, { inserted, ...summary });
    return { dry_run: false, summary, preview, inserted };
  });

// ---------- Customer audit trail ----------
export const getCustomerAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cust } = await supabase.from("customers").select("id, establishment_id").eq("id", data.customer_id).maybeSingle();
    if (!cust) throw new Error("Cliente não encontrado");
    const { data: cards } = await supabase.from("loyalty_cards").select("id").eq("customer_id", data.customer_id);
    const cardIds = (cards ?? []).map(c => c.id);
    const orFilter = cardIds.length
      ? `and(entity_type.eq.customer,entity_id.eq.${data.customer_id}),and(entity_type.eq.loyalty_card,entity_id.in.(${cardIds.join(",")}))`
      : `and(entity_type.eq.customer,entity_id.eq.${data.customer_id})`;
    const { data: logs, error } = await supabase.from("audit_logs")
      .select("id, action, entity_type, entity_id, metadata, user_id, created_at")
      .eq("establishment_id", cust.establishment_id)
      .or(orFilter)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((logs ?? []).map(l => l.user_id).filter(Boolean))) as string[];
    let usersMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      usersMap = new Map((profs ?? []).map(p => [p.id, p.full_name ?? ""]));
    }
    return (logs ?? []).map(l => ({
      ...l,
      user_name: (l.user_id && usersMap.get(l.user_id)) || null,
    }));
  });







export const getCustomerTokenByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    code: z.string().trim().min(3).max(20),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase.from("customers")
      .select("access_token")
      .eq("establishment_id", data.establishment_id)
      .eq("code", data.code)
      .maybeSingle();
    return row?.access_token ?? null;
  });


// ---------- Onboarding ----------
const SLUG_RESERVED = new Set(["app", "admin", "auth", "onboarding", "api", "l", "cartao", "c", "precos", "termos", "privacidade", "404", "bloqueado"]);

const establishmentSchema = z.object({
  name: z.string({ required_error: "Informe o nome da empresa." })
    .trim()
    .min(2, "O nome da empresa precisa ter pelo menos 2 caracteres.")
    .max(80, "O nome da empresa pode ter no máximo 80 caracteres."),
  slug: z.string({ required_error: "Informe o endereço público." })
    .trim()
    .toLowerCase()
    .min(3, "O endereço público precisa ter pelo menos 3 caracteres.")
    .max(60, "O endereço público pode ter no máximo 60 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens (sem espaços ou acentos).")
    .refine((v) => !SLUG_RESERVED.has(v), "Este endereço é reservado. Escolha outro."),
  segment: z.string({ required_error: "Selecione a categoria do seu negócio." })
    .trim()
    .min(2, "Selecione a categoria do seu negócio."),
  description: z.string().max(500, "A descrição pode ter no máximo 500 caracteres.").optional(),
  address: z.string().max(200, "O endereço pode ter no máximo 200 caracteres.").optional(),
  phone: z.string().max(20, "Telefone inválido.").optional(),
  whatsapp: z.string().max(20, "WhatsApp inválido.").optional(),
  primary_color: z.string().max(20).default("#5B21B6"),
  accent_color: z.string().max(20).default("#F97066"),
  logo_url: z.string().max(2000, "Link do logo muito longo.").url("Link do logo inválido.").optional().or(z.literal("")).transform((v) => v || undefined),
  campaign_name: z.string().trim().min(2).max(80).default("Cartão Fidelidade").optional(),
  stamps_required: z.number().int().min(2).max(50).default(10).optional(),
  reward_title: z.string().trim().min(2).max(120).default("Brinde exclusivo").optional(),
  reward_description: z.string().max(500, "Os detalhes da recompensa podem ter no máximo 500 caracteres.").optional(),
  stamp_icon: z.string().trim().min(1).max(32).default("star"),
});

function parseEstablishmentInput(d: unknown) {
  const r = establishmentSchema.safeParse(d);
  if (r.success) return r.data;
  // Retorna a primeira mensagem em pt-BR (sempre já traduzida acima).
  const first = r.error.errors[0];
  throw new Error(first?.message ?? "Dados inválidos. Revise o formulário.");
}

export const createEstablishment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseEstablishmentInput(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est, error } = await supabase.from("establishments").insert({
      slug: data.slug, name: data.name, segment: data.segment, description: data.description, address: data.address, phone: data.phone, whatsapp: data.whatsapp,
      primary_color: data.primary_color, accent_color: data.accent_color, logo_url: data.logo_url, created_by: userId,
    }).select("id, slug").single();
    if (error) {
      if (error.code === "23505") throw new Error("Este endereço já está em uso, escolha outro.");
      throw new Error("Não foi possível criar a empresa. Tente novamente em instantes.");
    }
    await supabase.from("establishment_members").insert({ establishment_id: est.id, user_id: userId, role: "owner" });
    // A campanha NÃO é criada no ato do onboarding para evitar violação de RLS (requires active subscription).
    // Ela será criada automaticamente ou manualmente APÓS o primeiro pagamento ser confirmado e a assinatura ficar ativa.
    return { establishment_id: est.id, slug: est.slug };
  });

export const getMyEstablishments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("establishment_members")
      .select("role, establishment:establishments(*)")
      .eq("user_id", userId).eq("active", true);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const est = data.establishment_id;

    // 1. Validar que o usuário pertence ao establishment solicitado
    const { data: membership } = await supabase
      .from("establishment_members")
      .select("id")
      .eq("establishment_id", est)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      // Se não for membro, checar se é super admin
      const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
      if (!isAdmin) throw new Error("Acesso negado ao estabelecimento.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 2. Ler production_started_at de system_settings usando supabaseAdmin (Server-Side Only)
    const { data: settings } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("namespace", "system")
      .eq("key", "production_mode")
      .maybeSingle();

    const productionData = (settings?.value as any) || { enabled: false, production_started_at: "1970-01-01T00:00:00Z" };
    const cutoff = productionData.production_started_at || "1970-01-01T00:00:00Z";

    const now = new Date();
    const goalMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // 3. Chamar dashboard_summary usando supabaseAdmin (service_role) pois a RPC é restrita
    const { data: raw, error } = await (supabaseAdmin as any).rpc("dashboard_summary", { 
      _est: est,
      _cutoff: cutoff
    });

    if (error) throw new Error(error.message);

    const s = (raw ?? {}) as {
      customersCount?: number; stampsCount?: number; rewardsCount?: number; redeemedCount?: number;
      mom?: { customers?: { current?: number; previous?: number }; stamps?: { current?: number; previous?: number }; rewards?: { current?: number; previous?: number } };
      topCustomers?: { id: string; name: string; visits_count: number; last_visit_at: string | null }[];
      daily?: Record<string, number>;
      goals?: { stamps_goal: number; customers_goal: number; rewards_goal: number; revenue_goal: number } | null;
    };

    const daily = s.daily ?? {};
    const days: { day: string; carimbos: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      days.push({ day: d.slice(5), carimbos: daily[d] ?? 0 });
    }

    return {
      customersCount: s.customersCount ?? 0,
      stampsCount: s.stampsCount ?? 0,
      rewardsCount: s.rewardsCount ?? 0,
      redeemedCount: s.redeemedCount ?? 0,
      series: days,
      topCustomers: s.topCustomers ?? [],
      mom: {
        customers: { current: s.mom?.customers?.current ?? 0, previous: s.mom?.customers?.previous ?? 0 },
        stamps: { current: s.mom?.stamps?.current ?? 0, previous: s.mom?.stamps?.previous ?? 0 },
        rewards: { current: s.mom?.rewards?.current ?? 0, previous: s.mom?.rewards?.previous ?? 0 },
      },
      goals: s.goals ?? { stamps_goal: 0, customers_goal: 0, rewards_goal: 0, revenue_goal: 0 },
      goalMonth: goalMonthKey,
    };
  });

export const getEstablishmentCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.from("campaigns")
      .select("id, name, type, reward_title, reward_description, rules, stamps_required, stamp_icon, stamp_validity_days, reward_validity_days, primary_color, accent_color, active, created_at")
      .eq("establishment_id", data.establishment_id)
      .order("active", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map(r => r.id);
    if (ids.length === 0) return [];
    const [{ data: cards }, { data: rewards }] = await Promise.all([
      supabase.from("loyalty_cards").select("id, campaign_id").in("campaign_id", ids),
      supabase.from("rewards").select("id, campaign_id, redeemed_at").in("campaign_id", ids),
    ]);
    const cardCount = new Map<string, number>();
    (cards ?? []).forEach(c => cardCount.set(c.campaign_id, (cardCount.get(c.campaign_id) ?? 0) + 1));
    const rewardCount = new Map<string, { unlocked: number; redeemed: number }>();
    (rewards ?? []).forEach(r => {
      const cur = rewardCount.get(r.campaign_id) ?? { unlocked: 0, redeemed: 0 };
      cur.unlocked += 1;
      if (r.redeemed_at) cur.redeemed += 1;
      rewardCount.set(r.campaign_id, cur);
    });
    return (rows ?? []).map(r => ({
      ...r,
      cards_count: cardCount.get(r.id) ?? 0,
      rewards_unlocked: rewardCount.get(r.id)?.unlocked ?? 0,
      rewards_redeemed: rewardCount.get(r.id)?.redeemed ?? 0,
    }));
  });

// ---------- Campaign CRUD ----------
const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").nullable().optional().or(z.literal("")).transform(v => (v ? v : null));
const campaignInput = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(80, "Nome muito longo."),
  reward_title: z.string().trim().min(2, "Descreva a recompensa.").max(120),
  reward_description: z.string().max(500).optional().or(z.literal("")).transform(v => v || undefined),
  rules: z.string().max(1000).optional().or(z.literal("")).transform(v => v || undefined),
  stamps_required: z.number().int().min(2, "Mínimo de 2 carimbos.").max(50, "Máximo de 50 carimbos."),
  stamp_icon: z.string().trim().min(1).max(32).default("star"),
  stamp_validity_days: z.number().int().min(0).max(3650).nullable().optional(),
  reward_validity_days: z.number().int().min(0).max(3650).nullable().optional(),
  primary_color: hexColor,
  accent_color: hexColor,
});

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).and(campaignInput).parse(d))
  .handler(async ({ data, context }) => {
    await assertActiveSubscription(context.supabase, (data as any).establishment_id);
    const { supabase, userId } = context;
    const { establishment_id, ...rest } = data;
    await enforceLimit(supabase, establishment_id, "campaigns", 1);
    const { data: row, error } = await supabase.from("campaigns").insert({
      establishment_id,
      name: rest.name,
      reward_title: rest.reward_title,
      reward_description: rest.reward_description,
      rules: rest.rules,
      stamps_required: rest.stamps_required,
      stamp_icon: rest.stamp_icon,
      stamp_validity_days: rest.stamp_validity_days ?? null,
      reward_validity_days: rest.reward_validity_days ?? null,
      primary_color: rest.primary_color ?? null,
      accent_color: rest.accent_color ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await auditLog(establishment_id, userId, "campaign_created", "campaign", row.id, { name: rest.name });
    return row;
  });

export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
    }).and(campaignInput).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;

    // Primeiro resolve o estabelecimento REAL da campanha.
    // Nunca confiar em establishment_id enviado pelo frontend.
    const { data: cur, error: curError } = await supabase
      .from("campaigns")
      .select("establishment_id")
      .eq("id", id)
      .maybeSingle();

    if (curError) {
      throw new Error(curError.message);
    }

    if (!cur?.establishment_id) {
      throw new Error("Campanha não encontrada");
    }

    // Agora valida a assinatura usando o establishment_id real do banco.
    await assertActiveSubscription(
      supabase,
      cur.establishment_id
    );

    const { error } = await supabase
      .from("campaigns")
      .update({
        name: rest.name,
        reward_title: rest.reward_title,
        reward_description: rest.reward_description,
        rules: rest.rules,
        stamps_required: rest.stamps_required,
        stamp_icon: rest.stamp_icon,
        stamp_validity_days:
          rest.stamp_validity_days ?? null,
        reward_validity_days:
          rest.reward_validity_days ?? null,
        primary_color:
          rest.primary_color ?? null,
        accent_color:
          rest.accent_color ?? null,
      })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    await auditLog(
      cur.establishment_id,
      userId,
      "campaign_updated",
      "campaign",
      id,
      { name: rest.name }
    );

    return { ok: true };
  });

export const toggleCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      active: z.boolean(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cur, error: curError } = await supabase
      .from("campaigns")
      .select("establishment_id")
      .eq("id", data.id)
      .maybeSingle();

    if (curError) {
      throw new Error(curError.message);
    }

    if (!cur?.establishment_id) {
      throw new Error("Campanha não encontrada");
    }

    await assertActiveSubscription(
      supabase,
      cur.establishment_id
    );

    const { error } = await supabase
      .from("campaigns")
      .update({
        active: data.active,
      })
      .eq("id", data.id);

    if (error) {
      throw new Error(error.message);
    }

    await auditLog(
      cur.establishment_id,
      userId,
      data.active
        ? "campaign_activated"
        : "campaign_paused",
      "campaign",
      data.id,
      {}
    );

    return { ok: true };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur } = await supabase.from("campaigns").select("establishment_id").eq("id", data.id).maybeSingle();
    if (!cur) throw new Error("Campanha não encontrada");
    const { count } = await supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("campaign_id", data.id);
    if ((count ?? 0) > 0) throw new Error("Esta campanha já possui cartões emitidos. Pause-a em vez de excluir.");
    const { error } = await supabase.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditLog(cur.establishment_id, userId, "campaign_deleted", "campaign", data.id, {});
    return { ok: true };
  });



// ---------- Internal: Ensure initial resources on first payment ----------
export async function ensureEstablishmentInitialResources(establishmentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Criar campanha inicial se não existir nenhuma
  const { data: campaigns } = await supabaseAdmin
    .from("campaigns")
    .select("id")
    .eq("establishment_id", establishmentId)
    .limit(1);

  if (!campaigns || campaigns.length === 0) {
    const { data: est } = await supabaseAdmin
      .from("establishments")
      .select("name, primary_color, accent_color")
      .eq("id", establishmentId)
      .single();

    if (est) {
      await supabaseAdmin.from("campaigns").insert({
        establishment_id: establishmentId,
        name: "Cartão Fidelidade",
        reward_title: "Brinde Exclusivo",
        reward_description: "Ganhe um brinde ao completar seu cartão!",
        stamps_required: 10,
        stamp_icon: "star",
        primary_color: est.primary_color,
        accent_color: est.accent_color,
        active: true
      });
    }
  }

  // 2. Criar página inicial no Link Tree se não existir
  const { data: pages } = await supabaseAdmin
    .from("link_tree_pages")
    .select("id")
    .eq("establishment_id", establishmentId)
    .limit(1);

  if (!pages || pages.length === 0) {
    const { data: est } = await supabaseAdmin
      .from("establishments")
      .select("name, slug, logo_url, primary_color, accent_color")
      .eq("id", establishmentId)
      .single();

    if (est) {
      const { data: newPage } = await supabaseAdmin.from("link_tree_pages").insert({
        establishment_id: establishmentId,
        title: est.name,
        logo_url: est.logo_url,
        theme: {
          primary: est.primary_color,
          accent: est.accent_color,
          background: "#0b0f19",
          text: "#ffffff",
          button_style: "glass",
          rounded: "xl"
        },
        published: true,
        published_at: new Date().toISOString()
      }).select("id").single();

      if (newPage) {
        const origin = process.env.VITE_APP_URL || "";
        await supabaseAdmin.from("link_tree_links").insert([
          {
            page_id: newPage.id,
            kind: "cartao",
            label: "Meu Cartão Fidelidade",
            url: `${origin}/cartao/${est.slug}`,
            enabled: true,
            sort_order: 0
          },
          {
            page_id: newPage.id,
            kind: "reviews",
            label: "Avaliar Estabelecimento",
            url: `${origin}/avaliar/${est.slug}`,
            enabled: true,
            sort_order: 1
          }
        ]);
      }
    }
  }
}
