import { RouteLoading } from "@/components/RouteLoading";
import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { Sparkles as HeroIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Star, Reply, EyeOff, Eye, MessageSquare, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { listReviews, getReviewStats, replyReview, toggleReviewPublic, getReviewSettings, saveReviewSettings } from "@/lib/reviews.functions";
import {
  getMerchantReviewForm, saveMerchantReviewForm, saveRatingOptions,
  upsertReviewQuestion, deleteReviewQuestion,
  listPublicReviewsInbox, updatePublicReview, getPublicReviewStats,
  getReviewInsights,
} from "@/lib/public-reviews.functions";
import { MerchantReplyDialog } from "@/components/MerchantReplyDialog";
import { formatDate } from "@/lib/format";
import { Trash2, Plus, ExternalLink as ExtLink, AlertTriangle, TrendingDown, Search, CheckCircle2, Lock, Sparkles, Inbox, Globe, ListChecks, HelpCircle, Settings2, Ticket, FileText } from "lucide-react";
import { useMyFeature } from "@/hooks/useMyFeature";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/avaliacoes/")({
  head: () => ({ meta: [{ title: "Avaliações — Fidelize" }] }),
  component: Page,
});

function Stars({ n, size = "sm" }: { n: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${cls} ${i <= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

/* ============ Circuit Cockpit HUD ============ */
function CockpitHero({ est }: { est: { id: string; name: string; slug: string } }) {
  const statsFn = useServerFn(getReviewStats);
  const { data: stats } = useQuery({
    queryKey: ["review-stats", est.id],
    queryFn: () => statsFn({ data: { establishmentId: est.id, days: 30 } }),
  });
  const { data: prev } = useQuery({
    queryKey: ["review-stats", est.id, "prev60"],
    queryFn: () => statsFn({ data: { establishmentId: est.id, days: 60 } }),
  });

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/avaliar/${est.slug}`
    : `/avaliar/${est.slug}`;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicUrl); toast.success("Link público copiado."); }
    catch { toast.error("Não foi possível copiar."); }
  };

  const avg = stats?.avg ?? 0;
  const prevAvg = prev && prev.count > (stats?.count ?? 0)
    ? ((prev.avg * prev.count) - ((stats?.avg ?? 0) * (stats?.count ?? 0))) / Math.max(1, prev.count - (stats?.count ?? 0))
    : 0;
  const delta = prevAvg ? +(avg - prevAvg).toFixed(2) : 0;
  const npsLabel = stats?.nps == null
    ? "—"
    : stats.nps >= 50 ? "Excelente" : stats.nps >= 0 ? "Bom" : "Crítico";
  const npsTone = stats?.nps == null
    ? "text-muted-foreground/60 bg-muted/40"
    : stats.nps >= 50 ? "text-emerald-400 bg-emerald-500/10"
    : stats.nps >= 0 ? "text-yellow-300 bg-yellow-500/10"
    : "text-rose-400 bg-rose-500/10";
  const distTotal = Math.max(1, Object.values(stats?.dist ?? {}).reduce((a, b) => a + b, 0));

  return (
    <div className="space-y-6">
      {/* Header cockpit */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-2 border-primary pl-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary/80">
              Reputação · Monitoramento em tempo real
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
            Avaliações de atendimento
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
            Acompanhe a percepção dos seus clientes e transforme cada feedback em inteligência de crescimento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
            <Link to="/app/qr" search={{ dest: "reviews" as const }}>
              <Sparkles className="h-3.5 w-3.5" /> Configurar QR Code
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink}>
            Copiar link
          </Button>
          <Button asChild size="sm" className="shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
            <a href={publicUrl} target="_blank" rel="noopener">
              Ver página pública <ExtLink className="ml-1 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      {/* KPI Band */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Nota média */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4 group">
          <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-all" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nota média · 30d</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">{stats ? avg.toFixed(1) : "—"}</span>
            <span className="text-xs text-muted-foreground">/ 5.0</span>
            {delta !== 0 && (
              <span className={`ml-auto text-[10px] font-bold font-mono ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
              </span>
            )}
          </div>
          <div className="mt-3 h-1 w-full rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] transition-all duration-700"
              style={{ width: `${(avg / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Volume */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Avaliações · 30d</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">{stats?.count ?? 0}</span>
          </div>
          <p className="mt-3 text-[10px] font-mono text-muted-foreground">
            {stats?.count ? `${stats.count} respostas coletadas` : "Nenhuma resposta ainda"}
          </p>
        </div>

        {/* NPS */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">NPS · 30d</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-foreground">{stats?.nps ?? "—"}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${npsTone}`}>{npsLabel}</span>
          </div>
          <div className="mt-3 flex gap-1">
            <div className="h-1 flex-1 rounded-sm bg-rose-500/30" />
            <div className="h-1 flex-1 rounded-sm bg-yellow-500/30" />
            <div className="h-1 flex-[4] rounded-sm bg-emerald-500/70 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          </div>
          <p className="mt-2 text-[10px] font-mono text-muted-foreground">
            {stats?.npsResponses ?? 0} respostas NPS
          </p>
        </div>

        {/* Distribuição */}
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Distribuição</p>
          <div className="mt-2 space-y-1">
            {[5, 4, 3, 2, 1].map((n) => {
              const v = stats?.dist?.[n] ?? 0;
              const pct = (v / distTotal) * 100;
              return (
                <div key={n} className="flex items-center gap-2">
                  <span className="text-[10px] w-3 font-mono text-muted-foreground">{n}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${n >= 4 ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]" : n === 3 ? "bg-yellow-400" : "bg-rose-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-[10px] font-mono text-muted-foreground">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


function Page() {
  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string; slug: string } | undefined;
  const { allowed, isLoading: featLoading } = useMyFeature(est?.id, "public_reviews");

  if (!est) return <RouteLoading label="Carregando…" fullscreen={false} className="min-h-[40vh]" />;

  if (!featLoading && !allowed) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Card className="border-primary/30">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary-soft grid place-items-center">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Avaliações de atendimento</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Este recurso é opcional e não está incluído no seu plano atual. Faça upgrade para publicar um formulário de avaliação, gerar QR Code exclusivo, coletar feedback dos clientes e responder publicamente.
              </p>
            </div>
            <ul className="text-sm text-left space-y-1 max-w-md mx-auto text-muted-foreground">
              <li className="flex gap-2"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Página pública /avaliar/{est.slug}</li>
              <li className="flex gap-2"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> QR Code dedicado para balcão e recibos</li>
              <li className="flex gap-2"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Inbox de respostas, alertas de nota baixa e insights por pergunta</li>
              <li className="flex gap-2"><Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Resposta pública do lojista visível na página</li>
            </ul>
            <Button asChild size="lg" className="mt-2">
              <Link to="/app/planos">Ver planos disponíveis</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">

      <CockpitHero est={est} />

      <ReviewsNav est={est} />
    </div>
  );
}

/* -------- Compact grouped navigation -------- */
const NAV_GROUPS = [
  {
    id: "formulario",
    label: "Formulário público",
    icon: FileText,
    tabs: [
      { v: "public-form", label: "Formulário", icon: FileText },
      { v: "public-ratings", label: "Notas 1–5", icon: ListChecks },
      { v: "public-questions", label: "Perguntas extras", icon: HelpCircle },
    ],
  },
  {
    id: "config",
    label: "Configurações",
    icon: Settings2,
    tabs: [{ v: "config", label: "Config. voucher", icon: Settings2 }],
  },
  {
    id: "voucher",
    label: "Voucher",
    icon: Ticket,
    tabs: [{ v: "feed", label: "Voucher", icon: Ticket }],
  },
  {
    id: "publico",
    label: "Público",
    icon: Globe,
    tabs: [{ v: "public-inbox", label: "Público", icon: Globe }],
  },
  {
    id: "alertas",
    label: "Alertas ≤2",
    icon: AlertTriangle,
    tabs: [{ v: "alerts", label: "Alertas ≤2", icon: AlertTriangle }],
  },
  {
    id: "insights",
    label: "Insights AI",
    icon: TrendingDown,
    tabs: [{ v: "insights", label: "Insights AI", icon: TrendingDown }],
  },
] as const;

function ReviewsNav({ est }: { est: { id: string; name: string; slug: string } }) {
  const [group, setGroup] = useState<string>("respostas");
  const activeGroup = NAV_GROUPS.find((g) => g.id === group) ?? NAV_GROUPS[0];
  const [tab, setTab] = useState<string>(activeGroup.tabs[0].v);

  function pickGroup(id: string) {
    setGroup(id);
    const g = NAV_GROUPS.find((x) => x.id === id);
    if (g) setTab(g.tabs[0].v);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-1">


        {NAV_GROUPS.map((g) => {
          const Icon = g.icon;
          const active = g.id === group;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => pickGroup(g.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}

            >
              <Icon className="h-3.5 w-3.5" />
              {g.label}
            </button>
          );
        })}
      </div>

      {activeGroup.tabs.length > 1 && (
        <div className="-mx-4 overflow-x-auto no-scrollbar md:mx-0">
          <div className="flex w-max items-center gap-1 px-4 md:px-0">
            {activeGroup.tabs.map((t) => {
              const Icon = t.icon;
              const active = t.v === tab;
              return (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setTab(t.v)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border/60 bg-background text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        {tab === "feed" && <Feed estId={est.id} />}
        {tab === "public-inbox" && <PublicInbox estId={est.id} />}
        {tab === "alerts" && <LowRatingAlerts estId={est.id} />}
        {tab === "insights" && <InsightsTab estId={est.id} />}
        {tab === "public-form" && <PublicFormTab estId={est.id} slug={est.slug} />}
        {tab === "public-ratings" && <PublicRatingsTab estId={est.id} />}
        {tab === "public-questions" && <PublicQuestionsTab estId={est.id} />}
        {tab === "config" && <Settings estId={est.id} />}
      </div>
    </div>
  );
}



function Feed({ estId }: { estId: string }) {
  const statsFn = useServerFn(getReviewStats);
  const listFn = useServerFn(listReviews);
  const [filter, setFilter] = useState<string>("all");

  const { data: stats } = useQuery({
    queryKey: ["review-stats", estId],
    queryFn: () => statsFn({ data: { establishmentId: estId, days: 30 } }),
  });
  const { data: rows, isLoading } = useQuery({
    queryKey: ["reviews", estId, filter],
    queryFn: () => listFn({ data: { establishmentId: estId, ratingFilter: filter === "all" ? undefined : Number(filter) } }),
  });

  const distMax = useMemo(() => Math.max(1, ...Object.values(stats?.dist ?? {})), [stats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Filtrar por nota</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n} estrelas</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {rows?.length ?? 0} resultado(s)
        </div>
      </div>

      {isLoading ? (
        <RouteLoading fullscreen={false} className="min-h-[40vh]" />
      ) : (rows ?? []).length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/60 bg-gradient-to-b from-primary/[0.03] to-transparent py-16 px-8 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <svg width="100%" height="100%" viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 200H180L220 240H580L620 200H800" stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="4 6" />
              <circle cx="220" cy="240" r="3" fill="hsl(var(--primary))" />
              <circle cx="580" cy="240" r="3" fill="hsl(var(--primary))" />
            </svg>
          </div>
          <div className="relative">
            <div className="mx-auto mb-5 h-16 w-16 rounded-full border border-primary/40 grid place-items-center relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
              <MessageSquare className="relative h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Aguardando sinais…</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Seu radar de reputação está ativo. Divulgue o QR no balcão ou no voucher para acelerar os primeiros feedbacks.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button asChild size="sm" className="shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
                <Link to="/app/qr" search={{ dest: "reviews" }}><Sparkles className="h-3.5 w-3.5" /> Gerar QR Code</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`/avaliar/${estId}`} target="_blank" rel="noopener">Ver página pública</a>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {(rows ?? []).map((r) => <ReviewRow key={r.id} r={r} estId={estId} />)}
        </div>
      )}
    </div>
  );
}


function ReviewRow({ r, estId }: { r: any; estId: string }) {
  const replyFn = useServerFn(replyReview);
  const toggleFn = useServerFn(toggleReviewPublic);
  const qc = useQueryClient();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.reply ?? "");

  const mut = useMutation({
    mutationFn: async () => replyFn({ data: { reviewId: r.id, reply } }),
    onSuccess: () => { toast.success("Resposta enviada"); setReplying(false); qc.invalidateQueries({ queryKey: ["reviews", estId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const togg = useMutation({
    mutationFn: async () => toggleFn({ data: { reviewId: r.id, isPublic: !r.is_public } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reviews", estId] }); toast.success(r.is_public ? "Ocultada" : "Publicada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const displayName = r.customer_name || r.customers?.name || "Cliente";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Stars n={r.rating} />
              <span className="text-sm font-semibold">{displayName}</span>
              {r.nps != null && <Badge variant="outline">NPS {r.nps}</Badge>}
              {!r.is_public && <Badge variant="secondary">Oculta</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => togg.mutate()} disabled={togg.isPending}>
              {r.is_public ? <><EyeOff className="mr-1 h-3 w-3" />Ocultar</> : <><Eye className="mr-1 h-3 w-3" />Publicar</>}
            </Button>
            {!r.reply && <Button size="sm" onClick={() => setReplying((v) => !v)}><Reply className="mr-1 h-3 w-3" />Responder</Button>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {r.comment && <p className="text-sm">{r.comment}</p>}
        {r.reply && (
          <div className="rounded-lg border-l-4 border-primary bg-muted/40 p-3 text-sm">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-primary">
              <MessageSquare className="h-3 w-3" /> Resposta do estabelecimento
            </div>
            {r.reply}
            <div className="mt-1 text-[10px] text-muted-foreground">{r.replied_at && formatDate(r.replied_at)}</div>
          </div>
        )}
        {replying && !r.reply && (
          <div className="space-y-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escreva uma resposta educada e útil…" maxLength={1000} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending || !reply.trim()}>Enviar</Button>
              <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Settings({ estId }: { estId: string }) {
  const getFn = useServerFn(getReviewSettings);
  const saveFn = useServerFn(saveReviewSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["review-settings", estId], queryFn: () => getFn({ data: { establishmentId: estId } }) });
  const [form, setForm] = useState<any>(null);

  const state = form ?? data ?? {
    auto_prompt: true, prompt_title: "Como foi seu atendimento?",
    prompt_message: "Sua opinião nos ajuda a melhorar. Leva menos de 30 segundos!",
    ask_nps: false, ask_categories: true,
    google_place_url: "", google_redirect_min_rating: 5,
    public_page_enabled: true, thank_you_message: "Obrigado pelo seu feedback!",
  };
  const upd = (patch: any) => setForm({ ...state, ...patch });

  const mut = useMutation({
    mutationFn: async () => saveFn({ data: {
      establishmentId: estId,
      auto_prompt: state.auto_prompt,
      prompt_title: state.prompt_title,
      prompt_message: state.prompt_message,
      ask_nps: state.ask_nps,
      ask_categories: state.ask_categories,
      google_place_url: state.google_place_url || null,
      google_redirect_min_rating: state.google_redirect_min_rating,
      public_page_enabled: state.public_page_enabled,
      thank_you_message: state.thank_you_message,
    } }),
    onSuccess: () => { toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["review-settings", estId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card><CardHeader><CardTitle>Configurações de avaliação</CardTitle></CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Título do convite</Label>
          <Input value={state.prompt_title} maxLength={120} onChange={(e) => upd({ prompt_title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Input value={state.prompt_message} maxLength={300} onChange={(e) => upd({ prompt_message: e.target.value })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div><div className="text-sm font-medium">Convidar automaticamente após carimbo</div>
            <div className="text-xs text-muted-foreground">Aparece no voucher do cliente ao entrar após novo carimbo.</div></div>
          <Switch checked={state.auto_prompt} onCheckedChange={(v) => upd({ auto_prompt: v })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div><div className="text-sm font-medium">Pedir NPS (0-10)</div>
            <div className="text-xs text-muted-foreground">Disponível apenas no plano Enterprise.</div></div>
          <Switch checked={state.ask_nps} onCheckedChange={(v) => upd({ ask_nps: v })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
          <div><div className="text-sm font-medium">Página pública de avaliações</div>
            <div className="text-xs text-muted-foreground">Fica em <code>/avaliar/seu-slug</code>. Bom para SEO.</div></div>
          <Switch checked={state.public_page_enabled} onCheckedChange={(v) => upd({ public_page_enabled: v })} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>URL do Google Reviews (opcional)</Label>
          <Input placeholder="https://g.page/r/…/review" value={state.google_place_url ?? ""}
            onChange={(e) => upd({ google_place_url: e.target.value })} />
          <p className="text-xs text-muted-foreground">Após uma avaliação com nota igual ou maior que <b>{state.google_redirect_min_rating}</b>, redirecionamos o cliente para deixar uma review no Google.</p>
        </div>
        <div className="space-y-2">
          <Label>Nota mínima para redirecionar ao Google</Label>
          <Select value={String(state.google_redirect_min_rating)} onValueChange={(v) => upd({ google_redirect_min_rating: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[5, 4, 3].map((n) => <SelectItem key={n} value={String(n)}>{n}+ estrelas</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Mensagem de agradecimento</Label>
          <Input value={state.thank_you_message} maxLength={300} onChange={(e) => upd({ thank_you_message: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Salvando…" : "Salvar configurações"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ================== PUBLIC RATING SYSTEM TABS ==================

function PublicFormTab({ estId, slug }: { estId: string; slug: string }) {
  const getFn = useServerFn(getMerchantReviewForm);
  const saveFn = useServerFn(saveMerchantReviewForm);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["mr-form", estId], queryFn: () => getFn({ data: { establishmentId: estId } }) });
  const [f, setF] = useState<any>(null);
  const s = f ?? data?.form;
  const upd = (patch: any) => setF({ ...s, ...patch });

  const mut = useMutation({
    mutationFn: async () => saveFn({ data: {
      establishmentId: estId,
      active: !!s.active,
      title: s.title, question: s.question,
      description: s.description ?? null,
      submit_label: s.submit_label,
      success_message: s.success_message,
      star_color: s.star_color, button_color: s.button_color,
      google_review_url: s.google_review_url ?? null,
      redirect_to_google_enabled: !!s.redirect_to_google_enabled,
      show_average: !!s.show_average,
      show_review_count: !!s.show_review_count,
      anonymous_allowed: !!s.anonymous_allowed,
      name_required: !!s.name_required,
      phone_required: !!s.phone_required,
      email_required: !!s.email_required,
      comment_required: !!s.comment_required,
      allow_multiple: !!s.allow_multiple,
      cooldown_hours: Number(s.cooldown_hours ?? 24),
      consent_text: s.consent_text ?? null,
    } }),
    onSuccess: () => { toast.success("Formulário salvo"); qc.invalidateQueries({ queryKey: ["mr-form", estId] }); qc.invalidateQueries({ queryKey: ["public-review-form", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!s) return <RouteLoading label="Carregando…" fullscreen={false} className="min-h-[40vh]" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
        <div>
          <div className="text-sm font-medium">Avaliações públicas ativas</div>
          <div className="text-xs text-muted-foreground">Aparece na Bio Commerce e em <code>/avaliar/{slug}</code></div>
        </div>
        <div className="flex items-center gap-3">
          <a href={`/avaliar/${slug}`} target="_blank" rel="noopener" className="text-sm text-primary hover:underline inline-flex items-center gap-1"><ExtLink className="h-3 w-3" />Abrir</a>
          <Switch checked={s.active} onCheckedChange={(v) => upd({ active: v })} />
        </div>
      </div>

      <Card><CardHeader><CardTitle>Textos & botão</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div><Label>Título</Label><Input value={s.title} maxLength={160} onChange={(e) => upd({ title: e.target.value })} /></div>
          <div><Label>Texto do botão</Label><Input value={s.submit_label} maxLength={60} onChange={(e) => upd({ submit_label: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Pergunta principal</Label><Input value={s.question} maxLength={300} onChange={(e) => upd({ question: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Texto de apoio (opcional)</Label><Input value={s.description ?? ""} maxLength={500} onChange={(e) => upd({ description: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Mensagem de agradecimento</Label><Input value={s.success_message} maxLength={300} onChange={(e) => upd({ success_message: e.target.value })} /></div>
          <div><Label>Cor das estrelas</Label><Input type="color" value={s.star_color} onChange={(e) => upd({ star_color: e.target.value })} /></div>
          <div><Label>Cor do botão</Label><Input type="color" value={s.button_color} onChange={(e) => upd({ button_color: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Campos exigidos</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {[
            ["anonymous_allowed", "Permitir avaliação anônima"],
            ["name_required", "Exigir nome"],
            ["phone_required", "Exigir telefone"],
            ["email_required", "Exigir e-mail"],
            ["comment_required", "Exigir comentário"],
            ["show_average", "Mostrar nota média publicamente"],
            ["show_review_count", "Mostrar quantidade de avaliações"],
            ["allow_multiple", "Permitir mais de uma avaliação por pessoa"],
          ].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">{label}</span>
              <Switch checked={!!s[k]} onCheckedChange={(v) => upd({ [k]: v })} />
            </div>
          ))}
          <div className="md:col-span-2">
            <Label>Intervalo mínimo entre avaliações do mesmo dispositivo (horas)</Label>
            <Input type="number" min={0} max={720} value={s.cooldown_hours} onChange={(e) => upd({ cooldown_hours: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-2">
            <Label>Texto de consentimento (LGPD)</Label>
            <Textarea value={s.consent_text ?? ""} maxLength={500} onChange={(e) => upd({ consent_text: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle>Google Reviews</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div><div className="text-sm font-medium">Oferecer redirecionamento para o Google</div>
              <div className="text-xs text-muted-foreground">Apenas quando a nota tiver ação "invite_google" (padrão: 4★ e 5★).</div></div>
            <Switch checked={s.redirect_to_google_enabled} onCheckedChange={(v) => upd({ redirect_to_google_enabled: v })} />
          </div>
          <div>
            <Label>Link do Google (perfil da empresa)</Label>
            <Input placeholder="https://g.page/r/…/review" value={s.google_review_url ?? ""} onChange={(e) => upd({ google_review_url: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Salvando…" : "Salvar formulário"}</Button>
    </div>
  );
}

function PublicRatingsTab({ estId }: { estId: string }) {
  const getFn = useServerFn(getMerchantReviewForm);
  const saveFn = useServerFn(saveRatingOptions);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["mr-form", estId], queryFn: () => getFn({ data: { establishmentId: estId } }) });
  const [rows, setRows] = useState<any[] | null>(null);
  const list = rows ?? data?.options ?? [];
  const set = (id: string, patch: any) => setRows(list.map((o) => o.id === id ? { ...o, ...patch } : o));

  const mut = useMutation({
    mutationFn: async () => saveFn({ data: {
      establishmentId: estId,
      options: list.map((o) => ({
        id: o.id, enabled: !!o.enabled, label: o.label,
        selection_message: o.selection_message ?? null,
        comment_required: !!o.comment_required,
        post_submit_action: o.post_submit_action,
      })),
    } }),
    onSuccess: () => { toast.success("Notas salvas"); qc.invalidateQueries({ queryKey: ["mr-form", estId] }); setRows(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <RouteLoading label="Carregando…" fullscreen={false} className="min-h-[40vh]" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Ative/desative cada nota e personalize o comportamento. Não force nota positiva — o cliente escolhe livremente.</p>
      {list.sort((a, b) => a.rating - b.rating).map((o) => (
        <Card key={o.id}>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[auto_1fr_1fr_1fr_auto] md:items-end">
            <div className="flex items-center gap-2 font-bold">
              {Array.from({ length: o.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
            </div>
            <div><Label className="text-xs">Texto</Label><Input value={o.label} onChange={(e) => set(o.id, { label: e.target.value })} maxLength={60} /></div>
            <div><Label className="text-xs">Mensagem ao selecionar</Label><Input value={o.selection_message ?? ""} onChange={(e) => set(o.id, { selection_message: e.target.value })} maxLength={300} /></div>
            <div>
              <Label className="text-xs">Ação após envio</Label>
              <Select value={o.post_submit_action} onValueChange={(v) => set(o.id, { post_submit_action: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apologize">Pedir desculpas</SelectItem>
                  <SelectItem value="ask_details">Pedir detalhes</SelectItem>
                  <SelectItem value="thank">Agradecer</SelectItem>
                  <SelectItem value="invite_google">Convidar p/ Google</SelectItem>
                  <SelectItem value="invite_share">Convidar p/ compartilhar</SelectItem>
                  <SelectItem value="none">Nenhuma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="flex items-center gap-2 text-xs"><Switch checked={o.enabled} onCheckedChange={(v) => set(o.id, { enabled: v })} />Ativa</label>
              <label className="flex items-center gap-2 text-xs"><Switch checked={o.comment_required} onCheckedChange={(v) => set(o.id, { comment_required: v })} />Comentário obrig.</label>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? "Salvando…" : "Salvar notas"}</Button>
    </div>
  );
}

function PublicQuestionsTab({ estId }: { estId: string }) {
  const getFn = useServerFn(getMerchantReviewForm);
  const upsertFn = useServerFn(upsertReviewQuestion);
  const delFn = useServerFn(deleteReviewQuestion);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["mr-form", estId], queryFn: () => getFn({ data: { establishmentId: estId } }) });

  const nextOrder = () => (data?.questions?.length ?? 0);
  const add = useMutation({
    mutationFn: async (q?: { question: string; question_type: any; choices?: string[]; required?: boolean }) => upsertFn({ data: { establishmentId: estId, question: {
      question: q?.question ?? "Nova pergunta",
      question_type: q?.question_type ?? "short",
      choices: q?.choices,
      required: q?.required ?? false,
      display_order: nextOrder(),
      active: true,
    } } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mr-form", estId] }); toast.success("Pergunta adicionada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const EXAMPLES: Array<{ label: string; q: { question: string; question_type: any; choices?: string[]; required?: boolean } }> = [
    { label: "Você recomendaria a um amigo?", q: { question: "Você recomendaria nosso estabelecimento a um amigo?", question_type: "yes_no" } },
    { label: "Tempo de espera", q: { question: "Como avalia o tempo de espera do atendimento?", question_type: "stars" } },
    { label: "Qualidade do produto", q: { question: "Como avalia a qualidade do produto/serviço?", question_type: "stars" } },
    { label: "Simpatia da equipe", q: { question: "A equipe foi simpática e atenciosa?", question_type: "yes_no" } },
    { label: "Limpeza do local", q: { question: "Como avalia a limpeza e organização do local?", question_type: "stars" } },
    { label: "O que podemos melhorar?", q: { question: "O que podemos melhorar no seu próximo atendimento?", question_type: "long" } },
    { label: "Como nos conheceu?", q: { question: "Como nos conheceu?", question_type: "choice", choices: ["Indicação", "Redes sociais", "Google", "Passei em frente", "Outro"] } },
    { label: "Voltará em breve?", q: { question: "Você pretende voltar em breve?", question_type: "yes_no" } },
    { label: "NPS clássico (0–10)", q: { question: "De 0 a 10, o quanto você nos recomendaria?", question_type: "nps" } },
    { label: "Motivo da visita", q: { question: "Qual foi o principal motivo da sua visita hoje?", question_type: "choice", choices: ["Rotina", "Ocasião especial", "Primeira vez", "Promoção", "Indicação"] } },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Perguntas extras que aparecem depois do cliente escolher a nota.</p>
        <Button size="sm" onClick={() => add.mutate(undefined)}><Plus className="mr-1 h-3 w-3" />Nova pergunta em branco</Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">💡 Exemplos prontos — clique para adicionar</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <Button key={ex.label} size="sm" variant="outline" onClick={() => add.mutate(ex.q)} disabled={add.isPending}>
              <Plus className="mr-1 h-3 w-3" />{ex.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {(data?.questions ?? []).length === 0 && (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma pergunta extra. Adicione uma acima ou escolha um exemplo.</CardContent></Card>
      )}
      {(data?.questions ?? []).map((q) => (
        <QuestionRow key={q.id} q={q} estId={estId} onChanged={() => qc.invalidateQueries({ queryKey: ["mr-form", estId] })} upsertFn={upsertFn} delFn={delFn} />
      ))}
    </div>
  );
}

function QuestionRow({ q, estId, onChanged, upsertFn, delFn }: { q: any; estId: string; onChanged: () => void; upsertFn: any; delFn: any }) {
  const [x, setX] = useState<any>(q);
  const save = useMutation({
    mutationFn: async () => upsertFn({ data: { establishmentId: estId, question: {
      id: x.id, question: x.question, question_type: x.question_type,
      choices: x.question_type === "choice" ? (Array.isArray(x.choices) ? x.choices : (x.choices ?? "").split("\n").map((s: string) => s.trim()).filter(Boolean)) : undefined,
      required: !!x.required, display_order: x.display_order ?? 0, active: !!x.active,
    } } }),
    onSuccess: () => { toast.success("Salvo"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async () => delFn({ data: { id: q.id } }),
    onSuccess: () => { toast.success("Removida"); onChanged(); },
  });
  return (
    <Card>
      <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_180px_auto]">
        <div>
          <Input value={x.question} maxLength={200} onChange={(e) => setX({ ...x, question: e.target.value })} />
          {x.question_type === "choice" && (
            <Textarea className="mt-2" placeholder="Uma opção por linha" value={Array.isArray(x.choices) ? x.choices.join("\n") : (x.choices ?? "")} onChange={(e) => setX({ ...x, choices: e.target.value })} />
          )}
        </div>
        <Select value={x.question_type} onValueChange={(v) => setX({ ...x, question_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="short">Texto curto</SelectItem>
            <SelectItem value="long">Texto longo</SelectItem>
            <SelectItem value="stars">Estrelas</SelectItem>
            <SelectItem value="nps">NPS 0–10</SelectItem>
            <SelectItem value="yes_no">Sim/Não</SelectItem>
            <SelectItem value="choice">Múltipla escolha</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 text-xs"><Switch checked={!!x.required} onCheckedChange={(v) => setX({ ...x, required: v })} />Obrig.</label>
          <label className="flex items-center gap-2 text-xs"><Switch checked={!!x.active} onCheckedChange={(v) => setX({ ...x, active: v })} />Ativa</label>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => del.mutate()}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PublicInbox({ estId }: { estId: string }) {
  const listFn = useServerFn(listPublicReviewsInbox);
  const statsFn = useServerFn(getPublicReviewStats);
  const updFn = useServerFn(updatePublicReview);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [ratingF, setRatingF] = useState<string>("all");

  const { data: stats } = useQuery({ queryKey: ["pr-stats", estId], queryFn: () => statsFn({ data: { establishmentId: estId, days: 30 } }) });
  const { data: rows, isLoading } = useQuery({
    queryKey: ["pr-inbox", estId, status, ratingF],
    queryFn: () => listFn({ data: { establishmentId: estId, status: status === "all" ? undefined : status as any, ratingFilter: ratingF === "all" ? undefined : Number(ratingF) } }),
  });

  const setSt = useMutation({
    mutationFn: async ({ id, s }: { id: string; s: string }) => updFn({ data: { id, status: s as any } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pr-inbox", estId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const distMax = Math.max(1, ...Object.values(stats?.dist ?? {}));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Nota média (30d)</div><div className="mt-1 flex items-end gap-2"><div className="text-3xl font-bold">{stats ? stats.avg.toFixed(1) : "—"}</div>{stats && <Stars n={Math.round(stats.avg)} />}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total (30d)</div><div className="mt-1 text-3xl font-bold">{stats?.count ?? "—"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pendentes</div><div className="mt-1 text-3xl font-bold">{stats?.pending ?? "—"}</div></CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Distribuição</div>
          <div className="mt-2 space-y-1">{[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-2 text-xs">
              <span className="w-3">{n}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${((stats?.dist?.[n] ?? 0) / distMax) * 100}%` }} /></div>
              <span className="w-6 text-right text-muted-foreground">{stats?.dist?.[n] ?? 0}</span>
            </div>
          ))}</div>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-sm">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="new">Nova</SelectItem>
            <SelectItem value="analyzing">Em análise</SelectItem>
            <SelectItem value="contacting">Em contato</SelectItem>
            <SelectItem value="resolved">Resolvida</SelectItem>
            <SelectItem value="archived">Arquivada</SelectItem>
          </SelectContent>
        </Select>
        <Label className="text-sm">Nota</Label>
        <Select value={ratingF} onValueChange={setRatingF}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {[5, 4, 3, 2, 1].map((n) => <SelectItem key={n} value={String(n)}>{n}★</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <RouteLoading fullscreen={false} className="min-h-[40vh]" />
      ) : (
        <div className="space-y-3">
          {(rows ?? []).length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma avaliação nesta seleção.</CardContent></Card>}
          {(rows ?? []).map((r: any) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Stars n={r.rating} />
                      <span className="text-sm font-semibold">{r.anonymous ? "Anônimo" : (r.customer_name || "Cliente")}</span>
                      <Badge variant="outline" className="text-[10px]">{r.source}</Badge>
                      <Badge className="text-[10px]" variant={r.status === "new" ? "default" : r.status === "resolved" ? "secondary" : "outline"}>{r.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}{r.order_reference ? ` · Pedido ${r.order_reference}` : ""}</div>
                  </div>
                  <Select value={r.status} onValueChange={(s) => setSt.mutate({ id: r.id, s })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nova</SelectItem>
                      <SelectItem value="analyzing">Em análise</SelectItem>
                      <SelectItem value="contacting">Em contato</SelectItem>
                      <SelectItem value="resolved">Resolvida</SelectItem>
                      <SelectItem value="archived">Arquivada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {r.comment && <p className="text-sm">{r.comment}</p>}
                {!r.anonymous && (r.customer_phone || r.customer_email) && (
                  <div className="text-xs text-muted-foreground">{r.customer_phone && <span>📞 {r.customer_phone}</span>}{r.customer_email && <span className="ml-3">✉️ {r.customer_email}</span>}</div>
                )}
                {r.merchant_reply && (
                  <div className="mt-2 rounded-lg border-l-2 border-primary bg-muted/40 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">Sua resposta pública · {r.merchant_reply_at ? formatDate(r.merchant_reply_at) : ""}</div>
                    <p className="mt-1 text-sm">{r.merchant_reply}</p>
                  </div>
                )}
                <div className="flex justify-end pt-1">
                  <MerchantReplyDialog reviewId={r.id} currentReply={r.merchant_reply} publicHidden={r.public_hidden} invalidateKeys={[["pr-inbox", estId], ["pr-alerts", estId]]} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


// ================== LOW-RATING ALERTS (≤2) ==================
function LowRatingAlerts({ estId }: { estId: string }) {
  const listFn = useServerFn(listPublicReviewsInbox);
  const statsFn = useServerFn(getPublicReviewStats);
  const updFn = useServerFn(updatePublicReview);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<string>("all");

  const { data: stats } = useQuery({ queryKey: ["pr-stats", estId], queryFn: () => statsFn({ data: { establishmentId: estId, days: 30 } }) });
  const { data: rows, isLoading } = useQuery({
    queryKey: ["pr-alerts", estId, rating],
    queryFn: () => listFn({ data: { establishmentId: estId, ratingFilter: rating === "all" ? undefined : Number(rating), limit: 200 } }),
  });

  const filtered = useMemo(() => {
    const base = (rows ?? []).filter((r: any) => r.rating <= 2);
    const s = search.trim().toLowerCase();
    if (!s) return base;
    return base.filter((r: any) =>
      (r.customer_name ?? "").toLowerCase().includes(s) ||
      (r.comment ?? "").toLowerCase().includes(s) ||
      (r.customer_phone ?? "").toLowerCase().includes(s) ||
      (r.customer_email ?? "").toLowerCase().includes(s) ||
      (r.order_reference ?? "").toLowerCase().includes(s)
    );
  }, [rows, search]);

  const open = filtered.filter((r: any) => r.status !== "resolved" && r.status !== "archived");
  const handled = filtered.filter((r: any) => r.status === "resolved" || r.status === "archived");

  const markHandled = useMutation({
    mutationFn: async (id: string) => updFn({ data: { id, status: "resolved" } }),
    onSuccess: () => {
      toast.success("Marcada como tratada");
      qc.invalidateQueries({ queryKey: ["pr-alerts", estId] });
      qc.invalidateQueries({ queryKey: ["pr-inbox", estId] });
      qc.invalidateQueries({ queryKey: ["pr-stats", estId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-destructive/40">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-destructive" /> Não tratadas</div>
            <div className="mt-1 text-3xl font-bold text-destructive">{stats?.lowRatingOpen ?? open.length}</div>
          </CardContent>
        </Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total ≤2 exibidas</div><div className="mt-1 text-3xl font-bold">{filtered.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Já tratadas</div><div className="mt-1 text-3xl font-bold">{handled.length}</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nome, comentário, telefone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={rating} onValueChange={setRating}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">1★ e 2★</SelectItem>
            <SelectItem value="1">Apenas 1★</SelectItem>
            <SelectItem value="2">Apenas 2★</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <RouteLoading fullscreen={false} className="min-h-[40vh]" />
      ) : open.length === 0 && handled.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma avaliação com nota baixa. 🎉</CardContent></Card>
      ) : (
        <>
          {open.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Pendentes de atendimento ({open.length})</h3>
              {open.map((r: any) => (
                <Card key={r.id} className="border-destructive/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Stars n={r.rating} />
                          <span className="text-sm font-semibold">{r.anonymous ? "Anônimo" : (r.customer_name || "Cliente")}</span>
                          <Badge variant="destructive" className="text-[10px]">Nota baixa</Badge>
                          <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}{r.order_reference ? ` · Pedido ${r.order_reference}` : ""}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MerchantReplyDialog reviewId={r.id} currentReply={r.merchant_reply} publicHidden={r.public_hidden} invalidateKeys={[["pr-alerts", estId], ["pr-inbox", estId]]} />
                        <Button size="sm" onClick={() => markHandled.mutate(r.id)} disabled={markHandled.isPending}>
                          <CheckCircle2 className="mr-1 h-3 w-3" />Marcar como tratada
                        </Button>
                      </div>
                    </div>
                    {r.comment && <p className="text-sm">{r.comment}</p>}
                    {!r.anonymous && (r.customer_phone || r.customer_email) && (
                      <div className="text-xs text-muted-foreground">{r.customer_phone && <span>📞 {r.customer_phone}</span>}{r.customer_email && <span className="ml-3">✉️ {r.customer_email}</span>}</div>
                    )}
                    {r.merchant_reply && (
                      <div className="mt-2 rounded-lg border-l-2 border-primary bg-muted/40 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">Sua resposta · {r.merchant_reply_at ? formatDate(r.merchant_reply_at) : ""}</div>
                        <p className="mt-1 text-sm">{r.merchant_reply}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {handled.length > 0 && (
            <div className="space-y-2 opacity-70">
              <h3 className="text-sm font-semibold flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Já tratadas ({handled.length})</h3>
              {handled.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <Stars n={r.rating} />
                      <span className="text-sm font-semibold">{r.anonymous ? "Anônimo" : (r.customer_name || "Cliente")}</span>
                      <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDate(r.created_at)}</span>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                    {r.merchant_reply && (
                      <div className="mt-1 rounded-lg border-l-2 border-primary/60 bg-muted/40 p-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">Sua resposta</div>
                        <p className="text-sm">{r.merchant_reply}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ================== INSIGHTS TAB ==================
function InsightsTab({ estId }: { estId: string }) {
  const insFn = useServerFn(getReviewInsights);
  const statsFn = useServerFn(getPublicReviewStats);
  const [days, setDays] = useState<string>("30");
  const { data: ins, isLoading } = useQuery({
    queryKey: ["pr-insights", estId, days],
    queryFn: () => insFn({ data: { establishmentId: estId, days: Number(days) } }),
  });
  const { data: stats } = useQuery({
    queryKey: ["pr-stats-ins", estId, days],
    queryFn: () => statsFn({ data: { establishmentId: estId, days: Number(days) } }),
  });

  if (isLoading || !ins) return <RouteLoading fullscreen={false} className="min-h-[40vh]" />;

  const totalByRating = ins.byRatingOption.reduce((s, o) => s + o.count, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Label className="text-sm">Período</Label>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
            <SelectItem value="365">1 ano</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">{stats?.count ?? 0} avaliações · média {stats?.avg?.toFixed(1) ?? "—"}</div>
      </div>

      {ins.insights.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-destructive" />Insights — o que mais puxa a nota para baixo</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ins.insights.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 rounded-lg bg-background p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{i.question}</div>
                  <div className="text-xs text-muted-foreground">{i.responses} respostas · {i.lowCount} com nota ≤2</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{i.avgRating.toFixed(1)}★</div>
                  <div className="text-[10px] text-muted-foreground">média associada</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Breakdown por categoria de nota</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ins.byRatingOption.length === 0 && <div className="text-sm text-muted-foreground">Sem dados no período.</div>}
          {ins.byRatingOption.map((o) => {
            const pct = Math.round((o.count / totalByRating) * 100);
            return (
              <div key={o.rating} className="flex items-center gap-3">
                <div className="flex w-24 items-center gap-1"><Stars n={o.rating} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground truncate">{o.label}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="w-20 text-right text-sm tabular-nums">{o.count} <span className="text-muted-foreground text-xs">({pct}%)</span></div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhamento por pergunta</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {ins.byQuestion.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma pergunta extra configurada.</div>}
          {ins.byQuestion.map((q) => (
            <div key={q.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{q.question}</div>
                  <div className="text-xs text-muted-foreground">{q.responses} respostas · tipo {q.type}</div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${q.avgRating > 0 && q.avgRating < 3 ? "text-destructive" : ""}`}>
                    {q.avgRating > 0 ? `${q.avgRating.toFixed(1)}★` : "—"}
                  </div>
                  {q.lowCount > 0 && <Badge variant="destructive" className="text-[10px]">{q.lowCount} nota ≤2</Badge>}
                </div>
              </div>
              {q.breakdown.length > 0 && (
                <div className="mt-3 space-y-1">
                  {q.breakdown.map((b, i) => {
                    const maxCount = Math.max(1, ...q.breakdown.map((x) => x.count));
                    const pct = Math.round((b.count / maxCount) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <div className="w-32 truncate">{b.key}</div>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-24 text-right tabular-nums">
                          {b.count} resp · {b.avgRating > 0 ? `${b.avgRating.toFixed(1)}★` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
