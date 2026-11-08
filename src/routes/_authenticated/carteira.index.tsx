import { RouteLoading } from "@/components/RouteLoading";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getMyWallet, getMyHistory, getMyRewards, getPromotedEstablishmentIds } from "@/lib/my-wallet.functions";
import { listAchievementsCatalog, listMyAchievements } from "@/lib/achievements.functions";
import { ChevronRight, Sparkles, Gift, Stamp, RotateCcw, Bell, Flame, Trophy, Calendar, Clock, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { saveWalletCache, readWalletCache } from "@/lib/offline-wallet-cache";
import { supabase } from "@/integrations/supabase/client";
import {
  EmptyWalletState,
  WalletErrorState,
  WithOfflineFallback,
} from "@/components/wallet/WalletStates";
import { WalletStack } from "@/components/wallet/WalletStack";
import { WalletOnboarding } from "@/components/wallet/WalletOnboarding";



type WalletItem = Awaited<ReturnType<typeof getMyWallet>>[number];

const walletOpts = queryOptions({
  queryKey: ["my-wallet"],
  queryFn: () => getMyWallet(),
  staleTime: 15_000,
});

export const Route = createFileRoute("/_authenticated/carteira/")({
  ssr: false,
  loader: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(walletOpts);
    } catch (err) {
      // Offline-first: usa último snapshot em cache local se a rede falhar.
      // Cache restrito à sessão local: nunca restaurar dados de outra conta.
      const { data: { session } } = await supabase.auth.getSession();
      const cache = readWalletCache<WalletItem>(session?.user?.id);
      if (cache?.items?.length) {
        context.queryClient.setQueryData(walletOpts.queryKey, cache.items);
        return cache.items;
      }
      throw err;
    }
  },
  head: () => ({ meta: [{ title: "Início — Carteira Fidelize" }, { name: "robots", content: "noindex" }] }),
  component: WalletHome,
  pendingComponent: () => <RouteLoading label="Carregando sua carteira…" fullscreen={false} />,
  errorComponent: ({ error, reset }) => {
    return <WalletErrorState error={error} onRetry={reset} />;
  },
});

function WalletHome() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(walletOpts);
  const items = data ?? [];
  const totalStamps = items.reduce((sum, i) => sum + (i.card?.stamps ?? 0), 0);
  const readyRewards = items.filter((i) => {
    if (!i.card) return false;
    const campaign = i.card.campaign as { stamps_required: number; active: boolean };
    if (!campaign.active) return false;
    const req = campaign.stamps_required || 1;
    return i.card.stamps >= req;
  }).length;

  // Offline-first: persiste último estado da carteira para renderizar sem internet.
  useEffect(() => {
    if (!items.length) return;
    let active = true;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && session?.user?.id) saveWalletCache(items, session.user.id);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [items]);



  const { data: history } = useQuery({
    queryKey: ["my-history"],
    queryFn: () => getMyHistory(),
    staleTime: 15_000,
  });
  const { data: rewards } = useQuery({
    queryKey: ["my-rewards"],
    queryFn: () => getMyRewards(),
    staleTime: 15_000,
  });
  const { data: promotedIds } = useQuery({
    queryKey: ["promoted-establishment-ids"],
    queryFn: () => getPromotedEstablishmentIds(),
    staleTime: 60_000,
  });
  const promotedSet = new Set(promotedIds ?? []);

  // Feed unificado: recompensas prontas (topo) + carimbos + "faltam X" (aviso).
  const feed = buildFeed(items, history ?? [], rewards ?? []);
  const streak = computeWeeklyStreak(history ?? []);

  // "Em destaque": prioriza cartões cujo estabelecimento tem promoção ativa agora.
  const featured = [...items].sort((a, b) => {
    const aP = promotedSet.has((a.establishment as { id: string }).id) ? 1 : 0;
    const bP = promotedSet.has((b.establishment as { id: string }).id) ? 1 : 0;
    return bP - aP;
  });

  // Busca local por estabelecimento — carteiras grandes viram lista navegável.
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const visibleFeatured = term
    ? featured.filter((i) =>
        (i.establishment as { name: string }).name.toLowerCase().includes(term),
      )
    : featured;

  // Recompensa liberada mais próxima de expirar (avisa antes de perder).
  const soonestExpiry = (rewards ?? [])
    .filter((r) => r.ready && r.expiresAt)
    .map((r) => new Date(r.expiresAt as string).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0] ?? null;


  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["my-wallet"] })}>
      <div className="space-y-5">
        <div className="pt-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">Bem-vindo(a) de volta</h1>
          <p className="text-sm text-muted-foreground">
            Um resumo dos seus cartões e recompensas Fidelize.
          </p>
        </div>

        <WalletOnboarding />




        {items.length === 0 ? (
          <EmptyWalletState />
        ) : (
          <>
            {readyRewards > 0 && (
              <Link
                to="/carteira/premios"
                search={{ tab: "recompensas" }}
                className="group relative flex items-center gap-3 overflow-hidden rounded-3xl border border-primary/50 bg-gradient-to-br from-primary/15 to-primary/5 p-4 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)] transition-all hover:from-primary/20"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Pronto para resgatar</div>
                  <div className="font-display text-sm font-bold">
                    Você tem {readyRewards} {readyRewards === 1 ? "recompensa disponível" : "recompensas disponíveis"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Toque no botão <b>Meu QR</b> abaixo para retirar.</div>
                  {soonestExpiry !== null && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-300">
                      <Clock className="h-3 w-3" />
                      {expiryLabel(soonestExpiry)}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}


            {(streak.weeks >= 2 || streak.atRisk) && (
              <StreakCard weeks={streak.weeks} lastVisit={streak.lastVisit} atRisk={streak.atRisk} daysLeft={streak.daysLeft} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 xl:gap-6">
              <KpiTile label="Cartões" value={items.length} />
              <KpiTile label="Carimbos" value={totalStamps} icon={<Stamp className="h-3.5 w-3.5" />} />
              <KpiTile className="lg:flex" label="Prontas" value={readyRewards} accent={readyRewards > 0 ? "primary" : undefined} icon={<Gift className="h-3.5 w-3.5" />} />
            </div>

            <AchievementsAndRecapRow />


            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Em destaque</h2>
                <Link to="/carteira/premios" search={{ tab: "cartoes" }} className="text-xs font-medium text-primary hover:underline">
                  Ver todos →
                </Link>
              </div>

              {items.length >= 4 && (
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar estabelecimento…"
                    aria-label="Buscar estabelecimento na minha carteira"
                    className="h-11 w-full rounded-2xl border border-border/60 bg-card/40 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Limpar busca"
                      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {visibleFeatured.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-6 text-center text-sm text-muted-foreground">
                  Nenhum cartão encontrado para “{query}”.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                  <div className="col-span-1">
                    <WalletStack key={term} items={visibleFeatured.slice(0, 7)} />
                  </div>
                  <div className="hidden md:grid col-span-1 xl:col-span-2 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 h-fit">
                    {visibleFeatured.slice(1, 7).map(item => (
                       <Link 
                        key={item.customer.id} 
                        to="/carteira/$slug" 
                        params={{ slug: (item.establishment as { slug: string }).slug }}
                        className="group flex items-center gap-4 p-4 rounded-3xl bg-background/40 border border-border/40 hover:bg-background/60 hover:border-primary/30 transition-all"
                       >
                          <div className="h-12 w-12 rounded-2xl overflow-hidden border border-border/40 shrink-0">
                            { (item.establishment as { logo_url: string }).logo_url ? (
                              <img 
                                src={(item.establishment as { logo_url: string }).logo_url} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  const parent = (e.target as HTMLElement).parentElement;
                                  if (parent) {
                                    const fb = document.createElement('div');
                                    fb.className = "w-full h-full bg-primary/10 flex items-center justify-center font-bold text-primary uppercase";
                                    fb.innerText = (item.establishment as { name: string }).name.slice(0, 1).toUpperCase();
                                    parent.appendChild(fb);
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-primary/10 flex items-center justify-center font-bold text-primary uppercase">
                                {(item.establishment as { name: string }).name.slice(0,1).toUpperCase()}
                              </div>
                            )}

                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black truncate">{(item.establishment as { name: string }).name}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{item.card?.stamps || 0} de {(item.card?.campaign as { stamps_required: number })?.stamps_required || 0} carimbos</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                       </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>


            {feed.length > 0 && (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    <Bell className="mr-1 inline h-3.5 w-3.5" /> Atividade recente
                  </h2>
                  <Link to="/carteira/historico" className="text-xs font-medium text-primary hover:underline">
                    Ver tudo →
                  </Link>
                </div>
                <ol className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {feed.map((f) => <FeedRow key={f.id} f={f} />)}
                </ol>
              </section>
            )}
          </>
        )}
      </div>
    </WithOfflineFallback>
  );
}

type FeedItem = {
  id: string;
  kind: "stamp" | "reverted" | "ready" | "close";
  when: string | null;
  primary: string;
  secondary: string;
  color: string | null;
  logo: string | null;
  slug: string | null;
};

function buildFeed(
  items: Awaited<ReturnType<typeof getMyWallet>>,
  history: Awaited<ReturnType<typeof getMyHistory>>,
  rewards: Awaited<ReturnType<typeof getMyRewards>>,
): FeedItem[] {
  const out: FeedItem[] = [];

  // Recompensas prontas (topo do feed).
  for (const r of rewards.filter((r) => r.ready)) {
    const est = r.establishment as { slug: string; name: string; logo_url: string | null; primary_color: string };
    out.push({
      id: `ready-${r.cardId}`,
      kind: "ready",
      when: null,
      primary: `${r.reward} liberado`,
      secondary: est.name,
      color: est.primary_color,
      logo: est.logo_url,
      slug: est.slug,
    });
  }

  // "Faltam X carimbos para..." em cartões próximos (70%+ mas não prontos).
  for (const it of items) {
    if (!it.card) continue;
    const req = (it.card.campaign as { stamps_required: number }).stamps_required || 1;
    const pct = it.card.stamps / req;
    const missing = req - it.card.stamps;
    if (pct >= 0.7 && missing > 0 && missing <= 2) {
      const est = it.establishment as { slug: string; name: string; logo_url: string | null; primary_color: string };
      const reward = (it.card.campaign as { reward_title: string }).reward_title;
      out.push({
        id: `close-${it.customer.id}`,
        kind: "close",
        when: null,
        primary: `Faltam ${missing} para ${reward}`,
        secondary: est.name,
        color: est.primary_color,
        logo: est.logo_url,
        slug: est.slug,
      });
    }
  }

  // Últimos carimbos (limitado a 5).
  for (const s of history.slice(0, 5)) {
    const est = s.establishment as { slug: string; name: string; logo_url: string | null; primary_color: string } | null;
    out.push({
      id: `stamp-${s.id}`,
      kind: s.reverted ? "reverted" : "stamp",
      when: s.createdAt,
      primary: s.reverted ? "Carimbo estornado" : "Novo carimbo",
      secondary: `${est?.name ?? "Estabelecimento"} · ${s.campaignName ?? "Campanha"}`,
      color: est?.primary_color ?? null,
      logo: est?.logo_url ?? null,
      slug: est?.slug ?? null,
    });
  }

  return out.slice(0, 8);
}

function FeedRow({ f }: { f: FeedItem }) {
  const Icon =
    f.kind === "ready" ? Sparkles :
    f.kind === "close" ? Gift :
    f.kind === "reverted" ? RotateCcw : Stamp;
  const tone =
    f.kind === "ready" ? "bg-primary/15 text-primary border-primary/40" :
    f.kind === "close" ? "bg-amber-500/10 text-amber-600 border-amber-500/40 dark:text-amber-300" :
    f.kind === "reverted" ? "bg-destructive/10 text-destructive border-destructive/30" :
    "bg-muted text-muted-foreground border-border/60";
  const inner = (
    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background/60 p-2.5">
      <div className={"grid h-9 w-9 shrink-0 place-items-center rounded-xl border " + tone}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{f.primary}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {f.secondary}{f.when ? ` · ${formatDate(f.when)}` : ""}
        </div>
      </div>
      {f.slug && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
  return (
    <li>
      {f.slug ? (
        <Link to="/carteira/$slug" params={{ slug: f.slug }} className="block transition-colors hover:brightness-105">
          {inner}
        </Link>
      ) : inner}
    </li>
  );
}

function KpiTile({ label, value, accent, icon, className }: { label: string; value: number; accent?: "primary"; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card/40 p-3 backdrop-blur", className)}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {icon}{label}
      </div>
      <div className={"mt-1 font-display text-2xl font-bold " + (accent === "primary" ? "text-primary" : "")}>
        {value}
      </div>
    </div>
  );
}

/**
 * Streak semanal: quantas semanas ISO consecutivas (contando esta semana)
 * o usuário registrou ao menos um carimbo não estornado.
 */
function computeWeeklyStreak(
  history: Awaited<ReturnType<typeof getMyHistory>>,
): { weeks: number; lastVisit: string | null; atRisk: boolean; daysLeft: number } {
  const valid = history.filter((h) => !h.reverted && h.createdAt);
  const now = new Date();
  const isoDay = now.getUTCDay() || 7; // 1..7 (Mon..Sun)
  const daysLeft = 8 - isoDay; // dias restantes até o fim da semana ISO (inclui hoje)
  if (!valid.length) return { weeks: 0, lastVisit: null, atRisk: false, daysLeft };
  const weekKeys = new Set(valid.map((h) => isoWeekKey(new Date(h.createdAt))));
  const hasCurrent = weekKeys.has(isoWeekKey(now));
  const hasPrev = weekKeys.has(isoWeekKey(addDays(now, -7)));
  if (!hasCurrent && !hasPrev) return { weeks: 0, lastVisit: valid[0].createdAt, atRisk: false, daysLeft };
  let cursor = hasCurrent ? now : addDays(now, -7);
  let weeks = 0;
  while (weekKeys.has(isoWeekKey(cursor))) {
    weeks++;
    cursor = addDays(cursor, -7);
  }
  return { weeks, lastVisit: valid[0].createdAt, atRisk: !hasCurrent && hasPrev && weeks >= 1, daysLeft };
}

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

function StreakCard({ weeks, lastVisit, atRisk, daysLeft }: { weeks: number; lastVisit: string | null; atRisk: boolean; daysLeft: number }) {
  if (atRisk) {
    // Vermelho SÓ quando faltar menos de 2 dias. Antes disso, tom âmbar (lembrete, não alarme).
    const critical = daysLeft < 2;
    const accent = critical ? "destructive" : "amber-500";
    return (
      <div className={`relative overflow-hidden rounded-3xl border ${critical ? "border-destructive/50" : "border-amber-500/40"} bg-gradient-to-br ${critical ? "from-destructive/15 via-amber-500/10 to-orange-500/10" : "from-amber-500/12 via-orange-500/8 to-primary/8"} p-4`}>
        <div className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl ${critical ? "bg-destructive/25" : "bg-amber-500/20"}`} />
        <div className="relative flex items-center gap-3">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${critical ? "from-destructive to-orange-600" : "from-amber-500 to-orange-500"} text-white shadow-lg`}>
            <Flame className="wallet-streak-flame h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-[10px] font-black uppercase tracking-widest ${critical ? "text-destructive" : "text-amber-600 dark:text-amber-300"}`}>
              {critical ? "Sua sequência está em risco" : "Sequência quase pausando"}
            </div>
            <div className="font-display text-base font-bold">
              {critical ? (
                <>Faltam <span className="text-destructive">{daysLeft} {daysLeft === 1 ? "dia" : "dias"}</span> para pausar {weeks} {weeks === 1 ? "semana" : "semanas"} 🔥</>
              ) : (
                <>Ainda dá tempo — <span className="text-amber-600 dark:text-amber-300">{daysLeft} dias</span> para manter {weeks} {weeks === 1 ? "semana" : "semanas"} de combo</>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {critical ? "Passe em uma loja hoje ou amanhã para manter o combo vivo." : "Uma visita esta semana mantém o combo em pé."}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-primary/10 p-4">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
          <Flame className="wallet-streak-flame h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">
            Sequência semanal
          </div>
          <div className="font-display text-base font-bold">
            Você visitou <span className="text-orange-600 dark:text-orange-400">{weeks} semanas seguidas</span> 🔥
          </div>
          {lastVisit && (
            <div className="text-[11px] text-muted-foreground">
              Última visita em {formatDate(lastVisit)} — não perca o ritmo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function AchievementsAndRecapRow() {
  const { data: catalog = [] } = useQuery({
    queryKey: ["achievements-catalog"],
    queryFn: () => listAchievementsCatalog(),
    staleTime: 5 * 60_000,
  });
  const { data: mine = [] } = useQuery({
    queryKey: ["my-achievements"],
    queryFn: () => listMyAchievements(),
    staleTime: 30_000,
  });
  const total = catalog.length;
  const unlocked = mine.length;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        to="/carteira/conquistas"
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-amber-500/10 via-card/40 to-card/40 p-3 transition-all hover:border-amber-500/50"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/15 text-amber-500 dark:text-amber-300">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Conquistas
          </div>
          <div className="font-display text-lg font-black">
            {unlocked}
            <span className="text-xs font-bold text-muted-foreground">/{total}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </Link>

      <Link
        to="/carteira/retrospectiva"
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-violet-500/10 via-card/40 to-card/40 p-3 transition-all hover:border-violet-500/50"
      >
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500/25 to-purple-500/15 text-violet-500 dark:text-violet-300">
          <Calendar className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Retrospectiva
          </div>
          <div className="font-display text-sm font-bold">Seu ano em números</div>
          <div className="text-[10px] text-muted-foreground">Toque para ver →</div>
        </div>
      </Link>
    </div>
  );
}


export function WalletCard({ item }: { item: WalletItem }) {
  const est = item.establishment as { slug: string; name: string; logo_url: string | null; primary_color: string; active: boolean };
  const card = item.card;
  const req = card ? (card.campaign as { stamps_required: number }).stamps_required || 1 : 1;
  const stamps = card?.stamps ?? 0;
  const pct = Math.min(100, Math.round((stamps / req) * 100));
  const missing = Math.max(0, req - stamps);
  const reward = card ? (card.campaign as { reward_title: string }).reward_title : null;
  const campaignActive = card ? (card.campaign as { active: boolean }).active : true;

  return (
    <Link
      to="/carteira/$slug"
      params={{ slug: est.slug }}
      className="group relative block overflow-hidden rounded-3xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: est.primary_color || "hsl(var(--primary))" }}
      />
      <div className="flex items-start gap-3">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-muted text-lg font-bold uppercase"
          style={{ color: est.primary_color || undefined }}
        >
          {est.logo_url ? (
            <img src={est.logo_url} alt={est.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            est.name.slice(0, 2)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold">{est.name}</h3>
            {!est.active && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                inativo
              </span>
            )}
            {!campaignActive && (
              <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-amber-600 dark:text-amber-300">
                expirado
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {card ? (
              <>
                <span className="font-semibold text-foreground">{stamps}</span>
                <span> de {req} carimbos · </span>
                {missing > 0 ? (
                  <>faltam <span className="font-medium text-foreground">{missing}</span> para <span className="text-foreground">{reward}</span></>
                ) : campaignActive ? (
                  <span className="font-semibold text-primary inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Recompensa liberada
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-300">Campanha expirada — aguarde nova campanha</span>
                )}
              </>
            ) : (
              "Cartão aguardando primeiro carimbo"
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: est.primary_color || "hsl(var(--primary))",
              }}
            />
          </div>
          {item.customer.lastVisitAt && (
            <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Última visita: {formatDate(item.customer.lastVisitAt)}
            </div>
          )}
        </div>
        <ChevronRight className="mt-4 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

/** Rótulo curto de validade da recompensa liberada ("expira hoje", "3 dias"). */
function expiryLabel(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return "Expirada";
  const days = Math.ceil(diff / 86_400_000);
  if (days <= 1) return "Expira hoje";
  return `Expira em ${days} dias`;
}
