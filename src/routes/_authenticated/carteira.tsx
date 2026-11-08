import { createFileRoute, Outlet, Link, useLocation, redirect } from "@tanstack/react-router";
import { 
  Home, 
  Compass, 
  Wallet, 
  User, 
  QrCode,
  Search,
  Bell,
  LogOut,
  Settings,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Star,
  MapPin,
  Clock,
  Gift,
  PlusCircle,
  Heart,
  ArrowRight,
  LogOut as LogOutIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/LogoMark";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { getMyWallet, getMyRewards } from "@/lib/my-wallet.functions";
import { clearWalletCache } from "@/lib/offline-wallet-cache";
import { InboxBellBadge } from "@/components/wallet/InboxBellBadge";
import { WalletQrSheet } from "@/components/wallet/WalletQrSheet";

export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({}),
  beforeLoad: async () => {
    const { resolveAuthenticatedDestination } = await import("@/lib/destination-resolver");
    const to = await resolveAuthenticatedDestination();
    if (to !== "/carteira") throw redirect({ to });
  },
  loader: async ({ context }) => {
    // Prefetch common data to ensure Right Sidebar has content during SSR/initial load if needed
    await Promise.all([
      context.queryClient.ensureQueryData({ queryKey: ["my-wallet"], queryFn: getMyWallet }),
      context.queryClient.ensureQueryData({ queryKey: ["my-rewards"], queryFn: getMyRewards }),
    ]);
  },
  component: WalletLayout,
});

function WalletLayout() {
  const location = useLocation();
  const activeTab = location.pathname;
  

  const tabs = [
    { icon: Home, label: "Início", path: "/carteira" },
    { icon: Compass, label: "Descobrir", path: "/carteira/descobrir" },
    { icon: QrCode, label: "QR Codes", path: "/carteira/scanner", isFab: true },
    { icon: Wallet, label: "Recompensas", path: "/carteira/premios" },
    { icon: User, label: "Perfil", path: "/carteira/perfil" },
  ];

  const secondaryNav = [
  { icon: Bell, label: "Notificações", path: "/carteira/mensagens" },
  { icon: Star, label: "Favoritos", path: "/carteira/favoritos" },
  { icon: HelpCircle, label: "Ajuda", path: "/carteira/ajuda" },
  { icon: Settings, label: "Configurações", path: "/carteira/perfil" },
];

  const { data: walletData = [] } = useQuery({ 
    queryKey: ["my-wallet"], 
    queryFn: getMyWallet,
    staleTime: 30_000 
  });
  
  const { data: rewardsData = [] } = useQuery({ 
    queryKey: ["my-rewards"], 
    queryFn: getMyRewards,
    staleTime: 30_000 
  });

  const progressItems = walletData
    .filter(it => it.card)
    .map(it => ({
      name: (it.establishment as { name: string }).name,
      progress: it.card?.stamps || 0,
      total: (it.card?.campaign as { stamps_required: number }).stamps_required || 10,
      slug: (it.establishment as { slug: string }).slug
    }))
    .sort((a, b) => (b.progress / b.total) - (a.progress / a.total))
    .slice(0, 3);

  const readyRewards = rewardsData
    .filter(r => r.ready)
    .slice(0, 2);

  const pinnedMerchants = walletData
    .filter(it => it.customer.pinned)
    .map(it => ({
      logo: (it.establishment as { logo_url: string }).logo_url,
      name: (it.establishment as { name: string }).name,
      slug: (it.establishment as { slug: string }).slug
    }))
    .slice(0, 5);


  const [qrSheetOpen, setQrSheetOpen] = useState(false);
const [profileName, setProfileName] = useState("Cliente Fidelize");
const [profileEmail, setProfileEmail] = useState("");
useEffect(() => {
  let mounted = true;

  void (async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!mounted || !user) return;
setProfileEmail(user.email ?? "");
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!mounted) return;

    const resolvedName =
      data?.full_name?.trim() ||
      user.email?.split("@")[0] ||
      "Cliente Fidelize";

    setProfileName(resolvedName);
  })();

  return () => {
    mounted = false;
  };
}, []);

const profileInitials = profileName
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase())
  .join("");
  return (
    <div className="min-h-screen bg-[oklch(0.985_0.006_285)] dark:bg-[oklch(0.14_0.018_288)] font-sans transition-colors duration-300 flex">
      <WalletQrSheet open={qrSheetOpen} onOpenChange={setQrSheetOpen} />
      
      {/* 1. SIDEBAR (DESKTOP) & DRAWER (MOBILE) */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[110] w-72 transform bg-background/80 backdrop-blur-2xl border-r border-border/40 transition-all duration-500 ease-in-out hidden md:flex md:flex-col md:sticky md:inset-y-0 md:w-20 xl:w-72 translate-x-0"
      )}>
        <div className="flex flex-col h-full p-4 xl:p-6">
          {/* Logo Section */}
          <div className="flex items-center gap-4 mb-10 px-2 lg:justify-center xl:justify-start">
            <div className="relative group">
              <LogoMark size={40} className="rounded-2xl shadow-xl shadow-primary/20 transition-transform group-hover:scale-110" />
              <div className="absolute -inset-1 rounded-2xl bg-primary/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col lg:hidden xl:flex text-left">
              <span className="font-display text-xl font-black tracking-tighter text-primary">Fidelize</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none">Premium Clean</span>
            </div>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 space-y-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.path || (tab.path === "/carteira" && activeTab === "/carteira/");
              const Icon = tab.icon;

              if (tab.isFab) {
                return (
                  <button
                    key={tab.path}
                    onClick={() => setQrSheetOpen(true)}
                    className={cn(
                      "w-full flex items-center gap-4 p-3 xl:p-4 rounded-[1.25rem] transition-all group lg:justify-center xl:justify-start",
                      "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("h-6 w-6 shrink-0 transition-transform group-hover:scale-110")} />
                    <span className={cn("font-bold text-sm lg:hidden xl:block opacity-70 group-hover:opacity-100")}>
                      {tab.label}
                    </span>
                  </button>
                );
              }

              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={cn(
                    "flex items-center gap-4 p-3 xl:p-4 rounded-[1.25rem] transition-all group lg:justify-center xl:justify-start",
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-6 w-6 shrink-0 transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                  <span className={cn("font-bold text-sm lg:hidden xl:block", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div 
                      layoutId="activePill" 
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground lg:hidden xl:block" 
                    />
                  )}
                </Link>
              );
            })}

            <div className="my-6 h-px bg-border/40 lg:w-8 lg:mx-auto xl:w-full" />

           {secondaryNav.map((item) => (
  <Link
    key={item.label}
    to={item.path}
    className="w-full flex items-center gap-4 p-3 xl:p-4 rounded-[1.25rem] text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all group lg:justify-center xl:justify-start"
  >
    <div className="relative">
      <item.icon className="h-6 w-6 shrink-0 transition-transform group-hover:scale-110" />
    </div>

    <span className="font-bold text-sm lg:hidden xl:block opacity-70 group-hover:opacity-100">
      {item.label}
    </span>
  </Link>
))}
</nav>

          {/* User Profile Mini (Sidebar Bottom) */}
          <div className="mt-auto p-2 lg:p-0 xl:p-2">
             <div className="flex items-center gap-3 p-3 rounded-2xl bg-accent/40 border border-border/20 lg:justify-center xl:justify-start">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-black shadow-lg">
  {profileInitials || "CF"}
</div>

<div className="min-w-0 flex-1 lg:hidden xl:block text-left">
  <p className="text-xs font-black truncate">{profileName}</p>
<p className="text-[10px] text-muted-foreground font-bold truncate">
  {profileEmail || "Minha conta"}
</p>
</div>
                <button 
                  className="text-muted-foreground hover:text-destructive transition-colors lg:hidden xl:block"
                  onClick={async () => {
                    const { supabase } = await import("@/integrations/supabase/client");
                    const isPwa = window.matchMedia("(display-mode: standalone)").matches;
                    await supabase.auth.signOut();
                    clearWalletCache();
                    window.location.href = isPwa ? "/auth?source=pwa" : "/";
                  }}
                >
                  <LogOutIcon className="h-4 w-4" />
                </button>
             </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden md:flex-grow">
        
        {/* Top Header - Desktop & Mobile */}
        <header className="sticky top-0 z-40 w-full bg-background/60 backdrop-blur-xl border-b border-border/40 px-4 xl:px-8 h-16 md:h-20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">

            
            {/* Contextual Title / Breadcrumb */}
            <div className="hidden sm:block text-left">
               <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/60 leading-none mb-1">
                 {activeTab.includes('descobrir') ? 'Exploração' : 'Minha Central'}
               </h2>
               <p className="text-lg font-display font-black tracking-tight text-foreground">
                 {activeTab.includes('descobrir') ? 'Descobrir' : 'Início'}
               </p>
            </div>
          </div>

          {/* Desktop Search & Global Actions */}
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden md:flex items-center relative group">
              <Search className="absolute left-4 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input 
                placeholder="Pesquisar estabelecimentos..." 
                className="w-64 xl:w-80 h-11 bg-accent/40 border-none rounded-2xl pl-11 pr-4 text-sm font-medium focus:ring-4 focus:ring-primary/5 transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <InboxBellBadge 
                unread={0} 
                readyRewards={readyRewards.length}
                active={activeTab === "/carteira/mensagens"} 
              />
              <button className="md:hidden h-11 w-11 flex items-center justify-center rounded-2xl bg-accent/60 text-muted-foreground">
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-[oklch(0.985_0.006_285)] dark:bg-[oklch(0.14_0.018_288)]">
          <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 xl:p-10">
            {/* Desktop Layout Pattern: Main content + Sidebar Right */}
            <div className="flex flex-col md:flex-row gap-8 xl:gap-12">
              
              {/* Primary Column */}
              <div className="flex-1 space-y-6 md:space-y-12 pb-24 md:pb-10">
                <Outlet />
              </div>

              <aside className="hidden md:block w-[300px] xl:w-[380px] flex-shrink-0 space-y-10">
                
                {/* 1. Quick Progress Section */}
                {progressItems.length > 0 && (
                  <section className="bg-background/40 backdrop-blur-md rounded-[2.5rem] p-6 border border-border/40 shadow-sm text-left">
                     <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Progresso Rápido</h3>
                        <Link to="/carteira" className="text-[10px] font-bold text-primary hover:underline">Ver todos</Link>
                     </div>
                     
                     <div className="space-y-5">
                        {progressItems.map(item => (
                          <Link to="/carteira/$slug" params={{ slug: item.slug }} key={item.slug} className="block group cursor-pointer">
                             <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                  {/* Just a generic fallback or emoji for now as we don't have logo here easily without extra mapping */}
                                  📍
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-sm font-bold truncate">{item.name}</p>
                                   <p className="text-[10px] text-muted-foreground font-medium">Faltam {item.total - item.progress} carimbos</p>
                                </div>
                             </div>
                             <div className="h-1.5 w-full bg-accent/60 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(item.progress/item.total)*100}%` }}
                                  className="h-full bg-primary" 
                                />
                             </div>
                          </Link>
                        ))}
                     </div>
  
                     <Link to="/carteira/descobrir" className="w-full mt-8 h-12 rounded-2xl bg-white dark:bg-black/20 border border-border/40 text-xs font-black uppercase tracking-wider hover:bg-accent transition-colors flex items-center justify-center gap-2 group">
                        <span>Explorar mais</span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                     </Link>
                  </section>
                )}

                {/* 2. Your Rewards Section */}
                {readyRewards.length > 0 && (
                  <section className="text-left">
                     <div className="flex items-center gap-2 mb-4 px-2">
                        <Gift className="h-4 w-4 text-primary" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Prêmios Disponíveis</h3>
                     </div>
                     
                     <div className="grid grid-cols-1 gap-3">
                        {readyRewards.map(reward => {
                           const est = reward.establishment as { name: string, slug: string };
                           return (
                            <Link 
                              key={reward.cardId}
                              to="/carteira/$slug"
                              params={{ slug: est.slug }}
                              className="p-4 rounded-3xl bg-gradient-to-br from-primary to-accent text-white shadow-xl shadow-primary/10 group cursor-pointer overflow-hidden relative block"
                            >
                               <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:scale-150 transition-transform duration-700" />
                               <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">{est.name}</p>
                               <h4 className="text-lg font-display font-black leading-tight mb-3 truncate">{reward.reward}</h4>
                               <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-black uppercase bg-white/20 px-2 py-1 rounded-lg">
                                    {reward.expiresAt ? `Expira em ${new Date(reward.expiresAt).toLocaleDateString()}` : 'Disponível'}
                                  </span>
                                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <ChevronRight className="h-4 w-4" />
                                  </div>
                               </div>
                            </Link>
                           );
                        })}
                     </div>
                  </section>
                )}

                {/* 3. Favorite Merchants */}
                {pinnedMerchants.length > 0 && (
                  <section className="text-left">
                     <div className="flex items-center gap-2 mb-4 px-2">
                        <Heart className="h-4 w-4 text-destructive" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Fixados</h3>
                     </div>
                     
                     <div className="flex flex-wrap gap-2">
                        {pinnedMerchants.map((m, i) => (
                          <Link 
                            to="/carteira/$slug"
                            params={{ slug: m.slug }}
                            key={m.slug} 
                            className="h-12 w-12 rounded-2xl bg-background border border-border/40 overflow-hidden flex items-center justify-center shadow-sm hover:scale-110 hover:shadow-md transition-all cursor-pointer"
                          >
                            {m.logo ? (
                              <img src={m.logo} className="w-full h-full object-cover" alt={m.name} />
                            ) : (
                              <span className="text-xs font-bold text-primary">{m.name.slice(0, 1)}</span>
                            )}
                          </Link>
                        ))}
                        <Link 
                          to="/carteira/descobrir"
                          className="h-12 w-12 rounded-2xl bg-accent/40 border border-dashed border-border/60 flex items-center justify-center text-muted-foreground cursor-pointer hover:bg-accent transition-colors"
                        >
                          <PlusCircle className="h-5 w-5" />
                        </Link>
                     </div>
                  </section>
                )}
              </aside>

            </div>
          </div>

          {/* Footer Area - Desktop Only */}
          <footer className="mt-20 border-t border-border/20 py-10 px-6 opacity-40 hidden lg:block">
            <div className="max-w-md mx-auto text-center">
              <LogoMark size={24} className="mx-auto grayscale opacity-50 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Fidelize 2.0 • Premium Clean Platform</p>
            </div>
          </footer>
        </main>
      </div>


      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 20px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.1);
        }
      `}} />
      {/* 4. MOBILE BOTTOM NAV (PREMIUM CLEAN) */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] flex h-16 items-center justify-around border-t border-border/40 bg-background/80 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.path || (tab.path === "/carteira" && activeTab === "/carteira/");
          const Icon = tab.icon;
          
          if (tab.isFab) {
            return (
              <button
                key={tab.path}
                onClick={() => setQrSheetOpen(true)}
                className="relative -top-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 z-[110]"
              >
                <Icon className="h-6 w-6" />
              </button>
            );
          }

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                "flex flex-col items-center gap-1 p-2 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
