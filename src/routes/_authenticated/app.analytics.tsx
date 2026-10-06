import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart3, Stamp, Gift, Trophy, Users, ArrowLeft, TrendingUp, Building2,
  Link2, Star as StarIcon, CreditCard, QrCode, MousePointerClick,
} from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Bar, BarChart, Legend,
} from "recharts";
import * as Icons from "lucide-react";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getRecapAnalytics } from "@/lib/analytics.functions";
import { PageHero } from "@/components/PageHero";
import { LoadingSkeleton, ErrorState } from "@/components/states";

export const Route = createFileRoute("/_authenticated/app/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · Recap 2.0 — Fidelize" },
      { name: "description", content: "Coortes semanais, retenção e desempenho por estabelecimento no seu programa de fidelidade." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: memberships } = useQuery({
    queryKey: ["memberships"],
    queryFn: () => getMyEstablishments(),
  });
  const ests = useMemo(
    () => (memberships ?? []).map((m) => m.establishment as { id: string; name: string; slug: string }).filter(Boolean),
    [memberships],
  );
  const [scope, setScope] = useState<string>("all");
  const [weeks, setWeeks] = useState<number>(12);

  const { data, isLoading, isError, error, refetch } = useQuery({
    enabled: ests.length > 0,
    queryKey: ["recap-analytics", scope, weeks],
    queryFn: () =>
      getRecapAnalytics({
        data: {
          establishment_id: scope === "all" ? undefined : scope,
          weeks,
        },
      }),
    staleTime: 60_000,
  });

  if (isError) return <ErrorState title="Falha ao carregar analytics" error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <LoadingSkeleton variant="page" />;

  return (
    <div className="space-y-8">
      <PageHero
        icon={BarChart3}
        eyebrow="Recap 2.0"
        title="Analytics em profundidade"
        subtitle="Coortes semanais, retenção de novos clientes e comparativo entre unidades."
        actions={
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            <ArrowLeft className="h-4 w-4" /> Painel
          </Link>
        }
        ticker={[
          { label: "Carimbos", value: data.totals.stamps.toLocaleString("pt-BR"), icon: Stamp },
          { label: "Resgates", value: data.totals.redemptions.toLocaleString("pt-BR"), icon: Gift },
          { label: "Conquistas", value: data.totals.achievements.toLocaleString("pt-BR"), icon: Trophy },
          { label: "Novos clientes", value: data.totals.newCustomers.toLocaleString("pt-BR"), icon: Users },
        ]}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {ests.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-sm"
            >
              <option value="all">Todos os estabelecimentos</option>
              {ests.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/60 p-1">
          {[4, 8, 12, 26].map((w) => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                weeks === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w}s
            </button>
          ))}
        </div>
      </div>

      {/* Timeline semanal */}
      <div className="dash-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Timeline semanal</div>
            <h3 className="sec-title mt-1 text-lg">Carimbos · Resgates · Conquistas</h3>
          </div>
          <span className="card-icon" aria-hidden><TrendingUp /></span>
        </div>
        <div className="mt-6 h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={80}>
            <AreaChart data={data.weeks} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="stFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rdFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f0abfc" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f0abfc" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="acFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5}
                tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="currentColor" opacity={0.5} />
              <Tooltip
                contentStyle={{
                  background: "color-mix(in oklab, var(--card) 92%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--primary) 40%, transparent)",
                  borderRadius: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area name="Carimbos" type="monotone" dataKey="stamps" stroke="var(--color-primary)" strokeWidth={2} fill="url(#stFill)" />
              <Area name="Resgates" type="monotone" dataKey="redemptions" stroke="#f0abfc" strokeWidth={2} fill="url(#rdFill)" />
              <Area name="Conquistas" type="monotone" dataKey="achievements" stroke="#fbbf24" strokeWidth={2} fill="url(#acFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Canais & Alcance */}
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ChannelKpi icon={Link2} label="Bio Commerce" primary={data.channels.linktree.views} primaryLabel="visualizações"
            secondary={`${data.channels.linktree.clicks} cliques · CTR ${data.channels.linktree.ctr}%`} />
          <ChannelKpi icon={StarIcon} label="Página de Avaliação" primary={data.channels.reviews.views} primaryLabel="visualizações"
            secondary={data.totals.stamps > 0 ? "canal público" : "aguardando tráfego"} />
          <ChannelKpi icon={CreditCard} label="Cartão Fidelidade" primary={data.channels.loyalty.views} primaryLabel="visualizações"
            secondary="landing pública" />
          <ChannelKpi icon={QrCode} label="QR Code" primary={data.channels.qr.total} primaryLabel="scans"
            secondary={`${data.channels.qr.scansMain} principal · ${data.channels.qr.scansSecond} secundário`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="dash-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Alcance por canal</div>
                <h3 className="sec-title mt-1 text-lg">Visualizações & cliques por semana</h3>
              </div>
              <span className="card-icon card-icon-accent" aria-hidden><TrendingUp /></span>
            </div>
            <div className="mt-6 h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={80}>
                <AreaChart data={data.channels.weekly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="qrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5}
                    tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="currentColor" opacity={0.5} />
                  <Tooltip
                    contentStyle={{
                      background: "color-mix(in oklab, var(--card) 92%, transparent)",
                      border: "1px solid color-mix(in oklab, var(--primary) 40%, transparent)",
                      borderRadius: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area name="Árvore views" type="monotone" dataKey="linktreeViews" stroke="var(--color-primary)" strokeWidth={2} fill="url(#lkFill)" />
                  <Area name="Árvore cliques" type="monotone" dataKey="linktreeClicks" stroke="#f0abfc" strokeWidth={2} fill="transparent" />
                  <Area name="Avaliação" type="monotone" dataKey="reviewsViews" stroke="#fbbf24" strokeWidth={2} fill="transparent" />
                  <Area name="Cartão" type="monotone" dataKey="loyaltyViews" stroke="#a78bfa" strokeWidth={2} fill="transparent" />
                  <Area name="QR scans" type="monotone" dataKey="qrScans" stroke="#22d3ee" strokeWidth={2} fill="url(#qrFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dash-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Ranking</div>
                <h3 className="sec-title mt-1 text-lg">Top links clicados</h3>
              </div>
              <span className="card-icon" aria-hidden><MousePointerClick /></span>
            </div>
            <div className="mt-4 space-y-3">
              {data.channels.linktree.topLinks.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum clique registrado ainda.
                </div>
              )}
              {data.channels.linktree.topLinks.map((l, i) => {
                const max = data.channels.linktree.topLinks[0]?.clicks || 1;
                const pct = Math.max(6, Math.round((l.clicks / max) * 100));
                return (
                  <div key={l.ref_id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-grid h-6 w-6 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] font-semibold shrink-0">{i + 1}</span>
                        <span className="truncate text-sm font-medium">{l.label}</span>
                      </div>
                      <span className="text-xs font-mono text-primary shrink-0">{l.clicks}</span>
                    </div>
                    <div className="rank-bar"><span style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>



      {/* Coortes */}
      <div className="dash-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Retenção por coorte</div>
            <h3 className="sec-title mt-1 text-lg">Novos clientes voltam?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              % da coorte que carimbou de novo nas semanas seguintes ao cadastro.
            </p>
          </div>
          <span className="card-icon card-icon-accent" aria-hidden><Users /></span>
        </div>
        <div className="mt-4 -mx-6 overflow-x-auto px-6">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Semana</th>
                <th className="py-2 pr-4 text-right font-medium">Novos</th>
                <th className="py-2 px-2 text-center font-medium">S0</th>
                <th className="py-2 px-2 text-center font-medium">S1</th>
                <th className="py-2 px-2 text-center font-medium">S2</th>
                <th className="py-2 px-2 text-center font-medium">S3</th>
                <th className="py-2 pl-4 text-right font-medium">Carimbos</th>
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((c) => (
                <tr key={c.week} className="border-t border-border/40">
                  <td className="py-2 pr-4 font-mono text-xs">{c.week}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{c.size}</td>
                  <RetentionCell pct={c.w0} size={c.size} />
                  <RetentionCell pct={c.w1} size={c.size} />
                  <RetentionCell pct={c.w2} size={c.size} />
                  <RetentionCell pct={c.w3} size={c.size} />
                  <td className="py-2 pl-4 text-right tabular-nums text-primary">{c.stampsTotal}</td>
                </tr>
              ))}
              {data.cohorts.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Sem dados no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Por estabelecimento */}
      {data.perEstablishment.length > 1 && (
        <div className="dash-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Comparativo</div>
              <h3 className="sec-title mt-1 text-lg">Por estabelecimento</h3>
            </div>
            <span className="card-icon" aria-hidden><Building2 /></span>
          </div>
          <div className="mt-6 h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={80}>
              <BarChart data={data.perEstablishment} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="currentColor" opacity={0.5} />
                <Tooltip
                  contentStyle={{
                    background: "color-mix(in oklab, var(--card) 92%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--primary) 40%, transparent)",
                    borderRadius: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="Carimbos" dataKey="stamps" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                <Bar name="Resgates" dataKey="redemptions" fill="#f0abfc" radius={[6, 6, 0, 0]} />
                <Bar name="Conquistas" dataKey="achievements" fill="#fbbf24" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top campanhas + Top conquistas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="dash-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Ranking</div>
              <h3 className="sec-title mt-1 text-lg">Top campanhas por resgate</h3>
            </div>
            <span className="card-icon" aria-hidden><Gift /></span>
          </div>
          <div className="mt-4 space-y-3">
            {data.topCampaigns.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">Sem resgates no período.</div>
            )}
            {data.topCampaigns.map((c, i) => {
              const max = data.topCampaigns[0]?.redemptions || 1;
              const pct = Math.max(6, Math.round((c.redemptions / max) * 100));
              return (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-grid h-6 w-6 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] font-semibold shrink-0">{i + 1}</span>
                      <span className="truncate text-sm font-medium">{c.title}</span>
                    </div>
                    <span className="text-xs font-mono text-primary shrink-0">{c.redemptions}</span>
                  </div>
                  <div className="rank-bar"><span style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dash-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Gamificação</div>
              <h3 className="sec-title mt-1 text-lg">Conquistas desbloqueadas</h3>
            </div>
            <span className="card-icon card-icon-accent" aria-hidden><Trophy /></span>
          </div>
          <div className="mt-4 space-y-3">
            {data.topAchievements.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">Ninguém desbloqueou ainda.</div>
            )}
            {data.topAchievements.map((a) => {
              const IconComp =
                (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[a.icon] ??
                Icons.Award;
              return (
                <div key={a.code} className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary shrink-0">
                    <IconComp className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.title}</div>
                    <div className="text-[11px] text-muted-foreground">{a.count} desbloqueios</div>
                  </div>
                  <span className="text-sm font-mono text-primary">{a.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RetentionCell({ pct, size }: { pct: number; size: number }) {
  if (size === 0) {
    return <td className="py-2 px-2 text-center text-muted-foreground">—</td>;
  }
  const bg = `color-mix(in oklab, var(--primary) ${Math.min(85, pct)}%, transparent)`;
  const fg = pct > 45 ? "var(--primary-foreground)" : "var(--foreground)";
  return (
    <td className="py-1.5 px-2 text-center">
      <span
        className="inline-block min-w-[3rem] rounded-md px-2 py-1 text-xs tabular-nums font-medium"
        style={{ background: bg, color: fg }}
      >
        {pct}%
      </span>
    </td>
  );
}

function ChannelKpi({
  icon: Icon, label, primary, primaryLabel, secondary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary: number;
  primaryLabel: string;
  secondary: string;
}) {
  return (
    <div className="dash-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="metric-number text-2xl">{primary.toLocaleString("pt-BR")}</span>
            <span className="text-[11px] text-muted-foreground">{primaryLabel}</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground truncate">{secondary}</div>
        </div>
        <span className="card-icon shrink-0" aria-hidden><Icon /></span>
      </div>
    </div>
  );
}

