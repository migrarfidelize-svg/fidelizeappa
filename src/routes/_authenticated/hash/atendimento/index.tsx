import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  getCRMStats,
  getWhatsAppInstanceStatus,
  getCRMConversations,
  getCRMConversationMessages,
  sendCRMMessage,
  updateCRMConversationStatus,
  getCRMEstablishments,
  getCRMOperators,
} from "@/lib/atendimento.functions";
import { useCRMRealtime } from "@/hooks/use-crm-realtime";
import { cn } from "@/lib/utils";
import { TemplateManager } from "@/components/crm/TemplateManager";
import { OTPEditor } from "@/components/crm/OTPEditor";
import { AgentConfig } from "@/components/crm/AgentConfig";
import { ContactManager } from "@/components/crm/ContactManager";
import { FlowEditor } from "@/components/crm/FlowEditor";
import { FlowsView } from "@/components/crm/FlowsView";
import { WhatsAppManager } from "@/components/crm/WhatsAppManager";

import { BroadcastManager } from "@/components/crm/broadcasts/BroadcastManager";
import { MessageSquare, History, Contact, UserCheck, GitBranch, FileText, Smartphone, Settings2, Moon, Sun, Search, Bell, Plus, Filter, SendHorizontal } from "lucide-react";
import { useTheme } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/hash/atendimento/")({
  component: AtendimentoCRM,
});

function AtendimentoCRM() {
  const { theme, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState("conversas");
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const establishments = useQuery({ queryKey: ["crm-establishments"], queryFn: () => getCRMEstablishments() });
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState("");

  // Seleção automática: o CRM nunca deve exigir escolha manual de conta.
  // Restaura a última conta usada e, na ausência dela, assume a primeira ativa.
  useEffect(() => {
    const list = establishments.data as Array<{ id: string }> | undefined;
    if (!list?.length || selectedEstablishmentId) return;
    let stored: string | null = null;
    try { stored = localStorage.getItem("crm:establishmentId"); } catch { /* noop */ }
    const next = list.find((item) => item.id === stored)?.id ?? list[0].id;
    setSelectedEstablishmentId(next);
  }, [establishments.data, selectedEstablishmentId]);

  useEffect(() => {
    if (!selectedEstablishmentId) return;
    try { localStorage.setItem("crm:establishmentId", selectedEstablishmentId); } catch { /* noop */ }
  }, [selectedEstablishmentId]);

  const establishmentId = selectedEstablishmentId;
  useCRMRealtime(establishmentId);
  
  const navItems = [
    { group: "Operação", items: [
      { id: "conversas", label: "Conversas", icon: MessageSquare },
      { id: "fila", label: "Fila", icon: History },
      { id: "contatos", label: "Contatos", icon: Contact },
      { id: "disparos", label: "Disparos", icon: SendHorizontal },
    ]},
    { group: "Automação", items: [
      { id: "agente", label: "Agente", icon: UserCheck },
      { id: "fluxos", label: "Fluxos", icon: GitBranch, subId: "fluxos_editor" },
    ]},
    { group: "Comunicação", items: [
      { id: "templates", label: "Templates", icon: FileText },
      { id: "otp", label: "OTP", icon: MessageSquare },
      { id: "whatsapp", label: "WhatsApp", icon: Smartphone },
    ]},
  ];

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Object Dock Superior */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card shrink-0">
        <div className="flex items-center h-full gap-6">
          {navItems.map((group, gIdx) => (
            <div key={group.group} className="flex items-center gap-1 h-full">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSelectedFlow(null); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all border border-transparent",
                    activeTab === item.id 
                      ? "bg-primary/10 text-primary border-primary/20 shadow-sm" 
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
              {gIdx < navItems.length - 1 && <div className="w-[1px] h-4 bg-border mx-2" />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
            <select aria-label="Estabelecimento ativo" value={establishmentId} onChange={(event) => { setSelectedEstablishmentId(event.target.value); setSelectedFlow(null); }} className="h-9 max-w-64 rounded-md border bg-background px-3 text-xs">
              <option value="" disabled>Selecione o estabelecimento</option>
              {(establishments.data || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button onClick={toggle} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
        </div>
      </header>

      {/* Conteúdo CRM */}
      <main className="flex-1 overflow-hidden relative">
        {!establishmentId ? <div className="grid h-full place-items-center text-sm text-muted-foreground">Selecione um estabelecimento ativo.</div> : activeTab === "conversas" ? (
          <ConversationQueue key={establishmentId} establishmentId={establishmentId} />
        ) : (
          <div className="h-full overflow-y-auto p-8">
            {activeTab === "fila" && <ConversationQueue key={`${establishmentId}:waiting`} establishmentId={establishmentId} statusFilter="waiting" />}
            {activeTab === "contatos" && <ContactManager establishmentId={establishmentId} />}
            {activeTab === "disparos" && <BroadcastManager establishmentId={establishmentId} />}
            {activeTab === "agente" && <AgentConfig establishmentId={establishmentId} />}
            {activeTab === "fluxos" && (
              <FlowsView 
                establishmentId={establishmentId}
                onEdit={(flow) => {
                  setSelectedFlow(flow);
                  setActiveTab("fluxos_editor");
                }} 
              />
            )}
            {activeTab === "fluxos_editor" && (
              <FlowEditor 
                establishmentId={establishmentId}
                flow={selectedFlow} 
                onBack={() => { 
                  setActiveTab("fluxos"); 
                  setSelectedFlow(null); 
                }} 
              />
            )}


            {activeTab === "templates" && <TemplateManager establishmentId={establishmentId} />}
            {activeTab === "otp" && <OTPEditor />}
            {activeTab === "whatsapp" && <WhatsAppManager establishmentId={establishmentId} />}
          </div>
        )}
      </main>
    </div>
  );
}

function ConversationQueue({ establishmentId, statusFilter = "all" }: { establishmentId: string; statusFilter?: "all" | "waiting" }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [body, setBody] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const operators = useQuery({ queryKey: ["crm-operators", establishmentId], queryFn: () => getCRMOperators({ data: { establishmentId } }), enabled: !!establishmentId });
  const conversations = useQuery({ queryKey: ["crm-conversations", establishmentId, statusFilter], queryFn: () => getCRMConversations({ data: { establishmentId, status: statusFilter } }), enabled: !!establishmentId });
  const selected = conversations.data?.find((item: any) => item.id === selectedId);
  const messages = useQuery({
    queryKey: ["crm-messages", selectedId],
    queryFn: () => getCRMConversationMessages({ data: { establishmentId, conversationId: selectedId! } }),
    enabled: !!establishmentId && !!selectedId,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ["crm-messages", selectedId] });
  };
  const send = useMutation({ mutationFn: () => sendCRMMessage({ data: { establishmentId, conversationId: selectedId!, body, isNote } }), onSuccess: () => { setBody(""); setIsNote(false); refresh(); } });
  const status = useMutation({ mutationFn: (value: "assigned" | "closed") => updateCRMConversationStatus({ data: { establishmentId, conversationId: selectedId!, status: value, assignedTo: value === "assigned" ? selectedAssignee : undefined } }), onSuccess: refresh });
  const supportActive = Boolean((selected?.metadata as any)?.support?.active);
  return <div className="flex h-full w-full">
    <aside className="w-80 border-r bg-card overflow-y-auto">
      <div className="h-12 border-b flex items-center px-4 gap-2"><Search className="h-4 w-4" /><span className="text-xs">{statusFilter === "waiting" ? "Aguardando atendimento" : "Conversas"}</span></div>
      {(conversations.data || []).map((conversation: any) => {
        const support = Boolean(conversation.metadata?.support?.active);
        const last = [...(conversation.messages || [])].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))[0];
        return <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={cn("w-full border-b p-3 text-left", selectedId === conversation.id && "bg-muted") }>
          <div className="flex justify-between gap-2"><strong className="truncate text-sm">{conversation.customer_name || conversation.customer_phone}</strong>{support && <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-black text-red-600">SUPORTE</span>}</div>
          {conversation.customer_name && <p className="truncate text-[10px] text-muted-foreground">{conversation.customer_phone}</p>}
          <p className="truncate text-xs text-muted-foreground">{last?.body || "Nova conversa"}</p>
          <div className="flex justify-between text-[10px] uppercase text-muted-foreground"><span>{conversation.status === "waiting" ? "Aguardando" : conversation.status === "assigned" ? "Atribuído" : conversation.status}</span><span>{conversation.last_message_at ? formatWaitTime(conversation.last_message_at) : ""}</span></div>
        </button>;
      })}
      {!conversations.isLoading && !conversations.data?.length && <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma conversa.</p>}
    </aside>
    <section className="flex min-w-0 flex-1 flex-col">
      {!selected ? <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Selecione uma conversa.</div> : <>
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div><strong>{selected.customer_phone}</strong>{supportActive && <span className="ml-3 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-1 text-xs font-black text-red-600">SUPORTE</span>}</div>
          <div className="flex gap-2">{selected.status === "waiting" && <><select aria-label="Responsável" value={selectedAssignee} onChange={(event) => setSelectedAssignee(event.target.value)} className="rounded border bg-background px-2 text-xs"><option value="">Selecione o operador</option>{(operators.data || []).map((member: any) => <option key={member.user_id} value={member.user_id}>{member.user_id} ({member.role})</option>)}</select><button disabled={!selectedAssignee} onClick={() => status.mutate("assigned")} className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50">Atribuir</button></>}<button onClick={() => status.mutate("closed")} className="rounded border px-3 py-1 text-xs">Resolver</button></div>
        </header>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">{(messages.data || []).map((message: any) => <div key={`${message.type}-${message.id}`} className={cn("max-w-[75%] rounded-lg p-3 text-sm", message.direction === "outbound" ? "ml-auto bg-primary text-primary-foreground" : message.direction === "internal" ? "mx-auto bg-amber-500/10" : "bg-muted")}>{message.body || message.content}</div>)}</div>
        <footer className="space-y-2 border-t p-3"><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={isNote} onChange={(event) => setIsNote(event.target.checked)} /> Nota interna (não envia ao cliente)</label><div className="flex gap-2"><textarea value={body} onChange={(event) => setBody(event.target.value)} className={cn("min-h-12 flex-1 rounded border bg-background p-2 text-sm", isNote && "border-amber-500/50 bg-amber-500/5")} placeholder={isNote ? "Adicionar nota interna..." : "Responder pelo WhatsApp..."} /><button disabled={!body.trim() || send.isPending} onClick={() => send.mutate()} className="rounded bg-primary px-4 text-sm text-primary-foreground">{isNote ? "Anotar" : "Enviar"}</button></div></footer>
      </>}
    </section>
  </div>;
}

function formatWaitTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h` : `${Math.floor(hours / 24)} d`;
}
