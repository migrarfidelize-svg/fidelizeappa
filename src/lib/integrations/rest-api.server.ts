/**
 * API REST privada para integrações externas (Fidelize Integrations API).
 * Server-only: autenticação por API Key, rate limit, auditoria e handlers.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const API_BASE_PATH = "/api/public/integrations";

export type ApiKeyRow = {
  id: string;
  establishment_id: string;
  name: string;
  prefix: string;
  key_hash: string;
  scopes: string[];
  allowed_origins: string[];
  rate_limit_per_minute: number;
  revoked_at: string | null;
};

export type AuthResult =
  | { ok: true; key: ApiKeyRow }
  | { ok: false; status: number; code: string; message: string; keyId?: string | null; establishmentId?: string | null; prefix?: string | null };

// ---------------------------------------------------------------- utils

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const prefix = randomBytes(6).toString("hex"); // 12 chars
  const secret = randomBytes(24).toString("base64url");
  const raw = `fdz_${prefix}_${secret}`;
  return { raw, prefix, hash: sha256(raw) };
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-api-key, authorization",
      "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
      ...extraHeaders,
    },
  });
}

export function errorResponse(status: number, code: string, message: string) {
  return jsonResponse({ error: { code, message } }, status);
}

function clientIp(request: Request): string | null {
  const h = request.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("cf-connecting-ip") || h.get("x-real-ip") || null;
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, "");
}

// ---------------------------------------------------------------- auth

function readRawKey(request: Request): string | null {
  const header = request.headers.get("x-api-key");
  if (header && header.trim()) return header.trim();
  const auth = request.headers.get("authorization");
  if (auth && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, "").trim();
  return null;
}

export async function authenticateApiRequest(request: Request): Promise<AuthResult> {
  const raw = readRawKey(request);
  if (!raw) {
    return { ok: false, status: 401, code: "missing_api_key", message: "Informe a API Key no cabeçalho x-api-key." };
  }
  const parts = raw.split("_");
  if (parts.length < 3 || parts[0] !== "fdz") {
    return { ok: false, status: 401, code: "invalid_api_key", message: "Formato de API Key inválido." };
  }
  const prefix = parts[1]!;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, establishment_id, name, prefix, key_hash, scopes, allowed_origins, rate_limit_per_minute, revoked_at")
    .eq("prefix", prefix)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, code: "auth_lookup_failed", message: "Falha ao validar a API Key.", prefix };
  }
  if (!row || !safeEqualHex(row.key_hash, sha256(raw))) {
    return { ok: false, status: 401, code: "invalid_api_key", message: "API Key inválida.", prefix };
  }
  const key = row as ApiKeyRow;
  if (key.revoked_at) {
    return { ok: false, status: 401, code: "revoked_api_key", message: "API Key revogada.", keyId: key.id, establishmentId: key.establishment_id, prefix };
  }

  // Validação de origem (quando configurada na chave)
  const allowed = key.allowed_origins ?? [];
  if (allowed.length > 0) {
    const origin = request.headers.get("origin") || request.headers.get("referer");
    const host = origin ? (() => { try { return new URL(origin).origin; } catch { return origin; } })() : null;
    const ip = clientIp(request);
    const matches = host ? allowed.includes(host) : false;
    const ipMatches = ip ? allowed.includes(ip) : false;
    if (!matches && !ipMatches) {
      return { ok: false, status: 403, code: "origin_not_allowed", message: "Origem não autorizada para esta API Key.", keyId: key.id, establishmentId: key.establishment_id, prefix };
    }
  }

  // Rate limit por minuto
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("api_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", key.id)
    .gte("created_at", since);

  if ((count ?? 0) >= key.rate_limit_per_minute) {
    return { ok: false, status: 429, code: "rate_limit_exceeded", message: `Limite de ${key.rate_limit_per_minute} requisições por minuto atingido.`, keyId: key.id, establishmentId: key.establishment_id, prefix };
  }

  await supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  return { ok: true, key };
}

export async function logApiRequest(input: {
  request: Request;
  path: string;
  status: number;
  establishmentId?: string | null;
  apiKeyId?: string | null;
  prefix?: string | null;
  errorCode?: string | null;
  durationMs: number;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("api_request_logs").insert({
      establishment_id: input.establishmentId ?? null,
      api_key_id: input.apiKeyId ?? null,
      key_prefix: input.prefix ?? null,
      method: input.request.method,
      path: input.path,
      status_code: input.status,
      ip: clientIp(input.request),
      origin: input.request.headers.get("origin"),
      user_agent: input.request.headers.get("user-agent"),
      duration_ms: Math.round(input.durationMs),
      error_code: input.errorCode ?? null,
    });
  } catch {
    /* auditoria nunca bloqueia a resposta */
  }
}

// ---------------------------------------------------------------- DTOs

type CustomerRow = {
  id: string; code: string; name: string; phone: string; email: string | null;
  tier: string; visits_count: number; last_visit_at: string | null;
  marketing_opt_in: boolean; birthdate: string | null; notes: string | null;
  blocked: boolean; created_at: string; updated_at: string; establishment_id: string;
};

const CUSTOMER_COLUMNS =
  "id, code, name, phone, email, tier, visits_count, last_visit_at, marketing_opt_in, birthdate, notes, blocked, created_at, updated_at, establishment_id";

function toCustomerDTO(c: CustomerRow) {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    phone: c.phone,
    email: c.email,
    tier: c.tier,
    visits: c.visits_count,
    last_visit_at: c.last_visit_at,
    marketing_opt_in: c.marketing_opt_in,
    birthdate: c.birthdate,
    notes: c.notes,
    blocked: c.blocked,
    created_at: c.created_at,
    updated_at: c.updated_at,
    establishment_id: c.establishment_id,
  };
}

// ---------------------------------------------------------------- handlers

type Ctx = { key: ApiKeyRow };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function findCustomerById(estId: string, id: string) {
  const db = await admin();
  const { data } = await db.from("customers").select(CUSTOMER_COLUMNS).eq("id", id).eq("establishment_id", estId).maybeSingle();
  return (data as CustomerRow | null) ?? null;
}

async function findCustomerByPhone(estId: string, phone: string) {
  const db = await admin();
  const digits = normalizePhone(phone);
  const { data } = await db
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("establishment_id", estId)
    .or(`phone.eq.${digits},phone.eq.${phone}`)
    .limit(1)
    .maybeSingle();
  return (data as CustomerRow | null) ?? null;
}

/** Cartão de fidelidade da campanha ativa (cria se necessário). */
async function ensureActiveCard(estId: string, customerId: string, campaignId?: string) {
  const db = await admin();
  type Campaign = { id: string; stamps_required: number; reward_validity_days: number | null };
  type Card = { id: string; stamps: number; cycle: number };

  const q = db.from("campaigns").select("id, stamps_required, reward_validity_days").eq("establishment_id", estId).eq("active", true);
  const { data: camps } = campaignId ? await q.eq("id", campaignId).limit(1) : await q.order("created_at", { ascending: true }).limit(1);
  const campaign = ((camps ?? [])[0] ?? null) as Campaign | null;
  if (!campaign) return null;

  const { data: existing } = await db
    .from("loyalty_cards")
    .select("id, stamps, cycle, campaign_id, customer_id, establishment_id")
    .eq("customer_id", customerId)
    .eq("campaign_id", campaign.id)
    .maybeSingle();

  if (existing) return { card: existing, campaign };

  const { data: created, error } = await db
    .from("loyalty_cards")
    .insert({ customer_id: customerId, campaign_id: campaign.id, establishment_id: estId, stamps: 0, cycle: 1 })
    .select("id, stamps, cycle, campaign_id, customer_id, establishment_id")
    .single();
  if (error || !created) return null;
  return { card: created, campaign };
}

async function addPoints(estId: string, customer: CustomerRow, quantity: number, campaignId?: string) {
  const db = await admin();
  const ctx = await ensureActiveCard(estId, customer.id, campaignId);
  if (!ctx) return { error: "no_active_campaign" as const };

  let { stamps, cycle } = ctx.card as { stamps: number; cycle: number };
  const required = ctx.campaign.stamps_required;
  let rewardsCreated = 0;

  for (let i = 0; i < quantity; i++) {
    const { error } = await db.from("stamps").insert({
      card_id: ctx.card.id,
      establishment_id: estId,
      cycle,
    });
    if (error) return { error: "stamp_insert_failed" as const };
    stamps += 1;
    if (stamps >= required) {
      const expires = ctx.campaign.reward_validity_days
        ? new Date(Date.now() + ctx.campaign.reward_validity_days * 86400_000).toISOString()
        : null;
      await db.from("rewards").insert({
        card_id: ctx.card.id,
        campaign_id: ctx.campaign.id,
        establishment_id: estId,
        cycle,
        expires_at: expires,
      });
      rewardsCreated += 1;
      stamps = 0;
      cycle += 1;
    }
  }

  await db.from("loyalty_cards").update({ stamps, cycle }).eq("id", ctx.card.id);
  await db
    .from("customers")
    .update({ last_visit_at: new Date().toISOString(), visits_count: (customer.visits_count ?? 0) + quantity })
    .eq("id", customer.id);

  try {
    const { syncCustomerWalletSafe } = await import("@/lib/wallet-sync.server");
    await syncCustomerWalletSafe(customer.id);
  } catch { /* noop */ }

  return { card_id: ctx.card.id, points: stamps, required, cycle, rewards_created: rewardsCreated };
}

async function removePoints(estId: string, customer: CustomerRow, quantity: number, campaignId?: string) {
  const db = await admin();
  const ctx = await ensureActiveCard(estId, customer.id, campaignId);
  if (!ctx) return { error: "no_active_campaign" as const };

  const { data: list } = await db
    .from("stamps")
    .select("id")
    .eq("card_id", ctx.card.id)
    .is("reverted_at", null)
    .order("created_at", { ascending: false })
    .limit(quantity);

  const ids = (list ?? []).map((s: { id: string }) => s.id);
  if (ids.length === 0) return { error: "no_points" as const };

  await db.from("stamps").update({ reverted_at: new Date().toISOString() }).in("id", ids);

  const current = (ctx.card as { stamps: number }).stamps;
  const next = Math.max(0, current - ids.length);
  await db.from("loyalty_cards").update({ stamps: next }).eq("id", ctx.card.id);
  await db
    .from("customers")
    .update({ visits_count: Math.max(0, (customer.visits_count ?? 0) - ids.length) })
    .eq("id", customer.id);

  try {
    const { syncCustomerWalletSafe } = await import("@/lib/wallet-sync.server");
    await syncCustomerWalletSafe(customer.id);
  } catch { /* noop */ }

  return { card_id: ctx.card.id, removed: ids.length, points: next, required: ctx.campaign.stamps_required };
}

async function customerStats(estId: string, customer: CustomerRow) {
  const db = await admin();

  const { data: cards } = await db
    .from("loyalty_cards")
    .select("id, stamps, cycle, campaign_id")
    .eq("customer_id", customer.id)
    .eq("establishment_id", estId);

  const cardIds = (cards ?? []).map((c: { id: string }) => c.id);

  let purchases = 0;
  let lastPurchase: string | null = null;
  if (cardIds.length > 0) {
    const { count } = await db
      .from("stamps")
      .select("id", { count: "exact", head: true })
      .in("card_id", cardIds)
      .is("reverted_at", null);
    purchases = count ?? 0;

    const { data: last } = await db
      .from("stamps")
      .select("created_at")
      .in("card_id", cardIds)
      .is("reverted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastPurchase = (last as { created_at: string } | null)?.created_at ?? null;
  }

  const points = (cards ?? []).reduce((acc: number, c: { stamps: number }) => acc + (c.stamps ?? 0), 0);

  const { count: rewardsCount } = await db
    .from("rewards")
    .select("id", { count: "exact", head: true })
    .eq("establishment_id", estId)
    .in("card_id", cardIds.length > 0 ? cardIds : ["00000000-0000-0000-0000-000000000000"]);

  return {
    customer_id: customer.id,
    total_purchases: purchases,
    points,
    visits: customer.visits_count ?? 0,
    cashback: 0,
    rewards: rewardsCount ?? 0,
    tier: customer.tier,
    last_purchase_at: lastPurchase ?? customer.last_visit_at,
  };
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function str(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Roteia uma requisição já autenticada. `segments` = caminho após /api/public/integrations. */
export async function handleApiRoute(request: Request, segments: string[], ctx: Ctx): Promise<Response> {
  const estId = ctx.key.establishment_id;
  const method = request.method.toUpperCase();
  const [a, b, c] = segments;

  // GET /customer/:id  |  PUT /customer/:id  |  GET /customer/:id/stats
  if (a === "customer" && b && UUID_RE.test(b)) {
    const customer = await findCustomerById(estId, b);
    if (!customer) return errorResponse(404, "customer_not_found", "Cliente não encontrado.");

    if (c === "stats" && method === "GET") {
      return jsonResponse(await customerStats(estId, customer));
    }
    if (!c && method === "GET") {
      return jsonResponse({ customer: toCustomerDTO(customer) });
    }
    if (!c && method === "PUT") {
      const body = await readJson(request);
      if (!body) return errorResponse(400, "invalid_body", "Corpo JSON inválido.");
      const patch: Record<string, unknown> = {};
      if ("name" in body) {
        const name = str(body.name, 80);
        if (!name || name.length < 2) return errorResponse(422, "invalid_name", "Nome inválido.");
        patch.name = name;
      }
      if ("email" in body) patch.email = str(body.email, 120);
      if ("phone" in body) {
        const phone = normalizePhone(String(body.phone ?? ""));
        if (phone.length < 10 || phone.length > 13) return errorResponse(422, "invalid_phone", "Telefone inválido.");
        patch.phone = phone;
      }
      if ("notes" in body) patch.notes = str(body.notes, 500);
      if ("birthdate" in body) patch.birthdate = str(body.birthdate, 10);
      if ("marketing_opt_in" in body) patch.marketing_opt_in = Boolean(body.marketing_opt_in);
      if ("blocked" in body) patch.blocked = Boolean(body.blocked);
      if (Object.keys(patch).length === 0) return errorResponse(422, "empty_update", "Nenhum campo para atualizar.");

      const db = await admin();
      const { data, error } = await db
        .from("customers")
        .update(patch)
        .eq("id", customer.id)
        .eq("establishment_id", estId)
        .select(CUSTOMER_COLUMNS)
        .maybeSingle();
      if (error) return errorResponse(400, "update_failed", error.message);
      return jsonResponse({ customer: toCustomerDTO(data as CustomerRow) });
    }
    return errorResponse(405, "method_not_allowed", "Método não permitido para este recurso.");
  }

  // POST /customer
  if (a === "customer" && !b && method === "POST") {
    const body = await readJson(request);
    if (!body) return errorResponse(400, "invalid_body", "Corpo JSON inválido.");
    const name = str(body.name, 80);
    const phone = normalizePhone(String(body.phone ?? ""));
    if (!name || name.length < 2) return errorResponse(422, "invalid_name", "Informe um nome válido.");
    if (phone.length < 10 || phone.length > 13) return errorResponse(422, "invalid_phone", "Informe um telefone válido.");

    const existing = await findCustomerByPhone(estId, phone);
    if (existing) return jsonResponse({ customer: toCustomerDTO(existing), created: false }, 200);

    const db = await admin();
    const { data, error } = await db
      .from("customers")
      .insert({
        establishment_id: estId,
        name,
        phone,
        email: str(body.email, 120),
        notes: str(body.notes, 500),
        birthdate: str(body.birthdate, 10),
        marketing_opt_in: Boolean(body.marketing_opt_in ?? false),
      })
      .select(CUSTOMER_COLUMNS)
      .single();
    if (error) return errorResponse(400, "create_failed", error.message);
    return jsonResponse({ customer: toCustomerDTO(data as CustomerRow), created: true }, 201);
  }

  // GET /customer-by-phone/:phone
  if (a === "customer-by-phone" && b && method === "GET") {
    const customer = await findCustomerByPhone(estId, decodeURIComponent(b));
    if (!customer) return errorResponse(404, "customer_not_found", "Cliente não encontrado.");
    return jsonResponse({ customer: toCustomerDTO(customer) });
  }

  // POST /points/add | POST /points/remove
  if (a === "points" && (b === "add" || b === "remove") && method === "POST") {
    const body = await readJson(request);
    if (!body) return errorResponse(400, "invalid_body", "Corpo JSON inválido.");

    const customerId = str(body.customer_id, 40);
    const phone = body.phone ? normalizePhone(String(body.phone)) : null;
    const customer = customerId && UUID_RE.test(customerId)
      ? await findCustomerById(estId, customerId)
      : phone
        ? await findCustomerByPhone(estId, phone)
        : null;
    if (!customer) return errorResponse(404, "customer_not_found", "Cliente não encontrado. Informe customer_id ou phone.");

    const qtyRaw = Number(body.quantity ?? body.points ?? 1);
    if (!Number.isFinite(qtyRaw) || qtyRaw < 1 || qtyRaw > 50) {
      return errorResponse(422, "invalid_quantity", "quantity deve ser um número entre 1 e 50.");
    }
    const quantity = Math.floor(qtyRaw);
    const campaignId = str(body.campaign_id, 40) ?? undefined;
    if (campaignId && !UUID_RE.test(campaignId)) return errorResponse(422, "invalid_campaign", "campaign_id inválido.");

    const result = b === "add"
      ? await addPoints(estId, customer, quantity, campaignId)
      : await removePoints(estId, customer, quantity, campaignId);

    if ("error" in result) {
      if (result.error === "no_active_campaign") return errorResponse(409, "no_active_campaign", "Nenhuma campanha de fidelidade ativa para este estabelecimento.");
      if (result.error === "no_points") return errorResponse(409, "no_points", "O cliente não possui pontos para remover.");
      return errorResponse(500, "points_operation_failed", "Não foi possível concluir a operação de pontos.");
    }
    return jsonResponse({ ok: true, ...result });
  }

  return errorResponse(404, "unknown_endpoint", "Endpoint não encontrado.");
}
