import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getAdminStatus } from "@/lib/admin.functions";
import { checkMyFeature } from "@/lib/plans.functions";
import { Logo } from "@/components/Logo";
import { LogoMark } from "@/components/LogoMark";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Stamp, QrCode, LogOut, Sparkles, ChevronDown, ChevronRight, UsersRound, Shield, Mic,
  LifeBuoy, BookOpen, Package, Receipt, HeartHandshake, Bell, Star, Menu,
  PanelLeftClose, PanelLeftOpen, Compass, Megaphone, UserCircle2, MessageSquare, BarChart3,
  Link2, UtensilsCrossed, ShoppingBag, FolderTree, LayoutList, Wallet, CreditCard,
  Palette,
} from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickSearch } from "@/components/merchant/QuickSearch";
import { GuidedTour, type TourStep } from "@/components/GuidedTour";
import { PageGuidePrompt } from "@/components/merchant/PageGuidePrompt";
import { PageGuideButton } from "@/components/merchant/PageGuideButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { usePermissions } from "@/hooks/usePermissions";
import { RouteLoading } from "@/components/RouteLoading";
import { PanelTransition } from "@/components/PanelTransition";
import { ROUTE_PERMISSIONS } from "@/lib/permissions";
import { getAuthenticatedAccountAccess } from "@/lib/account-access.functions";

const MERCHANT_TOUR_STEPS: TourStep[] = [
  { preview: "welcome", title: "Bem-vindo à Fidelize!", description: "Vamos dar um tour completo pelas áreas da plataforma. Leva cerca de 2 minutos e você já sai sabendo usar tudo." },
  { preview: "dashboard", title: "Painel em tempo real", description: "Acompanhe carimbos, clientes ativos, recompensas resgatadas e sua meta do mês em tempo real." },
  { preview: "stamp", title: "Carimbar cliente", description: "Adicione carimbos por busca, leitura do QR Code do voucher ou câmera. É o coração operacional do dia a dia." },
  { preview: "customers", title: "Base de clientes", description: "Todos os seus clientes fidelizados com filtros avançados, importação em CSV, ações em massa e histórico de cada visita." },
  { preview: "campaigns", title: "Campanhas e cartão", description: "Crie e personalize seus cartões: quantos carimbos, qual recompensa, ícones, cores, validade e regras de bônus." },
  { preview: "qrcodes", title: "QR Code e materiais gráficos", description: "Gere cartazes prontos para Instagram, Story, balcão e mesa (7x10cm). Baixe em alta resolução e escolha o destino do QR." },
  { preview: "campaigns", title: "Cardápio digital", description: "Monte seu cardápio online com fotos, categorias, preços e QR por mesa ou balcão — tudo com link público próprio." },
  { preview: "customers", title: "Avaliações", description: "Receba avaliações dos clientes após o atendimento, acompanhe a nota média e responda quem avaliou." },
  { preview: "qrcodes", title: "Árvore de links", description: "Uma página única com seus links: WhatsApp, redes sociais, cardápio, promoções e cartão fidelidade." },
  { preview: "campaigns", title: "Notificações e retenção", description: "Envie push segmentado, veja a prévia do público antes de disparar e ative rotinas de aniversário, inatividade e níveis." },
  { preview: "dashboard", title: "Analytics", description: "Veja de onde vêm os acessos (cardápio, árvore de links, avaliações, cartão), evolução de carimbos e engajamento." },
  { preview: "customers", title: "Equipe e permissões", description: "Convide atendentes, defina o que cada um pode acessar e acompanhe tudo pelos logs de auditoria." },
  { preview: "dashboard", title: "Configurações", description: "Dados do negócio, logo, horários, integrações, e-mails e preferências ficam centralizados nas Configurações." },
  { preview: "plans", title: "Seu plano e suporte", description: "Acompanhe o uso do plano, faça upgrade quando precisar e abra chamados no Help Desk direto pelo painel." },
];

/** No celular o tour cobre as mesmas áreas, em textos curtos. */
const MERCHANT_TOUR_STEPS_MOBILE: TourStep[] = [
  { preview: "welcome", title: "Bem-vindo!", description: "Tour rápido pelas áreas do painel no celular." },
  { preview: "stamp", title: "Carimbar é aqui", description: "O botão “Carimbar” na barra de baixo abre a busca do cliente e o leitor de QR Code." },
  { preview: "dashboard", title: "Painel do dia", description: "Carimbos de hoje, clientes ativos e recompensas resgatadas em tempo real." },
  { preview: "customers", title: "Clientes", description: "Busque qualquer cliente, veja o histórico e importe sua base por CSV." },
  { preview: "campaigns", title: "Campanhas", description: "Defina quantos carimbos valem a recompensa e personalize o cartão." },
  { preview: "qrcodes", title: "QR e materiais", description: "Em “Mais” você gera cartazes e materiais prontos para o balcão e o Instagram." },
  { preview: "campaigns", title: "Cardápio digital", description: "Cardápio online com fotos e QR por mesa, em “Mais”." },
  { preview: "customers", title: "Avaliações", description: "Acompanhe notas e comentários dos clientes após o atendimento." },
  { preview: "campaigns", title: "Notificações", description: "Dispare push para seus clientes e ative rotinas automáticas de retenção." },
  { preview: "plans", title: "Plano e suporte", description: "Veja o uso do plano, faça upgrade e fale com o suporte em “Mais”." },
];




/** Rotas liberadas mesmo sem assinatura ativa (pagamento, perfil e suporte de cobrança). */
const BILLING_EXEMPT = ["/app/planos", "/app/perfil", "/app/checkout", "/app/assinatura"];

function isBillingExempt(pathname: string) {
  return BILLING_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: async ({ location }) => {
    // 1. Validar papéis básicos (Super Admin e Customer)
    try {
      const { resolveAuthenticatedDestination } = await import("@/lib/destination-resolver");
      const to = await resolveAuthenticatedDestination();
      if (to === "/onboarding" || to === "/carteira") throw redirect({ to });
    } catch (e) {
      if (e && typeof e === "object" && ("isRedirect" in e || "to" in e)) throw e;
      // Fail-open para erros transitórios: o componente lida com loading
    }

    // 2. Subscription Gate
    // Se estiver em uma rota isenta, não bloqueamos.
    if (isBillingExempt(location.pathname)) return;

    try {
      // Usamos o cliente browser que já tem o cabeçalho de auth injetado pelo router.
      // my_subscription_gate é SECURITY DEFINER, então resolve permissões de leitura no banco.
      const { data, error } = await supabase.rpc("my_subscription_gate");
      
      if (error) {
        console.error("[app] erro no subscription gate:", error);
        // Em caso de erro de rede ou permissão na RPC, mandamos para planos como fallback seguro
        throw redirect({ to: "/app/planos", search: { gate: "error", code: error.code } as any });
      }

      const gate = (data ?? {}) as { has_establishment?: boolean; active?: boolean; super_admin?: boolean };
      
      // Super Admin acessa tudo (redundante mas seguro)
      if (gate.super_admin) return;

      // Se não tem empresa vinculada, deve ir para o onboarding
      if (!gate.has_establishment) {
        throw redirect({ to: "/onboarding" });
      }

      // Se tem empresa mas não tem assinatura ativa, bloqueia tudo exceto BILLING_EXEMPT
      if (!gate.active) {
        throw redirect({ to: "/app/planos" });
      }
    } catch (e) {
      // Se for um objeto de redirecionamento do TanStack Router, relançamos para processar
      if (e && typeof e === "object" && ("isRedirect" in e || "to" in e)) throw e;
      
      // Fallback para falha de rede (Failed to fetch)
      console.error("[app] exceção no beforeLoad:", e);
      throw redirect({ to: "/app/planos", search: { gate: "offline" } as any });
    }
  },

  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
type NavGroup = { key: string; label: string; icon: any; items: NavItem[] };

const NAV_GROUPS: (NavGroup | NavItem)[] = [
  {
    key: "visao",
    icon: LayoutDashboard,
    label: "Visão geral",
    items: [
      { to: "/app", label: "Painel", icon: LayoutDashboard, exact: true },
      { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  { to: "/app/qr", label: "QR Codes", icon: QrCode },

  {
    key: "clientes",
    icon: Users,
    label: "Clientes",
    items: [
      { to: "/app/clientes", label: "Clientes", icon: Users, exact: true },
      { to: "/app/equipe", label: "Equipe", icon: UsersRound },
    ],
  },
  {
    key: "fidelidade",
    icon: Sparkles,
    label: "Fidelidade",
    items: [
      { to: "/app/carimbar", label: "Carimbar", icon: Stamp },
      { to: "/app/campanhas", label: "Campanhas de fidelidade", icon: Sparkles },
      { to: "/app/wallet", label: "Carteira digital", icon: Wallet },
    ],
  },
  {
    key: "linktree",
    icon: Link2,
    label: "Árvore de links",
    items: [{ to: "/app/linktree", label: "Árvore de links", icon: Link2 }],
  },
  {
    key: "avaliacoes",
    icon: Star,
    label: "Avaliações",
    items: [
      { to: "/app/avaliacoes", label: "Visão geral", icon: Star, exact: true },
      { to: "/app/avaliacoes/tema", label: "Tema da página", icon: Palette },
    ],
  },
  {
    key: "cardapio",
    icon: UtensilsCrossed,
    label: "Cardápio Story",
    items: [
      { to: "/app/cardapio", label: "Visão geral", icon: UtensilsCrossed, exact: true },
      { to: "/app/cardapio/categorias", label: "Categorias", icon: FolderTree },
      { to: "/app/cardapio/pratos", label: "Pratos", icon: LayoutList },
      { to: "/app/cardapio/aparencia", label: "Aparência", icon: Palette },
    ],
  },
  {
    key: "catalogo",
    icon: ShoppingBag,
    label: "Catálogo digital",
    items: [
      { to: "/app/catalogo", label: "Visão geral", icon: ShoppingBag, exact: true },
      { to: "/app/catalogo/colecoes", label: "Coleções", icon: FolderTree },
      { to: "/app/catalogo/produtos", label: "Produtos", icon: LayoutList },
      { to: "/app/catalogo/aparencia", label: "Aparência", icon: Palette },
      { to: "/app/pedidos", label: "Pedidos", icon: Receipt },
    ],
  },
  {
    key: "comunicacao",
    icon: Megaphone,
    label: "Comunicação",
    items: [
      { to: "/app/retencao", label: "Retenção", icon: HeartHandshake },
      { to: "/app/notificacoes", label: "Notificações", icon: Bell },
      { to: "/app/promocoes", label: "Promoções", icon: Megaphone },
      { to: "/app/mensagens", label: "Mensagens", icon: MessageSquare },
      { to: "/app/anuncios", label: "Anúncios em destaque", icon: Megaphone },
    ],
  },



  {
    key: "financeiro",
    icon: Wallet,
    label: "Financeiro",
    items: [
      { to: "/app/planos", label: "Planos", icon: Package },
      { to: "/app/pagamentos", label: "Pagamentos", icon: CreditCard },
    ],
  },
  {
    key: "suporte",
    icon: LifeBuoy,
    label: "Suporte",
    items: [
      { to: "/app/kb", label: "Central de Ajuda", icon: BookOpen },
      { to: "/app/fidelize", label: "Fale com a Fidelize", icon: LifeBuoy },
    ],
  },
];



const FLAT_NAV = NAV_GROUPS.flatMap((g) => ('items' in g ? g.items : [g]));

/** Atalhos fixos da barra inferior no mobile (operação do balcão). */
const MOBILE_TABS: NavItem[] = [
  { to: "/app", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/app/carimbar", label: "Carimbar", icon: Stamp },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/qr", label: "QR Codes", icon: QrCode },
];

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const getAdmin = useServerFn(getAdminStatus);
  const { data: memberships, isLoading } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const { data: adminStatus } = useQuery({ queryKey: ["admin-status"], queryFn: () => getAdmin() });
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });


  // mantém a categoria da rota atual expandida
  useEffect(() => {
    const g = NAV_GROUPS.find((grp) => 'items' in grp && grp.items.some((n: NavItem) => (n.exact ? pathname === n.to : pathname.startsWith(n.to))));
    // apenas uma categoria aberta por vez: mantém o menu inteiro visível sem scroll
    setOpenGroups(g && 'key' in g ? [g.key] : []);
  }, [pathname]);


  // fecha o menu mobile ao trocar de rota
  useEffect(() => { setMobileOpen(false); }, [pathname]);


  useEffect(() => {
    try {
      const v = localStorage.getItem("fidelize_sidebar_collapsed");
      if (v === "1") setCollapsed(true);
    } catch { /* noop */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("fidelize_sidebar_collapsed", collapsed ? "1" : "0"); } catch { /* noop */ }
  }, [collapsed]);

  const { data: unreadSupport = 0 } = useQuery({
    queryKey: ["support-unread"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return 0;
      const { count } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("requester_user_id", u.user.id)
        .eq("has_unread_customer", true);
      return count ?? 0;
    },
    refetchOnWindowFocus: true,
  });

  // Realtime do suporte: tópico único por montagem e listeners registrados
  // ANTES de subscribe(). Reaproveitar o mesmo nome de canal fazia o
  // supabase-js recusar os callbacks ("after subscribe()") e os avisos
  // em tempo real nunca chegavam.
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;
      if (!userId || cancelled) return;
      const topic = `support-customer-notify:${userId}:${Math.random().toString(36).slice(2, 9)}`;
      const ch = supabase.channel(topic);
      ch.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets", filter: `requester_user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as { has_unread_customer?: boolean; protocol?: string; subject?: string };
          if (!n.has_unread_customer) return;
          toast.message("Nova resposta do suporte", {
            description: `${n.protocol ?? ""} — ${n.subject ?? ""}`.trim(),
            action: { label: "Ver", onClick: () => navigateRef.current({ to: "/app/fidelize" }) },
          });
          queryClientRef.current.invalidateQueries({ queryKey: ["support-unread"] });
          queryClientRef.current.invalidateQueries({ queryKey: ["my-support-tickets"] });
        },
      );
      if (cancelled) return;
      ch.subscribe();
      channel = ch;
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);


  const activeEstEarly = memberships?.[0]?.establishment as { id: string } | undefined;
  const activeEstId = activeEstEarly?.id;
  const lastAllowedRef = useRef<boolean | null>(null);
  const checkFeatureFn = useServerFn(checkMyFeature);
  useEffect(() => {
    if (!activeEstId) return;
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    async function refresh(reason: "init" | "plan_features" | "establishment") {
      const res = await checkFeatureFn({ data: { establishment_id: activeEstId!, feature_key: "public_reviews" } }).catch(() => null);
      if (cancelled || !res) return;
      const allowed = !!res.allowed;
      const prev = lastAllowedRef.current;
      lastAllowedRef.current = allowed;
      queryClient.invalidateQueries({ queryKey: ["feature", activeEstId, "public_reviews"] });
      if (prev === null || prev === allowed || reason === "init") return;
      if (allowed) {
        toast.success("Avaliações públicas foram HABILITADAS na sua conta 🎉", {
          duration: 12000,
          description: "Você já pode criar QR Codes de avaliação e coletar CSAT dos clientes.",
          action: { label: "Abrir Avaliações", onClick: () => navigate({ to: "/app/avaliacoes" }) },
        });
      } else {
        toast.warning("Avaliações públicas foram DESABILITADAS na sua conta", {
          duration: 12000,
          description: "QRs já existentes continuam salvos. Faça upgrade para reativar.",
          action: { label: "Ver planos", onClick: () => navigate({ to: "/app/planos" }) },
        });
      }
    }

    refresh("init");
    ch = supabase
      .channel(`feature-gate-${activeEstId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_features", filter: "feature_key=eq.public_reviews" }, () => refresh("plan_features"))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "establishments", filter: `id=eq.${activeEstId}` }, () => refresh("establishment"))
      .subscribe();

    return () => { cancelled = true; if (ch) supabase.removeChannel(ch); };
  }, [activeEstId, checkFeatureFn, navigate, queryClient]);

  const activeEst = memberships?.[0]?.establishment as { id: string; name: string; slug: string; logo_url: string | null } | undefined;

  const { can, isLoading: permsLoading } = usePermissions(activeEst?.id);
  const filteredGroups = NAV_GROUPS.map((g) => {
    if (!('items' in g)) return g;
    return {
      ...g,
      items: g.items.filter((it: NavItem) => {
        const action = ROUTE_PERMISSIONS[it.to];
        if (!action) return true;
        if (permsLoading) return true;
        return can(action);
      }),
    };
  }).filter((g) => {
    if (!('items' in g)) {
      const action = ROUTE_PERMISSIONS[g.to];
      if (!action) return true;
      if (permsLoading) return true;
      return can(action);
    }
    return g.items.length > 0;
  });

  const FLAT_ALLOWED = filteredGroups.flatMap((g) => ('items' in g ? g.items : [g]));

  if (isLoading) return <RouteLoading label="Carregando seu painel…" />;
  if (!memberships?.length) {
    if (typeof window !== "undefined" && !pathname.startsWith("/onboarding")) {
      navigate({ to: "/onboarding" });
    }
    return <RouteLoading label="Configurando sua empresa…" />;
  }

  const isItemActive = (n: NavItem) => (n.exact ? pathname === n.to : pathname.startsWith(n.to));
  const activeNav = FLAT_ALLOWED.find((n) => (n.exact ? pathname === n.to : pathname.startsWith(n.to))) ?? FLAT_NAV.find((n) => (n.exact ? pathname === n.to : pathname.startsWith(n.to))) ?? (FLAT_NAV[0] as NavItem);


  async function signOut() {
    const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: isPwa ? "/auth" : "/", replace: true, search: isPwa ? { source: "pwa" } : undefined });
  }

  const renderNavItem = (n: NavItem, onNavigate?: () => void, forceExpanded = false, isSubItem = false) => {
    const active = isItemActive(n);
    const badge = n.to === "/app/fidelize" && unreadSupport > 0 ? unreadSupport : 0;
    const showLabel = forceExpanded || !collapsed;
    const inner = (
      <Link
        to={n.to}
        data-tour={`nav-${n.to}`}
        onClick={onNavigate}
        className={[
          "group relative flex items-center rounded-xl transition-all duration-200",
          isSubItem ? "h-9 text-[13px] font-medium" : "h-10 text-sm font-medium",
          showLabel ? (isSubItem ? "px-2.5 gap-2" : "px-3 gap-2.5") : "px-0 justify-center",
          active 
            ? "text-primary-foreground bg-primary shadow-sm" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        ].join(" ")}
      >
        <span className="relative z-10 grid place-items-center h-8 w-8 shrink-0">
          <n.icon
            className={isSubItem ? "h-4 w-4" : "h-[18px] w-[18px]"}
            strokeWidth={active ? 2.5 : 2}
          />
        </span>
        <AnimatePresence initial={false}>
          {showLabel && (
            <motion.span
              key="label"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15 }}
              className="relative z-10 flex-1 truncate"
            >
              {n.label}
            </motion.span>
          )}
        </AnimatePresence>
        {badge > 0 && showLabel && (
          <span className="relative z-10 inline-flex min-w-[18px] h-4.5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground ring-1 ring-white/10">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
        {badge > 0 && !showLabel && (
          <span className="absolute top-1 right-1 z-10 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
        )}
      </Link>
    );
    if (!showLabel) {
      return (
        <Tooltip key={n.to} delayDuration={100}>
          <TooltipTrigger asChild>{inner}</TooltipTrigger>
          <TooltipContent side="right" className="font-semibold shadow-md">{n.label}</TooltipContent>
        </Tooltip>
      );
    }
    return <div key={n.to}>{inner}</div>;
  };

  const renderNav = (onNavigate?: () => void, forceExpanded = false) => {
    const showLabel = forceExpanded || !collapsed;
    return (
      <LayoutGroup id="sidebar-nav">
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4 overflow-y-auto overflow-x-visible">
          {filteredGroups.map((g, idx) => {
            // Se for item direto (NavItem)
            if (!('items' in g)) {
              return (
                <div key={g.to + idx}>
                  {renderNavItem(g, onNavigate, forceExpanded)}
                </div>
              );
            }

            const GroupIcon = g.icon;
            const groupActive = g.items.some(isItemActive);
            const expanded = openGroups.includes(g.key);
            const flyout = !forceExpanded && hoverGroup === g.key;

            // Categoria com um único destino vira link direto (sem submenu).
            if (g.items.length === 1) {
              return (
                <div key={g.key}>
                  {renderNavItem({ ...g.items[0], label: g.label, icon: g.icon }, onNavigate, forceExpanded)}
                </div>
              );
            }

            return (
              <div
                key={g.key}
                className="relative"
                onMouseEnter={(e) => {
                  if (forceExpanded) return;
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setHoverPos({ top: Math.min(r.top, window.innerHeight - 340), left: r.right + 8 });
                  setHoverGroup(g.key);
                }}
                onMouseLeave={() => { if (!forceExpanded) setHoverGroup((c) => (c === g.key ? null : c)); }}
              >
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => (prev.includes(g.key) ? [] : [g.key]))}
                  aria-expanded={expanded}
                  className={[
                    "relative w-full flex items-center rounded-xl h-10 text-sm font-semibold transition-all duration-200",
                    showLabel ? "px-3 gap-2.5" : "px-0 justify-center",
                    groupActive 
                      ? "text-primary bg-primary/10" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  ].join(" ")}
                >
                  <span className="grid place-items-center h-8 w-8 shrink-0">
                    <GroupIcon className="h-[18px] w-[18px]" strokeWidth={groupActive ? 2.5 : 2} />
                  </span>

                  {showLabel && (
                    <>
                      <span className="flex-1 text-left truncate">{g.label}</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 opacity-60 ${expanded ? "rotate-90" : ""}`} />
                    </>
                  )}
                </button>

                {/* Submenu inline (ao clicar) */}
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      key="inline"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className={`flex flex-col gap-1 py-1 ${showLabel ? "ml-4 pl-3 border-l border-border/40" : ""}`}>
                        {g.items.map((n: NavItem) => renderNavItem(n, onNavigate, forceExpanded, true))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submenu lateral (ao passar o mouse) */}
                <AnimatePresence>
                  {flyout && !expanded && (
                    <motion.div
                      key="flyout"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.15 }}
                      style={{ position: "fixed", top: hoverPos.top, left: hoverPos.left }}
                      className="z-[100] w-64 max-h-[80vh] overflow-y-auto rounded-2xl border border-border/60 bg-popover/95 p-2 shadow-2xl backdrop-blur-xl"
                    >
                      <div className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                        {g.label}
                      </div>
                      <div className="flex flex-col gap-1">
                        {g.items.map((n: NavItem) => renderNavItem(n, () => { setHoverGroup(null); onNavigate?.(); }, true, true))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

      </LayoutGroup>
    );
  };


  const renderFooter = (onNavigate?: () => void, forceExpanded = false) => {
    const showLabel = forceExpanded || !collapsed;
    return (
      <div className={`mt-auto border-t bg-muted/20 ${showLabel ? "p-3" : "p-2"} flex flex-col gap-2`}>
        <div className={`flex items-center rounded-xl h-10 ${showLabel ? "px-3 justify-between" : "justify-center"}`}>
          {showLabel && <span className="text-[13px] font-medium text-muted-foreground">Tema</span>}
          <div className="flex items-center justify-center w-8 h-8">
            <ThemeToggle />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={`w-full ${showLabel ? "px-3 justify-between" : "px-0 justify-center"} h-10 rounded-xl hover:bg-muted/50 transition-all duration-200`}
            >
              <span className="grid place-items-center h-7.5 w-7.5 rounded-lg bg-primary/15 text-primary text-[10px] font-bold shrink-0 border border-primary/10">
                {activeEst?.name?.slice(0, 2).toUpperCase() ?? "FZ"}
              </span>
              {showLabel && (
                <>
                  <span className="truncate text-[13px] font-semibold flex-1 text-left ml-2.5">{activeEst?.name}</span>
                  <ChevronDown className="h-4 w-4 opacity-50 ml-1" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={collapsed ? "center" : "end"} side={collapsed ? "right" : "bottom"} className="w-56 rounded-2xl p-1.5 shadow-2xl">
            <DropdownMenuItem asChild className="rounded-xl"><Link to="/app/perfil" onClick={onNavigate}><UserCircle2 className="mr-2.5 h-4 w-4 opacity-60" />Editar perfil</Link></DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-xl"><Link to="/cartao/$slug" params={{ slug: activeEst!.slug }} onClick={onNavigate}><Compass className="mr-2.5 h-4 w-4 opacity-60" />Ver página pública</Link></DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-xl"><Link to="/lgpd" onClick={onNavigate}><Shield className="mr-2.5 h-4 w-4 opacity-60" />Meus Dados (LGPD)</Link></DropdownMenuItem>

            {adminStatus?.isAdmin && (
              <DropdownMenuItem asChild className="rounded-xl"><Link to="/hash" onClick={onNavigate}><Shield className="mr-2.5 h-4 w-4 opacity-60 text-primary" />Painel do administrador</Link></DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="my-1.5 opacity-50" />
            <DropdownMenuItem onClick={() => { onNavigate?.(); signOut(); }} className="rounded-xl text-destructive focus:text-destructive focus:bg-destructive/10"><LogOut className="mr-2.5 h-4 w-4" />Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <TooltipProvider>
      <div className="min-h-dvh dock-page-bg">
        {/* Desktop: sidebar padrão (ícone + nome) */}
        <aside
          className={[
            "hidden md:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-border/60 bg-card/80 backdrop-blur-xl transition-[width] duration-200",
            collapsed ? "w-[76px]" : "w-64",
          ].join(" ")}
          data-tour="sidebar-logo"
        >
          <div className={`flex h-18 items-center border-b border-border/60 transition-[height] duration-200 ${collapsed ? "justify-center px-2" : "justify-between px-3"}`}>
            {collapsed ? (
              <Link to="/app" aria-label="Fidelize" className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10">
                <LogoMark size={20} className="text-primary" />
              </Link>
            ) : (
              <Link to="/app" aria-label="Fidelize" className="min-w-0 flex items-center">
                <Logo className="py-0.5" />
              </Link>
            )}
            {!collapsed && (
              <Button size="icon" variant="ghost" aria-label="Recolher menu" onClick={() => setCollapsed(true)}>
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>

          {collapsed && (
            <div className="flex justify-center pt-2">
              <Button size="icon" variant="ghost" aria-label="Expandir menu" onClick={() => setCollapsed(false)}>
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </div>
          )}

          {renderNav()}
          {renderFooter()}
        </aside>

        <div className={`flex flex-col min-w-0 transition-all duration-300 ease-in-out ${collapsed ? "md:pl-[76px]" : "md:pl-64"}`}>

          {/* Top bar (desktop + mobile) */}
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 h-18 px-4 md:px-6 border-b bg-card/70 backdrop-blur-xl transition-[height] duration-200">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile trigger */}
              <div className="md:hidden">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-72 flex flex-col">
                    <VisuallyHidden><SheetTitle>Menu de navegação</SheetTitle></VisuallyHidden>
                    <div className="p-4 border-b flex items-center h-18"><Logo className="py-0.5" /></div>
                    {renderNav(closeMobile, true)}
                    {renderFooter(closeMobile, true)}
                  </SheetContent>
                </Sheet>
              </div>
              <div className="md:hidden flex items-center h-full"><Logo className="py-0.5" /></div>

              {/* Breadcrumb / page title (desktop) */}
              <div className="hidden md:flex items-center gap-2 min-w-0">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Fidelize</span>
                <span className="text-muted-foreground/40">/</span>
                <AnimatePresence mode="wait">
                  <motion.h1
                    key={activeNav.to}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="font-display text-sm font-semibold truncate"
                  >
                    {activeNav.label}
                  </motion.h1>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.dispatchEvent(new CustomEvent("fidelize:start-tour"))}
                className="hidden lg:inline-flex text-primary hover:text-primary hover:bg-primary/10 gap-2 h-9 border border-primary/25"
              >
                <Compass className="h-4 w-4" />
                <span className="text-xs font-medium">Fazer tour</span>
              </Button>

              <QuickSearch
                establishmentId={activeEstId ?? null}
                navTargets={FLAT_NAV.map((n) => ({ to: n.to, label: n.label }))}
              />

              <PageGuideButton scope={activeEst?.id ?? "user"} />

              <div className="hidden md:block"><ThemeToggle /></div>
            </div>
          </header>

          {/* Main with page transition */}
          <main className="flex-1 min-w-0 relative">
            <ErrorBoundary name="app">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="relative min-w-0 px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-7 md:pb-7 max-w-[1400px] w-full mx-auto"
              >
                <PanelTransition />
                <Outlet />
              </motion.div>
            </AnimatePresence>
            </ErrorBoundary>
          </main>

          {/* Barra inferior (mobile) — atalhos da operação diária */}
          <nav
            aria-label="Navegação rápida"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            <ul className="grid grid-cols-5">
              {MOBILE_TABS.map((t) => {
                const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
                return (
                  <li key={t.to}>
                    <Link
                      to={t.to}
                      className={[
                        "flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                        active ? "text-primary" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      <t.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                      <span className="max-w-full truncate px-1">{t.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground"
                >
                  <Menu className="h-5 w-5" strokeWidth={1.8} />
                  <span>Mais</span>
                </button>
              </li>
            </ul>
          </nav>
        </div>

        {pathname === "/app" && (
          <GuidedTour
            steps={MERCHANT_TOUR_STEPS}
            mobileSteps={MERCHANT_TOUR_STEPS_MOBILE}
            storageKey={`fidelize_tour_v1_${activeEst?.id ?? "user"}`}
          />
        )}
        {/* Sempre montado: responde ao botão de ajuda em qualquer tela. */}
        <PageGuidePrompt scope={activeEst?.id ?? "user"} />

      </div>
    </TooltipProvider>
  );
}
