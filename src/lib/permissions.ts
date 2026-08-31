// Catálogo central de permissões usadas em toda a plataforma.
// Cada ação tem um label amigável e um grupo, para o painel de edição por membro.
// A lógica de decisão está em `member_can` no banco e em `usePermissions()` no cliente.

export type PermissionAction =
  | "stamping.use"
  | "inbox.use"
  | "customers.view"
  | "customers.edit"
  | "customers.import"
  | "customers.export"
  | "campaigns.manage"
  | "retention.manage"
  | "reviews.view"
  | "reviews.reply"
  | "qr.manage"
  | "linktree.manage"
  | "menu.manage"
  | "ads.manage"
  | "push.send"
  | "promotions.manage"
  | "messages.manage"
  | "analytics.view"
  | "support.open"
  | "support.reply"
  | "settings.branding"
  | "settings.integrations"
  | "settings.wallet"
  | "team.manage"
  | "team.roles.manage"
  | "billing.manage";


export type MemberRole = "owner" | "manager" | "staff";

export type PermissionEntry = {
  action: PermissionAction;
  label: string;
  description: string;
  group: "operacao" | "marketing" | "reputacao" | "comunicacao" | "analytics" | "suporte" | "config";
  ownerOnly?: boolean; // não pode ser concedida a staff/manager
};

export const PERMISSION_CATALOG: PermissionEntry[] = [
  // Operação
  { action: "stamping.use",       group: "operacao", label: "Carimbar clientes",         description: "Adicionar/remover carimbos e resgatar recompensas." },
  { action: "inbox.use",          group: "comunicacao", label: "Central de Atendimento", description: "Responder conversas do WhatsApp, assumir e finalizar atendimentos." },
  { action: "customers.view",     group: "operacao", label: "Ver base de clientes",      description: "Consultar clientes, histórico e cartões." },
  { action: "customers.edit",     group: "operacao", label: "Editar clientes",           description: "Criar, editar e excluir clientes." },
  { action: "customers.import",   group: "operacao", label: "Importar CSV",              description: "Importar clientes em massa via planilha." },
  { action: "customers.export",   group: "operacao", label: "Exportar dados",            description: "Baixar relatórios e listas em CSV/PDF." },

  // Marketing
  { action: "campaigns.manage",   group: "marketing", label: "Campanhas",                description: "Criar e gerenciar campanhas de fidelidade." },
  { action: "retention.manage",   group: "marketing", label: "Retenção & níveis",        description: "Configurar níveis, aniversário e reengajamento." },
  { action: "promotions.manage",  group: "marketing", label: "Promoções",                description: "Criar cupons e promoções." },
  { action: "messages.manage",    group: "marketing", label: "Mensagens semanais",       description: "Publicar mensagens para os clientes." },

  // Reputação
  { action: "reviews.view",       group: "reputacao", label: "Ver avaliações",           description: "Consultar avaliações recebidas." },
  { action: "reviews.reply",      group: "reputacao", label: "Responder avaliações",     description: "Publicar respostas públicas." },
  { action: "qr.manage",          group: "reputacao", label: "QR Codes",                 description: "Editar cartazes, banners e materiais de QR." },
  { action: "linktree.manage",    group: "reputacao", label: "Árvore de links",          description: "Editar página pública de links." },
  { action: "menu.manage",        group: "reputacao", label: "Cardápio Virtual",         description: "Criar e publicar o cardápio digital do restaurante." },

  // Anúncios
  { action: "ads.manage",         group: "marketing", label: "Anúncios em destaque",     description: "Criar e acompanhar campanhas patrocinadas na vitrine Descobrir." },

  // Comunicação
  { action: "push.send",          group: "comunicacao", label: "Notificações push",      description: "Disparar notificações para clientes." },

  // Analytics
  { action: "analytics.view",     group: "analytics", label: "Ver analytics",            description: "Ver métricas de engajamento e canais." },

  // Suporte
  { action: "support.open",       group: "suporte",  label: "Abrir tickets",             description: "Criar tickets no suporte Fidelize." },
  { action: "support.reply",      group: "suporte",  label: "Responder tickets internos", description: "Responder tickets abertos pela equipe." },

  // Configurações sensíveis
  { action: "settings.branding",     group: "config", label: "Identidade & branding",    description: "Alterar logo, cores, nome público." },
  { action: "settings.integrations", group: "config", label: "Integrações",              description: "Gerenciar Mercado Pago, Asaas, webhooks, API." },
  { action: "settings.wallet",       group: "config", label: "Wallet (Apple/Google)",    description: "Configurar cartão na Wallet." },
  { action: "team.manage",           group: "config", label: "Equipe",                   description: "Convidar e gerenciar atendentes." },
  { action: "team.roles.manage",     group: "config", label: "Alterar papéis da equipe", description: "Promover/rebaixar donos, gerentes e atendentes.", ownerOnly: true },
  { action: "billing.manage",        group: "config", label: "Planos & cobrança",        description: "Alterar plano, ver faturas, mudar meio de pagamento.", ownerOnly: true },
];

export const GROUP_LABELS: Record<PermissionEntry["group"], string> = {
  operacao:    "Operação",
  marketing:   "Marketing",
  reputacao:   "Reputação",
  comunicacao: "Comunicação",
  analytics:   "Analytics",
  suporte:     "Suporte",
  config:      "Configurações sensíveis",
};

// Presets padrão por papel (usado apenas para exibir o "estado herdado" na UI;
// a decisão real vive em `public.member_can`).
export function defaultPreset(role: MemberRole, action: PermissionAction): boolean {
  if (role === "owner") return true;
  if (role === "manager") {
    return action !== "billing.manage" && action !== "team.roles.manage";
  }
  // staff
  return (
    action === "stamping.use" ||
    action === "inbox.use" ||
    action === "customers.view" ||
    action === "customers.edit" ||
    action === "reviews.view" ||
    action === "reviews.reply" ||
    action === "push.send" ||
    action === "support.open" ||
    action === "support.reply" ||
    action === "analytics.view"
  );
}

// Rotas → ação que a controla (usado para filtrar o menu lateral).
export const ROUTE_PERMISSIONS: Record<string, PermissionAction> = {
  "/app/carimbar":     "stamping.use",
  "/app/clientes":     "customers.view",
  "/app/campanhas":    "campaigns.manage",
  "/app/retencao":     "retention.manage",
  "/app/avaliacoes":   "reviews.view",
  "/app/qr":           "qr.manage",
  "/app/linktree":     "linktree.manage",
  "/app/cardapio":     "menu.manage",
  "/app/catalogo":     "menu.manage",
  "/app/pedidos":      "menu.manage",

  "/app/notificacoes": "push.send",
  "/app/promocoes":    "promotions.manage",
  "/app/mensagens":    "messages.manage",
  "/app/analytics":    "analytics.view",
  "/app/equipe":       "team.manage",
  "/app/planos":       "billing.manage",
  "/app/pagamentos":   "billing.manage",
  "/app/anuncios":     "ads.manage",
};
