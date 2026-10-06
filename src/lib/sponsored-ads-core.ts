/**
 * Núcleo puro do módulo "Destaque Patrocinado".
 *
 * Sem dependências de servidor ou de rede: rótulos, transições de status,
 * validação de destino/criativo e cálculo de CTR. Usado tanto pelo painel
 * quanto pelas server functions, para que a regra seja idêntica nos dois lados.
 */

export const AD_STATUSES = [
  "draft",
  "pending_review",
  "changes_requested",
  "approved_awaiting_payment",
  "payment_pending",
  "payment_confirmed",
  "scheduled",
  "active",
  "paused",
  "expired",
  "rejected",
  "cancelled",
  "refund_pending",
  "refunded",
] as const;

export type AdStatus = (typeof AD_STATUSES)[number];

export const AD_STATUS_META: Record<
  AdStatus,
  { label: string; tone: "neutral" | "info" | "warn" | "success" | "danger"; hint: string }
> = {
  draft: { label: "Rascunho", tone: "neutral", hint: "Ainda não enviado para análise." },
  pending_review: { label: "Em análise", tone: "info", hint: "Nossa equipe está avaliando o anúncio." },
  changes_requested: { label: "Correção solicitada", tone: "warn", hint: "Ajuste o criativo e envie novamente." },
  approved_awaiting_payment: { label: "Aprovado — pague para publicar", tone: "success", hint: "Gere o PIX para ativar." },
  payment_pending: { label: "Aguardando pagamento", tone: "warn", hint: "PIX gerado, aguardando confirmação." },
  payment_confirmed: { label: "Pagamento confirmado", tone: "success", hint: "Preparando a publicação." },
  scheduled: { label: "Programado", tone: "info", hint: "Vai entrar no ar na data combinada." },
  active: { label: "No ar", tone: "success", hint: "Sendo exibido na vitrine Descobrir." },
  paused: { label: "Pausado", tone: "warn", hint: "Fora da rotação até ser retomado." },
  expired: { label: "Encerrado", tone: "neutral", hint: "O período contratado terminou." },
  rejected: { label: "Rejeitado", tone: "danger", hint: "O conteúdo não pôde ser aceito." },
  cancelled: { label: "Cancelado", tone: "neutral", hint: "Cancelado antes da ativação." },
  refund_pending: { label: "Reembolso em análise", tone: "warn", hint: "Solicitação de reembolso em andamento." },
  refunded: { label: "Reembolsado", tone: "neutral", hint: "Valor devolvido." },
};

/** Transições permitidas — validadas SEMPRE no backend. */
export const AD_TRANSITIONS: Record<AdStatus, AdStatus[]> = {
  draft: ["pending_review", "cancelled"],
  pending_review: ["changes_requested", "approved_awaiting_payment", "rejected", "cancelled"],
  changes_requested: ["pending_review", "cancelled"],
  approved_awaiting_payment: ["payment_pending", "cancelled", "scheduled", "active"],
  payment_pending: ["payment_confirmed", "approved_awaiting_payment", "cancelled"],
  payment_confirmed: ["scheduled", "active", "refund_pending"],
  scheduled: ["active", "paused", "cancelled", "refund_pending"],
  active: ["paused", "expired", "refund_pending"],
  paused: ["active", "expired", "refund_pending", "cancelled"],
  expired: ["refund_pending"],
  rejected: [],
  cancelled: [],
  refund_pending: ["refunded", "active", "expired"],
  refunded: [],
};

export function canTransition(from: AdStatus, to: AdStatus): boolean {
  return (AD_TRANSITIONS[from] ?? []).includes(to);
}

/** Estados em que o estabelecimento pode editar o criativo. */
export function isEditable(status: AdStatus): boolean {
  return status === "draft" || status === "changes_requested";
}

export const CTA_LABELS = [
  "Conhecer estabelecimento",
  "Ver oferta",
  "Ver catálogo",
  "Ver cardápio",
  "Ver benefícios",
  "Reservar",
  "Resgatar",
] as const;
export type CtaLabel = (typeof CTA_LABELS)[number];

export const OFFER_TYPES = [
  "discount",
  "percentage",
  "savings",
  "benefit",
  "loyalty",
  "reward",
  "institutional",
] as const;
export type AdOfferType = (typeof OFFER_TYPES)[number];

export const OFFER_TYPE_META: Record<AdOfferType, { label: string; hint: string }> = {
  discount: { label: "Preço com Desconto", hint: "Ex: De R$ 49 por R$ 34" },
  percentage: { label: "Percentual OFF", hint: "Ex: 20% OFF em todo site" },
  savings: { label: "Valor de Desconto", hint: "Ex: Economize R$ 15" },
  benefit: { label: "Benefício Extra", hint: "Ex: Ganhe uma sobremesa" },
  loyalty: { label: "Fidelidade Turbinada", hint: "Ex: Ganhe 2 carimbos extras" },
  reward: { label: "Recompensa Exclusiva", hint: "Ex: Resgate por 5 carimbos" },
  institutional: { label: "Institucional Afidelize", hint: "Campanha de marca ou aviso geral." },
};


export const DESTINATION_TYPES = ["establishment", "catalog", "menu", "linktree", "loyalty_card"] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const AD_DISPLAY_MODELS = ["premium_banner", "sponsored_feed", "carousel"] as const;
export type AdDisplayModel = (typeof AD_DISPLAY_MODELS)[number];

export const AD_DISPLAY_MODEL_META: Record<
  AdDisplayModel,
  {
    label: string;
    description: string;
    aspectRatio: string;
    recommendedRes: string;
    features: string[];
  }
> = {
  premium_banner: {
    label: "Premium Banner",
    description: "Banner patrocinado em destaque, ocupando um bloco próprio dentro da área Descobrir.",
    aspectRatio: "21:9",
    recommendedRes: "1260x540px",
    features: ["Maior destaque visual", "Criativo ocupando todo o bloco", "Selo Patrocinado", "CTA sobreposto", "Imagem full bleed"],
  },
  sponsored_feed: {
    label: "Sponsored Feed",
    description: "Anúncio integrado ao fluxo normal de estabelecimentos e conteúdos da área Descobrir.",
    aspectRatio: "21:9",
    recommendedRes: "1260x540px",
    features: ["Aparece entre conteúdos orgânicos", "Formato semelhante aos cards da plataforma", "Identificação clara Patrocinado", "Menos invasivo"],
  },
  carousel: {
    label: "Carousel",
    description: "Bloco horizontal de destaques patrocinados em formato de carrossel.",
    aspectRatio: "1:1",
    recommendedRes: "600x600px",
    features: ["Vários anúncios no mesmo espaço", "Swipe horizontal no mobile", "Seção Destaques para você", "Cada anúncio identificado como Patrocinado"],
  },
};


export const DESTINATION_META: Record<DestinationType, { label: string; description: string; path: string }> = {
  establishment: { label: "Página do estabelecimento", description: "Perfil público com dados e benefícios.", path: "/e" },
  catalog: { label: "Catálogo", description: "Vitrine de produtos com pedidos.", path: "/catalogo" },
  menu: { label: "Cardápio", description: "Cardápio digital em modo stories.", path: "/cardapio" },
  linktree: { label: "Bio Commerce", description: "Sua página única de links.", path: "/links" },
  loyalty_card: { label: "Cartão fidelidade", description: "Página pública do cartão.", path: "/cartao" },
};

/** Monta o caminho interno do destino. Nunca aceita URL externa. */
export function destinationPath(type: DestinationType, slug: string): string {
  const meta = DESTINATION_META[type];
  const clean = String(slug || "").replace(/[^a-zA-Z0-9-_]/g, "");
  if (!meta || !clean) return "/";
  return `${meta.path}/${clean}`;
}

export const AD_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const AD_IMAGE_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
export const AD_TITLE_MAX = 60;
export const AD_DESCRIPTION_MAX = 140;

/** Remove tags/entidades e normaliza espaços. Nada de HTML nos criativos. */
export function sanitizeAdText(input: unknown, max: number): string {
  const raw = typeof input === "string" ? input : "";
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-zA-Z#0-9]+;/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function ctr(impressions: number, clicks: number): number {
  if (!impressions || impressions <= 0) return 0;
  return Math.round((clicks / impressions) * 1000) / 10;
}

export function daysBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 0;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function daysRemaining(endsAt: string | null): number {
  if (!endsAt) return 0;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function formatCents(cents: number | null | undefined, currency = "BRL"): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

/**
 * Identificador de sessão anônimo, próprio da plataforma.
 * Não contém dados pessoais; existe apenas para deduplicar métricas.
 */
export const AD_SESSION_KEY = "fidelize:ads:sid";

export function getAdSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = localStorage.getItem(AD_SESSION_KEY);
    if (!sid || sid.length < 16) {
      sid = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, "");
      localStorage.setItem(AD_SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}
