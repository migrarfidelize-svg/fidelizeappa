export type InboxStatus = "bot" | "waiting" | "assigned" | "paused" | "closed";

export const STATUS_META: Record<InboxStatus, { label: string; className: string }> = {
  bot: { label: "Bot", className: "bg-primary/10 text-primary border-primary/20" },
  waiting: { label: "Na fila", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  assigned: { label: "Em atendimento", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  paused: { label: "Pausada", className: "bg-muted text-muted-foreground border-border" },
  closed: { label: "Finalizada", className: "bg-muted text-muted-foreground border-border" },
};

export const PRIORITY_META: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgente", className: "bg-destructive/10 text-destructive border-destructive/20" },
  high: { label: "Alta", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  medium: { label: "Média", className: "bg-muted text-muted-foreground border-border" },
  low: { label: "Baixa", className: "bg-muted text-muted-foreground border-border" },
};

export function relativeTime(value?: string | null) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

export function shortTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Hoje";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatPhone(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 10) return phone || "—";
  const local = digits.slice(-11);
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  return rest.length === 9 ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}` : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

export function isSlaOverdue(conversation: { sla_due_at?: string | null; status?: string }) {
  return !!conversation.sla_due_at && conversation.status !== "closed" && new Date(conversation.sla_due_at).getTime() < Date.now();
}

export function initials(name?: string | null, phone?: string | null) {
  const source = (name || "").trim() || (phone || "").replace(/\D/g, "").slice(-2);
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function minutesLabel(minutes: number) {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
