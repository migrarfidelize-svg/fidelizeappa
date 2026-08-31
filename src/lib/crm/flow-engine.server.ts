import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEFAULT_SUPPORT_TERMS = ["5", "suporte", "atendente", "falar com atendente", "falar com suporte", "humano", "ajuda humana"];
const stepType = (step: any) => step?.payload?.type || step?.step_key;

function nextStep(step: any, steps: any[]) {
  const configuredId = step?.payload?.nextStepId;
  if (configuredId) return steps.find((candidate: any) => candidate.id === configuredId);
  return steps.find((candidate: any) => candidate.sort_order === step.sort_order + 1);
}

export type AgentBehavior = {
  autoReply?: boolean;
  welcomeNew?: boolean;
  welcomeKnown?: boolean;
  timeoutMinutes?: number;
  timeoutAction?: "transfer_to_queue" | "close" | "restart_flow";
};

export function shouldWelcomeContact(behavior: AgentBehavior, isNewContact: boolean) {
  return isNewContact ? behavior.welcomeNew !== false : behavior.welcomeKnown !== false;
}

export function timedOutAction(behavior: AgentBehavior, stateUpdatedAt: string | undefined, now = Date.now()) {
  if (!stateUpdatedAt || !behavior.timeoutMinutes) return null;
  return now - new Date(stateUpdatedAt).getTime() >= behavior.timeoutMinutes * 60_000
    ? (behavior.timeoutAction || "transfer_to_queue")
    : null;
}

export function fallbackDecision(fallback: any, previousFailures: number) {
  const failures = previousFailures + 1;
  return { failures, action: failures >= (fallback?.maxFailures || 3) ? (fallback?.action || "transfer_to_queue") : "retry" };
}

export function afterHumanTransition(afterHuman: "stay_closed" | "return_to_bot" | "restart_flow" | undefined) {
  if (!afterHuman || afterHuman === "stay_closed") return { reopen: false, restart: false };
  return { reopen: true, restart: afterHuman === "restart_flow" };
}

async function sendAndPersist(conv: any, text: string, options: any = {}, source = "flow") {
  const { getActiveWhatsAppProvider } = await import("../otp.functions");
  const active = await getActiveWhatsAppProvider(conv.establishment_id);
  if (!active) throw new Error("CRM_WHATSAPP_PROVIDER_NOT_FOUND");
  const providerEnv = { ...process.env } as Record<string, string | undefined>;
  for (const [field, envName] of Object.entries(active.runtime.credentials_ref || {})) {
    const credential = active.runtime.db_credentials?.[field];
    if (credential) providerEnv[envName] = credential;
  }
  const sent = await active.provider.sendTestMessage(active.runtime, providerEnv, conv.customer_phone, text, options);
  if (!sent.ok) throw new Error(sent.message || "CRM_WHATSAPP_SEND_FAILED");
  const persisted = await supabaseAdmin.from("crm_messages").insert({
    conversation_id: conv.id, establishment_id: conv.establishment_id, body: text,
    direction: "outbound", provider: active.provider.meta.id,
    provider_message_id: sent.providerMessageId || `${source}-${crypto.randomUUID()}`,
    message_type: "text", metadata: { source },
  });
  if (persisted.error) throw persisted.error;
}

async function updateState(conv: any, flowId: string | null, stepId: string | null, extra: Record<string, unknown> = {}) {
  const metadata = (conv.metadata as Record<string, unknown>) || {};
  const flowState = { ...((metadata.flow_state as object) || {}), flowId, stepId, updatedAt: new Date().toISOString(), ...extra };
  const result = await supabaseAdmin.from("crm_conversations").update({
    metadata: { ...metadata, flow_state: flowState },
  }).eq("id", conv.id).eq("establishment_id", conv.establishment_id);
  if (result.error) throw result.error;
  conv.metadata = { ...metadata, flow_state: flowState };
}

async function handoff(conv: any, confirmation: string) {
  const existing = await (supabaseAdmin as any).from("crm_support_tickets").select("id")
    .eq("conversation_id", conv.id).eq("establishment_id", conv.establishment_id).in("status", ["open", "in_progress"]).maybeSingle();
  if (existing.error) throw existing.error;
  let ticketId = (existing.data as any)?.id;
  if (!ticketId) {
    const ticket = await (supabaseAdmin as any).from("crm_support_tickets").insert({
      conversation_id: conv.id, establishment_id: conv.establishment_id, status: "open",
    }).select("id").single();
    if (ticket.error || !ticket.data) throw ticket.error ?? new Error("CRM_SUPPORT_TICKET_FAILED");
    ticketId = (ticket.data as any).id;
  }
  
  const metadata = { 
    ...((conv.metadata as object) || {}), 
    support: { active: true, ticketId }, 
    flow_state: { mode: "manual", flowId: null, stepId: null } 
  };
  
  const updated = await supabaseAdmin.from("crm_conversations").update({
    status: "waiting", assigned_to: null, assigned_at: null, metadata,
  }).eq("id", conv.id).eq("establishment_id", conv.establishment_id);
  
  if (updated.error) throw updated.error;
  
  if (!(conv.metadata as any)?.support?.active) {
    await sendAndPersist(conv, confirmation, {}, "support_handoff");
  }
  
  return { ok: true, action: "handoff" } as const;
}

async function closeConversation(conv: any, message?: string) {
  const result = await supabaseAdmin.from("crm_conversations").update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", conv.id).eq("establishment_id", conv.establishment_id);
  if (result.error) throw result.error;
  if (message) await sendAndPersist(conv, message, {}, "agent_close");
  return { ok: true, action: "closed" } as const;
}

async function applyConfiguredAction(conv: any, action: string, config: any, flowId: string) {
  if (action === "transfer_to_queue") return handoff(conv, config.handoff?.message || config.fallback?.message || "Vou encaminhar você para nossa equipe.");
  if (action === "close") return closeConversation(conv, config.fallback?.message);
  if (action === "restart_flow") {
    await updateState(conv, flowId, null, { mode: null, failures: 0 });
    return { ok: true, action: "restart_flow" } as const;
  }
  return { ok: true, action: "stay_silent" } as const;
}

async function loadActiveFlow(establishmentId: string, flowId: string) {
  const flowResult = await supabaseAdmin.from("crm_flows")
    .select("*, steps:crm_flow_steps!crm_flow_steps_flow_id_fkey(*)")
    .eq("id", flowId).eq("establishment_id", establishmentId).eq("is_active", true).single();
  if (flowResult.error || !flowResult.data) throw flowResult.error ?? new Error("CRM_FLOW_NOT_FOUND");
  return { flow: flowResult.data, steps: (flowResult.data.steps || []).sort((a: any, b: any) => a.sort_order - b.sort_order) };
}

async function startFlow(conv: any, steps: any[], config: any, behavior: AgentBehavior) {
  const isNewContact = (conv.metadata as any)?.contact_is_new === true;
  const welcome = shouldWelcomeContact(behavior, isNewContact);
  const menuStep = steps.find((step: any) => stepType(step) === "options") || steps[0];
  if (welcome && config.presentation) await sendAndPersist(conv, config.presentation, {}, "agent_welcome");
  if (isNewContact) conv.metadata = { ...((conv.metadata as object) || {}), contact_is_new: false };
  const start = welcome && !config.presentation ? steps[0] : menuStep;
  return processStep(conv, start, steps);
}

export type FlowActionResult = { ok: boolean; action: string; error?: unknown };

export async function processStep(conv: any, step: any, steps: any[]): Promise<FlowActionResult> {
  if (!step) return { ok: false, action: "error", error: "Step is null" };
  const payload = step.payload as any;
  switch (stepType(step)) {
    case "message": {
      await sendAndPersist(conv, payload.text || "");
      await updateState(conv, step.flow_id, step.id);
      const next = nextStep(step, steps);
      return next ? processStep(conv, next, steps) : { ok: true, action: "end" };
    }
    case "options":
      await sendAndPersist(conv, payload.text || "Escolha:", { type: "options", options: payload.options || [] });
      await updateState(conv, step.flow_id, step.id);
      return { ok: true, action: "menu" };
    case "transfer_to_queue":
      return handoff(conv, payload.text || "Entendi. Vou encaminhar você para nossa equipe de suporte. 💜");
    case "agent":
      await sendAndPersist(conv, payload.text || "Perfeito! Conte o que precisa. 💜");
      await updateState(conv, step.flow_id, step.id, { mode: "agent" });
      return { ok: true, action: "agent" };
    case "close": {
      const update = await supabaseAdmin.from("crm_conversations").update({
        status: "closed",
        closed_at: new Date().toISOString(),
      }).eq("id", conv.id).eq("establishment_id", conv.establishment_id);
      if (update.error) throw update.error;
      if (payload.text) await sendAndPersist(conv, payload.text, {}, "flow_close");
      return { ok: true, action: "closed" };
    }
    default:
      return { ok: true, action: "end" };
  }
}

export async function executeFlow(conversationId: string, messageBody: string): Promise<FlowActionResult> {
  const conversationResult = await supabaseAdmin.from("crm_conversations").select("*").eq("id", conversationId).single();
  if (conversationResult.error || !conversationResult.data) throw conversationResult.error ?? new Error("CRM_CONVERSATION_NOT_FOUND");
  const conv = conversationResult.data;
  
  if (conv.status !== "bot" || (conv as any).bot_paused === true || (conv.metadata as any)?.support?.active) return { ok: true, action: "ignored" };

  const input = messageBody.trim().toLocaleLowerCase("pt-BR");

  const settingsResult = await (supabaseAdmin as any).from("crm_agent_settings").select("flow_id, enabled, config")
    .eq("establishment_id", conv.establishment_id).maybeSingle();
  if (settingsResult.error) throw settingsResult.error;
  
  if (!(settingsResult.data as any)?.enabled) return { ok: true, action: "ignored" };
  
  const config = ((settingsResult.data as any).config as any) || {};
  const behavior = config.behavior || {};
  if (behavior.autoReply === false) return { ok: true, action: "ignored" };
  const customKeywords = Array.isArray(config.handoff?.keywords) ? config.handoff.keywords : [];
  const supportTerms = [...new Set([...DEFAULT_SUPPORT_TERMS, ...customKeywords])];

  if (supportTerms.some((term) => input === term || (term.length > 3 && input.includes(term)))) {
    return handoff(conv, config.handoff?.message || "Entendi. Vou encaminhar você para nossa equipe de suporte. 💜");
  }

  let state = (conv.metadata as any)?.flow_state;
  const flowId = state?.flowId || (settingsResult.data as any).flow_id;

  const timeoutAction = timedOutAction(behavior, state?.updatedAt);
  if (timeoutAction) {
    const timeoutResult = await applyConfiguredAction(conv, timeoutAction, config, flowId);
    if (timeoutResult.action !== "restart_flow") return timeoutResult;
    state = null;
    conv.metadata = { ...((conv.metadata as object) || {}), flow_state: null };
  }
  
  const { steps } = await loadActiveFlow(conv.establishment_id, flowId);

  if (input === "menu" || input === "voltar") return processStep(conv, steps.find((s: any) => stepType(s) === "options"), steps);

  if (state?.mode === "agent") {
    const { processAgentMessage } = await import("./agent-engine.server");
    const agentResult = await processAgentMessage({ conversationId, inboundText: messageBody, flowId, stepId: state.stepId });
    
    if (agentResult.action === "handoff_requested") {
      return handoff(conv, config.handoff?.message || "Entendi. Vou encaminhar você para nossa equipe de suporte. 💜");
    }
    if (agentResult.action === "failed") {
      const decision = fallbackDecision(config.fallback, Number(state?.failures || 0));
      await updateState(conv, flowId, state.stepId, { failures: decision.failures });
      if (config.fallback?.message) await sendAndPersist(conv, config.fallback.message, {}, "agent_fallback");
      if (decision.action !== "retry") return applyConfiguredAction(conv, decision.action, config, flowId);
      return { ok: true, action: "fallback" };
    }
    
    return { ok: true, action: "agent" };
  }
  
  if (state?.stepId) {
    const current = steps.find((s: any) => s.id === state.stepId);
    if (current && stepType(current) === "options") {
      const option = ((current.payload as any)?.options || []).find((item: any) => item.value === input);
      if (option) return processStep(conv, steps.find((s: any) => s.id === option.nextStepId), steps);
      const decision = fallbackDecision(config.fallback, Number(state?.failures || 0));
      await updateState(conv, flowId, current.id, { failures: decision.failures });
      if (config.fallback?.message) await sendAndPersist(conv, config.fallback.message, {}, "flow_fallback");
      if (decision.action !== "retry") return applyConfiguredAction(conv, decision.action, config, flowId);
      return { ok: true, action: "fallback" };
    }
  }
  
  return startFlow(conv, steps, config, behavior);
}

let processingTimeouts = false;
let timeoutWorker: ReturnType<typeof setInterval> | undefined;

/** Processes persisted, tenant-scoped CRM flow timeouts. Safe to call repeatedly. */
export async function processCRMTimeouts(now = Date.now()) {
  if (processingTimeouts) return { processed: 0, skipped: true };
  processingTimeouts = true;
  let processed = 0;
  try {
    // Snapshot every bot conversation before changing any status. Offset is
    // therefore stable and no candidate after a full batch can be skipped.
    const candidates: any[] = [];
    const batchSize = 200;
    for (let offset = 0; ; offset += batchSize) {
      const page = await supabaseAdmin.from("crm_conversations").select("*")
        .eq("status", "bot").range(offset, offset + batchSize - 1);
      if (page.error) throw page.error;
      candidates.push(...(page.data || []));
      if (!page.data || page.data.length < batchSize) break;
    }
    for (const conv of candidates) {
      try {
        const state = (conv.metadata as any)?.flow_state;
        const updatedAt = state?.updatedAt;
        if (!conv.establishment_id || !updatedAt || state?.timeoutHandledFor === updatedAt) continue;
        const settingsResult = await (supabaseAdmin as any).from("crm_agent_settings").select("flow_id, enabled, config")
          .eq("establishment_id", conv.establishment_id).maybeSingle();
        if (settingsResult.error || !(settingsResult.data as any)?.enabled) continue;
        const settings = settingsResult.data as any;
        const config = settings.config || {};
        const action = timedOutAction(config.behavior || {}, updatedAt, now);
        if (!action) continue;
        const flowId = state.flowId || settings.flow_id;
        if (!flowId) continue;
        if (action !== "restart_flow") {
          await applyConfiguredAction(conv, action, config, flowId);
        } else {
          // Claim this persisted state before sending, then immediately start the
          // configured presentation/menu instead of waiting for another inbound message.
          await updateState(conv, flowId, null, { mode: null, failures: 0, timeoutHandledFor: updatedAt });
          const { steps } = await loadActiveFlow(conv.establishment_id, flowId);
          await startFlow(conv, steps, config, config.behavior || {});
        }
        processed += 1;
      } catch (error) {
        console.error("[CRM timeout worker] conversation processing failed", { conversationId: conv.id });
      }
    }
    return { processed, skipped: false };
  } finally {
    processingTimeouts = false;
  }
}

/** Starts once with the Node server entry; the timer itself is not the source of truth. */
export function startCRMTimeoutWorker() {
  if (timeoutWorker) return;
  const run = () => void processCRMTimeouts().catch(() => console.error("[CRM timeout worker] cycle failed"));
  run();
  timeoutWorker = setInterval(run, 60_000);
  timeoutWorker.unref?.();
}
