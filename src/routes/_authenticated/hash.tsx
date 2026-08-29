import { RouteLoading } from "@/components/RouteLoading";
import { PanelTransition } from "@/components/PanelTransition";
import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getAdminStatus, bootstrapSuperAdmin } from "@/lib/admin.functions";
import { Logo } from "@/components/Logo";
import { LogoMark } from "@/components/LogoMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Shield, LayoutDashboard, Building2, CreditCard, ArrowLeft, Bell, FileClock, Wallet2,
  UsersRound, Settings, Mail, FileText, ListChecks, LifeBuoy, Package, Mic,
  DollarSign, Wallet, Megaphone, Cog, BookOpen, Menu, Star, Plug, Sparkles, Rocket, FileJson, KeyRound, ChevronRight, ChevronLeft, Activity, MessageSquare, Globe, ServerCog, Link2
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/hash")({
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
type NavGroup = { key: string; label: string; icon: any; items: NavItem[] };

const OVERVIEW: NavItem = { to: "/hash", label: "Visão geral", icon: LayoutDashboard, exact: true };
const ATENDIMENTO: NavItem = { to: "/hash/atendimento", label: "Atendimento", icon: MessageSquare };

const NAV_GROUPS: NavGroup[] = [
  {
    key: "plataforma",
    label: "Plataforma",
    icon: Building2,
    items: [
      { to: "/hash/empresas", label: "Empresas", icon: Building2 },
      { to: "/hash/usuarios", label: "Usuários", icon: UsersRound },
      { to: "/hash/equipe", label: "Equipe", icon: Shield },
      { to: "/hash/suporte", label: "Suporte", icon: LifeBuoy },
      { to: "/hash/avaliacoes", label: "Avaliações", icon: Star },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    icon: Wallet,
    items: [
      { to: "/hash/financeiro", label: "Financeiro", icon: DollarSign },
      { to: "/hash/assinaturas", label: "Assinaturas", icon: CreditCard },
      { to: "/hash/planos", label: "Planos", icon: Package },
      { to: "/hash/anuncios", label: "Anúncios patrocinados", icon: Megaphone },
      
    ],
  },
  {
    key: "comunicacao",
    label: "Comunicação",
    icon: Mail,
    items: [
      { to: "/hash/emails", label: "E-mail", icon: Mail, exact: true },
      { to: "/hash/email-templates", label: "Templates", icon: FileText },
      { to: "/hash/email-fila", label: "Fila de envio", icon: ListChecks },
      { to: "/hash/notificacoes", label: "Push", icon: Bell },
      { to: "/hash/alertas", label: "Alertas", icon: Megaphone },
      { to: "/hash/ajuda", label: "Central de Ajuda", icon: BookOpen },
    ],
  },
  {
    key: "sistema",
    label: "Sistema",
    icon: Cog,
    items: [
      { to: "/hash/landing", label: "Página inicial", icon: Sparkles },
      { to: "/hash/integracoes", label: "Integrações", icon: Plug },
      { to: "/hash/api-integracoes", label: "API de Integrações", icon: Link2 },
      { to: "/hash/provisionamentos", label: "Provisionamentos", icon: ServerCog },

      { to: "/hash/pixel", label: "Monitor do Pixel", icon: Activity },
      { to: "/hash/liberacoes", label: "Liberações de recursos", icon: KeyRound },
      { to: "/hash/cardapio-jsonld", label: "JSON-LD do cardápio", icon: FileJson },
      { to: "/hash/auditoria", label: "Auditoria", icon: FileClock },
      { to: "/hash/migracao", label: "Migração & Downloads", icon: Rocket },
      { to: "/hash/studio", label: "Studio de Voz", icon: Mic },
      { to: "/hash/seo", label: "SEO & Identidade", icon: Globe },
      { to: "/hash/config", label: "Configurações", icon: Settings },
    ],
  },
];


function AdminLayout() {
  const navigate = useNavigate();
  const getStatus = useServerFn(getAdminStatus);
  const bootstrap = useServerFn(bootstrapSuperAdmin);
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin-sidebar-collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("admin-sidebar-collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => getStatus(),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  // mantém apenas a categoria da rota atual expandida
  useEffect(() => {
    const g = NAV_GROUPS.find((grp) =>
      grp.items.some((n) => (n.exact ? pathname === n.to : pathname.startsWith(n.to))),
    );
    setOpenGroups(g ? [g.key] : []);
  }, [pathname]);


  if (isLoading) return <RouteLoading label="Verificando permissões…" />;

  if (!data?.isAdmin) {
    return (
      <div className="min-h-dvh grid place-items-center bg-muted/30 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Shield className="h-7 w-7" /></div>
            <h1 className="font-display text-2xl font-bold">Painel do Administrador</h1>
            <p className="text-sm text-muted-foreground">Esta área é restrita aos administradores da plataforma Fidelize.</p>
            {data?.canBootstrap ? (
              <>
                <p className="text-sm">Nenhum administrador cadastrado ainda. Você pode assumir este papel agora — como primeiro usuário.</p>
                <Button className="w-full gradient-brand text-primary-foreground" onClick={async () => {
                  try { await bootstrap(); toast.success("Você agora é administrador da plataforma."); refetch(); }
                  catch (e: any) { toast.error(e.message ?? "Falha ao promover"); }
                }}>Tornar-me administrador</Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Solicite acesso ao administrador atual.</p>
            )}
            <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/app" })}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isItemActive = (n: NavItem) => (n.exact ? pathname === n.to : pathname.startsWith(n.to));
  const allItems: NavItem[] = [OVERVIEW, ATENDIMENTO, ...NAV_GROUPS.flatMap((g) => g.items)];
  const activeNav = allItems.find(isItemActive) ?? OVERVIEW;

  const closeMobile = () => setMobileOpen(false);

  const navItemClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-xl transition-colors font-medium",
      isSidebarCollapsed ? "justify-center w-10 h-10 mx-auto" : "px-3 h-[var(--nav-item-h,2.5rem)] text-[length:var(--nav-fs,0.875rem)]",
      active
        ? "bg-primary-soft text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  const renderNavItem = (n: NavItem, onNavigate?: () => void) => {
    const active = isItemActive(n);
    const content = (
      <Link key={n.to} to={n.to} onClick={onNavigate} className={navItemClass(active)}>
        <n.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
        {!isSidebarCollapsed && <span className="truncate">{n.label}</span>}
      </Link>
    );

    if (isSidebarCollapsed) {
      return (
        <TooltipProvider key={n.to}>
          <Tooltip>
            <TooltipTrigger asChild>
              {content}
            </TooltipTrigger>
            <TooltipContent side="right">
              {n.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return content;
  };

  const renderNav = (onNavigate?: () => void, forceExpanded = false) => (
    <nav className={cn("nav-dense flex flex-1 flex-col gap-[var(--nav-gap)] overflow-y-auto overflow-x-hidden py-[var(--nav-py)]", isSidebarCollapsed ? "px-1" : "px-2.5")}>
      {renderNavItem(OVERVIEW, onNavigate)}
      {renderNavItem(ATENDIMENTO, onNavigate)}
      {NAV_GROUPS.map((g) => {
        const GroupIcon = g.icon;
        const groupActive = g.items.some(isItemActive);
        const expanded = openGroups.includes(g.key);
        const flyout = !forceExpanded && hoverGroup === g.key;
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
              onClick={() => {
                if (isSidebarCollapsed) {
                  setIsSidebarCollapsed(false);
                }
                setOpenGroups((prev) => (prev.includes(g.key) ? [] : [g.key]));
              }}
              aria-expanded={expanded}
              className={cn(
                "relative flex items-center gap-3 rounded-xl transition-colors font-semibold",
                isSidebarCollapsed ? "justify-center w-10 h-10 mx-auto" : "w-full px-3 h-[var(--nav-item-h,2.5rem)] text-[length:var(--nav-fs,0.875rem)]",
                groupActive ? "text-foreground bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <GroupIcon className={`h-[18px] w-[18px] shrink-0 ${groupActive ? "text-primary" : ""}`} strokeWidth={groupActive ? 2.3 : 1.8} />
              {!isSidebarCollapsed && <span className="flex-1 text-left truncate">{g.label}</span>}
              {!isSidebarCollapsed && <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />}
            </button>

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
                  <div className="ml-4 flex flex-col gap-[var(--nav-gap)] border-l border-border/60 py-[var(--nav-gap)] pl-2">
                    {g.items.map((n) => renderNavItem(n, onNavigate))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {flyout && !expanded && (
                <motion.div
                  key="flyout"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                  style={{ position: "fixed", top: hoverPos.top, left: hoverPos.left }}
                  className="z-50 w-60 max-h-[70vh] overflow-y-auto rounded-2xl border border-border/60 bg-popover/95 p-2 shadow-xl backdrop-blur-xl"
                >
                  <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                    {g.label}
                  </div>
                  <div className="space-y-0.5">
                    {g.items.map((n) => renderNavItem(n, () => { setHoverGroup(null); onNavigate?.(); }))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );



  return (
    <TooltipProvider>
      <div className="min-h-dvh dock-page-bg">
        {/* Desktop Sidebar */}
        <aside 
          className={cn(
            "hidden md:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-border/60 bg-card/80 backdrop-blur-xl transition-all duration-300",
            isSidebarCollapsed ? "w-16" : "w-64"
          )}
        >
          <div className="flex h-14 items-center gap-2 border-b border-border/60 px-3 overflow-hidden">
            <Link to="/hash" aria-label="Fidelize Admin" className="flex min-w-0 items-center gap-2">
              <LogoMark size={20} className="text-primary" />
              {!isSidebarCollapsed && <span className="font-display text-sm font-bold whitespace-nowrap">Fidelize</span>}
            </Link>
            {!isSidebarCollapsed && (
              <span className="rounded bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary whitespace-nowrap">
                Admin
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar py-2">
            {renderNav()}
          </div>

          <div className="border-t border-border/60 p-2 space-y-1">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="flex w-full items-center justify-center h-10 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            <div className="pt-2">
              <Link
                to="/app"
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-all",
                  isSidebarCollapsed && "justify-center"
                )}
              >
                <ArrowLeft className="h-[18px] w-[18px] shrink-0" /> 
                {!isSidebarCollapsed && <span className="truncate">Painel do lojista</span>}
              </Link>
            </div>
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tema</span>
                <ThemeToggle />
              </div>
            )}
          </div>
        </aside>

        <div 
          className={cn(
            "flex flex-col min-w-0 transition-all duration-300",
            isSidebarCollapsed ? "md:pl-16" : "md:pl-64"
          )}
        >

          {/* Top bar */}
          <header className={cn("sticky top-0 z-20 flex items-center justify-between gap-3 h-14 px-4 md:px-6 border-b bg-card/70 backdrop-blur-xl")}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="md:hidden">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="p-0 w-72 flex flex-col">
                    <VisuallyHidden><SheetTitle>Menu de navegação</SheetTitle></VisuallyHidden>
                    <div className="p-5 border-b flex items-center gap-2">
                      <Logo />
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">Admin</span>
                    </div>
                    {renderNav(closeMobile, true)}
                    <div className="p-3 border-t space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-muted-foreground">Tema</span>
                        <ThemeToggle />
                      </div>
                      <Link to="/app" onClick={closeMobile} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3 w-3" /> Voltar ao painel do lojista
                      </Link>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              <div className="md:hidden flex items-center gap-2">
                <Logo />
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">Admin</span>
              </div>

              <div className="hidden md:flex items-center gap-2 min-w-0">
                <AnimatePresence mode="wait">
                  <motion.h1
                    key={activeNav.to}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 4 }}
                    className="font-display text-sm font-semibold truncate"
                  >
                    {activeNav.label}
                  </motion.h1>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/carteira"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-primary-soft hover:text-primary transition-colors"
                aria-label="Abrir painel /carteira em nova aba"
                title="Ver painel do cliente final"
              >
                <Wallet2 className="h-3.5 w-3.5" />
                Ver /carteira
              </a>
              <div className="hidden md:block"><ThemeToggle /></div>
            </div>
          </header>

          <main className="flex-1 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "relative max-w-[1400px] w-full mx-auto px-4 py-5 md:px-6 md:py-7 min-h-0 min-w-0 flex flex-col",
                  pathname.startsWith("/hash/atendimento") && "max-w-none w-full mx-0 p-0 h-[calc(100dvh-56px)]"
                )}

              >
                <PanelTransition />
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
