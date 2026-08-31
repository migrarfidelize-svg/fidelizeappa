import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Award, History, Mail, Phone, Stamp, Tag as TagIcon } from "lucide-react";
import { formatPhone, initials, relativeTime } from "./inbox-utils";

type Props = {
  detail: any;
  tags: any[];
  allTags: any[];
  onToggleTag: (tagId: string, attach: boolean) => void;
};

export function ContactPanel({ detail, tags, allTags, onToggleTag }: Props) {
  const conversation = detail?.conversation;
  if (!conversation) {
    return <div className="p-6 text-sm text-muted-foreground">Nenhuma conversa selecionada.</div>;
  }
  const contact = conversation.contact;
  const customer = detail.customer;
  const attached = new Set(tags.map((t: any) => t.id));

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
            {initials(contact?.name, conversation.customer_phone)}
          </div>
          <div>
            <p className="text-sm font-semibold">{contact?.name || formatPhone(conversation.customer_phone)}</p>
            <p className="text-xs text-muted-foreground">{formatPhone(conversation.customer_phone)}</p>
          </div>
        </div>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contato</h3>
          <div className="space-y-1.5 text-sm">
            <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {formatPhone(conversation.customer_phone)}</p>
            {contact?.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {contact.email}</p>}
            <p className="flex items-center gap-2 text-muted-foreground">
              <History className="h-3.5 w-3.5" /> {detail.previousConversations} atendimento(s) no histórico
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <TagIcon className="h-3.5 w-3.5" /> Etiquetas
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {allTags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada.</p>}
            {allTags.map((t: any) => {
              const on = attached.has(t.id);
              return (
                <button key={t.id} type="button" onClick={() => onToggleTag(t.id, !on)}>
                  <Badge
                    variant="outline"
                    className={cn("cursor-pointer text-[11px]", on ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground")}
                  >
                    {t.name}
                  </Badge>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fidelidade</h3>
          {customer ? (
            <div className="space-y-1.5 rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{customer.name}</p>
              <p className="text-xs text-muted-foreground">Nível: {customer.tier ?? "—"} · {customer.visits_count ?? 0} visitas</p>
              <p className="text-xs text-muted-foreground">Última visita: {relativeTime(customer.last_visit_at)}</p>
              {detail.loyalty && (
                <div className="flex gap-3 pt-1 text-xs">
                  <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5 text-primary" /> {detail.loyalty.cards} cartões</span>
                  <span className="flex items-center gap-1"><Stamp className="h-3.5 w-3.5 text-primary" /> {detail.loyalty.stamps} carimbos</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Este contato ainda não é um cliente cadastrado na fidelidade.</p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atendimento</h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Aberta {relativeTime(conversation.created_at)} atrás</p>
            <p>Primeira resposta: {conversation.first_response_at ? relativeTime(conversation.first_response_at) + " atrás" : "pendente"}</p>
            <p>Última mensagem: {relativeTime(conversation.last_message_at)}</p>
            {conversation.close_note && <p className="text-foreground">Encerramento: {conversation.close_note}</p>}
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

export { Button };
