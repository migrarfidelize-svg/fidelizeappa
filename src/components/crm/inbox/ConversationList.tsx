import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bot, MessageSquare, User } from "lucide-react";
import { PRIORITY_META, STATUS_META, formatPhone, initials, isSlaOverdue, relativeTime, shortTime } from "./inbox-utils";

type Props = {
  conversations: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
  agentNames: Record<string, string>;
};

export function ConversationList({ conversations, selectedId, onSelect, isLoading, agentNames }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>
    );
  }

  if (!conversations.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <MessageSquare className="h-8 w-8 opacity-40" />
        <p className="text-sm">Nenhuma conversa com esses filtros.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <ul className="divide-y divide-border">
        {conversations.map((c) => {
          const status = STATUS_META[(c.status as keyof typeof STATUS_META)] ?? STATUS_META.bot;
          const overdue = isSlaOverdue(c);
          const name = c.contact?.name || formatPhone(c.customer_phone);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60",
                  selectedId === c.id && "bg-muted",
                )}
              >
                <div className="relative">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(c.contact?.name, c.customer_phone)}
                  </div>
                  {c.status === "bot" ? (
                    <Bot className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background p-0.5 text-primary" />
                  ) : c.assigned_to ? (
                    <User className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background p-0.5 text-emerald-600" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{shortTime(c.last_message_at ?? c.created_at)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.preview?.direction === "outbound" ? "Você: " : ""}
                    {c.preview?.body || "Sem mensagens"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", status.className)}>
                      {status.label}
                    </Badge>
                    {c.priority && c.priority !== "medium" && (
                      <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", PRIORITY_META[c.priority]?.className)}>
                        {PRIORITY_META[c.priority]?.label}
                      </Badge>
                    )}
                    {overdue && (
                      <Badge variant="outline" className="h-5 gap-1 border-destructive/20 bg-destructive/10 px-1.5 text-[10px] text-destructive">
                        <AlertTriangle className="h-3 w-3" /> SLA
                      </Badge>
                    )}
                    {c.status === "waiting" && (
                      <span className="text-[10px] text-muted-foreground">aguarda {relativeTime(c.waiting_since ?? c.last_message_at)}</span>
                    )}
                    {c.assigned_to && agentNames[c.assigned_to] && (
                      <span className="truncate text-[10px] text-muted-foreground">· {agentNames[c.assigned_to]}</span>
                    )}
                    {c.unread_count > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
