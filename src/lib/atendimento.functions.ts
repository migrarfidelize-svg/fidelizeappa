import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito: apenas administradores da plataforma.");
}

export async function authorizeCRMEstablishment(supabase: any, userId: string, establishmentId: string): Promise<string> {
  // Regra definitiva: o CRM de Atendimento é exclusivo da plataforma (super admin).
  // Lojista, owner, manager e staff não têm acesso, nem via UI nem via ServerFn.
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_super_admin", { _user: userId });
  if (adminError) throw new Error(adminError.message);
  if (!isAdmin) throw new Error("Acesso restrito: apenas administradores da plataforma.");

  const { data: establishment, error } = await supabase.from("establishments").select("id").eq("id", establishmentId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!establishment) throw new Error("Estabelecimento selecionado não existe.");
  return establishmentId;
}


const tenantSchema = z.object({ establishmentId: z.string().uuid() });

export async function assertActiveCRMAssignee(client: any, establishmentId: string, assigneeId: string) {
  const { data, error } = await client.from("establishment_members").select("user_id")
    .eq("establishment_id", establishmentId).eq("user_id", assigneeId).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("O responsável não é um operador ativo deste estabelecimento.");
  return assigneeId;
}

export function validateCRMFlowDestinations(steps: any[], ids = steps.map((step) => String(step.id))) {
  const allowed = new Set([...ids, "transfer"]);
  for (const step of steps) {
    const destinations = [step?.payload?.nextStepId, ...(step?.payload?.options || []).map((option: any) => option.nextStepId)].filter(Boolean);
    if (destinations.some((destination) => !allowed.has(destination))) {
      throw new Error("Um bloco aponta para um destino que não existe neste fluxo.");
    }
  }
}

export function remapCRMFlowSteps(steps: any[], createId: () => string = () => crypto.randomUUID()) {
  const idMap = new Map<string, string>(steps.map((step: any) => [step.id, createId()]));
  const remap = (value: any): any => Array.isArray(value) ? value.map(remap) : (!value || typeof value !== "object") ? value
    : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "nextStepId" && typeof child === "string" ? (idMap.get(child) || child) : remap(child)]));
  return steps.map((step: any) => ({ ...step, id: idMap.get(step.id), payload: remap(step.payload) }));
}

export const getCRMEstablishments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data, error } = await supabase.from("establishments").select("id, name, slug, active").eq("active", true).order("name");
    if (error) throw error;
    return data || [];
  });

const saveOtpTemplateSchema = z.object({
  template: z.string().min(10).max(500),
});

export const getOTPSettingsDetailed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getActiveWhatsAppProvider } = await import("./otp.functions");

    // 1. Get Template
    const { data: templateData } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("namespace", "otp")
      .eq("key", "template")
      .maybeSingle();

    // 2. Get Configs (validity, cooldown)
    const { data: configData } = await supabaseAdmin
      .from("system_settings")
      .select("*")
      .eq("namespace", "otp")
      .in("key", ["validity_minutes", "cooldown_seconds", "max_attempts"]);

    const configs = (configData || []).reduce((acc: any, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {
      validity_minutes: 10,
      cooldown_seconds: 60,
      max_attempts: 5
    });

    // 3. Get Provider Info
    const active = await getActiveWhatsAppProvider();
    
    // 4. Get Current Status for the UI
    let status = "DISCONNECTED";
    if (active) {
      try {
        const dbCreds = (active.runtime.db_credentials || {}) as Record<string, string>;
        
        const mergedEnv: Record<string, string | undefined> = { ...(process.env as Record<string, string | undefined>) };
        for (const [field, envName] of Object.entries(active.runtime.credentials_ref)) {
          const v = dbCreds[field];
          if (v) mergedEnv[envName] = v;
        }

        const runtime = { ...active.runtime, db_credentials: dbCreds };
        const statusRes = await active.provider.getInstanceStatus(runtime, mergedEnv);
        status = statusRes?.status || "DISCONNECTED";
      } catch (e) {
        console.warn("Failed to fetch initial WhatsApp status for OTP Dashboard", e);
      }
    }

    return {
      template: (templateData?.value as any)?.text || "Afidelize\n\nSeu código de acesso é {{code}}.\n\nEle expira em {{minutes}} minutos.\n\nNão compartilhe este código.",
      configs,
      provider: active ? {
        name: active.provider.meta.label,
        id: active.provider.meta.id,
        enabled: active.runtime.enabled,
        status: status
      } : null
    };
  });


export const getWhatsAppInstanceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);

    const { getActiveWhatsAppProvider } = await import("./otp.functions");
    const active = await getActiveWhatsAppProvider(establishmentId);

    if (!active) return { status: "DISCONNECTED", message: "Nenhum provedor configurado" };

    const dbCreds = (active.runtime.db_credentials || {}) as Record<string, string>;

    const mergedEnv: Record<string, string | undefined> = { ...(process.env as Record<string, string | undefined>) };
    for (const [field, envName] of Object.entries(active.runtime.credentials_ref)) {
      const v = dbCreds[field];
      if (v) mergedEnv[envName] = v;
    }

    // Garante que db_credentials esteja descriptografado para o provider
    const runtime = { ...active.runtime, db_credentials: dbCreds };
    const status = await active.provider.getInstanceStatus(runtime, mergedEnv);
    return { ...status, provider: { id: active.provider.meta.id, name: active.provider.meta.label } };
  });

export const disconnectWhatsAppInstance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);

    const { getActiveWhatsAppProvider } = await import("./otp.functions");
    const active = await getActiveWhatsAppProvider(establishmentId);
    if (!active) throw new Error("Nenhum provedor ativo.");

    const dbCreds = (active.runtime.db_credentials || {}) as Record<string, string>;
    const mergedEnv: Record<string, string | undefined> = { ...(process.env as Record<string, string | undefined>) };
    for (const [field, envName] of Object.entries(active.runtime.credentials_ref)) {
      const v = dbCreds[field];
      if (v) mergedEnv[envName] = v;
    }

    return await active.provider.disconnectInstance({ ...active.runtime, db_credentials: dbCreds }, mergedEnv);
  });

/** Returned only to an authorized CRM operator so URL-only providers can be configured safely. */
export const getCRMWhatsAppWebhookUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    const establishmentId = await authorizeCRMEstablishment(context.supabase, context.userId, data.establishmentId);
    const { ensureWhatsAppWebhookSecret } = await import("./otp.functions");
    const secret = await ensureWhatsAppWebhookSecret(establishmentId);
    if (!secret) throw new Error("Integração WhatsApp não configurada.");
    const request = getRequest();
    const origin = request ? new URL(request.url).origin : "";
    return `${origin}/api/public/webhooks/whatsapp?establishment_id=${encodeURIComponent(establishmentId)}&webhook_secret=${encodeURIComponent(secret)}`;
  });


export const saveOTPTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    template: z.string().min(10).max(500),
    configs: z.object({
      validity_minutes: z.number().min(1).max(60).optional(),
      cooldown_seconds: z.number().min(10).max(300).optional(),
      max_attempts: z.number().min(1).max(20).optional()
    }).optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    // Update Template
    await supabaseAdmin
      .from("system_settings")
      .upsert({ 
        namespace: "otp",
        key: "template", 
        value: { text: data.template } as any,
      }, { onConflict: "namespace,key" });

    // Update Configs if provided
    if (data.configs) {
      for (const [key, val] of Object.entries(data.configs)) {
        if (val !== undefined) {
          await supabaseAdmin.from("system_settings").upsert({
            namespace: "otp",
            key,
            value: val as any
          }, { onConflict: "namespace,key" });
        }
      }
    }

    return { ok: true };
  });

export const sendOTPTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: z.string(), message: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { getActiveWhatsAppProvider } = await import("./otp.functions");
    const active = await getActiveWhatsAppProvider();

    if (!active) {
      throw new Error("Nenhum provedor de WhatsApp ativo configurado nas Integrações.");
    }

    const dbCreds = (active.runtime.db_credentials || {}) as Record<string, string>;

    const runtime = { ...active.runtime, db_credentials: dbCreds };
    const mergedEnv = { ...process.env } as Record<string, string | undefined>;
    for (const [field, envName] of Object.entries(runtime.credentials_ref)) {
      const v = dbCreds[field];
      if (v) mergedEnv[envName] = v;
    }

    const res = await active.provider.sendTestMessage(
      runtime, 
      mergedEnv, 
      data.phone, 
      data.message
    );

    if (!res.ok) {
      return { 
        ok: false, 
        message: res.message || "Falha ao enviar mensagem de teste.",
        details: res.providerResponse,
        httpStatus: res.httpStatus
      };
    }

    return { 
      ok: true, 
      messageId: res.providerMessageId,
      provider: "uazapi"
    };
  });

// --- CRM FUNCTIONS ---

export const getCRMStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);

    const today = new Date().toISOString().split('T')[0];

    // Parallel counts for stats
    const [
      { count: openCount },
      { count: waitingCount },
      { count: assignedCount },
      { count: resolvedToday }
    ] = await Promise.all([
      supabase.from("crm_conversations").select("*", { count: 'exact', head: true }).eq("establishment_id", establishmentId).neq("status", "closed"),
      supabase.from("crm_conversations").select("*", { count: 'exact', head: true }).eq("establishment_id", establishmentId).eq("status", "waiting"),
      supabase.from("crm_conversations").select("*", { count: 'exact', head: true }).eq("establishment_id", establishmentId).eq("status", "assigned"),
      supabase.from("crm_conversations").select("*", { count: 'exact', head: true }).eq("establishment_id", establishmentId).eq("status", "closed").gte("closed_at", today)
    ]);

    return {
      open: openCount || 0,
      waiting: waitingCount || 0,
      assigned: assignedCount || 0,
      resolvedToday: resolvedToday || 0,
      avgWaitTime: null
    };
  });

export const getCRMOperators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members, error } = await supabaseAdmin.from("establishment_members")
      .select("user_id, role").eq("establishment_id", establishmentId).eq("active", true).order("created_at");
    if (error) throw error;
    return members || [];
  });

export const getCRMConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    establishmentId: z.string().uuid(),
    status: z.enum(["all", "bot", "waiting", "assigned", "closed"]).optional(),
    search: z.string().optional()
  }).parse(d || {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);

    let query = supabase
      .from("crm_conversations")
      .select("*, messages:crm_messages(body, created_at, direction)")
      .eq("establishment_id", establishmentId)
      .order("last_message_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    if (data.search) {
      query = query.or(`customer_phone.ilike.%${data.search}%,customer_name.ilike.%${data.search}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    return rows || [];
  });

export const getCRMConversationMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.extend({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);

    const { data: conversation, error: conversationError } = await supabase
      .from("crm_conversations")
      .select("id")
      .eq("id", data.conversationId)
      .eq("establishment_id", establishmentId)
      .maybeSingle();
    if (conversationError || !conversation) throw new Error("Conversa não encontrada neste estabelecimento.");

    const { data: messages, error } = await supabase
      .from("crm_messages")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const { data: notes } = await (supabase as any)
      .from("crm_internal_notes")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: true });

    // Combine and sort messages and notes for unified history
    const history = [
      ...(messages || []).map(m => ({ ...m, type: 'message' })),
      ...(notes || []).map((n: any) => ({ ...n, type: 'note', direction: 'internal' }))
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return history;
  });

export const sendCRMMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    establishmentId: z.string().uuid(),
    conversationId: z.string().uuid(),
    body: z.string().min(1),
    isNote: z.boolean().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: conv, error: convErr } = await supabase
      .from("crm_conversations")
      .select("customer_phone, establishment_id")
      .eq("id", data.conversationId)
      .eq("establishment_id", establishmentId)
      .single();
    if (convErr || !conv) throw new Error("Conversa não encontrada neste estabelecimento.");

    if (data.isNote) {
      const { error } = await (supabaseAdmin as any)
        .from("crm_internal_notes")
        .insert({
          conversation_id: data.conversationId,
          establishment_id: establishmentId,
          author_id: userId,
          content: data.body
        });
      if (error) throw error;
      return { ok: true };
    }

    // Regular Message logic
    const { getActiveWhatsAppProvider } = await import("./otp.functions");
    const active = await getActiveWhatsAppProvider(conv.establishment_id);
    if (!active) throw new Error("Nenhum provedor de WhatsApp ativo.");

    const providerEnv = { ...process.env } as Record<string, string | undefined>;
    for (const [field, envName] of Object.entries(active.runtime.credentials_ref || {})) {
      const credential = active.runtime.db_credentials?.[field];
      if (credential) providerEnv[envName] = credential;
    }

    const res = await active.provider.sendTestMessage(
      active.runtime,
      providerEnv,
      conv.customer_phone,
      data.body
    );

    if (!res.ok) throw new Error(res.message || "Falha no envio via WhatsApp.");

    const { error: msgErr } = await (supabaseAdmin as any)
      .from("crm_messages")
        .insert({
          conversation_id: data.conversationId,
          establishment_id: conv.establishment_id,
          body: data.body,
          direction: "outbound",
          provider: active.provider.meta.id,
          provider_message_id: res.providerMessageId || `admin-${Date.now()}`
        });

    if (msgErr) throw msgErr;

    await supabaseAdmin
      .from("crm_conversations")
      .update({ 
        status: "assigned", 
        assigned_to: userId, 
        assigned_at: new Date().toISOString(),
        last_message_at: new Date().toISOString() 
      })
      .eq("id", data.conversationId)
      .eq("establishment_id", conv.establishment_id)
      .not("status", "eq", "closed");

    return { ok: true };
  });

export const updateCRMConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    establishmentId: z.string().uuid(),
    conversationId: z.string().uuid(),
    status: z.enum(["bot", "waiting", "assigned", "closed"]),
    assignedTo: z.string().uuid().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: conversation, error: conversationError } = await supabase
      .from("crm_conversations").select("establishment_id, metadata").eq("id", data.conversationId).eq("establishment_id", establishmentId).single();
    if (conversationError || !conversation) throw new Error("Conversa não encontrada.");
    const updateData: any = { status: data.status, updated_at: new Date().toISOString() };
    if (data.status === "closed") {
      updateData.closed_at = new Date().toISOString();
      updateData.metadata = { ...((conversation.metadata as object) || {}), support: { ...((conversation.metadata as any)?.support || {}), active: false } };
      const ticketResult = await (supabaseAdmin as any).from("crm_support_tickets")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("conversation_id", data.conversationId).eq("establishment_id", conversation.establishment_id)
        .in("status", ["open", "in_progress"]);
      if (ticketResult.error) throw ticketResult.error;
    } else if (data.status === "assigned") {
      const assignee = data.assignedTo || userId;
      await assertActiveCRMAssignee(supabaseAdmin, establishmentId, assignee);
      updateData.assigned_at = new Date().toISOString();
      updateData.assigned_to = assignee;
    } else if (data.status === "waiting") {
      updateData.assigned_to = null;
      updateData.assigned_at = null;
    }

    const { error } = await supabaseAdmin
      .from("crm_conversations")
      .update(updateData)
      .eq("id", data.conversationId)
      .eq("establishment_id", conversation.establishment_id);

    if (error) throw error;
    return { ok: true };
  });

// --- CRM FLOWS ---
export const getCRMFlows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    
    // Ensure default flow exists for this tenant
    const { ensureDefaultWhatsAppFlow } = await import("./crm/bootstrap.server");
    await ensureDefaultWhatsAppFlow(establishmentId);

    const { data: flows, error } = await (supabase as any)
      .from("crm_flows")
      .select("id, name, description, is_active, metadata, steps:crm_flow_steps!crm_flow_steps_flow_id_fkey(*)")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: true });
      
    if (error) throw error;
    return (flows || []).map((flow: any) => ({
      ...flow,
      steps: [...(flow.steps || [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    }));
  });

export const getCRMFlowWithSteps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.extend({ flowId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: flow, error } = await supabaseAdmin
      .from("crm_flows")
      .select(`
        *,
        steps:crm_flow_steps!crm_flow_steps_flow_id_fkey(*)
      `)
      .eq("id", data.flowId)
      .eq("establishment_id", establishmentId)
      .single();

    if (error) throw error;

    if (flow && flow.steps) {
      flow.steps.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }

    return flow;
  });

export const saveCRMFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    establishmentId: z.string().uuid(),
    id: z.string().uuid().optional(),
    name: z.string().min(3),
    description: z.string().optional(),
    is_active: z.boolean().optional(),
    steps: z.array(z.any())
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);

    const flowData = { 
      name: data.name, 
      description: data.description, 
      is_active: data.is_active ?? false,
      establishment_id: establishmentId,
      updated_at: new Date().toISOString()
    };

    let flowId = data.id;
    if (flowId) {
      const { data: ownedFlow } = await supabaseAdmin.from("crm_flows").select("id").eq("id", flowId).eq("establishment_id", establishmentId).maybeSingle();
      if (!ownedFlow) throw new Error("Fluxo não pertence ao estabelecimento ativo.");
      const { error } = await supabaseAdmin.from("crm_flows").update(flowData).eq("id", flowId).eq("establishment_id", establishmentId);
      if (error) throw error;
    } else {
      const { data: newFlow, error } = await supabaseAdmin.from("crm_flows").insert(flowData).select("id").single();
      if (error) throw error;
      flowId = newFlow.id;
    }

    const stepIds = data.steps.map((step) => String(step.id || crypto.randomUUID()));
    const { data: existingSteps, error: existingStepsError } = await supabaseAdmin
      .from("crm_flow_steps")
      .select("id, flow_id, establishment_id")
      .in("id", stepIds);
    if (existingStepsError) throw existingStepsError;
    if ((existingSteps || []).some((step) => step.flow_id !== flowId || step.establishment_id !== establishmentId)) {
      throw new Error("Um bloco informado pertence a outro fluxo ou estabelecimento.");
    }
    const allowedDestinations = new Set([...stepIds, "transfer"]);
    validateCRMFlowDestinations(data.steps, stepIds);
    const stepsToUpsert = data.steps.map((step, index) => {
      const payload = step.payload && typeof step.payload === "object" ? step.payload : {};
      if (Array.isArray((payload as any).options)) {
        for (const option of (payload as any).options) {
          if (option.nextStepId && !allowedDestinations.has(option.nextStepId)) {
            throw new Error("Uma opção aponta para um bloco que não existe neste fluxo.");
          }
        }
      }
      return {
        id: stepIds[index],
        step_key: String(step.step_key || (payload as any).type || "message"),
        payload,
        flow_id: flowId!,
        establishment_id: establishmentId,
        sort_order: index,
      };
    });

    if (stepsToUpsert.length) {
      const { error: upsertErr } = await supabaseAdmin.from("crm_flow_steps").upsert(stepsToUpsert, { onConflict: "id" });
      if (upsertErr) throw upsertErr;
      const { error: deleteErr } = await supabaseAdmin.from("crm_flow_steps").delete()
        .eq("flow_id", flowId!).eq("establishment_id", establishmentId).not("id", "in", `(${stepIds.join(",")})`);
      if (deleteErr) throw deleteErr;
    } else {
      const { error: deleteErr } = await supabaseAdmin.from("crm_flow_steps").delete().eq("flow_id", flowId!).eq("establishment_id", establishmentId);
      if (deleteErr) throw deleteErr;
    }

    return { id: flowId };
  });

// --- AGENT SETTINGS ---
const agentSettingsSchema = z.object({
  enabled: z.boolean(),
  name: z.string().trim().min(1).max(100),
  provider_id: z.enum(["openai", "deepseek", "openrouter", "grok"]).optional().or(z.literal("")),
  model: z.string().trim().max(120).optional(),
  systemPrompt: z.string().max(20_000),
  presentation: z.string().max(2_000),
  handoff: z.object({
    keywords: z.array(z.string().trim().min(1).max(100)).max(100),
    message: z.string().max(2_000),
  }).passthrough(),
  fallback: z.object({
    message: z.string().max(2_000),
    maxFailures: z.number().int().min(1).max(20),
    action: z.enum(["transfer_to_queue", "close", "stay_silent"]),
  }).passthrough(),
  behavior: z.object({
    mainFlowId: z.string().uuid(),
    autoReply: z.boolean(),
    welcomeNew: z.boolean(),
    welcomeKnown: z.boolean(),
    afterHuman: z.enum(["stay_closed", "return_to_bot", "restart_flow"]),
    timeoutMinutes: z.number().int().min(1).max(1440),
    timeoutAction: z.enum(["transfer_to_queue", "close", "restart_flow"]),
  }).passthrough(),
}).passthrough();

export const getAgentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    
    // Ensure default flow and agent settings exist for this tenant
    const { ensureDefaultWhatsAppFlow } = await import("./crm/bootstrap.server");
    await ensureDefaultWhatsAppFlow(establishmentId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isAIProviderUsable } = await import("./crm/ai-adapter.server");

    const { data: settingsData, error } = await (supabaseAdmin as any).from("crm_agent_settings")
      .select("enabled, flow_id, config")
      .eq("establishment_id", establishmentId)
      .maybeSingle();
      
    if (error) throw error;
    if (!settingsData) return null;

    const config = (settingsData.config || {}) as Record<string, any>;
    const providerUsable = await isAIProviderUsable(establishmentId, config.provider_id);

    return {
      ...config,
      enabled: settingsData.enabled,
      providerUsable,
      behavior: {
        ...(config.behavior || {}),
        mainFlowId: settingsData.flow_id
      }
    };
  });

export const saveAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => agentSettingsSchema.extend({ establishmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data: inputData, context }) => {
    const { userId, supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const establishmentId = await authorizeCRMEstablishment(supabase, userId, inputData.establishmentId);
    
    const {
      behavior,
      enabled,
      establishmentId: _establishmentId,
      providerUsable: _providerUsable,
      ...config
    } = inputData || {};

    const {
      mainFlowId: flowId,
      ...behaviorConfig
    } = behavior || {};

    if (flowId) {
      const { data: flow } = await supabaseAdmin.from("crm_flows").select("id").eq("id", flowId).eq("establishment_id", establishmentId).maybeSingle();
      if (!flow) throw new Error("Fluxo não pertence ao estabelecimento ativo.");
    }

    const { error } = await (supabaseAdmin as any).from("crm_agent_settings").upsert({
      establishment_id: establishmentId, 
      flow_id: flowId || null, 
      enabled: enabled ?? true,
      config: { ...config, behavior: behaviorConfig },
    }, { onConflict: "establishment_id" });

    if (error) throw error;
    return { ok: true };
  });

// --- TAGS ---
export const getCRMTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, input.establishmentId);
    const { data, error } = await (supabase as any).from("crm_tags").select("*").eq("establishment_id", establishmentId).order("name");
    if (error) throw error;
    return data || [];
  });

export const saveCRMTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.extend({ name: z.string(), color: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("crm_tags").insert({ name: data.name, color: data.color, establishment_id: establishmentId });
    if (error) throw error;
    return { ok: true };
  });

export const deleteCRMFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.extend({ flowId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_flows").delete().eq("id", data.flowId).eq("establishment_id", establishmentId);
    if (error) throw error;
    return { ok: true };
  });

export const duplicateCRMFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.extend({ flowId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: flow } = await supabaseAdmin.from("crm_flows").select("*, steps:crm_flow_steps!crm_flow_steps_flow_id_fkey(*)").eq("id", data.flowId).eq("establishment_id", establishmentId).single();
    if (!flow) throw new Error("Fluxo não encontrado");

    const { data: newFlow, error: flowErr } = await supabaseAdmin.from("crm_flows").insert({
      name: `${flow.name} (Cópia)`,
      description: flow.description,
      establishment_id: flow.establishment_id,
      is_active: false
    }).select("id").single();

    if (flowErr) throw flowErr;

    if (flow.steps && flow.steps.length > 0) {
      const stepsToInsert = remapCRMFlowSteps(flow.steps).map((s: any) => ({
        id: s.id,
        flow_id: newFlow.id,
        establishment_id: flow.establishment_id,
        step_key: s.step_key,
        payload: s.payload,
        sort_order: s.sort_order ?? 0
      }));
      const { error: stepsError } = await supabaseAdmin.from("crm_flow_steps").insert(stepsToInsert);
      if (stepsError) throw stepsError;
    }

    return { id: newFlow.id };
  });

// --- CRM CONTACTS ---
export const getCRMContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, input.establishmentId);
    
    // In CRM, contacts are the 'crm_contacts' table (manual/external) 
    // PLUS we might want to see 'profiles' (auth users).
    // The requirement says "crm_contacts" and "contact manual NÃO cria usuário Auth".
    const { data, error } = await (supabase as any)
      .from("crm_contacts")
      .select("*, tags:crm_contact_tags(tag:crm_tags(*))")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });

export const saveCRMContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishmentId: z.string().uuid(),
    id: z.string().uuid().optional(),
    name: z.string().min(2),
    phone: z.string().min(10),
    email: z.string().email().optional().nullable(),
    notes: z.string().optional().nullable()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);

    // Impedir telefone duplicado
    const phone = data.phone.replace(/\D/g, "");
    const { data: existing } = await (supabaseAdmin as any)
      .from("crm_contacts")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("phone", phone)
      .maybeSingle();
    
    if (existing && existing.id !== data.id) {
      throw new Error("Este número de telefone já está cadastrado.");
    }

    const { error } = await (supabaseAdmin as any)
      .from("crm_contacts")
      .upsert({
        id: data.id || undefined,
        establishment_id: establishmentId,
        name: data.name,
        phone: phone,
        email: data.email,
        notes: data.notes
      });

    if (error) throw error;
    return { ok: true };
  });

export const deleteCRMContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.extend({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { error } = await (supabaseAdmin as any)
      .from("crm_contacts")
      .delete()
      .eq("id", data.contactId)
      .eq("establishment_id", establishmentId);
    
    if (error) throw error;
    return { ok: true };
  });

// --- CRM TEMPLATES ---
export const getCRMTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, input.establishmentId);
    
    const { data, error } = await (supabase as any)
      .from("crm_templates")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });

export const saveCRMTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishmentId: z.string().uuid(),
    id: z.string().uuid().optional(),
    name: z.string().min(2),
    content: z.string().min(1),
    category: z.string().default("general"),
    is_active: z.boolean().default(true)
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any)
      .from("crm_templates")
      .upsert({
        id: data.id || undefined,
        establishment_id: establishmentId,
        name: data.name,
        body: data.content,
        category: data.category,
        is_active: data.is_active
      });


    if (error) throw error;
    return { ok: true };
  });

export const deleteCRMTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.extend({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { error } = await (supabaseAdmin as any)
      .from("crm_templates")
      .delete()
      .eq("id", data.templateId)
      .eq("establishment_id", establishmentId);
    
    if (error) throw error;
    return { ok: true };
  });

// --- CRM QUICK REPLIES ---
export const getCRMQuickReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenantSchema.parse(d))
  .handler(async ({ data: input, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, input.establishmentId);
    const { data, error } = await (supabase as any).from("crm_quick_replies").select("*").eq("establishment_id", establishmentId).order("shortcut");
    if (error) throw error;
    return data || [];
  });

export const saveCRMQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    establishmentId: z.string().uuid(),
    id: z.string().uuid().optional(),
    shortcut: z.string().min(2),
    message: z.string().min(1)
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const establishmentId = await authorizeCRMEstablishment(supabase, userId, data.establishmentId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("crm_quick_replies").upsert({ id: data.id, shortcut: data.shortcut, message: data.message, establishment_id: establishmentId });
    if (error) throw error;
    return { ok: true };
  });
