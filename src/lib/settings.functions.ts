import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers ----------
async function assertRole(supabase: any, userId: string, estId: string, min: "staff" | "manager" | "owner") {
  const { data, error } = await supabase.rpc("has_establishment_role", { _user: userId, _est: estId, _min_role: min });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sem permissão");
}
async function audit(supabase: any, estId: string, userId: string, action: string, entity: string, entityId: string | null, details: any = {}) {
  await supabase.from("audit_logs").insert({
    establishment_id: estId, actor_id: userId, action, entity_type: entity, entity_id: entityId, details,
  });
}
async function hashPin(pin: string) {
  const { randomBytes, scryptSync } = await import("node:crypto");
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}$${derived}`;
}
async function verifyPin(pin: string, stored: string) {
  const [salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const { scryptSync, timingSafeEqual } = await import("node:crypto");
  const derived = scryptSync(pin, salt, 32);
  const a = Buffer.from(hash, "hex");
  return a.length === derived.length && timingSafeEqual(a, derived);
}

// ---------- Establishment: full read ----------
export const getEstablishmentFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "staff");
    const { data: est } = await supabase.from("establishments").select("*").eq("id", data.establishment_id).single();
    const { data: settings } = await supabase.from("establishment_settings").select("*").eq("establishment_id", data.establishment_id).maybeSingle();
    const { data: sub } = await supabase.from("subscriptions").select("*").eq("establishment_id", data.establishment_id).maybeSingle();
    let mySettings = settings;
    if (!mySettings) {
      const { data: created } = await supabase.from("establishment_settings").insert({ establishment_id: data.establishment_id }).select("*").single();
      mySettings = created;
    }
    return { establishment: est, settings: mySettings, subscription: sub };
  });

// ---------- Update profile (establishment fields) ----------
const profileSchema = z.object({
  establishment_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
  description: z.string().max(500).optional().nullable(),
  segment: z.string().max(60).optional().nullable(),
  cnpj: z.string().max(20).optional().nullable(),
  razao_social: z.string().max(200).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  website: z.string().max(200).optional().nullable(),
  instagram: z.string().max(60).optional().nullable(),
  facebook: z.string().max(60).optional().nullable(),
  tiktok: z.string().max(60).optional().nullable(),
  google_maps_url: z.string().max(400).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  cep: z.string().max(9).optional().nullable(),
  business_hours: z.string().max(1000).optional().nullable(),
  timezone: z.string().max(60).optional(),
  logo_url: z.string().max(1000).optional().nullable(),
  cover_url: z.string().max(1000).optional().nullable(),
  average_ticket: z.number().nonnegative().max(999999).optional().nullable(),
});

export const updateEstablishmentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "manager");
    // slug uniqueness
    const { data: dup } = await supabase.from("establishments").select("id").eq("slug", data.slug).neq("id", data.establishment_id).maybeSingle();
    if (dup) throw new Error("Este link (slug) já está em uso. Escolha outro.");
    const { establishment_id, email, ...rest } = data;
    const { error } = await supabase.from("establishments").update({ ...rest, email: email || null }).eq("id", establishment_id);
    if (error) throw new Error(error.message);
    await audit(supabase, establishment_id, userId, "establishment.updated", "establishment", establishment_id, { fields: Object.keys(rest) });
    return { ok: true };
  });

// ---------- Update establishment logo (quick action) ----------
export const updateEstablishmentLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    logo_url: z.string().min(1).max(2000).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "manager");
    const { error } = await supabase.from("establishments").update({ logo_url: data.logo_url }).eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    await audit(supabase, data.establishment_id, userId, "establishment.logo_updated", "establishment", data.establishment_id, {});
    return { ok: true };
  });

// ---------- Update settings section ----------
const sectionSchema = z.enum(["privacy", "notifications", "appearance", "card", "security", "billing_prefs"]);
export const updateSettingsSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    section: sectionSchema,
    patch: z.record(z.any()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "manager");
    const { data: current } = await supabase.from("establishment_settings").select("*").eq("establishment_id", data.establishment_id).maybeSingle();
    const currentSection = (current as any)?.[data.section] ?? {};
    const merged = { ...currentSection, ...data.patch };
    const payload: any = { [data.section]: merged };
    if (!current) {
      const { error } = await (supabase.from("establishment_settings") as any).insert({ establishment_id: data.establishment_id, ...payload });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (supabase.from("establishment_settings") as any).update(payload).eq("establishment_id", data.establishment_id);
      if (error) throw new Error(error.message);
    }

    await audit(supabase, data.establishment_id, userId, `settings.${data.section}.updated`, "establishment_settings", data.establishment_id, { keys: Object.keys(data.patch) });
    return { ok: true };
  });

// ---------- Team members ----------
export const listTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "staff");
    const { data: members } = await supabase.from("establishment_members")
      .select("id, user_id, role, active, invited_email, display_name, pin_hash, last_pin_used_at, created_at")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: true });
    // load profile names
    const ids = (members ?? []).map((m: any) => m.user_id).filter(Boolean);
    let profiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids);
      profiles = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    const { data: invites } = await supabase.from("team_invites")
      .select("id, email, role, expires_at, accepted_at, revoked_at, created_at")
      .eq("establishment_id", data.establishment_id)
      .is("accepted_at", null).is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    return {
      members: (members ?? []).map((m: any) => ({
        ...m, has_pin: !!m.pin_hash, pin_hash: undefined,
        profile: profiles[m.user_id] ?? null,
      })),
      invites: invites ?? [],
    };
  });

async function sendInviteEmail(opts: {
  supabase: any; supabaseAdmin: any;
  establishment_id: string; email: string; role: string; token: string; inviter_id: string;
}) {
  try {
    const { sendTemplateEmail } = await import("./email.server");
    const { data: est } = await opts.supabaseAdmin.from("establishments")
      .select("name").eq("id", opts.establishment_id).maybeSingle();
    const { data: prof } = await opts.supabaseAdmin.from("profiles")
      .select("full_name").eq("id", opts.inviter_id).maybeSingle();
    const { getPublicAppUrl } = await import("@/lib/app-url");
    const origin = getPublicAppUrl();
    const inviteUrl = `${origin}/invite/${opts.token}`;
    await sendTemplateEmail({
      to: opts.email,
      template: "team_invite",
      variables: {
        inviter_name: prof?.full_name ?? "Um administrador",
        establishment_name: est?.name ?? "sua empresa",
        role: opts.role === "manager" ? "Gerente" : "Atendente",
        invite_url: inviteUrl,
      },
      actor_id: opts.inviter_id,
      establishment_id: opts.establishment_id,
    });
  } catch {
    // sendOrEnqueue já enfileira; nunca deve quebrar o convite
  }
}

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    email: z.string().email().max(200),
    role: z.enum(["staff", "manager"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "manager");
    const { enforceLimit } = await import("@/lib/plans.functions");
    await enforceLimit(supabase, data.establishment_id, "employees", 1);
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(24).toString("hex");
    const { data: inv, error } = await supabase.from("team_invites").insert({
      establishment_id: data.establishment_id,
      email: data.email.toLowerCase(), role: data.role,
      token, invited_by: userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await audit(supabase, data.establishment_id, userId, "team.invited", "team_invite", inv.id, { email: data.email, role: data.role });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await sendInviteEmail({ supabase, supabaseAdmin, establishment_id: data.establishment_id, email: data.email.toLowerCase(), role: data.role, token, inviter_id: userId });
    return { invite: inv, token };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid(), invite_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "manager");
    const { error } = await supabase.from("team_invites").update({ revoked_at: new Date().toISOString() })
      .eq("id", data.invite_id).eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);
    await audit(supabase, data.establishment_id, userId, "team.invite_revoked", "team_invite", data.invite_id, {});
    return { ok: true };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid(), invite_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "manager");
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(24).toString("hex");
    const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    const { data: inv, error } = await supabase.from("team_invites")
      .update({ token, expires_at, revoked_at: null })
      .eq("id", data.invite_id).eq("establishment_id", data.establishment_id)
      .select("*").single();
    if (error) throw new Error(error.message);
    await audit(supabase, data.establishment_id, userId, "team.invite_resent", "team_invite", data.invite_id, {});
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await sendInviteEmail({ supabase, supabaseAdmin, establishment_id: data.establishment_id, email: inv.email, role: inv.role, token, inviter_id: userId });
    return { invite: inv, token };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin.from("team_invites").select("*").eq("token", data.token).maybeSingle();
    if (!inv) throw new Error("Convite inválido");
    if (inv.revoked_at) throw new Error("Convite revogado");
    if (inv.accepted_at) throw new Error("Convite já usado");
    if (new Date(inv.expires_at) < new Date()) throw new Error("Convite expirado");
    // insert member
    await supabaseAdmin.from("establishment_members").upsert({
      establishment_id: inv.establishment_id, user_id: userId, role: inv.role, active: true, invited_email: inv.email,
    }, { onConflict: "establishment_id,user_id" });
    await supabaseAdmin.from("team_invites").update({ accepted_at: new Date().toISOString(), accepted_by: userId }).eq("id", inv.id);
    await audit(supabase, inv.establishment_id, userId, "team.invite_accepted", "team_invite", inv.id, {});
    return { establishment_id: inv.establishment_id };
  });

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    member_id: z.string().uuid(),
    role: z.enum(["staff", "manager", "owner"]).optional(),
    active: z.boolean().optional(),
    display_name: z.string().max(60).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, data.role === "owner" ? "owner" : "manager");
    const { member_id, establishment_id, ...patch } = data;
    const { error } = await supabase.from("establishment_members").update(patch)
      .eq("id", member_id).eq("establishment_id", establishment_id);
    if (error) throw new Error(error.message);
    await audit(supabase, establishment_id, userId, "team.member_updated", "establishment_member", member_id, patch);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid(), member_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "owner");
    const { error } = await supabase.from("establishment_members").delete()
      .eq("id", data.member_id).eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);
    await audit(supabase, data.establishment_id, userId, "team.member_removed", "establishment_member", data.member_id, {});
    return { ok: true };
  });

// ---------- PIN ----------
export const setMyPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    pin: z.string().regex(/^\d{4,6}$/, "PIN deve ter 4 a 6 dígitos"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const hash = await hashPin(data.pin);
    const { error } = await supabase.from("establishment_members").update({ pin_hash: hash })
      .eq("establishment_id", data.establishment_id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    await audit(supabase, data.establishment_id, userId, "security.pin_set", "establishment_member", null, {});
    return { ok: true };
  });

export const removeMyPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("establishment_members").update({ pin_hash: null })
      .eq("establishment_id", data.establishment_id).eq("user_id", userId);
    await audit(supabase, data.establishment_id, userId, "security.pin_removed", "establishment_member", null, {});
    return { ok: true };
  });

export const verifyMyPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid(), pin: z.string().min(4).max(6) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: m } = await supabase.from("establishment_members").select("pin_hash").eq("establishment_id", data.establishment_id).eq("user_id", userId).maybeSingle();
    if (!m?.pin_hash) return { ok: true, required: false };
    const ok = await verifyPin(data.pin, m.pin_hash);
    if (ok) await supabase.from("establishment_members").update({ last_pin_used_at: new Date().toISOString() }).eq("establishment_id", data.establishment_id).eq("user_id", userId);
    return { ok, required: true };
  });

// ---------- Change password ----------
export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ new_password: z.string().min(6).max(15) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: data.new_password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Notification templates ----------
const EVENTS = ["new_stamp", "reward_ready", "birthday", "inactive_customer"] as const;
export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "staff");
    const { data: tpls } = await supabase.from("notification_templates").select("*").eq("establishment_id", data.establishment_id);
    // ensure defaults exist in memory (returned even if not persisted)
    const map = new Map<string, any>();
    (tpls ?? []).forEach((t: any) => map.set(`${t.event}:${t.channel}`, t));
    const defaults = EVENTS.map(ev => map.get(`${ev}:email`) ?? {
      id: null, establishment_id: data.establishment_id, event: ev, channel: "email",
      subject: defaultSubject(ev), body: defaultBody(ev), active: true,
    });
    return { templates: defaults };
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    event: z.enum(EVENTS),
    channel: z.enum(["email", "whatsapp"]).default("email"),
    subject: z.string().max(200).optional().nullable(),
    body: z.string().max(4000),
    active: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "manager");
    const { error } = await supabase.from("notification_templates").upsert({
      establishment_id: data.establishment_id, event: data.event, channel: data.channel,
      subject: data.subject ?? null, body: data.body, active: data.active,
    }, { onConflict: "establishment_id,event,channel" });
    if (error) throw new Error(error.message);
    await audit(supabase, data.establishment_id, userId, "notifications.template_saved", "notification_template", null, { event: data.event, channel: data.channel });
    return { ok: true };
  });

function defaultSubject(ev: string) {
  return {
    new_stamp: "Você ganhou um carimbo! 🎉",
    reward_ready: "Sua recompensa está pronta! 🎁",
    birthday: "Feliz aniversário! 🎂",
    inactive_customer: "Sentimos sua falta!",
  }[ev] ?? "";
}
function defaultBody(ev: string) {
  return {
    new_stamp: "Olá {{nome}}, você acabou de ganhar mais um carimbo em {{empresa}}. Faltam {{restantes}} para sua próxima recompensa!",
    reward_ready: "Olá {{nome}}, sua recompensa em {{empresa}} está disponível. Aproveite!",
    birthday: "Feliz aniversário, {{nome}}! Passe em {{empresa}} para uma surpresa especial.",
    inactive_customer: "Olá {{nome}}, faz um tempo que não te vemos em {{empresa}}. Volte e ganhe um carimbo bônus!",
  }[ev] ?? "";
}

// ---------- LGPD data requests ----------
export const listDataRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "manager");
    const { data: rows } = await supabase.from("data_requests").select("*").eq("establishment_id", data.establishment_id).order("created_at", { ascending: false }).limit(100);
    return { requests: rows ?? [] };
  });

export const createDataRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    customer_phone: z.string().trim().min(10).max(11),
    kind: z.enum(["export", "delete"]),
    reason: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "manager");
    const { data: cust } = await supabase.from("customers").select("id, name")
      .eq("establishment_id", data.establishment_id).eq("phone", data.customer_phone).maybeSingle();
    if (!cust) throw new Error("Cliente não encontrado com esse telefone.");
    const { data: req, error } = await supabase.from("data_requests").insert({
      establishment_id: data.establishment_id, customer_id: cust.id, customer_phone: data.customer_phone,
      kind: data.kind, requested_by: userId, reason: data.reason ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await audit(supabase, data.establishment_id, userId, `lgpd.${data.kind}_requested`, "customer", cust.id, {});
    return { request: req };
  });

export const processDataRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid(), request_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "owner");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await supabaseAdmin.from("data_requests").select("*").eq("id", data.request_id).single();
    if (!req || req.establishment_id !== data.establishment_id) throw new Error("Solicitação inválida");
    if (req.status !== "pending") throw new Error("Solicitação já processada");
    if (!req.customer_id) throw new Error("Cliente não vinculado");

    if (req.kind === "export") {
      const { data: cust } = await supabaseAdmin.from("customers").select("*").eq("id", req.customer_id).single();
      const { data: cards } = await supabaseAdmin.from("loyalty_cards").select("*").eq("customer_id", req.customer_id);
      const { data: stamps } = await supabaseAdmin.from("stamps").select("*").in("card_id", (cards ?? []).map((c: any) => c.id).concat(["00000000-0000-0000-0000-000000000000"]));
      const { data: rewards } = await supabaseAdmin.from("rewards").select("*").in("card_id", (cards ?? []).map((c: any) => c.id).concat(["00000000-0000-0000-0000-000000000000"]));
      const payload = { customer: cust, cards, stamps, rewards, exported_at: new Date().toISOString() };
      await supabaseAdmin.from("data_requests").update({
        status: "done", processed_at: new Date().toISOString(),
        result_url: `data:application/json;base64,${Buffer.from(JSON.stringify(payload, null, 2)).toString("base64")}`,
      }).eq("id", data.request_id);
      await audit(supabase, data.establishment_id, userId, "lgpd.exported", "customer", req.customer_id, {});
      return { ok: true, payload };
    } else {
      // Anonymize customer + delete cards/consents
      const anonPhone = `deleted_${createHash("sha256").update(req.customer_id).digest("hex").slice(0, 10)}`;
      await (supabaseAdmin.from("customers") as any).update({
        name: "Cliente removido", phone: anonPhone, email: null,
        marketing_opt_in: false, notes: null,
      }).eq("id", req.customer_id);

      await supabaseAdmin.from("consents").delete().eq("customer_id", req.customer_id);
      await supabaseAdmin.from("data_requests").update({
        status: "done", processed_at: new Date().toISOString(),
      }).eq("id", data.request_id);
      await audit(supabase, data.establishment_id, userId, "lgpd.deleted", "customer", req.customer_id, {});
      return { ok: true };
    }
  });

// ---------- Audit logs ----------
export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid(), limit: z.number().min(1).max(200).default(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "manager");
    const { data: rows } = await supabase.from("audit_logs").select("*")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false }).limit(data.limit);
    return { logs: rows ?? [] };
  });

// ---------- Danger zone ----------
export const archiveEstablishment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "owner");
    await supabase.from("establishments").update({ active: false, archived_at: new Date().toISOString() }).eq("id", data.establishment_id);
    await audit(supabase, data.establishment_id, userId, "establishment.archived", "establishment", data.establishment_id, {});
    return { ok: true };
  });

export const restoreEstablishment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "owner");
    await supabase.from("establishments").update({ active: true, archived_at: null }).eq("id", data.establishment_id);
    await audit(supabase, data.establishment_id, userId, "establishment.restored", "establishment", data.establishment_id, {});
    return { ok: true };
  });

export const deleteEstablishment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    confirm_slug: z.string().min(3),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "owner");
    const { data: est } = await supabase.from("establishments").select("slug").eq("id", data.establishment_id).single();
    if (!est || est.slug !== data.confirm_slug) throw new Error("Confirmação do link não confere.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await audit(supabase, data.establishment_id, userId, "establishment.deleted", "establishment", data.establishment_id, { slug: est.slug });
    await supabaseAdmin.from("establishments").delete().eq("id", data.establishment_id);
    return { ok: true };
  });

// ---------- Export data (owner-only, full establishment) ----------
export const exportEstablishmentData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, data.establishment_id, "owner");
    const { data: est } = await supabase.from("establishments").select("*").eq("id", data.establishment_id).single();
    const { data: customers } = await supabase.from("customers").select("*").eq("establishment_id", data.establishment_id);
    const { data: campaigns } = await supabase.from("campaigns").select("*").eq("establishment_id", data.establishment_id);
    const { data: cards } = await supabase.from("loyalty_cards").select("*").eq("establishment_id", data.establishment_id);
    const { data: stamps } = await supabase.from("stamps").select("*").eq("establishment_id", data.establishment_id);
    const { data: rewards } = await supabase.from("rewards").select("*").eq("establishment_id", data.establishment_id);
    await audit(supabase, data.establishment_id, userId, "establishment.exported", "establishment", data.establishment_id, {});
    return { establishment: est, customers, campaigns, cards, stamps, rewards, exported_at: new Date().toISOString() };
  });
