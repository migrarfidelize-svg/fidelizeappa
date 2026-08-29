import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas Super Administradores podem acessar as configurações de e-mail.");
}

export const getEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { maskApiKey } = await import("./email.server");
    const { data, error } = await supabaseAdmin
      .from("system_email_settings")
      .select("id, sender_email, sender_name, reply_to, resend_api_key, updated_at, created_at")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { configured: false as const };
    return {
      configured: true as const,
      id: data.id,
      sender_email: data.sender_email,
      sender_name: data.sender_name,
      reply_to: data.reply_to,
      updated_at: data.updated_at,
      created_at: data.created_at,
      api_key_masked: maskApiKey(data.resend_api_key),
      api_key_last4: (data.resend_api_key ?? "").slice(-4),
    };
  });

/** Returns the full API key. Requires super admin. Used ONLY by the eye-toggle in the admin UI. */
export const revealEmailApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("system_email_settings")
      .select("resend_api_key")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { api_key: (data?.resend_api_key as string | undefined) ?? "" };
  });

const settingsSchema = z.object({
  resend_api_key: z.string().trim().min(10, "API Key inválida").max(200).optional(),
  sender_email: z.string().trim().email("E-mail remetente inválido").max(200),
  sender_name: z.string().trim().min(1, "Nome remetente obrigatório").max(120),
  reply_to: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "Reply-to inválido"),
});

export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("system_email_settings")
      .select("id, resend_api_key")
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);

    if (existing) {
      const patch: {
        sender_email: string;
        sender_name: string;
        reply_to: string | null;
        resend_api_key?: string;
      } = {
        sender_email: data.sender_email,
        sender_name: data.sender_name,
        reply_to: data.reply_to ?? null,
      };
      if (data.resend_api_key) patch.resend_api_key = data.resend_api_key;
      const { error } = await supabaseAdmin
        .from("system_email_settings")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      if (!data.resend_api_key) throw new Error("Informe a API Key do Resend para a primeira configuração.");
      const { error } = await supabaseAdmin.from("system_email_settings").insert({
        resend_api_key: data.resend_api_key,
        sender_email: data.sender_email,
        sender_name: data.sender_name,
        reply_to: data.reply_to ?? null,
        singleton: true,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ to: z.string().trim().email("Informe um e-mail válido") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { sendPlatformEmail } = await import("./email.server");
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;padding:24px;max-width:520px;margin:auto;color:#0f172a;">
        <h2 style="margin:0 0 12px;font-size:20px;">Teste de envio — Fidelize</h2>
        <p style="margin:0 0 12px;line-height:1.5;">Se você recebeu este e-mail, a integração com o Resend está funcionando corretamente.</p>
        <p style="margin:0 0 24px;color:#64748b;font-size:13px;">Enviado em ${new Date().toLocaleString("pt-BR")}.</p>
        <div style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;font-size:13px;">
          Este é um envio de diagnóstico disparado pelo painel do Super Administrador. Nenhuma ação é necessária.
        </div>
      </div>`;
    const res = await sendPlatformEmail({
      to: data.to,
      subject: "Teste de envio — Fidelize",
      html,
      text: "Teste de envio da integração com o Resend.",
      template: "test",
      actor_id: context.userId,
      log_status: "test",
    });
    if (!res.ok) throw new Error(res.error ?? "Falha ao enviar e-mail de teste");
    return { ok: true as const, resend_id: res.resend_id, duration_ms: res.duration_ms };
  });

export const listEmailLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        q: z.string().trim().max(200).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("email_logs")
      .select("id, to_email, subject, template, status, resend_id, error, duration_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.q) {
      const term = `%${data.q}%`;
      q = q.or(`to_email.ilike.${term},subject.ilike.${term},template.ilike.${term}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { logs: rows ?? [] };
  });

// ============ Email templates (Super Admin only) ============
export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .select("id, slug, name, description, subject, variables, is_system, active, updated_at")
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { templates: data ?? [] };
  });

export const getEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("email_templates").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Template não encontrado");
    return row;
  });

const templateWriteSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  subject: z.string().trim().min(2).max(300),
  html: z.string().min(10),
  text: z.string().optional().nullable(),
  variables: z.array(z.string().max(60)).max(30).default([]),
  active: z.boolean().default(true),
});

export const createEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateWriteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("email_templates").insert({
      slug: data.slug, name: data.name, description: data.description ?? null,
      subject: data.subject, html: data.html, text: data.text ?? null,
      variables: data.variables as any, active: data.active,
      updated_by: context.userId, is_system: false,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateWriteSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // system templates: allow editing content but not slug
    const { data: current } = await supabaseAdmin.from("email_templates").select("is_system, slug").eq("id", data.id).maybeSingle();
    if (!current) throw new Error("Template não encontrado");
    const patch: any = {
      name: data.name, description: data.description ?? null,
      subject: data.subject, html: data.html, text: data.text ?? null,
      variables: data.variables as any, active: data.active,
      updated_by: context.userId,
    };
    if (!current.is_system) patch.slug = data.slug;
    const { error } = await supabaseAdmin.from("email_templates").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin.from("email_templates").select("is_system").eq("id", data.id).maybeSingle();
    if (!current) throw new Error("Template não encontrado");
    if (current.is_system) throw new Error("Templates do sistema não podem ser removidos (apenas desativados).");
    const { error } = await supabaseAdmin.from("email_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const previewEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    subject: z.string(),
    html: z.string(),
    text: z.string().optional().nullable(),
    variables: z.record(z.string(), z.any()).default({}),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { renderVariables } = await import("./email.server");
    return {
      subject: renderVariables(data.subject, data.variables),
      html: renderVariables(data.html, data.variables),
      text: data.text ? renderVariables(data.text, data.variables) : null,
    };
  });

export const sendTemplatePreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    to: z.string().email(),
    subject: z.string(),
    html: z.string(),
    text: z.string().optional().nullable(),
    variables: z.record(z.string(), z.any()).default({}),
    template: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { sendPlatformEmail, renderVariables } = await import("./email.server");
    const res = await sendPlatformEmail({
      to: data.to,
      subject: renderVariables(data.subject, data.variables),
      html: renderVariables(data.html, data.variables),
      text: data.text ? renderVariables(data.text, data.variables) : undefined,
      template: data.template ?? "preview",
      actor_id: context.userId,
      log_status: "test",
    });
    if (!res.ok) throw new Error(res.error ?? "Falha ao enviar prévia");
    return { ok: true as const, resend_id: res.resend_id };
  });

// ============ Email queue admin ============
export const listEmailQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    status: z.enum(["pending","processing","sent","failed","all"]).default("all"),
    limit: z.number().int().min(1).max(200).default(100),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("email_queue")
      .select("id, to_email, subject, template, status, attempts, max_attempts, next_attempt_at, last_error, resend_id, created_at, sent_at")
      .order("created_at", { ascending: false }).limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const retryQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("email_queue")
      .update({ status: "pending", next_attempt_at: new Date().toISOString(), last_error: null })
      .eq("id", data.id).in("status", ["failed","pending","processing"]);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteQueueItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("email_queue").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const runQueueNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { processEmailQueue } = await import("./email.server");
    return await processEmailQueue(50);
  });

// ============ Password recovery (público) ============
export const requestPasswordRecovery = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    email: z.string().trim().email().max(200),
    redirect_to: z.string().url().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { sendPasswordRecoveryEmail } = await import("./email.server");
    await sendPasswordRecoveryEmail(data.email, data.redirect_to);
    return { ok: true as const };
  });
