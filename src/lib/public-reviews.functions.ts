import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFeature } from "@/lib/plans.functions";
import type { ReviewThemeConfig } from "@/lib/review-themes";


const DEFAULT_LABELS: Record<number, string> = {
  1: "Muito ruim", 2: "Ruim", 3: "Regular", 4: "Bom", 5: "Excelente",
};
const DEFAULT_ACTIONS: Record<number, "apologize" | "ask_details" | "thank" | "invite_google"> = {
  1: "apologize", 2: "ask_details", 3: "thank", 4: "invite_google", 5: "invite_google",
};

// Ensure a form (and its 5 rating options) exists for an establishment.
async function ensureForm(
  sb: any,
  establishmentId: string,
): Promise<string> {
  const { data: existing } = await sb.from("review_forms").select("id").eq("establishment_id", establishmentId).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await sb.from("review_forms").insert({ establishment_id: establishmentId }).select("id").single();
  if (error || !created) throw new Error(error?.message ?? "Falha ao criar formulário");
  const rows = [1, 2, 3, 4, 5].map((n) => ({
    review_form_id: created.id,
    rating: n,
    label: DEFAULT_LABELS[n],
    comment_required: n <= 2,
    post_submit_action: DEFAULT_ACTIONS[n],
    display_order: n,
  }));
  await sb.from("review_rating_options").insert(rows);
  return created.id;
}

// ============ PUBLIC: fetch form by establishment slug ============
export const getPublicReviewForm = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: est } = await supabaseAdmin
      .from("establishments")
      .select("id, name, slug, logo_url, primary_color, accent_color, description, active")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!est || !est.active) return null;

    const { data: settings } = await supabaseAdmin
      .from("review_settings")
      .select("theme")
      .eq("establishment_id", est.id)
      .maybeSingle();
    const theme = (settings?.theme ?? null) as ReviewThemeConfig | null;

    const { data: form } = await supabaseAdmin
      .from("review_forms")
      .select("*")
      .eq("establishment_id", est.id)
      .eq("active", true)
      .maybeSingle();
    if (!form) return { est, form: null, options: [], questions: [], stats: null, theme };

    const [{ data: options }, { data: questions }] = await Promise.all([
      supabaseAdmin.from("review_rating_options").select("*").eq("review_form_id", form.id).eq("enabled", true).order("display_order"),
      supabaseAdmin.from("review_questions").select("*").eq("review_form_id", form.id).eq("active", true).order("display_order"),
    ]);

    let stats: { count: number; avg: number } | null = null;
    if (form.show_average || form.show_review_count) {
      const { data: rows } = await supabaseAdmin
        .from("customer_reviews")
        .select("rating")
        .eq("establishment_id", est.id);
      const list = rows ?? [];
      stats = {
        count: list.length,
        avg: list.length ? list.reduce((a: number, r: any) => a + r.rating, 0) / list.length : 0,
      };
    }
    return { est, form, options: options ?? [], questions: questions ?? [], stats, theme };
  });

// ============ PUBLIC: submit ============
const answerSchema = z.object({
  question_id: z.string().uuid(),
  answer_text: z.string().max(2000).optional().nullable(),
  answer_number: z.number().optional().nullable(),
  answer_boolean: z.boolean().optional().nullable(),
});

const submitSchema = z.object({
  slug: z.string().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  customer_name: z.string().trim().max(120).optional(),
  customer_phone: z.string().trim().max(40).optional(),
  customer_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  order_reference: z.string().trim().max(80).optional(),
  anonymous: z.boolean().optional(),
  source: z.enum(["linktree", "direct_url", "qr", "embed"]).optional(),
  device_id: z.string().trim().min(6).max(80),
  answers: z.array(answerSchema).max(30).optional(),
});

function sanitizeText(v: string | undefined | null): string | null {
  if (!v) return null;
  // strip HTML tags & control chars, keep basic text
  const t = String(v).replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return t.length ? t.slice(0, 2000) : null;
}

export const submitPublicReview = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof submitSchema>) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: est } = await supabaseAdmin.from("establishments").select("id").eq("slug", data.slug).maybeSingle();
    if (!est) throw new Error("Estabelecimento não encontrado.");
    const { data: form } = await supabaseAdmin
      .from("review_forms")
      .select("*")
      .eq("establishment_id", est.id)
      .eq("active", true)
      .maybeSingle();
    if (!form) throw new Error("Avaliações desativadas.");

    // rating enabled?
    const { data: opt } = await supabaseAdmin
      .from("review_rating_options")
      .select("enabled, comment_required, post_submit_action, selection_message")
      .eq("review_form_id", form.id)
      .eq("rating", data.rating)
      .maybeSingle();
    if (!opt || !opt.enabled) throw new Error("Esta nota não está disponível.");

    // required fields
    const commentRequired = form.comment_required || opt.comment_required;
    const cleanComment = sanitizeText(data.comment);
    if (commentRequired && !cleanComment) throw new Error("Comentário é obrigatório para essa avaliação.");
    const isAnon = !!(data.anonymous && form.anonymous_allowed);
    if (!isAnon) {
      if (form.name_required && !data.customer_name?.trim()) throw new Error("Informe seu nome.");
      if (form.phone_required && !data.customer_phone?.trim()) throw new Error("Informe seu telefone.");
      if (form.email_required && !data.customer_email?.trim()) throw new Error("Informe seu e-mail.");
    }

    // cooldown via device hash (per form)
    const { createHash } = await import("node:crypto");
    const deviceHash = createHash("sha256").update(`${form.id}:${data.device_id}`).digest("hex");
    if (!form.allow_multiple && form.cooldown_hours > 0) {
      const since = new Date(Date.now() - form.cooldown_hours * 3600_000).toISOString();
      const { data: prev } = await supabaseAdmin
        .from("customer_reviews")
        .select("id")
        .eq("review_form_id", form.id)
        .eq("device_hash", deviceHash)
        .gte("submitted_at", since)
        .limit(1)
        .maybeSingle();
      if (prev) throw new Error(`Você já enviou uma avaliação recentemente. Tente novamente em ${form.cooldown_hours}h.`);
    }

    // insert (service role bypasses RLS: no INSERT policy on customer_reviews)
    // const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); // Already imported above
    const { data: inserted, error } = await supabaseAdmin
      .from("customer_reviews")
      .insert({
        establishment_id: est.id,
        review_form_id: form.id,
        rating: data.rating,
        comment: cleanComment,
        customer_name: isAnon ? null : sanitizeText(data.customer_name),
        customer_phone: isAnon ? null : sanitizeText(data.customer_phone),
        customer_email: isAnon ? null : (data.customer_email || null),
        order_reference: sanitizeText(data.order_reference),
        source: data.source ?? "linktree",
        anonymous: isAnon,
        device_hash: deviceHash,
        status: data.rating <= 2 ? "analyzing" : "new",
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Erro ao enviar");

    // answers
    if (data.answers?.length) {
      const rows = data.answers.map((a) => ({
        review_id: inserted.id,
        question_id: a.question_id,
        answer_text: sanitizeText(a.answer_text ?? undefined),
        answer_number: a.answer_number ?? null,
        answer_boolean: a.answer_boolean ?? null,
      }));
      await supabaseAdmin.from("review_answers").insert(rows);
    }

    await supabaseAdmin.from("review_events").insert({
      review_form_id: form.id,
      review_id: inserted.id,
      event_type: "submitted",
      meta: { rating: data.rating, source: data.source ?? "linktree" },
    });

    // Avisa a equipe do estabelecimento no aparelho (push + inbox).
    try {
      const { notifyNewReview } = await import("@/lib/merchant-notify.server");
      await notifyNewReview(est.id, {
        rating: data.rating,
        comment: cleanComment,
        customer_name: isAnon ? null : sanitizeText(data.customer_name),
      });
    } catch { /* nunca bloqueia o envio da avaliação */ }

    // Low-rating alert (≤ 2 stars) — surfaces at top of inbox and enables merchant notifications
    if (data.rating <= 2) {
      await supabaseAdmin.from("review_events").insert({
        review_form_id: form.id,
        review_id: inserted.id,
        event_type: "low_rating_alert",
        meta: { rating: data.rating, has_contact: !isAnon && !!(data.customer_phone || data.customer_email) },
      });
    }

    const shouldOfferGoogle =
      form.redirect_to_google_enabled &&
      !!form.google_review_url &&
      (opt.post_submit_action === "invite_google");

    return {
      id: inserted.id,
      action: opt.post_submit_action,
      selection_message: opt.selection_message,
      google_url: shouldOfferGoogle ? form.google_review_url : null,
      success_message: form.success_message,
    };
  });

// ============ PUBLIC: telemetry (open, google_shown, google_clicked) ============
export const logPublicReviewEvent = createServerFn({ method: "POST" })
  .inputValidator((d: { form_id: string; event_type: string; review_id?: string }) =>
    z.object({
      form_id: z.string().uuid(),
      event_type: z.enum(["page_opened", "rating_selected", "google_shown", "google_clicked", "wallet_cta_clicked"]),
      review_id: z.string().uuid().optional(),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("review_events").insert({
      review_form_id: data.form_id,
      review_id: data.review_id ?? null,
      event_type: data.event_type,
    });
    return { ok: true };
  });

// ============ MERCHANT ============
export const getMerchantReviewForm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string }) => z.object({ establishmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const formId = await ensureForm(
      context.supabase,
      data.establishmentId,
    );
    const [{ data: form }, { data: options }, { data: questions }] = await Promise.all([
      context.supabase.from("review_forms").select("*").eq("id", formId).single(),
      context.supabase.from("review_rating_options").select("*").eq("review_form_id", formId).order("display_order"),
      context.supabase.from("review_questions").select("*").eq("review_form_id", formId).order("display_order"),
    ]);
    return { form: form!, options: options ?? [], questions: questions ?? [] };
  });

const formSaveSchema = z.object({
  establishmentId: z.string().uuid(),
  active: z.boolean(),
  title: z.string().trim().min(1).max(160),
  question: z.string().trim().min(1).max(300),
  description: z.string().trim().max(500).nullable().optional(),
  submit_label: z.string().trim().min(1).max(60),
  success_message: z.string().trim().min(1).max(300),
  star_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  button_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  google_review_url: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
  redirect_to_google_enabled: z.boolean(),
  show_average: z.boolean(),
  show_review_count: z.boolean(),
  anonymous_allowed: z.boolean(),
  name_required: z.boolean(),
  phone_required: z.boolean(),
  email_required: z.boolean(),
  comment_required: z.boolean(),
  allow_multiple: z.boolean(),
  cooldown_hours: z.number().int().min(0).max(720),
  consent_text: z.string().trim().max(500).nullable().optional(),
});

export const saveMerchantReviewForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof formSaveSchema>) => formSaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertFeature(context.supabase, data.establishmentId, "public_reviews");
    const formId = await ensureForm(
      context.supabase,
      data.establishmentId,
    );
    const { establishmentId: _e, ...rest } = data;
    const { error } = await context.supabase
      .from("review_forms")
      .update({
        ...rest,
        google_review_url: rest.google_review_url || null,
      })
      .eq("id", formId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const optionSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
  label: z.string().trim().min(1).max(60),
  selection_message: z.string().trim().max(300).nullable().optional(),
  comment_required: z.boolean(),
  post_submit_action: z.enum(["apologize", "ask_details", "thank", "invite_google", "invite_share", "none"]),
});

export const saveRatingOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; options: z.infer<typeof optionSchema>[] }) =>
    z.object({
      establishmentId: z.string().uuid(),
      options: z.array(optionSchema).min(1).max(5),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFeature(context.supabase, data.establishmentId, "public_reviews");
    // authorize: options belong to form of that establishment
    const { data: form } = await context.supabase
      .from("review_forms")
      .select("id")
      .eq("establishment_id", data.establishmentId)
      .maybeSingle();
    if (!form) throw new Error("Formulário não encontrado.");
    for (const o of data.options) {
      const { error } = await context.supabase
        .from("review_rating_options")
        .update({
          enabled: o.enabled,
          label: o.label,
          selection_message: o.selection_message ?? null,
          comment_required: o.comment_required,
          post_submit_action: o.post_submit_action,
        })
        .eq("id", o.id)
        .eq("review_form_id", form.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Questions CRUD
const questionUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(1).max(200),
  question_type: z.enum(["stars", "nps", "yes_no", "choice", "short", "long"]),
  choices: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  required: z.boolean(),
  display_order: z.number().int().min(0).max(1000),
  active: z.boolean(),
});

export const upsertReviewQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; question: z.infer<typeof questionUpsertSchema> }) =>
    z.object({ establishmentId: z.string().uuid(), question: questionUpsertSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFeature(context.supabase, data.establishmentId, "public_reviews");
    const { data: form } = await context.supabase
      .from("review_forms")
      .select("id")
      .eq("establishment_id", data.establishmentId)
      .maybeSingle();
    if (!form) throw new Error("Formulário não encontrado.");
    const payload = {
      review_form_id: form.id,
      question: data.question.question,
      question_type: data.question.question_type,
      choices: data.question.choices ?? null,
      required: data.question.required,
      display_order: data.question.display_order,
      active: data.question.active,
    };
    if (data.question.id) {
      const { error } = await context.supabase.from("review_questions").update(payload).eq("id", data.question.id).eq("review_form_id", form.id);
      if (error) throw new Error(error.message);
      return { id: data.question.id };
    }
    const { data: ins, error } = await context.supabase.from("review_questions").insert(payload).select("id").single();
    if (error || !ins) throw new Error(error?.message ?? "Erro");
    return { id: ins.id };
  });

export const deleteReviewQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("review_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Inbox
export const listPublicReviewsInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; status?: string; ratingFilter?: number; withCommentOnly?: boolean; limit?: number }) =>
    z.object({
      establishmentId: z.string().uuid(),
      status: z.enum(["new", "analyzing", "contacting", "resolved", "archived"]).optional(),
      ratingFilter: z.number().int().min(1).max(5).optional(),
      withCommentOnly: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("customer_reviews")
      .select("id, rating, comment, customer_name, customer_phone, customer_email, order_reference, source, status, anonymous, internal_note, ticket_id, submitted_at, created_at, resolved_at, merchant_reply, merchant_reply_at, public_hidden")
      .eq("establishment_id", data.establishmentId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.status) q = q.eq("status", data.status);
    if (data.ratingFilter) q = q.eq("rating", data.ratingFilter);
    if (data.withCommentOnly) q = q.not("comment", "is", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============ MERCHANT: reply publicly to a review ============
export const replyPublicReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reply: string }) =>
    z.object({
      id: z.string().uuid(),
      reply: z.string().trim().min(2, "Resposta muito curta").max(1500, "Máx 1500 caracteres"),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const clean = data.reply.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
    if (!clean) throw new Error("Resposta inválida.");
    const { data: row, error: fetchErr } = await context.supabase
      .from("customer_reviews")
      .select("id, establishment_id, review_form_id, customer_email, customer_name, rating")
      .eq("id", data.id)
      .maybeSingle();
    if (fetchErr || !row) throw new Error("Avaliação não encontrada.");

    const { error } = await context.supabase
      .from("customer_reviews")
      .update({
        merchant_reply: clean,
        merchant_reply_at: new Date().toISOString(),
        merchant_reply_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("review_events").insert({
      review_form_id: row.review_form_id,
      review_id: row.id,
      event_type: "merchant_replied",
      meta: { by: context.userId, has_email: !!row.customer_email },
    });
    return { ok: true, has_email: !!row.customer_email };
  });

// ============ MERCHANT: toggle public visibility of a review ============
export const togglePublicReviewVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; hidden: boolean }) =>
    z.object({ id: z.string().uuid(), hidden: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("customer_reviews")
      .update({ public_hidden: data.hidden })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ PUBLIC: recent reviews to show on /avaliar/{slug} ============
export const getPublicReviewsList = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; limit?: number }) =>
    z.object({ slug: z.string().min(1).max(80), limit: z.number().int().min(1).max(30).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: est } = await supabaseAdmin
      .from("establishments").select("id").eq("slug", data.slug).maybeSingle();
    if (!est) return [];
    const { data: rows } = await supabaseAdmin
      .from("customer_reviews")
      .select("id, rating, comment, customer_name, anonymous, created_at, merchant_reply, merchant_reply_at")
      .eq("establishment_id", est.id)
      .eq("public_hidden", false)
      .or("merchant_reply.not.is.null,rating.gte.4")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 10);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      author: r.anonymous ? "Anônimo" : (r.customer_name || "Cliente"),
      created_at: r.created_at,
      merchant_reply: r.merchant_reply,
      merchant_reply_at: r.merchant_reply_at,
    }));
  });

export const updatePublicReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: string; internal_note?: string }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "analyzing", "contacting", "resolved", "archived"]).optional(),
      internal_note: z.string().trim().max(2000).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: {
      status?: "new" | "analyzing" | "contacting" | "resolved" | "archived";
      resolved_at?: string;
      internal_note?: string;
    } = {};
    if (data.status) {
      patch.status = data.status;
      if (data.status === "resolved") patch.resolved_at = new Date().toISOString();
    }
    if (data.internal_note !== undefined) patch.internal_note = data.internal_note;
    const { error } = await context.supabase.from("customer_reviews").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPublicReviewStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; days?: number }) =>
    z.object({ establishmentId: z.string().uuid(), days: z.number().int().min(1).max(365).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - (data.days ?? 30) * 86400_000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("customer_reviews")
      .select("rating, created_at, source, status")
      .eq("establishment_id", data.establishmentId)
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const count = list.length;
    const avg = count ? list.reduce((a, r) => a + r.rating, 0) / count : 0;
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const bySource: Record<string, number> = {};
    list.forEach((r) => {
      dist[r.rating] = (dist[r.rating] ?? 0) + 1;
      bySource[r.source ?? "linktree"] = (bySource[r.source ?? "linktree"] ?? 0) + 1;
    });
    const pending = list.filter((r) => r.status === "new").length;
    const lowRatingOpen = list.filter((r) => r.rating <= 2 && r.status !== "resolved" && r.status !== "archived").length;
    return { count, avg, dist, bySource, pending, lowRatingOpen };
  });

// ============ INSIGHTS: breakdown by question and rating option ============
export const getReviewInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; days?: number }) =>
    z.object({ establishmentId: z.string().uuid(), days: z.number().int().min(1).max(365).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - (data.days ?? 30) * 86400_000).toISOString();
    const { data: form } = await context.supabase
      .from("review_forms").select("id").eq("establishment_id", data.establishmentId).maybeSingle();
    if (!form) return { byRatingOption: [], byQuestion: [], insights: [] };

    const [{ data: opts }, { data: qs }, { data: reviews }] = await Promise.all([
      context.supabase.from("review_rating_options").select("rating, label").eq("review_form_id", form.id),
      context.supabase.from("review_questions").select("id, question, question_type, choices").eq("review_form_id", form.id),
      context.supabase.from("customer_reviews").select("id, rating").eq("establishment_id", data.establishmentId).gte("created_at", since),
    ]);
    const reviewIds = (reviews ?? []).map((r) => r.id);
    const reviewRating = new Map((reviews ?? []).map((r) => [r.id as string, r.rating as number]));

    const distByRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (reviews ?? []).forEach((r) => { distByRating[r.rating] = (distByRating[r.rating] ?? 0) + 1; });
    const byRatingOption = (opts ?? []).sort((a, b) => a.rating - b.rating).map((o) => ({
      rating: o.rating, label: o.label, count: distByRating[o.rating] ?? 0,
    }));

    let answers: Array<{ review_id: string; question_id: string; answer_text: string | null; answer_number: number | null; answer_boolean: boolean | null }> = [];
    if (reviewIds.length) {
      const { data: ans } = await context.supabase
        .from("review_answers")
        .select("review_id, question_id, answer_text, answer_number, answer_boolean")
        .in("review_id", reviewIds);
      answers = ans ?? [];
    }
    const byQuestion = (qs ?? []).map((q) => {
      const my = answers.filter((a) => a.question_id === q.id);
      const ratings = my.map((a) => reviewRating.get(a.review_id) ?? 0).filter((n) => n > 0);
      const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const lowCount = ratings.filter((r) => r <= 2).length;
      let breakdown: Array<{ key: string; count: number; avgRating: number }> = [];
      const avgOf = (arr: typeof my) => {
        const rs = arr.map((a) => reviewRating.get(a.review_id) ?? 0).filter((v) => v > 0);
        return rs.length ? rs.reduce((s, v) => s + v, 0) / rs.length : 0;
      };
      if (q.question_type === "yes_no") {
        const y = my.filter((a) => a.answer_boolean === true);
        const n = my.filter((a) => a.answer_boolean === false);
        breakdown = [
          { key: "Sim", count: y.length, avgRating: avgOf(y) },
          { key: "Não", count: n.length, avgRating: avgOf(n) },
        ];
      } else if (q.question_type === "choice") {
        const counts = new Map<string, { count: number; ratings: number[] }>();
        my.forEach((a) => {
          const k = a.answer_text ?? "—";
          const bucket = counts.get(k) ?? { count: 0, ratings: [] };
          bucket.count++;
          const r = reviewRating.get(a.review_id) ?? 0;
          if (r > 0) bucket.ratings.push(r);
          counts.set(k, bucket);
        });
        breakdown = Array.from(counts.entries()).map(([key, v]) => ({
          key, count: v.count,
          avgRating: v.ratings.length ? v.ratings.reduce((s, x) => s + x, 0) / v.ratings.length : 0,
        })).sort((a, b) => b.count - a.count);
      } else if (q.question_type === "stars" || q.question_type === "nps") {
        const nums = my.map((a) => a.answer_number ?? 0).filter((n) => n > 0);
        const avgN = nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
        breakdown = [{ key: q.question_type === "nps" ? "NPS médio" : "Média", count: nums.length, avgRating: avgN }];
      }
      return {
        id: q.id, question: q.question, type: q.question_type,
        responses: my.length, avgRating, lowCount, breakdown,
      };
    });

    const insights = byQuestion
      .filter((q) => q.responses >= 3 && q.avgRating > 0)
      .sort((a, b) => a.avgRating - b.avgRating)
      .slice(0, 3)
      .map((q) => ({
        question: q.question, avgRating: q.avgRating,
        lowCount: q.lowCount, responses: q.responses,
      }));

    return { byRatingOption, byQuestion, insights };
  });

// ============ PUBLIC: list approved reviews by slug (for wallet page) ============
export const listPublicReviewsBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; limit?: number }) =>
    z.object({ slug: z.string().min(1).max(80), limit: z.number().int().min(1).max(100).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: est } = await supabaseAdmin
      .from("establishments")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!est) return { stats: { count: 0, avg: 0 }, reviews: [], settings: { show_average: true, show_review_count: true } };

    const { data: form } = await supabaseAdmin
      .from("review_forms")
      .select("show_average, show_review_count")
      .eq("establishment_id", est.id)
      .maybeSingle();

    const { data: rows } = await supabaseAdmin
      .from("customer_reviews")
      .select("id, rating, comment, customer_name, anonymous, submitted_at, created_at, merchant_reply, merchant_reply_at, status, public_hidden")
      .eq("establishment_id", est.id)
      .neq("status", "archived")
      .eq("public_hidden", false)
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 50);

    const list = rows ?? [];
    const withComments = list.filter((r: any) => r.rating > 0);
    const count = withComments.length;
    const avg = count ? withComments.reduce((a: number, r: any) => a + (r.rating ?? 0), 0) / count : 0;

    return {
      stats: { count, avg },
      settings: {
        show_average: form?.show_average ?? true,
        show_review_count: form?.show_review_count ?? true,
      },
      reviews: list.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        author: r.anonymous ? null : r.customer_name,
        submittedAt: r.submitted_at ?? r.created_at,
        reply: r.merchant_reply,
        replyAt: r.merchant_reply_at,
      })),
    };
  });
