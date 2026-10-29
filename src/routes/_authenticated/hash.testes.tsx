import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminGetTrialDashboard, adminCreateTrialLink, adminUpdateTrialLink, TRIAL_FEATURES, TRIAL_STARTER_FEATURES } from "@/lib/trial-invites.functions";
import { ArrowUpRight, BarChart3, CalendarClock, Check, CheckCircle2, Clock3, Copy, ExternalLink, Gift, Link2, Loader2, MousePointerClick, Plus, RefreshCcw, Save, Search, ShieldCheck, Users2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/hash/testes")({
  component: TrialsAdminPage,
  head: () => ({ meta: [{ title: "Links de Testes | Fidelize Admin" }, { name: "robots", content: "noindex,nofollow" }] }),
});

type TrialForm = {
  title: string; description: string; plan_id: string; duration_days: number; duration_unit: "days" | "months";
  feature_keys: string[]; max_signups: number; expires_at: string | null; active: boolean;
};
const emptyForm: TrialForm = {
  title: "Experimente a Fidelize — 14 dias", description: "Convite exclusivo para lojistas conhecerem a Fidelize.",
  plan_id: "", duration_days: 14, duration_unit: "days", feature_keys: [...TRIAL_STARTER_FEATURES],
  max_signups: 1, expires_at: null, active: true,
};
const dateText = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Sem prazo";
const trialUrl = (token: string) => `https://afidelize.app/teste/${token}`;

function TrialsAdminPage() {
  const qc = useQueryClient();
  const getDashboard = useServerFn(adminGetTrialDashboard);
  const createLink = useServerFn(adminCreateTrialLink);
  const updateLink = useServerFn(adminUpdateTrialLink);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-trial-dashboard"],
    queryFn: () => getDashboard(),
    refetchInterval: 30000,
  });
  const plans = (data?.plans ?? []) as any[];
  const links = (data?.links ?? []) as any[];
  const visits = (data?.visits ?? []) as any[];
  const claims = (data?.claims ?? []) as any[];
  const [mode, setMode] = useState<"new" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TrialForm>(emptyForm);
  const [selectedLink, setSelectedLink] = useState<string>("all");
  const [search, setSearch] = useState("");

  const countViews = visits.length;
  const countSignup = claims.length;
  const conversion = countViews ? (100 * countSignup / countViews).toFixed(1) : "0,0";

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, plan_id: form.plan_id || plans.find((p) => p.tier === "pro")?.id || plans[0]?.id };
      if (!payload.plan_id) throw new Error("Selecione um plano de referência.");
      if (!payload.feature_keys.length) throw new Error("Habilite ao menos um recurso.");
      if (mode === "edit" && editingId) return updateLink({ data: { ...payload, id: editingId } });
      return createLink({ data: payload });
    },
    onSuccess: async (link: any) => {
      toast.success(mode === "edit" ? "Convite atualizado." : "Novo convite criado.");
      await qc.invalidateQueries({ queryKey: ["admin-trial-dashboard"] });
      setMode(null); setEditingId(null);
      if (mode === "new" && link?.token) {
        try { await navigator.clipboard.writeText(trialUrl(link.token)); toast.success("Link copiado."); }
        catch { /* permite copiar no card */ }
      }
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao salvar convite."),
  });

  function startCreate() {
    setMode("new"); setEditingId(null);
    const pro = plans.find((p: any) => p.tier === "pro") ?? plans[0];
    setForm({ ...emptyForm, plan_id: pro?.id ?? "", feature_keys: [...TRIAL_STARTER_FEATURES],
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString() });
  }

  function startEdit(link: any) {
    setMode("edit"); setEditingId(link.id);
    setForm({
      title: link.title, description: link.description ?? "", plan_id: link.plan_id,
      duration_days: link.duration_days, duration_unit: link.duration_unit ?? "days", feature_keys: [...link.feature_keys],
      max_signups: link.max_signups, expires_at: link.expires_at,
      active: link.active,
    });
  }

  function toggleFeature(key: string) {
    setForm((f) => ({
      ...f,
      feature_keys: f.feature_keys.includes(key) ? f.feature_keys.filter((x) => x !== key) : [...f.feature_keys, key],
    }));
  }

  async function copyLink(token: string) {
    try { await navigator.clipboard.writeText(trialUrl(token)); toast.success("Link copiado!"); }
    catch { toast.error("Não foi possível copiar automaticamente."); }
  }

  const filteredClaims = useMemo(() => claims.filter((c) => {
    if (selectedLink !== "all" && c.link_id !== selectedLink) return false;
    const text = [c.customer_name,c.customer_email,c.establishment_name,c.establishment_slug].join(" ").toLowerCase();
    return text.includes(search.trim().toLowerCase());
  }), [claims, selectedLink, search]);

  const filteredVisits = useMemo(() => visits.filter((v) =>
    selectedLink === "all" || v.link_id === selectedLink
  ), [visits, selectedLink]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Gift className="h-4 w-4" /> Aquisição e experimentação
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Testes</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Convites personalizados, acessos temporários e acompanhamento de cada lojista que chega à Fidelize.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}><RefreshCcw className="mr-2 h-4 w-4" /> Atualizar</Button>
          <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" /> Novo link de teste</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Links criados", value: links.length, icon: Link2, detail: links.filter((l) => l.active && l.signup_count < l.max_signups && (!l.expires_at || new Date(l.expires_at).getTime() > Date.now())).length + " disponíveis" },
          { title: "Visitantes identificados", value: countViews, icon: MousePointerClick, detail: "Navegadores registrados (limite de 1.000 exibidos)" },
          { title: "Cadastros por convite", value: countSignup, icon: Users2, detail: "Vinculados ao cadastro de lojista" },
          { title: "Conversão estimada", value: conversion + "%", icon: BarChart3, detail: "Cadastros / visitas exibidas" },
        ].map((metric) => (
          <Card key={metric.title} className="border-border/60 bg-card/90 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3"><span className="text-xs font-medium text-muted-foreground">{metric.title}</span><metric.icon className="h-4 w-4 text-primary" /></div>
              <div className="mt-3 text-3xl font-bold tabular-nums tracking-tight">{metric.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {mode && (
        <Card className="overflow-hidden border-primary/30 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-primary/5 px-5 py-4">
            <div><h2 className="text-lg font-bold">{mode === "new" ? "Configurar novo convite" : "Personalizar convite"}</h2>
              <p className="text-xs text-muted-foreground">As alterações do convite existente não alteram benefícios já ativados.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setMode(null)}>Cancelar</Button>
          </div>
          <CardContent className="space-y-6 p-5 md:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Nome interno do convite</Label><Input maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Parceiro Instagram - Outubro" /></div>
              <div className="space-y-2"><Label>Plano de referência</Label>
                <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                  <SelectContent>{plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2"><Label>Descrição opcional</Label><Input maxLength={400} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Campanha, parceria ou origem desse link" /></div>
              <div className="space-y-2"><Label>Duração do teste</Label>
                <div className="flex gap-2"><Input type="number" min={1} max={form.duration_unit==="months"?12:365} value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })} /><Select value={form.duration_unit} onValueChange={(v) => setForm({ ...form, duration_unit: v as "days"|"months", duration_days: v==="months" ? 1 : 14 })}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="days">Dias</SelectItem><SelectItem value="months">Meses</SelectItem></SelectContent></Select></div>
                <div className="flex flex-wrap gap-2">{[{label:"7 dias",v:7,u:"days"},{label:"14 dias",v:14,u:"days"},{label:"1 mês",v:1,u:"months"},{label:"3 meses",v:3,u:"months"},{label:"6 meses",v:6,u:"months"}].map((opt) => <Button type="button" key={opt.label} variant={form.duration_unit===opt.u&&form.duration_days===opt.v?"default":"outline"} size="sm" onClick={() => setForm({ ...form, duration_unit: opt.u as "days"|"months", duration_days: opt.v })}>{opt.label}</Button>)}</div>
              </div>
              <div className="space-y-2"><Label>Máximo de cadastros</Label>
                <Input type="number" min={1} max={500} value={form.max_signups} onChange={(e) => setForm({ ...form, max_signups: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">1 = expira no primeiro cadastro. Acima de 1 permite campanha compartilhada até atingir o limite.</p>
              </div>
              <div className="space-y-2"><Label>Validade do link (opcional)</Label>
                <Input type="datetime-local" value={form.expires_at ? new Date(new Date(form.expires_at).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16) : ""} onChange={(e) => setForm({ ...form, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                <p className="text-xs text-muted-foreground">A validade do link é independente da duração do teste individual.</p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/70 p-4"><div><Label>Link ativo</Label><p className="mt-1 text-xs text-muted-foreground">Desative a qualquer momento para bloquear novos cadastros.</p></div><Switch checked={form.active} onCheckedChange={(active) => setForm({ ...form, active })} /></div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Ferramentas liberadas para testes</h3><p className="text-xs text-muted-foreground">Selecione exatamente as funcionalidades que o lojista poderá experimentar.</p></div><Badge variant="secondary">{form.feature_keys.length} recursos</Badge></div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {TRIAL_FEATURES.map((feature) => {
                  const enabled = form.feature_keys.includes(feature.key);
                  return <button key={feature.key} type="button" onClick={() => toggleFeature(feature.key)} aria-pressed={enabled} className={"flex items-center justify-between rounded-xl border p-3 text-left text-sm transition-all " + (enabled ? "border-primary/50 bg-primary/5 text-foreground" : "border-border/60 hover:bg-muted/50 text-muted-foreground")}>
                    <span><span className="block font-medium">{feature.label}</span><span className="mt-0.5 block text-[11px] opacity-65">{feature.group}</span></span>
                    <span className={"ml-2 grid h-5 w-5 shrink-0 place-items-center rounded-md border " + (enabled ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{enabled && <Check className="h-3 w-3" />}</span>
                  </button>;
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
              <p className="max-w-md text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-4 w-4" /> Um link de uso único não expira por visualização: somente após cadastro elegível confirmado.</p>
              <Button size="lg" disabled={save.isPending || !form.feature_keys.length || !form.plan_id} onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {mode === "new" ? "Criar e gerar link" : "Salvar alterações"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Links de avaliação</h2><span className="text-xs text-muted-foreground">Clique para copiar ou editar</span></div>
        {isLoading ? <p className="py-12 text-center text-sm text-muted-foreground">Carregando links de teste…</p> : links.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Gift className="mx-auto h-8 w-8 text-primary" /><h3 className="mt-3 font-semibold">Seu primeiro convite está a um clique</h3><p className="mt-1 text-sm text-muted-foreground">Configure um teste personalizado e compartilhe com novos lojistas.</p><Button className="mt-4" onClick={startCreate}>Criar primeiro link</Button></CardContent></Card>
        ) : <div className="grid gap-3 xl:grid-cols-2">
          {links.map((link) => {
            const visitCount = visits.filter((v) => v.link_id === link.id).length;
            const exhausted = link.signup_count >= link.max_signups;
            const expired = link.expires_at && new Date(link.expires_at).getTime() <= Date.now();
            const available = link.active && !exhausted && !expired;
            const plan = plans.find((p: any) => p.id === link.plan_id);
            return <Card key={link.id} className="overflow-hidden border-border/70">
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Link2 className="h-5 w-5" /></span>
                    <div className="min-w-0"><h3 className="truncate font-semibold">{link.title}</h3><p className="text-xs text-muted-foreground">{plan?.name ?? "Plano"} · {link.duration_days} {link.duration_unit === "months" ? "meses" : "dias"} de acesso</p></div>
                  </div>
                  <Badge variant={available ? "default" : "secondary"}>{!link.active ? "Pausado" : exhausted ? "Esgotado" : expired ? "Expirado" : "Disponível"}</Badge>
                </div>
                <div className="flex items-center gap-2"><Input readOnly value={trialUrl(link.token)} className="min-w-0 text-xs" /><Button type="button" variant="outline" size="icon" onClick={() => copyLink(link.token)} title="Copiar link"><Copy className="h-4 w-4" /></Button><a className="inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted" href={trialUrl(link.token)} target="_blank" rel="noreferrer" title="Abrir convite"><ExternalLink className="h-4 w-4" /></a></div>
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3 text-center">
                  <div><strong className="block text-lg tabular-nums">{visitCount}</strong><span className="text-[11px] text-muted-foreground">Visitas</span></div>
                  <div><strong className="block text-lg tabular-nums">{link.signup_count}/{link.max_signups}</strong><span className="text-[11px] text-muted-foreground">Cadastros</span></div>
                  <div><strong className="block text-lg tabular-nums">{link.feature_keys.length}</strong><span className="text-[11px] text-muted-foreground">Recursos</span></div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Validade: {dateText(link.expires_at)}</span><Button variant="outline" size="sm" onClick={() => startEdit(link)}>Personalizar</Button></div>
              </CardContent>
            </Card>;
          })}
        </div>}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Pessoas que chegaram pelos convites</h2><p className="text-xs text-muted-foreground">Identificação nominal após cadastro; visitas anônimas são registradas por navegador.</p></div>
          <div className="flex flex-wrap gap-2"><Select value={selectedLink} onValueChange={setSelectedLink}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos os links" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os links</SelectItem>{links.map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}</SelectContent></Select><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="w-52 pl-9" placeholder="Buscar nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        </div>
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-5 py-3">Lojista / cadastro</th><th className="px-5 py-3">Convite</th><th className="px-5 py-3">Cadastro</th><th className="px-5 py-3">Acesso até</th><th className="px-5 py-3">Situação</th></tr></thead><tbody className="divide-y divide-border/60">{filteredClaims.map((c: any) => { const link = links.find((x) => x.id===c.link_id); const active = !!c.ends_at && new Date(c.ends_at).getTime() > Date.now(); return <tr key={c.id}><td className="px-5 py-4"><strong className="block font-semibold">{c.customer_name || "Nome não informado"}</strong><span className="block text-xs text-muted-foreground">{c.customer_email || "Sem e-mail"}</span>{c.establishment_name && <span className="block text-xs text-primary">{c.establishment_name}</span>}</td><td className="px-5 py-4 text-xs">{link?.title ?? "—"}</td><td className="px-5 py-4 text-xs">{dateText(c.claimed_at)}</td><td className="px-5 py-4 text-xs">{dateText(c.ends_at)}</td><td className="px-5 py-4"><Badge variant={active?"default":"secondary"}>{!c.establishment_id?"Aguardando empresa":active?"Em teste":"Encerrado"}</Badge></td></tr>;})}{filteredClaims.length===0&&<tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">Nenhum cadastro encontrado.</td></tr>}</tbody></table></div>
        </CardContent></Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Origem das visitas</h2>
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-5 py-3">Primeiro acesso</th><th className="px-5 py-3">Link</th><th className="px-5 py-3">Origem / Campanha</th><th className="px-5 py-3">Resultado</th></tr></thead><tbody className="divide-y divide-border/50">{filteredVisits.slice(0,100).map((visit: any) => {const claim=claims.find((c) => c.link_id===visit.link_id&&c.visitor_id===visit.visitor_id);return <tr key={visit.id}><td className="px-5 py-3">{dateText(visit.first_seen_at)}</td><td className="px-5 py-3">{links.find((l) => l.id===visit.link_id)?.title ?? "—"}</td><td className="max-w-[280px] truncate px-5 py-3" title={visit.referrer??""}>{[visit.utm_source,visit.utm_medium,visit.utm_campaign].filter(Boolean).join(" / ")||visit.referrer||"Acesso direto"}</td><td className="px-5 py-3">{claim?<span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5"/> Cadastrado</span>:<span className="inline-flex items-center gap-1 text-muted-foreground"><Clock3 className="h-3.5 w-3.5"/> Não cadastrado</span>}</td></tr>;})}{filteredVisits.length===0&&<tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">Ainda não existem visitas rastreadas.</td></tr>}</tbody></table></div>
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">Por privacidade, visitantes não cadastrados aparecem apenas como identificadores anônimos. Relatório mostra até 1.000 visitas mais recentes.</p>
        </CardContent></Card>
      </section>
    </div>
  );
}
