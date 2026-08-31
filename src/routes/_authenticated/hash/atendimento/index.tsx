import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getInboxContext, getInboxConversation, getInboxReports, getInboxStats, inboxSendMessage, inboxSetPriority,
  inboxToggleTag, inboxTransition, listInboxConversations, listInboxSetup, saveInboxCloseReason, saveInboxQueue,
  deleteInboxQueue, setMyInboxPresence,
} from "@/lib/crm/inbox.functions";
import { useCRMRealtime } from "@/hooks/use-crm-realtime";
import { RouteLoading } from "@/components/RouteLoading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Inbox, Kanban, Users, Bot, BarChart3, Settings2, Search, PanelRight,
  SendHorizontal, GitBranch, FileText, Smartphone, KeyRound, Menu,
} from "lucide-react";
import { ConversationList } from "@/components/crm/inbox/ConversationList";
import { ConversationView } from "@/components/crm/inbox/ConversationView";
import { ContactPanel } from "@/components/crm/inbox/ContactPanel";
import { QueueBoard } from "@/components/crm/inbox/QueueBoard";
import { InboxReports } from "@/components/crm/inbox/InboxReports";
import { InboxOperationSettings } from "@/components/crm/inbox/InboxSettings";
import { ContactManager } from "@/components/crm/ContactManager";
import { FlowsView } from "@/components/crm/FlowsView";
import { FlowEditor } from "@/components/crm/FlowEditor";
import { AgentConfig } from "@/components/crm/AgentConfig";
import { WhatsAppManager } from "@/components/crm/WhatsAppManager";
import { TemplateManager } from "@/components/crm/TemplateManager";
import { QuickRepliesManager } from "@/components/crm/QuickReplies";
import { BroadcastManager } from "@/components/crm/broadcasts/BroadcastManager";
import { OTPEditor } from "@/components/crm/OTPEditor";

export const Route = createFileRoute("/_authenticated/hash/atendimento/")({
  component: AtendimentoCommandDeck,
});

const STATUS_FILTERS = [
  { value: "all", label: "Abertas" },
  { value: "mine", label: "Minhas" },
  { value: "unassigned", label: "Sem responsável" },
  { value: "waiting", label: "Na fila" },
  { value: "bot", label: "Com o bot" },
  { value: "assigned", label: "Em atendimento" },
  { value: "paused", label: "Pausadas" },
  { value: "closed", label: "Finalizadas" },
];

const NAV_GROUPS = [
  {
    group: "Operação",
    items: [
      { id: "inbox", label: "Inbox", icon: Inbox },
      { id: "fila", label: "Fila", icon: Kanban },
      { id: "contatos", label: "Contatos", icon: Users },
      { id: "disparos", label: "Disparos", icon: SendHorizontal },
    ],
  },
  {
    group: "Automação",
    items: [
      { id: "agente", label: "Agente", icon: Bot },
      { id: "fluxos", label: "Fluxos", icon: GitBranch },
    ],
  },
  {
    group: "Comunicação",
    items: [
      { id: "templates", label: "Templates", icon: FileText },
      { id: "otp", label: "OTP", icon: KeyRound },
      { id: "whatsapp", label: "WhatsApp", icon: Smartphone },
    ],
  },
  {
    group: "Gestão",
    items: [
      { id: "relatorios", label: "Relatórios", icon: BarChart3 },
      { id: "config", label: "Configurações", icon: Settings2 },
    ],
  },
];

function AtendimentoCommandDeck() {
  const contextFn = useServerFn(getInboxContext);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);

  const ctx = useQuery({
    queryKey: ["inbox-context", establishmentId],
    queryFn: () => contextFn({ data: { establishmentId } }),
    staleTime: 60_000,
  });

  if (ctx.isLoading) return <RouteLoading label="Carregando atendimento…" fullscreen={false} className="min-h-[50vh]" />;
  if (ctx.isError) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{(ctx.error as Error)?.message || "Não foi possível abrir o Atendimento."}</p>
      </div>
    );
  }

  return <Workspace ctx={ctx.data!} onSwitchEstablishment={setEstablishmentId} />;
}

function KpiChip({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div
      className={cn(
        "flex min-w-[86px] flex-col rounded-lg border border-border/70 bg-card/70 px-3 py-1.5",
        tone === "danger" && "border-destructive/30 bg-destructive/10",
      )}
    >
      <span className={cn("text-[10px] uppercase tracking-wide text-muted-foreground", tone === "danger" && "text-destructive/80")}>{label}</span>
      <span className={cn("text-base font-semibold leading-tight", tone === "danger" && "text-destructive")}>{value}</span>
    </div>
  );
}

function Workspace({ ctx, onSwitchEstablishment }: { ctx: any; onSwitchEstablishment: (id: string) => void }) {
  const qc = useQueryClient();
  const est = ctx.establishmentId as string;
  useCRMRealtime(est);

  const [tab, setTab] = useState("inbox");
  const [navOpen, setNavOpen] = useState(false);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [queueId, setQueueId] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<any>(null);

  const listFn = useServerFn(listInboxConversations);
  const statsFn = useServerFn(getInboxStats);
  const setupFn = useServerFn(listInboxSetup);
  const detailFn = useServerFn(getInboxConversation);
  const reportsFn = useServerFn(getInboxReports);
  const sendFn = useServerFn(inboxSendMessage);
  const transitionFn = useServerFn(inboxTransition);
  const priorityFn = useServerFn(inboxSetPriority);
  const tagFn = useServerFn(inboxToggleTag);
  const queueSaveFn = useServerFn(saveInboxQueue);
  const queueDeleteFn = useServerFn(deleteInboxQueue);
  const reasonSaveFn = useServerFn(saveInboxCloseReason);
  const presenceFn = useServerFn(setMyInboxPresence);

  const setup = useQuery({ queryKey: ["inbox-setup", est], queryFn: () => setupFn({ data: { establishmentId: est } }), staleTime: 60_000 });
  const stats = useQuery({ queryKey: ["crm-stats", est], queryFn: () => statsFn({ data: { establishmentId: est } }), refetchInterval: 60_000 });
  const conversations = useQuery({
    queryKey: ["crm-conversations", est, status, search, queueId, priority],
    queryFn: () => listFn({ data: { establishmentId: est, status: status as any, search: search || undefined, queueId, priority: priority as any } }),
    refetchInterval: 30_000,
  });
  const detail = useQuery({
    queryKey: ["crm-messages", selectedId],
    queryFn: () => detailFn({ data: { establishmentId: est, conversationId: selectedId! } }),
    enabled: !!selectedId,
  });
  const reports = useQuery({
    queryKey: ["inbox-reports", est],
    queryFn: () => reportsFn({ data: { establishmentId: est, days: 14 } }),
    enabled: tab === "relatorios",
  });

  useEffect(() => {
    presenceFn({ data: { establishmentId: est, status: "online" } }).catch(() => {});
    const t = setInterval(() => { presenceFn({ data: { establishmentId: est, status: "online" } }).catch(() => {}); }, 120_000);
    return () => clearInterval(t);
  }, [est, presenceFn]);

  const agents = setup.data?.agents ?? [];
  const agentNames = useMemo(() => Object.fromEntries(agents.map((a: any) => [a.userId, a.name])), [agents]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm-conversations"] });
    qc.invalidateQueries({ queryKey: ["crm-messages"] });
    qc.invalidateQueries({ queryKey: ["crm-stats"] });
  };

  const sendMutation = useMutation({
    mutationFn: (vars: { body: string; isNote: boolean }) =>
      sendFn({ data: { establishmentId: est, conversationId: selectedId!, body: vars.body, isNote: vars.isNote } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message || "Não foi possível enviar."),
  });

  const actionMutation = useMutation({
    mutationFn: (vars: any) => transitionFn({ data: { establishmentId: est, conversationId: selectedId!, ...vars } }),
    onSuccess: () => { invalidate(); toast.success("Atendimento atualizado."); },
    onError: (e: any) => toast.error(e?.message || "Ação não permitida."),
  });

  const priorityMutation = useMutation({
    mutationFn: (p: string) => priorityFn({ data: { establishmentId: est, conversationId: selectedId!, priority: p as any } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message || "Falha ao alterar prioridade."),
  });

  const tagMutation = useMutation({
    mutationFn: (vars: { tagId: string; attach: boolean }) =>
      tagFn({ data: { establishmentId: est, conversationId: selectedId!, ...vars } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message || "Falha ao alterar etiqueta."),
  });

  const setupMutation = useMutation({
    mutationFn: async (vars: { kind: "queue" | "queue-delete" | "reason"; payload: any }) => {
      if (vars.kind === "queue") return queueSaveFn({ data: { establishmentId: est, ...vars.payload } });
      if (vars.kind === "queue-delete") return queueDeleteFn({ data: { establishmentId: est, id: vars.payload } });
      return reasonSaveFn({ data: { establishmentId: est, ...vars.payload } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inbox-setup"] }); toast.success("Configuração salva."); },
    onError: (e: any) => toast.error(e?.message || "Falha ao salvar."),
  });

  const openConversation = (id: string) => {
    setSelectedId(id);
    setTab("inbox");
  };

  const list = conversations.data ?? [];

  const goTo = (id: string) => {
    setTab(id);
    setNavOpen(false);
    if (id !== "fluxos") setEditingFlow(null);
  };

  const Nav = (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto p-3">
      {NAV_GROUPS.map((group) => (
        <div key={group.group} className="space-y-1">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{group.group}</p>
          {group.items.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.id === "fila" && !!stats.data?.waiting && (
                  <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] font-semibold text-foreground">{stats.data.waiting}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      {/* Sidebar interna */}
      <aside className="hidden w-[212px] shrink-0 border-r border-border bg-card/50 lg:block">{Nav}</aside>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[240px] p-0">
          <VisuallyHidden><SheetTitle>Navegação do atendimento</SheetTitle></VisuallyHidden>
          {Nav}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header operacional */}
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card/60 px-4 py-2.5">
          <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Abrir navegação">
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight">Central de Atendimento</h1>
            <p className="truncate text-[11px] text-muted-foreground">{ctx.establishmentName} · WhatsApp</p>
          </div>
          {ctx.isSuper && ctx.establishments?.length > 0 && (
            <Select value={est} onValueChange={onSwitchEstablishment}>
              <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ctx.establishments.map((e: any) => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <KpiChip label="Fila" value={stats.data?.waiting ?? 0} />
            <KpiChip label="Minhas" value={stats.data?.mine ?? 0} />
            <KpiChip label="Bot" value={stats.data?.bot ?? 0} />
            <KpiChip label="SLA" value={stats.data?.slaOverdue ?? 0} tone={stats.data?.slaOverdue ? "danger" : undefined} />
            <KpiChip label="Resolvidas" value={stats.data?.closedToday ?? 0} />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          {/* INBOX */}
          {tab === "inbox" && (
            <div className="flex h-full min-h-0">
              <aside className={cn("flex w-full min-w-0 flex-col border-r border-border md:w-[320px] md:shrink-0", selectedId && "hidden md:flex")}>
                <div className="space-y-2 border-b border-border p-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por telefone" className="h-9 pl-8 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_FILTERS.map((f) => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={priority ?? "any"} onValueChange={(v) => setPriority(v === "any" ? null : v)}>
                      <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any" className="text-xs">Prioridade</SelectItem>
                        <SelectItem value="urgent" className="text-xs">Urgente</SelectItem>
                        <SelectItem value="high" className="text-xs">Alta</SelectItem>
                        <SelectItem value="medium" className="text-xs">Média</SelectItem>
                        <SelectItem value="low" className="text-xs">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(setup.data?.queues?.length ?? 0) > 0 && (
                    <Select value={queueId ?? "any"} onValueChange={(v) => setQueueId(v === "any" ? null : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Fila" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any" className="text-xs">Todas as filas</SelectItem>
                        {setup.data!.queues.map((q: any) => <SelectItem key={q.id} value={q.id} className="text-xs">{q.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="min-h-0 flex-1">
                  <ConversationList
                    conversations={list}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    isLoading={conversations.isLoading}
                    agentNames={agentNames}
                  />
                </div>
              </aside>

              <section className={cn("flex min-w-0 flex-1 flex-col", !selectedId && "hidden md:flex")}>
                {selectedId && (
                  <div className="flex items-center justify-between border-b border-border px-2 py-1.5 xl:hidden">
                    <Button size="sm" variant="ghost" className="md:invisible" onClick={() => setSelectedId(null)}>
                      <ArrowLeft className="mr-1.5 h-4 w-4" /> Conversas
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDetailOpen(true)}>
                      <PanelRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="min-h-0 flex-1">
                  <ConversationView
                    detail={detail.data}
                    viewerId={ctx.userId}
                    agents={agents}
                    queues={setup.data?.queues ?? []}
                    closeReasons={setup.data?.closeReasons ?? []}
                    busy={sendMutation.isPending || actionMutation.isPending}
                    onSend={async (body, isNote) => { await sendMutation.mutateAsync({ body, isNote }); }}
                    onAction={async (payload) => { await actionMutation.mutateAsync(payload); }}
                    onPriority={(p) => priorityMutation.mutate(p)}
                  />
                </div>
              </section>

              <aside className="hidden w-[300px] shrink-0 border-l border-border xl:block">
                <ContactPanel
                  detail={detail.data}
                  tags={detail.data?.tags ?? []}
                  allTags={setup.data?.tags ?? []}
                  onToggleTag={(tagId, attach) => tagMutation.mutate({ tagId, attach })}
                />
              </aside>

              <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
                <SheetContent side="right" className="w-[320px] p-0">
                  <VisuallyHidden><SheetTitle>Detalhes do contato</SheetTitle></VisuallyHidden>
                  <ContactPanel
                    detail={detail.data}
                    tags={detail.data?.tags ?? []}
                    allTags={setup.data?.tags ?? []}
                    onToggleTag={(tagId, attach) => tagMutation.mutate({ tagId, attach })}
                  />
                </SheetContent>
              </Sheet>
            </div>
          )}

          {tab !== "inbox" && (
            <div className="h-full overflow-y-auto p-5 md:p-6">
              {tab === "fila" && <QueueBoard conversations={list} agentNames={agentNames} onOpen={openConversation} />}
              {tab === "contatos" && <ContactManager establishmentId={est} />}
              {tab === "disparos" && <BroadcastManager establishmentId={est} />}
              {tab === "agente" && <AgentConfig establishmentId={est} />}
              {tab === "fluxos" && (
                editingFlow
                  ? <FlowEditor establishmentId={est} flow={editingFlow} onBack={() => setEditingFlow(null)} />
                  : <FlowsView establishmentId={est} onEdit={setEditingFlow} />
              )}
              {tab === "templates" && <TemplateManager establishmentId={est} />}
              {tab === "otp" && <OTPEditor />}
              {tab === "whatsapp" && <WhatsAppManager establishmentId={est} />}
              {tab === "relatorios" && <InboxReports report={reports.data} agentNames={agentNames} />}
              {tab === "config" && (
                <Tabs defaultValue="operacao">
                  <TabsList>
                    <TabsTrigger value="operacao" className="text-xs">Operação</TabsTrigger>
                    <TabsTrigger value="respostas" className="text-xs">Respostas</TabsTrigger>
                    <TabsTrigger value="equipe" className="text-xs">Equipe</TabsTrigger>
                  </TabsList>
                  <TabsContent value="operacao" className="mt-3">
                    <InboxOperationSettings
                      queues={setup.data?.queues ?? []}
                      closeReasons={setup.data?.closeReasons ?? []}
                      canManage={ctx.canManage}
                      onSaveQueue={(payload) => setupMutation.mutate({ kind: "queue", payload })}
                      onDeleteQueue={(id) => setupMutation.mutate({ kind: "queue-delete", payload: id })}
                      onSaveReason={(payload) => setupMutation.mutate({ kind: "reason", payload })}
                    />
                  </TabsContent>
                  <TabsContent value="respostas" className="mt-3 space-y-4">
                    <QuickRepliesManager establishmentId={est} />
                    <TemplateManager establishmentId={est} />
                  </TabsContent>
                  <TabsContent value="equipe" className="mt-3 space-y-2">
                    {agents.map((a: any) => (
                      <div key={a.userId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.role}</p>
                        </div>
                        <Badge variant="outline" className="text-[11px]">
                          {a.presence?.status === "online" ? "Online" : a.presence?.status === "away" ? "Ausente" : "Offline"}
                        </Badge>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
