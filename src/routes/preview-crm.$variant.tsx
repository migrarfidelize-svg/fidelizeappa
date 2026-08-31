import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  MessageSquare, History, Contact, SendHorizontal, UserCheck, GitBranch,
  FileText, Smartphone, Search, Sparkles, Zap, ShieldCheck, BarChart3,
  Clock, CheckCircle2, Paperclip, Smile, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/preview-crm/$variant")({
  component: PreviewCRM,
  head: () => ({
    meta: [
      { title: "Preview visual do CRM de Atendimento | Fidelize" },
      { name: "description", content: "Três direções visuais para o CRM de Atendimento da Fidelize, com Disparos e OTP." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Preview visual do CRM de Atendimento" },
      { property: "og:description", content: "Direções visuais A, B e C do CRM de Atendimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

/* ---------------- mock data (somente visual) ---------------- */

const NAV = [
  { group: "Operação", items: [
    { id: "conversas", label: "Conversas", icon: MessageSquare, badge: 12 },
    { id: "fila", label: "Fila", icon: History, badge: 3 },
    { id: "contatos", label: "Contatos", icon: Contact },
    { id: "disparos", label: "Disparos", icon: SendHorizontal, badge: 2 },
  ]},
  { group: "Automação", items: [
    { id: "agente", label: "Agente", icon: UserCheck },
    { id: "fluxos", label: "Fluxos", icon: GitBranch },
  ]},
  { group: "Comunicação", items: [
    { id: "templates", label: "Templates", icon: FileText },
    { id: "otp", label: "OTP", icon: ShieldCheck },
    { id: "whatsapp", label: "WhatsApp", icon: Smartphone },
  ]},
];

const CONVERSAS = [
  { id: "1", name: "Marina Alves", phone: "+55 11 99812-4477", last: "Perfeito, quero resgatar o brinde 🎁", time: "agora", status: "Aguardando", unread: 2, support: true },
  { id: "2", name: "Rafael Duarte", phone: "+55 11 99711-2093", last: "Bot: seu cartão tem 7 de 10 selos", time: "4 min", status: "Atribuído", unread: 0 },
  { id: "3", name: "Camila Souza", phone: "+55 21 98220-7781", last: "Consigo usar dois cupons juntos?", time: "18 min", status: "Aguardando", unread: 1 },
  { id: "4", name: "Diego Martins", phone: "+55 31 99604-1122", last: "Obrigado pelo atendimento!", time: "1 h", status: "Resolvido", unread: 0 },
  { id: "5", name: "Bianca Reis", phone: "+55 47 98801-3355", last: "Qual o horário de hoje?", time: "2 h", status: "Atribuído", unread: 0 },
];

const MSGS = [
  { id: "m1", dir: "in", body: "Oi! Vi a promoção de terça, ainda vale?", time: "09:12" },
  { id: "m2", dir: "out", body: "Olá, Marina! Vale sim até as 22h de hoje 😊", time: "09:12" },
  { id: "m3", dir: "note", body: "Nota interna: cliente VIP, 7 selos acumulados.", time: "09:13" },
  { id: "m4", dir: "in", body: "Perfeito, quero resgatar o brinde 🎁", time: "09:15" },
];

const DISPAROS = [
  { id: "d1", name: "Reativação 30 dias", status: "Enviando", sent: 812, total: 1200, rate: "42%" },
  { id: "d2", name: "Promo Terça do Açaí", status: "Agendado", sent: 0, total: 640, rate: "—" },
  { id: "d3", name: "Aniversariantes de Agosto", status: "Concluído", sent: 318, total: 318, rate: "57%" },
];

const OTP_ROWS = [
  { id: "o1", phone: "+55 11 99812-4477", code: "412 908", status: "Validado", time: "há 2 min" },
  { id: "o2", phone: "+55 21 98220-7781", code: "779 145", status: "Pendente", time: "há 6 min" },
  { id: "o3", phone: "+55 31 99604-1122", code: "230 671", status: "Expirado", time: "há 22 min" },
];

const KPIS = [
  { label: "Na fila", value: "3", icon: Clock },
  { label: "Em atendimento", value: "8", icon: MessageSquare },
  { label: "Resolvidas hoje", value: "46", icon: CheckCircle2 },
  { label: "TMA", value: "2m 14s", icon: BarChart3 },
];

/* ---------------- shared section renderers ---------------- */

function DisparosPanel({ dense }: { dense?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Disparos</h2>
          <p className="text-xs text-muted-foreground">Campanhas em massa pelo WhatsApp com controle de cadência.</p>
        </div>
        <button className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Nova campanha</button>
      </div>
      <div className={cn("grid gap-3", dense ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {DISPAROS.map((d) => (
          <article key={d.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <strong className="truncate text-sm">{d.name}</strong>
              <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{d.status}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(d.sent / d.total) * 100}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{d.sent}/{d.total} enviados</span><span>Resposta {d.rate}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function OtpPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">OTP</h2>
          <p className="text-xs text-muted-foreground">Códigos de verificação enviados pelo WhatsApp.</p>
        </div>
        <button className="rounded-lg border px-3 py-2 text-xs font-semibold">Editar mensagem</button>
      </div>
      <div className="rounded-xl border bg-card">
        <div className="grid grid-cols-4 border-b px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Telefone</span><span>Código</span><span>Status</span><span className="text-right">Quando</span>
        </div>
        {OTP_ROWS.map((r) => (
          <div key={r.id} className="grid grid-cols-4 items-center border-b px-4 py-3 text-xs last:border-0">
            <span className="font-medium">{r.phone}</span>
            <span className="font-mono tracking-widest text-muted-foreground">{r.code}</span>
            <span><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
              r.status === "Validado" ? "bg-success/15 text-success" : r.status === "Pendente" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{r.status}</span></span>
            <span className="text-right text-muted-foreground">{r.time}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
        Template atual: <span className="font-mono">Seu código Fidelize é {"{{codigo}}"}. Expira em 5 minutos.</span>
      </div>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="grid h-full place-items-center rounded-xl border border-dashed bg-muted/20 p-10 text-center">
      <div>
        <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary" />
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">Área existente preservada nesta direção visual.</p>
      </div>
    </div>
  );
}

function Body({ tab }: { tab: string }) {
  if (tab === "disparos") return <DisparosPanel />;
  if (tab === "otp") return <OtpPanel />;
  const map: Record<string, string> = {
    fila: "Fila de atendimento", contatos: "Contatos", agente: "Agente de IA",
    fluxos: "Fluxos", templates: "Templates", whatsapp: "Conexão WhatsApp",
  };
  return <Placeholder title={map[tab] ?? "Módulo"} />;
}

/* ---------------- Direção A — Command Deck ---------------- */

function VariantA() {
  const [tab, setTab] = useState("conversas");
  const [sel, setSel] = useState("1");
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground"><Zap className="h-4 w-4" /></div>
          <span className="font-display text-sm font-bold">Atendimento</span>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{g.group}</p>
              <div className="space-y-1">
                {g.items.map((i) => (
                  <button key={i.id} onClick={() => setTab(i.id)}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                      tab === i.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground")}>
                    <i.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{i.label}</span>
                    {i.badge ? <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", tab === i.id ? "bg-primary-foreground/20" : "bg-primary/10 text-primary")}>{i.badge}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t p-3 text-[11px] text-muted-foreground">Conta: Açaí do Centro</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-5">
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Buscar conversas, contatos, campanhas…</span>
          </div>
          <div className="flex gap-2">
            {KPIS.slice(0, 3).map((k) => (
              <div key={k.label} className="rounded-lg border bg-background px-3 py-1.5">
                <span className="text-[10px] uppercase text-muted-foreground">{k.label}</span>
                <p className="font-display text-sm font-bold leading-none">{k.value}</p>
              </div>
            ))}
          </div>
        </header>

        {tab === "conversas" ? (
          <div className="flex min-h-0 flex-1">
            <div className="w-80 shrink-0 overflow-y-auto border-r bg-card">
              {CONVERSAS.map((c) => (
                <button key={c.id} onClick={() => setSel(c.id)}
                  className={cn("w-full border-b p-3 text-left transition-colors", sel === c.id ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-muted/40")}>
                  <div className="flex items-center justify-between gap-2">
                    <strong className="truncate text-sm">{c.name}</strong>
                    <span className="text-[10px] text-muted-foreground">{c.time}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.last}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{c.status}</span>
                    {c.support && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">SUPORTE</span>}
                    {c.unread > 0 && <span className="ml-auto grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">{c.unread}</span>}
                  </div>
                </button>
              ))}
            </div>
            <section className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-14 items-center justify-between border-b px-5">
                <div>
                  <strong className="text-sm">Marina Alves</strong>
                  <p className="text-[11px] text-muted-foreground">+55 11 99812-4477 · 7 selos</p>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg border px-3 py-1.5 text-xs">Atribuir</button>
                  <button className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground">Resolver</button>
                </div>
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-5">
                {MSGS.map((m) => (
                  <div key={m.id} className={cn("max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                    m.dir === "out" ? "ml-auto bg-primary text-primary-foreground" : m.dir === "note" ? "mx-auto border border-dashed bg-card text-muted-foreground" : "bg-card")}>
                    {m.body}
                    <span className={cn("mt-1 block text-[10px]", m.dir === "out" ? "text-primary-foreground/70" : "text-muted-foreground")}>{m.time}</span>
                  </div>
                ))}
              </div>
              <footer className="flex items-center gap-2 border-t bg-card p-3">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">Responder pelo WhatsApp…</div>
                <Smile className="h-4 w-4 text-muted-foreground" />
                <button className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Enviar</button>
              </footer>
            </section>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6"><Body tab={tab} /></div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Direção B — Focus Canvas ---------------- */

function VariantB() {
  const [tab, setTab] = useState("disparos");
  const flat = NAV.flatMap((g) => g.items);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-6 p-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Fidelize · CRM</p>
            <h1 className="font-display text-3xl font-bold tracking-tight">Atendimento</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border bg-card px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Buscar…</span>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-4">
          {KPIS.map((k) => (
            <div key={k.label} className="rounded-2xl border bg-card p-5">
              <k.icon className="mb-3 h-5 w-5 text-primary" />
              <p className="font-display text-2xl font-bold leading-none">{k.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>

        <nav className="flex flex-wrap gap-2">
          {flat.map((i) => (
            <button key={i.id} onClick={() => setTab(i.id)}
              className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                tab === i.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}>
              <i.icon className="h-3.5 w-3.5" />{i.label}
              {i.badge ? <span className={cn("rounded-full px-1.5", tab === i.id ? "bg-primary-foreground/20" : "bg-primary/10 text-primary")}>{i.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="flex-1 rounded-3xl border bg-card/60 p-8">
          {tab === "conversas" ? (
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <div className="space-y-3">
                {CONVERSAS.map((c) => (
                  <div key={c.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex justify-between gap-2">
                      <strong className="truncate text-sm">{c.name}</strong>
                      <span className="text-[10px] text-muted-foreground">{c.time}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{c.last}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border bg-card p-6">
                <div className="space-y-4">
                  {MSGS.map((m) => (
                    <div key={m.id} className={cn("max-w-[75%] rounded-2xl px-5 py-3 text-sm",
                      m.dir === "out" ? "ml-auto bg-primary text-primary-foreground" : m.dir === "note" ? "mx-auto bg-muted text-muted-foreground" : "bg-muted/60")}>{m.body}</div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl border bg-background p-4 text-xs text-muted-foreground">Responder pelo WhatsApp…</div>
              </div>
            </div>
          ) : (
            <Body tab={tab} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Direção C — Console Grid ---------------- */

function VariantC() {
  const [tab, setTab] = useState("otp");
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r bg-card py-3">
        <div className="mb-3 grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"><Zap className="h-4 w-4" /></div>
        {NAV.flatMap((g) => g.items).map((i) => (
          <button key={i.id} onClick={() => setTab(i.id)} title={i.label}
            className={cn("relative grid h-9 w-9 place-items-center rounded-md transition-colors",
              tab === i.id ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <i.icon className="h-4 w-4" />
            {i.badge ? <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" /> : null}
          </button>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Atendimento</span><ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-foreground capitalize">{tab}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {KPIS.map((k) => (
              <span key={k.label} className="tabular-nums">{k.label}: <strong className="text-foreground">{k.value}</strong></span>
            ))}
          </div>
        </header>

        {tab === "conversas" ? (
          <div className="flex min-h-0 flex-1">
            <div className="w-72 shrink-0 overflow-y-auto border-r">
              {CONVERSAS.map((c) => (
                <div key={c.id} className="border-b px-3 py-2 text-xs hover:bg-muted/40">
                  <div className="flex justify-between"><strong className="truncate">{c.name}</strong><span className="text-[10px] text-muted-foreground">{c.time}</span></div>
                  <p className="truncate text-[11px] text-muted-foreground">{c.last}</p>
                </div>
              ))}
            </div>
            <section className="flex min-w-0 flex-1 flex-col">
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {MSGS.map((m) => (
                  <div key={m.id} className={cn("max-w-[68%] rounded-md border px-3 py-2 text-xs",
                    m.dir === "out" ? "ml-auto border-primary/30 bg-primary/10" : m.dir === "note" ? "mx-auto border-dashed" : "bg-card")}>{m.body}</div>
                ))}
              </div>
              <div className="border-t p-2"><div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">Responder…</div></div>
            </section>
            <aside className="w-64 shrink-0 space-y-3 border-l p-4 text-xs">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contato</p>
              <div className="space-y-1"><p className="font-semibold">Marina Alves</p><p className="text-muted-foreground">+55 11 99812-4477</p></div>
              <div className="rounded-md border p-3"><p className="text-[10px] uppercase text-muted-foreground">Selos</p><p className="font-display text-lg font-bold">7 / 10</p></div>
              <div className="rounded-md border p-3"><p className="text-[10px] uppercase text-muted-foreground">Último disparo</p><p>Reativação 30 dias</p></div>
            </aside>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5"><Body tab={tab} /></div>
        )}
      </div>
    </div>
  );
}

function PreviewCRM() {
  const { variant } = Route.useParams();
  if (variant === "b") return <VariantB />;
  if (variant === "c") return <VariantC />;
  return <VariantA />;
}
