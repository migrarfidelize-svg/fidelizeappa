import { RouteLoading } from "@/components/RouteLoading";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PageHero } from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Radio, Target, RefreshCw, Smartphone, Tablet, Monitor, Link2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPixelAnalytics } from "@/lib/integrations/marketing/pixel.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/hash/pixel")({
  component: PixelMonitorPage,
  head: () => ({
    meta: [
      { title: "Monitoramento do Pixel · Fidelize" },
      { name: "description", content: "Analytics em tempo real dos eventos do Meta Pixel nas páginas públicas." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type LiveEvent = {
  id: string;
  event_name: string;
  path: string | null;
  device: string | null;
  session_hash: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}

function DeviceIcon({ device }: { device: string | null }) {
  if (device === "mobile") return <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />;
  if (device === "tablet") return <Tablet className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;
}

function Kpi({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="metric-number text-3xl mt-1">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function BarList({ items, empty }: { items: { label: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="tabular-nums text-muted-foreground">{i.count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PixelMonitorPage() {
  const fetchAnalytics = useServerFn(getPixelAnalytics);
  const [live, setLive] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["pixel-analytics"],
    queryFn: () => fetchAnalytics(),
    refetchInterval: 30_000,
    staleTime: 0,
  });

  // Realtime — novos eventos entram no topo do feed instantaneamente.
  useEffect(() => {
    const channel = supabase
      .channel("pixel-events-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pixel_events" }, (payload) => {
        const row = payload.new as LiveEvent;
        setLive((prev) => [row, ...prev].slice(0, 50));
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const feed = useMemo(() => {
    const seen = new Set<string>();
    return [...live, ...(data?.recent ?? [])].filter((e) => (seen.has(e.id) ? false : seen.add(e.id))).slice(0, 50);
  }, [live, data?.recent]);

  const status = !data?.configured
    ? { tone: "warn" as const, text: "Pixel não configurado" }
    : !data.enabled
      ? { tone: "warn" as const, text: "Integração desativada" }
      : !data.trackingPublic
        ? { tone: "warn" as const, text: "Somente Conversions API" }
        : { tone: "ok" as const, text: "Rastreando páginas públicas" };

  return (
    <div className="space-y-6 min-w-0">
      <PageHero
        icon={Target}
        title="Monitoramento do Pixel"
        subtitle="Analytics em tempo real dos eventos enviados pelo Meta Pixel nas páginas públicas."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status.tone === "ok" ? "secondary" : "outline"} className="gap-1">
          {status.tone === "ok" ? <Activity className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          {status.text}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Radio className={`h-3.5 w-3.5 ${connected ? "text-emerald-600" : "text-muted-foreground"}`} />
          {connected ? "Tempo real ativo" : "Conectando…"}
        </Badge>
        {data?.pixelId ? <Badge variant="outline" className="font-mono text-xs">ID {data.pixelId}</Badge> : null}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />Atualizar
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/hash/integracoes"><Link2 className="h-4 w-4 mr-1" />Configurar</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Kpi label="Últimos 5 min" value={data?.totals.last5m ?? 0} hint="eventos" />
        <Kpi label="Última hora" value={data?.totals.lastHour ?? 0} hint="eventos" />
        <Kpi label="24 horas" value={data?.totals.last24h ?? 0} hint="eventos" />
        <Kpi label="Sessões (24h)" value={data?.sessions24h ?? 0} hint="visitantes anônimos" />
        <Kpi label="7 dias" value={data?.totals.last7d ?? 0} hint="eventos" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Eventos por hora (24h)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {(data?.timeline ?? []).map((b) => {
              const max = Math.max(1, ...(data?.timeline ?? []).map((x) => x.count));
              return (
                <div key={b.bucket} className="flex-1 min-w-0 flex flex-col items-center gap-1" title={`${b.bucket} · ${b.count}`}>
                  <div className="w-full rounded-t bg-primary/80" style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? 4 : 1 }} />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Horário UTC · {data?.totals.last24h ?? 0} eventos nas últimas 24 horas.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Tipos de evento</CardTitle></CardHeader>
          <CardContent>
            <BarList items={(data?.byEvent ?? []).map((e) => ({ label: e.name, count: e.count }))} empty="Nenhum evento ainda." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Páginas mais rastreadas</CardTitle></CardHeader>
          <CardContent>
            <BarList items={(data?.byPath ?? []).map((e) => ({ label: e.path, count: e.count }))} empty="Nenhuma página ainda." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Dispositivos</CardTitle></CardHeader>
          <CardContent>
            <BarList items={(data?.byDevice ?? []).map((e) => ({ label: e.device, count: e.count }))} empty="Sem dados de dispositivo." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            Feed ao vivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <RouteLoading label="Carregando eventos…" fullscreen={false} className="min-h-[40vh]" />
          ) : feed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento recebido ainda. Abra uma página pública (landing, cardápio, Bio Commerce) para gerar o primeiro PageView.
            </p>
          ) : (
            <ul className="divide-y">
              {feed.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2 min-w-0">
                  <Badge variant="secondary" className="shrink-0">{e.event_name}</Badge>
                  <span className="truncate text-sm text-muted-foreground flex-1">{e.path ?? "—"}</span>
                  <DeviceIcon device={e.device} />
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">{timeAgo(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
