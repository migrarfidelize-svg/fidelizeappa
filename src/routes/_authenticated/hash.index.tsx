import { RouteLoading } from "@/components/RouteLoading";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { GreetingVoice } from "@/components/GreetingVoice";
import { LayoutDashboard as HeroIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetOverview } from "@/lib/admin.functions";
import {
  Building2, Users, Stamp, Gift, TrendingUp, Ban, CheckCircle2,
  DollarSign, Shield, Activity, Crown,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { formatBRL, formatDate } from "@/lib/format";



export const Route = createFileRoute("/_authenticated/hash/")({
  component: AdminOverview,
});

const PLAN_LABEL: Record<string, string> = {
  free: "Gratuito", starter: "Essencial", pro: "Profissional", enterprise: "Premium", business: "Empresarial",
};

function AdminOverview() {
  const getOverview = useServerFn(adminGetOverview);
  const { data, isError, refetch } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getOverview(),
    retry: 1,
  });
  if (isError) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold">Não foi possível carregar os indicadores</h2>
        <p className="text-sm text-muted-foreground">O painel está temporariamente indisponível. Nenhum dado administrativo foi alterado.</p>
        <button type="button" onClick={() => void refetch()} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Tentar novamente
        </button>
      </div>
    );
  }
  if (!data) return <RouteLoading label="Carregando visão geral…" fullscreen={false} className="min-h-[40vh]" />;

  const secondary: Array<{ label: string; value: string | number; icon: any; accent?: boolean }> = [
    { label: "Clientes", value: data.customersTotal, icon: Users },
    { label: "Carimbos", value: data.stampsTotal, icon: Stamp, accent: true },
    { label: "Recompensas", value: data.rewardsTotal, icon: Gift },
    { label: "Resgatadas", value: data.rewardsRedeemed, icon: TrendingUp, accent: true },
  ];

  const healthPct = data.estTotal ? Math.round((data.estActive / data.estTotal) * 100) : 0;
  const spark = data.series.slice(-14);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_var(--color-success)]" />
          Modo Produção Ativo
        </div>
        <div className="flex items-center gap-1 opacity-60">
          Infraestrutura Segura · SSL · AES-256
        </div>
      </div>

      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · Global"}
        liveLabel={"Ao vivo"}
        title={"Visão global da plataforma"}
        subtitle={"Métricas consolidadas de empresas, receita e operação em tempo real."}
      />

      <GreetingVoice />

      {/* EXECUTIVE BRIEF: receita + saúde */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="dash-card dash-card-accent dash-rise lg:col-span-2 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <Activity className="h-3.5 w-3.5 animate-pulse text-primary" /> Receita recorrente
              </div>
              <div className="mt-3 metric-number text-4xl sm:text-5xl">{formatBRL(data.mrr)}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.estActive.toLocaleString("pt-BR")} empresas ativas gerando receita mensal.
              </p>
            </div>
            <span className="card-icon card-icon-accent" aria-hidden><DollarSign /></span>
          </div>
          <div className="mt-6 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="admSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="carimbos" stroke="var(--color-primary)" strokeWidth={2} fill="url(#admSpark)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="dash-card dash-rise p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Saúde</div>
              <h3 className="font-display text-lg font-semibold">Base de empresas</h3>
            </div>
            <span className="card-icon" aria-hidden><Shield /></span>
          </div>

          <div className="mt-6 flex items-end gap-3">
            <div className="metric-number text-4xl">{healthPct}%</div>
            <div className="pb-1.5 text-xs text-muted-foreground">operando ativas</div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted/40 overflow-hidden border border-primary/10">
            <div className="h-full gradient-brand transition-all duration-700" style={{ width: `${healthPct}%` }} />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { l: "Total", v: data.estTotal, i: Building2 },
              { l: "Ativas", v: data.estActive, i: CheckCircle2 },
              { l: "Bloq.", v: data.estBlocked, i: Ban },
            ].map((x) => (
              <div key={x.l} className="rounded-xl border border-border/60 bg-muted/20 py-3">
                <x.i className="mx-auto h-4 w-4 text-muted-foreground" />
                <div className="mt-1 metric-number text-lg">{x.v.toLocaleString("pt-BR")}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{x.l}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* KPI SECUNDÁRIOS */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {secondary.map((s, i) => (
          <div
            key={s.label}
            className={`dash-card dash-rise ${s.accent ? "dash-card-accent" : ""} p-4 sm:p-5`}
            style={{ animationDelay: `${i * 60}ms`, ["--sweep" as any]: `${i * 45}deg` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-2 metric-number text-xl sm:text-2xl">
                  {s.value.toLocaleString("pt-BR")}
                </div>
              </div>
              <span className={`card-icon ${s.accent ? "card-icon-accent" : ""}`} aria-hidden>
                <s.icon />
              </span>
            </div>
          </div>
        ))}
      </div>


      {/* CHART + PLAN DISTRIBUTION */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="dash-card lg:col-span-2 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Últimos 30 dias</div>
              <h3 className="font-display text-lg font-semibold">Carimbos na plataforma</h3>
            </div>
            <span className="card-icon" aria-hidden><Activity /></span>
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series}>
                <defs>
                  <linearGradient id="admArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="currentColor" opacity={0.5} />
                <Tooltip
                  contentStyle={{
                    background: "color-mix(in oklab, var(--card) 92%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--primary) 40%, transparent)",
                    borderRadius: 12,
                  }}
                />
                <Area type="monotone" dataKey="carimbos" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#admArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card dash-card-accent p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Distribuição</div>
              <h3 className="font-display text-lg font-semibold">Por plano</h3>
            </div>
            <span className="card-icon card-icon-accent" aria-hidden><Crown /></span>
          </div>
          <div className="mt-6 space-y-4">
            {Object.entries(data.planCounts).map(([tier, count]) => {
              const pct = data.estTotal ? Math.round((count / data.estTotal) * 100) : 0;
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{PLAN_LABEL[tier] ?? tier}</span>
                    <span className="text-muted-foreground text-xs">{count} · {pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted/40 overflow-hidden border border-primary/10">
                    <div
                      className="h-full gradient-brand transition-all duration-700"
                      style={{ width: `${pct}%`, boxShadow: "0 0 12px -2px var(--primary)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RECENT */}
      <div className="dash-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Cadastros</div>
            <h3 className="font-display text-lg font-semibold">Empresas recentes</h3>
          </div>
          <Link to="/hash/empresas" className="text-xs text-primary font-medium hover:underline">
            Ver todas →
          </Link>
        </div>
        <div className="mt-4 divide-y divide-border/50">
          {data.recentEsts.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma empresa cadastrada.</div>
          )}
          {data.recentEsts.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground">/{e.slug} · {formatDate(e.created_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary">
                  {PLAN_LABEL[e.plan] ?? e.plan}
                </span>
                {e.active ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-success/10 border border-success/30 text-success">Ativa</span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 text-destructive">Bloqueada</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
