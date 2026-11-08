/**
 * Atendimento institucional da Fidelize: bot de regras, sem chamadas de IA.
 * Lógica pura compartilhada com testes e preview.
 */
export type SupportMode = "bot" | "ai";
export type SupportChoice = "support" | "plans" | "suggestions" | "menu" | "end_support" | null;

export const PLATFORM_SUPPORT_OPTIONS = [
  { label: "Suporte", value: "fidelize_support" },
  { label: "Planos", value: "fidelize_plans" },
  { label: "Sugestões", value: "fidelize_suggestions" },
] as const;

export const SUPPORT_MENU_TEXT = "Olá! Você está falando com a Fidelize. Como podemos ajudar? Escolha uma das opções:";
export const SUPPORT_QUEUE_TEXT = "Você está na fila de suporte. Nossa equipe atenderá assim que possível. Se não quiser aguardar, selecione Encerrar atendimento.";
export const SUPPORT_CLOSED_TEXT = "Atendimento encerrado a seu pedido. Quando precisar, envie menu para iniciar novamente.";
export const SUPPORT_SUGGESTION_REQUEST = "Queremos ouvir você! Envie sua sugestão em uma única mensagem. Ela será registrada para nossa equipe.";
export const SUPPORT_SUGGESTION_RECEIVED = "Obrigado! Sua sugestão foi registrada e encaminhada para avaliação da nossa equipe.";
export const SUPPORT_NO_PLANS_TEXT = "Nossos planos estão sendo atualizados. Para consultar condições, escolha Suporte no menu.";

/** Botão separado dos CTAs de link, compatível também com WhatsApp Web. */
export const PLATFORM_BACK_TO_MENU_OPTIONS = [
  { label: "Voltar ao menu", value: "fidelize_menu" },
] as const;

export const PLATFORM_SUPPORT_WAITING_OPTIONS = [
  { label: "Voltar ao menu", value: "fidelize_menu" },
  { label: "Encerrar atendimento", value: "fidelize_end_support" },
] as const;

function normalize(text: string): string {
  return String(text ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").trim().replace(/\s+/g, " ");
}

/** Aceita os IDs dos botões e os nomes; nunca apresenta fallback numérico. */
export function resolvePlatformSupportChoice(text: string): SupportChoice {
  const value = normalize(text);
  if (["menu", "voltar", "inicio", "voltar ao menu", "fidelize_menu"].includes(value)) return "menu";
  if (["fidelize_end_support", "encerrar atendimento", "cancelar atendimento", "cancelar suporte", "encerrar"].includes(value)) return "end_support";
  if (["fidelize_support", "suporte", "falar com suporte"].includes(value)) return "support";
  if (["fidelize_plans", "planos", "ver planos"].includes(value)) return "plans";
  if (["fidelize_suggestions", "sugestoes", "enviar sugestao"].includes(value)) return "suggestions";
  return null;
}

export type PublicPlan = {
  name: string;
  slug?: string | null;
  description?: string | null;
  price_monthly?: number | string | null;
  price_yearly?: number | string | null;
  currency?: string | null;
};
function money(value: number | string | null | undefined, currency: string) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value));
}

/** Card curto para o WhatsApp; preços e descrição sempre vêm da base ativa. */
export function formatPlatformPlanCard(plan: PublicPlan): string {
  const currency = plan.currency || "BRL";
  const monthly = money(plan.price_monthly, currency);
  const yearly = money(plan.price_yearly, currency);
  const lines = ["*" + String(plan.name).trim() + "*"];
  if (monthly !== null) lines.push("Mensal: " + monthly);
  if (yearly !== null) lines.push("Anual: " + yearly);
  if (monthly === null && yearly === null) lines.push("Valor sob consulta");
  if (plan.description) lines.push(String(plan.description).replace(/\s+/g, " ").trim().slice(0, 240));
  return lines.join("\n");
}

/** Link para o plano selecionado na seção real da landing, nunca checkout direto. */
export function platformPlanLandingUrl(plan: PublicPlan): string {
  const alias: Record<string, string> = {
    essencial: "essencial", profissional: "profissional", premium: "ilimitado",
    ilimitado: "ilimitado", empresarial: "empresarial",
  };
  const normalizeName = (value: string) =>
    value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const selected = alias[normalizeName(String(plan.slug || ""))]
    || alias[normalizeName(String(plan.name || ""))];
  return selected
    ? "https://afidelize.app/?plano=" + encodeURIComponent(selected) + "#precos"
    : "https://afidelize.app/#precos";
}

/** Apenas dados vindos de planos ativos e não arquivados do banco. */
export function formatPlatformPlans(plans: PublicPlan[]): string {
  if (!plans.length) return SUPPORT_NO_PLANS_TEXT;
  const lines = ["*Planos Fidelize*", ""];
  for (const plan of plans.slice(0, 8)) {
    const currency = plan.currency || "BRL";
    const monthly = money(plan.price_monthly, currency);
    const yearly = money(plan.price_yearly, currency);
    lines.push("*" + plan.name + "*");
    if (monthly !== null) lines.push("Mensal: " + monthly);
    if (yearly !== null) lines.push("Anual: " + yearly);
    if (monthly === null && yearly === null) lines.push("Valor sob consulta");
    if (plan.description) lines.push(String(plan.description).replace(/\s+/g, " ").slice(0, 160));
    lines.push("");
  }
  lines.push("Para voltar às opções, envie *menu*.");
  return lines.join("\n");
}

export function platformSupportMode(value: unknown): SupportMode {
  return value === "ai" ? "ai" : "bot";
}
