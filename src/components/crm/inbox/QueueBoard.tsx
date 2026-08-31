import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PRIORITY_META, STATUS_META, formatPhone, isSlaOverdue, relativeTime } from "./inbox-utils";

const COLUMNS: { key: "bot" | "waiting" | "assigned" | "paused"; title: string }[] = [
  { key: "waiting", title: "Na fila" },
  { key: "bot", title: "Com o bot" },
  { key: "assigned", title: "Em atendimento" },
  { key: "paused", title: "Pausadas" },
];

export function QueueBoard({
  conversations,
  agentNames,
  onOpen,
}: {
  conversations: any[];
  agentNames: Record<string, string>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = conversations.filter((c) => c.status === col.key);
        return (
          <div key={col.key} className="flex min-h-[240px] flex-col rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-semibold">{col.title}</span>
              <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", STATUS_META[col.key].className)}>{items.length}</Badge>
            </div>
            <ScrollArea className="max-h-[60vh] flex-1">
              <div className="space-y-2 p-2">
                {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Vazio</p>}
                {items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onOpen(c.id)}
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <p className="truncate text-sm font-medium">{c.contact?.name || formatPhone(c.customer_phone)}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.preview?.body || "Sem mensagens"}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {c.priority && c.priority !== "medium" && (
                        <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", PRIORITY_META[c.priority]?.className)}>
                          {PRIORITY_META[c.priority]?.label}
                        </Badge>
                      )}
                      {isSlaOverdue(c) && (
                        <Badge variant="outline" className="h-5 border-destructive/20 bg-destructive/10 px-1.5 text-[10px] text-destructive">SLA</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {c.assigned_to ? agentNames[c.assigned_to] ?? "Atendente" : relativeTime(c.last_message_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
