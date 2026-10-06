import { BarChart3, Bell, LinkIcon, Megaphone, QrCode, ShieldCheck, ShoppingBag, Smartphone, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useInView } from "./use-in-view";

type Feature = {
  icon: LucideIcon;
  title: string;
  sub: string;
  tag: string;
  visual: React.ReactNode;
};

const FEATURES: Feature[] = [
  {
    icon: Megaphone,
    title: "Campanhas",
    sub: "Promoções com meta, prazo e público segmentado.",
    tag: "Retenção",
    visual: (
      <div className="space-y-2">
        {([["Terça do combo", 78], ["Volta pra casa", 46], ["Clube Ouro", 92]] as const).map(([label, pct]) => (
          <div key={label}>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{label}</span>
              <span className="font-mono tabular-nums">{pct}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Star,
    title: "Avaliações",
    sub: "QR na mesa vira nota pública e feedback privado.",
    tag: "Reputação",
    visual: (
      <div>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-primary text-primary" />
          ))}
        </div>
        <p className="mt-3 rounded-lg border border-border/60 bg-background/50 p-2 text-xs text-muted-foreground">
          “Atendimento rápido e o combo grátis chegou certinho.”
        </p>
      </div>
    ),
  },
  {
    icon: QrCode,
    title: "Cardápio digital",
    sub: "Stories em tela cheia, com foto, preço e variações.",
    tag: "Vitrine",
    visual: (
      <div>
        <div className="flex gap-1">
          {[100, 40, 0, 0].map((w, i) => (
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full bg-primary" style={{ width: `${w}%` }} />
            </span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["Burger", "Açaí", "Café"].map((n) => (
            <div key={n} className="rounded-lg border border-border/60 bg-background/50 p-2 text-center text-[10px]">
              {n}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: ShoppingBag,
    title: "Catálogo digital",
    sub: "Produtos em vitrine, carrinho e pedido no WhatsApp.",
    tag: "Vendas",
    visual: (
      <div className="grid grid-cols-3 gap-2">
        {["R$ 89", "R$ 149", "R$ 59"].map((p) => (
          <div key={p} className="rounded-lg border border-border/60 bg-background/50 p-1.5">
            <span className="block h-8 rounded-md bg-gradient-to-br from-primary/25 to-accent/20" />
            <span className="mt-1 block text-center font-mono text-[10px] tabular-nums text-primary">{p}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: LinkIcon,
    title: "Bio Commerce",
    sub: "Uma bio só: cardápio, cartão, WhatsApp e mapa.",
    tag: "Bio",
    visual: (
      <div className="space-y-1.5">
        {["Cardápio", "Meu cartão", "WhatsApp"].map((l) => (
          <div key={l} className="rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs">
            {l}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Bell,
    title: "Notificações push",
    sub: "Chega na tela do cliente, sem custo por mensagem.",
    tag: "Alcance",
    visual: (
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        3 novas entregas agora
      </div>
    ),
  },
  {
    icon: BarChart3,
    title: "Analytics de canais",
    sub: "Saiba se o cliente veio do QR, do link ou do cardápio.",
    tag: "Dados",
    visual: (
      <div className="flex h-24 items-end gap-1.5 overflow-hidden rounded-lg">
        {[32, 48, 40, 66, 58, 82, 74, 96].map((h, i) => (
          <span key={i} className="w-full flex-1 rounded-t-md bg-gradient-to-t from-primary/25 to-primary" style={{ height: `${h}%` }} />
        ))}
      </div>
    ),
  },
  {
    icon: Users,
    title: "Equipe e permissões",
    sub: "Cada funcionário com acesso na medida certa.",
    tag: "Controle",
    visual: (
      <div className="space-y-2">
        {["Carimbar", "Ver clientes", "Financeiro"].map((p, i) => (
          <div key={p} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{p}</span>
            <span className={`h-5 w-9 rounded-full p-0.5 ${i < 2 ? "bg-primary/70" : "bg-muted"}`}>
              <span className="block h-4 w-4 rounded-full bg-background" style={{ transform: i < 2 ? "translateX(16px)" : "none" }} />
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Smartphone,
    title: "App instalável",
    sub: "Lojista e cliente instalam na tela inicial. Sem loja.",
    tag: "PWA",
    visual: (
      <div className="flex items-center gap-3">
        <span className="card-icon flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Smartphone className="h-5 w-5" />
        </span>
        <div className="text-xs text-muted-foreground">funciona offline e envia push nativo</div>
      </div>
    ),
  },
  {
    icon: ShieldCheck,
    title: "Antifraude e auditoria",
    sub: "Todo carimbo tem autor, data e histórico rastreável.",
    tag: "Segurança",
    visual: (
      <p className="rounded-lg border border-border/60 bg-background/50 p-2 font-mono text-[10px] text-muted-foreground">
        14:22 · Ana carimbou #3140 · IP registrado
      </p>
    ),
  },
];

function KineticCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <article className="kinetic-card">
      <div className="kinetic-card-inner">
        <div className="flex items-center justify-between gap-3">
          <span className="card-icon flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {feature.tag}
          </span>
        </div>
        <h3 className="mt-3 font-display text-base font-semibold">{feature.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{feature.sub}</p>
        <div className="mt-4">{feature.visual}</div>
      </div>
    </article>
  );
}

export function EcosystemBento() {
  const { ref, inView } = useInView<HTMLElement>(0.15);
  const loop = [...FEATURES, ...FEATURES];

  return (
    <section ref={ref} id="ecossistema" className="kinetic-section border-y py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Smartphone className="h-3.5 w-3.5" /> Tudo em uma conta
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">
            <span className="block text-balance">Começa no cartão fidelidade.</span>
            <span className="block text-balance">
              Vira a <span className="text-primary">operação inteira</span>
            </span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Dez ferramentas que conversam entre si — sem integrar nada, sem pagar dez assinaturas.
          </p>
        </div>
      </div>

      <div className={`kinetic-marquee mt-10 ${inView ? "animate-fade-in" : "opacity-0"}`}>
        <div className="kinetic-track">
          {loop.map((f, i) => (
            <KineticCard key={`${f.title}-${i}`} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}
