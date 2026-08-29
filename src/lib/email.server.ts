// Server-only email sending helpers. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SystemEmailSettings {
  id: string;
  resend_api_key: string;
  sender_email: string;
  sender_name: string;
  reply_to: string | null;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
  actor_id?: string | null;
  establishment_id?: string | null;
  log_status?: "sent" | "test";
}

export interface SendEmailResult {
  ok: boolean;
  resend_id?: string;
  error?: string;
  duration_ms: number;
}

export async function getGlobalEmailSettings(): Promise<SystemEmailSettings | null> {
  const { data, error } = await supabaseAdmin
    .from("system_email_settings")
    .select("id, resend_api_key, sender_email, sender_name, reply_to")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SystemEmailSettings | null) ?? null;
}

async function insertEmailLog(row: {
  to_email: string;
  subject: string;
  template: string | null;
  status: "sent" | "failed" | "test" | "queued";
  resend_id: string | null;
  error: string | null;
  duration_ms: number;
  actor_id: string | null;
  establishment_id: string | null;
}) {
  try {
    await supabaseAdmin.from("email_logs").insert(row);
  } catch {
    // logging must never break the send flow
  }
}

async function performResendCall(
  settings: SystemEmailSettings,
  input: { to: string; subject: string; html: string; text?: string },
): Promise<{ ok: boolean; resend_id: string | null; error: string | null; duration_ms: number }> {
  const started = Date.now();
  const from = `${settings.sender_name} <${settings.sender_email}>`;
  const payload: Record<string, unknown> = {
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
  };
  if (input.text) payload.text = input.text;
  if (settings.reply_to) payload.reply_to = settings.reply_to;

  let resend_id: string | null = null;
  let error: string | null = null;
  let ok = false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.resend_api_key}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    if (!res.ok) {
      error = `Resend [${res.status}]: ${body}`;
    } else {
      try {
        const parsed = JSON.parse(body) as { id?: string };
        resend_id = parsed.id ?? null;
      } catch {
        resend_id = null;
      }
      ok = true;
    }
  } catch (err: any) {
    error = err?.message ?? "Falha inesperada ao contatar o Resend";
  }
  return { ok, resend_id, error, duration_ms: Date.now() - started };
}

/** Substitui variáveis {{var}} em uma string. */
export function renderVariables(input: string, vars: Record<string, unknown>): string {
  if (!input) return "";
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string | null;
  slug: string;
}

export async function renderTemplate(
  slug: string,
  vars: Record<string, unknown>,
): Promise<RenderedTemplate> {
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select("slug, subject, html, text, active")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Template não encontrado: ${slug}`);
  if (!data.active) throw new Error(`Template inativo: ${slug}`);
  return {
    slug: data.slug,
    subject: renderVariables(data.subject as string, vars),
    html: renderVariables(data.html as string, vars),
    text: data.text ? renderVariables(data.text as string, vars) : null,
  };
}

/** Envia usando um template + variáveis; se falhar, enfileira automaticamente. */
export async function sendTemplateEmail(params: {
  to: string;
  template: string;
  variables: Record<string, unknown>;
  actor_id?: string | null;
  establishment_id?: string | null;
}): Promise<SendEmailResult> {
  const rendered = await renderTemplate(params.template, params.variables);
  return sendOrEnqueue({
    to: params.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text ?? undefined,
    template: rendered.slug,
    variables: params.variables,
    actor_id: params.actor_id ?? null,
    establishment_id: params.establishment_id ?? null,
  });
}

/** Tenta enviar imediatamente; se falhar (ou não estiver configurado), grava na fila para retry. */
export async function sendOrEnqueue(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
  variables?: Record<string, unknown>;
  actor_id?: string | null;
  establishment_id?: string | null;
}): Promise<SendEmailResult> {
  const started = Date.now();
  const settings = await getGlobalEmailSettings();

  if (!settings) {
    await enqueueEmail({ ...params, last_error: "E-mail global não configurado." });
    await insertEmailLog({
      to_email: params.to,
      subject: params.subject,
      template: params.template ?? null,
      status: "queued",
      resend_id: null,
      error: "E-mail global não configurado — mensagem enfileirada.",
      duration_ms: Date.now() - started,
      actor_id: params.actor_id ?? null,
      establishment_id: params.establishment_id ?? null,
    });
    return { ok: false, error: "E-mail global não configurado (enfileirado).", duration_ms: Date.now() - started };
  }

  const result = await performResendCall(settings, params);

  await insertEmailLog({
    to_email: params.to,
    subject: params.subject,
    template: params.template ?? null,
    status: result.ok ? "sent" : "failed",
    resend_id: result.resend_id,
    error: result.error,
    duration_ms: result.duration_ms,
    actor_id: params.actor_id ?? null,
    establishment_id: params.establishment_id ?? null,
  });

  if (!result.ok) {
    await enqueueEmail({ ...params, last_error: result.error ?? "Falha no envio" });
  }

  return {
    ok: result.ok,
    resend_id: result.resend_id ?? undefined,
    error: result.error ?? undefined,
    duration_ms: result.duration_ms,
  };
}

/** Envia diretamente (sem fila) — usado por testes de conexão. */
export async function sendPlatformEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const started = Date.now();
  const settings = await getGlobalEmailSettings();

  if (!settings) {
    const duration_ms = Date.now() - started;
    await insertEmailLog({
      to_email: input.to,
      subject: input.subject,
      template: input.template ?? null,
      status: "failed",
      resend_id: null,
      error: "E-mail global não configurado.",
      duration_ms,
      actor_id: input.actor_id ?? null,
      establishment_id: input.establishment_id ?? null,
    });
    return { ok: false, error: "E-mail global não configurado.", duration_ms };
  }

  const result = await performResendCall(settings, input);

  await insertEmailLog({
    to_email: input.to,
    subject: input.subject,
    template: input.template ?? null,
    status: result.ok ? (input.log_status ?? "sent") : "failed",
    resend_id: result.resend_id,
    error: result.error,
    duration_ms: result.duration_ms,
    actor_id: input.actor_id ?? null,
    establishment_id: input.establishment_id ?? null,
  });

  return {
    ok: result.ok,
    resend_id: result.resend_id ?? undefined,
    error: result.error ?? undefined,
    duration_ms: result.duration_ms,
  };
}

export async function enqueueEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
  variables?: Record<string, unknown>;
  actor_id?: string | null;
  establishment_id?: string | null;
  last_error?: string;
  delay_seconds?: number;
}) {
  const next = new Date(Date.now() + (params.delay_seconds ?? 30) * 1000).toISOString();
  await supabaseAdmin.from("email_queue").insert({
    to_email: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text ?? null,
    template: params.template ?? null,
    variables: (params.variables ?? {}) as any,
    status: "pending",
    attempts: 0,
    next_attempt_at: next,
    last_error: params.last_error ?? null,
    actor_id: params.actor_id ?? null,
    establishment_id: params.establishment_id ?? null,
  });
}

/** Processa até `limit` mensagens pendentes com backoff exponencial. */
export async function processEmailQueue(limit = 20): Promise<{
  picked: number;
  sent: number;
  failed: number;
  dead: number;
}> {
  const now = new Date().toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  const list = rows ?? [];
  if (list.length === 0) return { picked: 0, sent: 0, failed: 0, dead: 0 };

  const settings = await getGlobalEmailSettings();
  let sent = 0, failed = 0, dead = 0;

  for (const row of list as any[]) {
    // claim
    const { data: claim } = await supabaseAdmin
      .from("email_queue")
      .update({ status: "processing" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claim) continue;

    if (!settings) {
      const attempts = row.attempts + 1;
      const isDead = attempts >= row.max_attempts;
      await supabaseAdmin.from("email_queue").update({
        status: isDead ? "failed" : "pending",
        attempts,
        last_error: "E-mail global não configurado.",
        next_attempt_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
      }).eq("id", row.id);
      if (isDead) dead++; else failed++;
      continue;
    }

    const result = await performResendCall(settings, {
      to: row.to_email, subject: row.subject, html: row.html, text: row.text ?? undefined,
    });

    await insertEmailLog({
      to_email: row.to_email,
      subject: row.subject,
      template: row.template,
      status: result.ok ? "sent" : "failed",
      resend_id: result.resend_id,
      error: result.error,
      duration_ms: result.duration_ms,
      actor_id: row.actor_id,
      establishment_id: row.establishment_id,
    });

    if (result.ok) {
      await supabaseAdmin.from("email_queue").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        resend_id: result.resend_id,
        last_error: null,
        attempts: row.attempts + 1,
      }).eq("id", row.id);
      sent++;
    } else {
      const attempts = row.attempts + 1;
      const isDead = attempts >= row.max_attempts;
      await supabaseAdmin.from("email_queue").update({
        status: isDead ? "failed" : "pending",
        attempts,
        last_error: result.error,
        next_attempt_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
      }).eq("id", row.id);
      if (isDead) dead++; else failed++;
    }
  }

  return { picked: list.length, sent, failed, dead };
}

function backoffMs(attempt: number): number {
  // 1min, 5min, 15min, 1h, 6h
  const table = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
  return table[Math.min(attempt - 1, table.length - 1)] ?? 6 * 60 * 60_000;
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  const tail = key.slice(-4);
  return `${"•".repeat(Math.max(8, Math.min(20, key.length - 4)))}${tail}`;
}

/**
 * Envia o e-mail personalizado de redefinição de senha (template `password_recovery`).
 * Nunca revela se o e-mail existe — o resultado é sempre `{ ok: true }`.
 * Usado pelo fluxo "Esqueci minha senha" do app e pela API de integrações.
 */
export async function sendPasswordRecoveryEmail(
  email: string,
  redirectTo?: string,
): Promise<{ ok: true; sent: boolean }> {
  let actionLink: string | null = null;
  let userName = "";
  try {
    const { data: link } = await (supabaseAdmin.auth.admin as any).generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });
    actionLink = link?.properties?.action_link ?? null;
    userName = (link?.user?.user_metadata as any)?.full_name ?? "";
  } catch {
    // Silencioso — evita enumeração de usuários
  }

  if (!actionLink) return { ok: true, sent: false };

  const variables = { name: userName || "cliente", action_link: actionLink };
  try {
    await sendTemplateEmail({ to: email, template: "password_recovery", variables });
  } catch (err: any) {
    try {
      const rendered = await renderTemplate("password_recovery", variables);
      await enqueueEmail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text ?? undefined,
        template: "password_recovery",
        variables,
        last_error: err?.message ?? "Falha inicial",
      });
    } catch {
      return { ok: true, sent: false };
    }
  }
  return { ok: true, sent: true };
}
