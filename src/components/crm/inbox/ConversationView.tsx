import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Bot, CheckCircle2, ChevronDown, Hand, MoreVertical, PauseCircle, PlayCircle, Send, StickyNote, Undo2, UserPlus, Users,
} from "lucide-react";
import { PRIORITY_META, STATUS_META, dayLabel, formatPhone, shortTime } from "./inbox-utils";

type Props = {
  detail: any;
  viewerId: string;
  agents: { userId: string; name: string }[];
  queues: any[];
  closeReasons: any[];
  onSend: (body: string, isNote: boolean) => Promise<void> | void;
  onAction: (payload: { action: string; assigneeId?: string; queueId?: string; closeReasonId?: string; closeNote?: string }) => Promise<void> | void;
  onPriority: (priority: string) => void;
  busy?: boolean;
};

const EVENT_LABEL: Record<string, string> = {
  takeover: "assumiu o atendimento",
  transfer: "transferiu a conversa",
  return_to_bot: "devolveu ao bot",
  pause: "pausou a conversa",
  resume: "retomou a conversa",
  close: "finalizou o atendimento",
  reopen: "reabriu a conversa",
  to_queue: "enviou para a fila",
  priority: "alterou a prioridade",
};

export function ConversationView({ detail, viewerId, agents, queues, closeReasons, onSend, onAction, onPriority, busy }: Props) {
  const [text, setText] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState<string>("");
  const [closeNote, setCloseNote] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const conversation = detail?.conversation;
  const history = detail?.history ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [history.length, conversation?.id]);

  const agentNames = useMemo(() => Object.fromEntries(agents.map((a) => [a.userId, a.name])), [agents]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center text-muted-foreground">
        <div>
          <Bot className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">Selecione uma conversa para começar o atendimento.</p>
        </div>
      </div>
    );
  }

  const status = STATUS_META[conversation.status as keyof typeof STATUS_META] ?? STATUS_META.bot;
  const isMine = conversation.assigned_to === viewerId;
  const canTakeover = !conversation.assigned_to && conversation.status !== "closed";

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    await onSend(body, noteMode);
    setText("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header operacional */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{conversation.contact?.name || formatPhone(conversation.customer_phone)}</h2>
            <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", status.className)}>{status.label}</Badge>
            {conversation.bot_paused && conversation.status !== "closed" && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Bot pausado</Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {formatPhone(conversation.customer_phone)}
            {conversation.assigned_to ? ` · ${agentNames[conversation.assigned_to] ?? "Atendente"}` : " · sem responsável"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canTakeover && (
            <Button size="sm" disabled={busy} onClick={() => onAction({ action: "takeover" })}>
              <Hand className="mr-1.5 h-4 w-4" /> Assumir
            </Button>
          )}
          {conversation.status === "assigned" && isMine && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction({ action: "pause" })}>
              <PauseCircle className="mr-1.5 h-4 w-4" /> Pausar
            </Button>
          )}
          {conversation.status === "paused" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction({ action: "resume" })}>
              <PlayCircle className="mr-1.5 h-4 w-4" /> Retomar
            </Button>
          )}
          {conversation.status !== "closed" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setCloseOpen(true)}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Finalizar
            </Button>
          )}
          {conversation.status === "closed" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction({ action: "reopen" })}>
              <Undo2 className="mr-1.5 h-4 w-4" /> Reabrir
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Transferir para</DropdownMenuLabel>
              {agents.filter((a) => a.userId !== conversation.assigned_to).map((a) => (
                <DropdownMenuItem key={a.userId} onClick={() => onAction({ action: "transfer", assigneeId: a.userId })}>
                  <UserPlus className="mr-2 h-4 w-4" /> {a.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuLabel>Enviar para fila</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onAction({ action: "to_queue" })}>
                <Users className="mr-2 h-4 w-4" /> Fila geral
              </DropdownMenuItem>
              {queues.map((q) => (
                <DropdownMenuItem key={q.id} onClick={() => onAction({ action: "to_queue", queueId: q.id })}>
                  <Users className="mr-2 h-4 w-4" /> {q.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuLabel>Automação</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onAction({ action: "return_to_bot" })}>
                <Bot className="mr-2 h-4 w-4" /> Devolver ao bot
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={conversation.priority ?? "medium"} onValueChange={onPriority}>
            <SelectTrigger className="h-8 w-[116px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_META).map(([key, meta]) => (
                <SelectItem key={key} value={key} className="text-xs">{meta.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Histórico */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
          {history.map((item: any) => {
            if (item.kind === "event") {
              return (
                <div key={`e-${item.id}`} className="flex justify-center">
                  <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                    {(item.actor_id && agentNames[item.actor_id]) || "Sistema"} {EVENT_LABEL[item.event] ?? item.event} · {shortTime(item.created_at)}
                  </span>
                </div>
              );
            }
            if (item.kind === "note") {
              return (
                <div key={`n-${item.id}`} className="mx-auto w-full max-w-[85%] rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                    <StickyNote className="h-3 w-3" /> Nota interna · {agentNames[item.author_id] ?? "Equipe"} · {shortTime(item.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{item.body}</p>
                </div>
              );
            }
            const outbound = item.direction === "outbound";
            const fromBot = outbound && item.metadata?.source && item.metadata.source !== "agent";
            return (
              <div key={`m-${item.id}`} className={cn("flex", outbound ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3 py-2 text-sm",
                    outbound
                      ? fromBot
                        ? "bg-primary/10 text-foreground"
                        : "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {item.media_url && (
                    <a href={item.media_url} target="_blank" rel="noreferrer" className="mb-1 block text-xs underline">
                      Ver mídia anexada
                    </a>
                  )}
                  <p className="whitespace-pre-wrap break-words">{item.body}</p>
                  <p className={cn("mt-1 text-[10px] opacity-70", outbound ? "text-right" : "")}>
                    {fromBot ? "Bot · " : ""}
                    {dayLabel(item.created_at)} {shortTime(item.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-2">
          <Button size="sm" variant={noteMode ? "outline" : "secondary"} onClick={() => setNoteMode(false)}>Responder</Button>
          <Button size="sm" variant={noteMode ? "secondary" : "outline"} onClick={() => setNoteMode(true)}>
            <StickyNote className="mr-1.5 h-4 w-4" /> Nota interna
          </Button>
          {conversation.status === "bot" && !noteMode && (
            <span className="text-[11px] text-muted-foreground">Ao responder você assume a conversa e pausa o bot.</span>
          )}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={2}
            placeholder={noteMode ? "Nota visível apenas para a equipe…" : "Escreva sua mensagem…"}
            className="min-h-[56px] resize-none"
          />
          <Button onClick={() => void submit()} disabled={busy || !text.trim()} className="h-[56px] px-4">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Finalizar atendimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={closeReason} onValueChange={setCloseReason}>
              <SelectTrigger><SelectValue placeholder="Motivo do encerramento (opcional)" /></SelectTrigger>
              <SelectContent>
                {closeReasons.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Observação interna (opcional)" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                await onAction({ action: "close", closeReasonId: closeReason || undefined, closeNote: closeNote || undefined });
                setCloseOpen(false);
                setCloseReason("");
                setCloseNote("");
              }}
            >
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { ChevronDown };
