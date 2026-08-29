import { createFileRoute, Link, useRouter, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setPlanIntent } from "@/lib/plan-intent";
import { trackPlanFunnel, rememberSelectedPlan } from "@/lib/plan-funnel";

import { Logo } from "@/components/Logo";
import { StampCard } from "@/components/StampCard";
import { BrandMarquee } from "@/components/landing/BrandMarquee";
import { DEFAULT_BRANDS, DEFAULT_HERO_COPY, type LandingBrandsContent, type LandingHeroContent, type PublicPlan } from "@/lib/landing-content";
import { HeroAppPreview } from "@/components/landing/HeroAppPreview";
import { EcosystemBento } from "@/components/landing/EcosystemBento";

import { RoiCalculator } from "@/components/landing/RoiCalculator";

import { ScrollProgress } from "@/components/landing/ScrollProgress";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowRight, Menu, QrCode, Smartphone, ShieldCheck, BarChart3, Sparkles, Coffee, Scissors, Pizza, ShoppingBag, Wrench, IceCream, Store, PawPrint, Check, X, Cake, Clock, UserPlus, Crown, Gift, MessageCircle, Bell, Mail, Sprout, Zap, Building2, Send, Bot, HelpCircle, ChevronDown, type LucideIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { askFaqAI, getFaqAIStatus } from "@/lib/faq-ai.functions";
import { getLandingPublic } from "@/lib/landing-content.functions";

const SITE_URL = "https://warm-hug-genie.lovable.app";
const PAGE_TITLE = "Fidelize — Cartão fidelidade digital para clientes fiéis";
const PAGE_DESC = "Crie cartões fidelidade digitais com QR Code, painel de análise em tempo real e campanhas que fazem seus clientes voltarem sempre. Planos a partir de {useFromPrice()}/mês.";

const FAQ_ITEMS: Array<[string, string]> = [
  ["Meu cliente precisa baixar um app?", "Não. Tudo funciona direto pelo navegador do celular. Ele escaneia o QR Code, informa nome e telefone e já sai com o cartão pronto."],
  ["Como impedir que o cliente carimbe sozinho?", "Somente sua equipe autenticada pode adicionar carimbos. Cada ação fica registrada com data, hora e nome do funcionário responsável."],
  ["Posso cancelar quando quiser?", "Sim. Cancele a qualquer momento, sem multa. Seus dados ficam preservados caso queira voltar."],
  ["Posso ter mais de uma campanha?", "Sim, a partir do plano Inicial. No Profissional você tem até 5 campanhas ativas simultaneamente."],
  ["Funciona sem internet do cliente?", "No momento do carimbo, precisamos de internet. Mas a experiência é super leve — abre rapidinho em qualquer 3G."],
];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    source: (search?.source as string) || undefined,
  } as { source?: string }),


  head: () => ({
    // Head metadata is now handled by the central SEO configuration.
  }),
  beforeLoad: async ({ location }) => {
    // Se estiver no modo PWA (standalone) ou vier de um redirecionamento de PWA
    const isStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
    const search = location.search as any;
    const isPwaSource = search?.source === "pwa";

    if (isStandalone || isPwaSource) {
      throw redirect({ to: "/auth", search: { source: "pwa" } });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { resolveAuthenticatedDestination } = await import("@/lib/destination-resolver");
      const to = await resolveAuthenticatedDestination();
      throw redirect({ to });
    }
  },
  loader: () => getLandingPublic(),
  errorComponent: () => <Landing disableLiveSync />,
  component: Landing,
});

type LandingData = {
  hero: LandingHeroContent;
  brands: LandingBrandsContent;
  plans: PublicPlan[];
};

/** Dados públicos da landing (mockup, marcas e planos) vindos do loader. */
function useLandingData(): LandingData | undefined {
  try {
    return Route.useLoaderData() as LandingData;
  } catch {
    return undefined;
  }
}

/** Menor preço ativo cadastrado no admin (fallback: R$ 29,90). */
function useFromPrice() {
  const plans = useLandingData()?.plans ?? [];
  const prices = plans.map((p) => Number(p.price_monthly)).filter((n) => Number.isFinite(n) && n > 0);
  return prices.length ? brl(Math.min(...prices)) : "R$ 29,90";
}


function brl(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

/** Atualiza a landing em tempo real quando o admin salva o conteúdo. */
function LandingLiveSync() {
  const router = useRouter();
  useEffect(() => {
    let cleanup = () => {};
    let alive = true;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      if (!alive) return;
      const channel = supabase
        .channel("landing-content")
        .on("broadcast", { event: "updated" }, () => router.invalidate())
        .subscribe();
      cleanup = () => {
        supabase.removeChannel(channel);
      };
    })();
    return () => {
      alive = false;
      cleanup();
    };
  }, [router]);
  return null;
}

function Landing() {
  return (
    <div className="landing-scope min-h-dvh bg-background text-foreground pb-24 md:pb-0">
      <LandingLiveSync />
      <ScrollProgress />
      <SiteHeader />
      <main>
        <Hero />

        
        <Segments />
        <EcosystemBento />
        
        <RoiCalculator />
        <Examples />
        <Pricing />
        
        <FAQ />
        <CTA />
      </main>
      <SiteFooter />
      <MobileStickyCta />

    </div>
  );
}

function MobileStickyCta() {
  const fromPrice = useFromPrice();
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-400/30 bg-background/90 px-4 pb-[env(safe-area-inset-bottom)] pt-3 backdrop-blur-xl md:hidden">
      <div className="flex items-center gap-3 pb-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">A partir de {fromPrice}/mês</div>
          <div className="text-[11px] text-muted-foreground">A partir de {fromPrice}/mês · cancele quando quiser</div>
        </div>
        <Button asChild className="h-12 shrink-0 rounded-full px-6 font-bold">
          <a href="#precos">Quero assinar</a>
        </Button>
      </div>
    </div>
  );
}



const NAV_LINKS: Array<[string, string]> = [
  ["#ecossistema", "Recursos"],
  ["#ecossistema", "Ecossistema"],
  ["#roi", "Retorno"],
  ["#precos", "Preços"],
  ["#faq", "Dúvidas"],
];

function SiteHeader() {
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: async () => (await supabase.auth.getSession()).data.session });
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const handleDashboardClick = async (e: React.MouseEvent) => {
    if (!session) return;
    e.preventDefault();
    const { resolveAuthenticatedDestination } = await import("@/lib/destination-resolver");
    const to = await resolveAuthenticatedDestination();
    router.navigate({ to });
  };

  return (
    <header className="sticky top-4 z-40 px-4">
      <div className="nav-dock mx-auto flex h-18 max-w-5xl items-center justify-between gap-3 rounded-full border border-violet-400/60 bg-background/60 pl-6 pr-3 backdrop-blur-xl">
        <Link to="/" className="shrink-0 flex items-center h-full"><Logo className="py-1" /></Link>
        <nav className="hidden gap-7 md:flex text-sm text-muted-foreground">
          {NAV_LINKS.map(([href, label]) => (
            <a key={`${href}-${label}`} href={href} className="hover:text-foreground transition-colors">{label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {session ? (
            <Button
              asChild
              size="sm"
              className="rounded-full bg-primary text-primary-foreground font-semibold px-5 shadow-[0_0_0_1px_rgba(167,139,250,0.4),0_0_24px_-4px_rgba(167,139,250,0.65)] hover:brightness-110 cursor-pointer"
              onClick={handleDashboardClick}
            >
              <span className="flex items-center">Meu painel <ArrowRight className="ml-1 h-4 w-4" /></span>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="h-10 rounded-full hidden sm:inline-flex"><Link to="/auth">Entrar</Link></Button>
              <Button asChild size="sm" className="h-10 rounded-full px-4"><a href="#precos">Quero assinar</a></Button>

            </>
          )}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Abrir menu"
                className="rounded-full shrink-0 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-xs border-l border-violet-400/30 bg-background/95 backdrop-blur-xl">
              <SheetHeader className="text-left">
                <SheetTitle><Logo /></SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {NAV_LINKS.map(([href, label]) => (
                  <a
                    key={`${href}-${label}`}
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      const id = href.slice(1);
                      // aguarda o Sheet fechar (Radix restaura o scroll ao fechar)
                      setTimeout(() => {
                        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        history.replaceState(null, "", href);
                      }, 360);
                    }}
                    className="flex min-h-[48px] items-center rounded-xl border border-transparent px-4 py-3 text-base font-semibold text-foreground/90 transition-colors hover:border-violet-400/40 hover:bg-primary/10 hover:text-foreground active:bg-primary/15"
                  >
                    {label}

                  </a>
                ))}
              </nav>
              <div className="mt-6 flex flex-col gap-2 border-t border-border/60 pt-6">
                {session ? (
                  <Button asChild className="h-12 rounded-full cursor-pointer" onClick={(e) => { setMenuOpen(false); handleDashboardClick(e); }}>
                    <span className="flex items-center justify-center">Meu painel <ArrowRight className="ml-1 h-4 w-4" /></span>
                  </Button>
                ) : (
                  <>
                    <Button asChild className="h-12 rounded-full" onClick={() => setMenuOpen(false)}>
                      <a href="#precos">Quero assinar</a>
                    </Button>
                    <Button asChild variant="outline" className="h-12 rounded-full" onClick={() => setMenuOpen(false)}>
                      <Link to="/auth">Entrar</Link>
                    </Button>
                  </>
                )}

                <p className="pt-2 text-center text-xs text-muted-foreground">A partir de {useFromPrice()}/mês · cancele quando quiser</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}



const CYAN = "#a78bfa";
const OBSIDIAN = "#020617";

/** Bloco de textos e botões da hero — 100% editável em /hash/landing. */
function HeroCopy() {
  const data = useLandingData();
  const copy = data?.hero?.copy ?? DEFAULT_HERO_COPY;
  const price = useFromPrice();

  // Caso o usuário prefira uma mensagem personalizada sobre a logo da hero
  const badgeText = copy.badge;




  return (
    <div className="min-w-0 flex flex-col items-start text-left text-white">
      {badgeText ? (
        <span
          className="landing-hero-badge inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium sm:text-xs"
          style={{ background: `${CYAN}14`, border: `1px solid ${CYAN}55`, color: CYAN }}
        >
          <Sparkles className="h-3 w-3 shrink-0" />
          <span className="truncate">{badgeText}</span>
        </span>
      ) : null}

      <h1 className="mt-4 font-display text-[2rem] font-extrabold leading-[1.1] tracking-tight text-balance sm:mt-5 sm:text-5xl md:text-6xl pb-1">
        {copy.titlePrefix}{" "}
        {copy.titleHighlight ? (
          <span style={{ color: CYAN, textShadow: `0 0 40px ${CYAN}55` }}>{copy.titleHighlight}</span>
        ) : null}
        .
      </h1>

      {copy.subtitle ? (
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70 sm:mt-5 sm:text-base md:text-lg">
          {copy.subtitle}
        </p>
      ) : null}

      <div className="mt-7 flex w-full flex-col gap-3 sm:mt-8 sm:w-auto sm:flex-row sm:items-center">
        {copy.primaryCta.label ? (
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto font-bold hover:brightness-110 transition-all"
            style={{ background: CYAN, color: OBSIDIAN, boxShadow: `0 0 30px ${CYAN}55` }}
          >
            <a href={copy.primaryCta.href || "#precos"}>
              {copy.primaryCta.label} <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        ) : null}

        {copy.secondaryCta.label ? (
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full sm:w-auto bg-transparent text-white border-white/20 hover:bg-white/10 hover:text-white"
          >
            <a href={copy.secondaryCta.href || "#ecossistema"}>{copy.secondaryCta.label}</a>
          </Button>
        ) : null}
      </div>

      {copy.bullets.length ? (
        <ul className="mt-6 grid w-full grid-cols-1 gap-y-2 text-[13px] text-white/60 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:text-xs">
          {copy.bullets.map((b, i) => (
            <li key={i} className="flex min-w-0 items-start gap-2 sm:items-center">
              <Check className="mt-[2px] h-4 w-4 shrink-0 sm:mt-0" style={{ color: CYAN }} />
              <span className="min-w-0 leading-snug">{b.replace("{preco}", price)}</span>
            </li>
          ))}
        </ul>
      ) : null}

    </div>
  );
}

function Hero() {
  return (
    <section className="landing-hero relative" style={{ background: OBSIDIAN }}>
      <div aria-hidden className="hero-bg-aurora-circuit">
        <span className="hero-bokeh" />
        <svg className="hero-pcb" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <filter id="pcbGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="pcbNodeGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          {/* base traces (dim) */}
          <g stroke="rgba(167,139,250,0.14)" strokeWidth="1.2" fill="none">
            <path d="M0,720 L280,720 L320,680 L560,680 L600,640 L900,640 L940,600 L1600,600" />
            <path d="M0,540 L200,540 L240,500 L520,500 L560,460 L860,460 L900,420 L1600,420" />
            <path d="M0,300 L340,300 L380,340 L640,340 L680,380 L1600,380" />
            <path d="M120,900 L120,760 L160,720" />
            <path d="M420,900 L420,700 L460,680" />
            <path d="M780,900 L780,660 L820,640" />
            <path d="M1140,900 L1140,620 L1180,600" />
            <path d="M300,0 L300,180 L340,220 L340,300" />
            <path d="M760,0 L760,240 L800,280 L800,340" />
            <path d="M1220,0 L1220,300 L1260,340 L1260,380" />
          </g>
          {/* animated bright traces */}
          <g className="pcb-fx" stroke="#a78bfa" strokeWidth="1.6" fill="none" filter="url(#pcbGlow)" strokeDasharray="140 900" strokeLinecap="round">
            <path className="pcb-trace pcb-t1" d="M0,720 L280,720 L320,680 L560,680 L600,640 L900,640 L940,600 L1600,600" />
            <path className="pcb-trace pcb-t2" d="M0,540 L200,540 L240,500 L520,500 L560,460 L860,460 L900,420 L1600,420" />
            <path className="pcb-trace pcb-t3" d="M1600,380 L680,380 L640,340 L380,340 L340,300 L0,300" />
            <path className="pcb-trace pcb-t4" d="M420,900 L420,700 L460,680" />
            <path className="pcb-trace pcb-t5" d="M1140,900 L1140,620 L1180,600" />
            <path className="pcb-trace pcb-t6" d="M760,0 L760,240 L800,280 L800,340" />
          </g>
          {/* nodes with pulsing glow */}
          <g className="pcb-fx" fill="#a78bfa" filter="url(#pcbNodeGlow)">
            <circle className="pcb-node pcb-n1" cx="320" cy="680" r="3.5" />
            <circle className="pcb-node pcb-n2" cx="600" cy="640" r="3.5" />
            <circle className="pcb-node pcb-n3" cx="940" cy="600" r="3.5" />
            <circle className="pcb-node pcb-n4" cx="240" cy="500" r="3.5" />
            <circle className="pcb-node pcb-n5" cx="900" cy="420" r="3.5" />
            <circle className="pcb-node pcb-n6" cx="680" cy="380" r="3.5" />
            <circle className="pcb-node pcb-n7" cx="340" cy="300" r="3.5" />
            <circle className="pcb-node pcb-n1" cx="460" cy="680" r="3" fill="#8b5cf6" />
            <circle className="pcb-node pcb-n3" cx="1180" cy="600" r="3" fill="#8b5cf6" />
            <circle className="pcb-node pcb-n5" cx="800" cy="340" r="3" fill="#8b5cf6" />
          </g>
        </svg>
        <span className="hero-vignette" />
      </div>
      

      
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:py-16 md:py-24">
        <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] lg:gap-14">
          <HeroCopy />


          <div className="landing-hero-preview -mx-2 flex scale-95 justify-center sm:mx-0 sm:scale-100 lg:justify-end">
            <HeroAppPreview content={useLandingData()?.hero} />
          </div>
        </div>
      </div>


    </section>
  );
}

function Segments() {
  const brands = useLandingData()?.brands ?? DEFAULT_BRANDS;
  return (
    <section
      id="segmentos"
      className="relative overflow-hidden border-y border-border bg-white py-16 dark:border-white/10 dark:bg-[#050810] md:py-20"
    >

      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{ background: "radial-gradient(70% 60% at 50% 0%, rgba(255,255,255,0.07), transparent 70%)" }}
      />
      <div className="relative z-10 mx-auto max-w-5xl px-4 text-center text-foreground dark:text-white">
        <h2 className="font-display text-2xl font-bold leading-snug text-balance md:text-4xl">
          {brands.title}
        </h2>
        <p className="mt-3 text-base text-muted-foreground dark:text-white/60 md:text-lg">{brands.subtitle}</p>
      </div>

      <div className="relative z-10 mt-10 md:mt-14">
        <BrandMarquee brands={brands.brands} />
      </div>
    </section>
  );
}


function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Crie seu cartão",
      desc: "Escolha suas cores, adicione sua logo e defina a recompensa que seus clientes vão amar.",
      color: "#a78bfa",
    },
    {
      n: "02",
      title: "Compartilhe o QR",
      desc: "Coloque o QR Code no seu balcão ou envie o link. O cliente escaneia e já sai com o cartão no celular.",
      color: "#a855f7",
    },
    {
      n: "03",
      title: "Carimbe e fidelize",
      desc: "A cada visita, você escaneia o cartão dele. Ele acumula, ganha e volta sempre.",
      color: "#a855f7",
    },
  ];

  const sectionRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const stage = stageRef.current;
    if (!stage) return;
    const links = Array.from(stage.querySelectorAll<SVGPathElement>(".hiw-link path.hiw-link-main"));
    const roots = Array.from(stage.querySelectorAll<SVGGElement>(".hiw-link g.hiw-root"));

    links.forEach((p, i) => {
      let len = 700;
      try { len = p.getTotalLength(); } catch {}
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      p.style.opacity = "1";
      // trigger draw after cards start appearing
      const delay = 350 + i * 500;
      setTimeout(() => {
        p.style.transition = "stroke-dashoffset 900ms cubic-bezier(.6,.05,.2,1)";
        p.style.strokeDashoffset = "0";
      }, delay);
      const root = roots[i];
      if (root) {
        setTimeout(() => {
          root.style.transition = "opacity 400ms ease, transform 400ms ease";
          root.style.opacity = "1";
          root.style.transform = "scale(1)";
        }, delay + 850);
      }
    });
  }, [visible]);

  return (
    <section ref={sectionRef} id="como-funciona" className="relative py-16 md:py-20">
      <div ref={stageRef} className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-violet-500/5 blur-[120px]" />
        <div aria-hidden className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full blur-[120px]" style={{ background: "rgba(255,43,214,0.05)" }} />

        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mb-14 text-center">
            <span className="font-display text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#a78bfa" }}>
              Fluxo de experiência
            </span>
            <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              Três passos simples para seus clientes voltarem sempre
            </h2>
            <p className="mt-4 text-white/60">Do primeiro cadastro à recompensa, tudo funciona pelo navegador.</p>
          </div>

          <div className="relative grid gap-10 md:grid-cols-3 md:gap-6">
            <svg
              aria-hidden
              className="hiw-link pointer-events-none absolute inset-0 hidden h-full w-full md:block"
              viewBox="0 0 1000 400"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="hiwLinkA" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
                <linearGradient id="hiwLinkB" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
                <filter id="hiwGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                className="hiw-link-main"
                d="M 260 110 C 340 110, 380 110, 500 110"
                stroke="url(#hiwLinkA)"
                strokeWidth="2.5"
                fill="none"
                filter="url(#hiwGlow)"
                strokeLinecap="round"
                style={{ opacity: 0 }}
              />
              <g className="hiw-root" style={{ opacity: 0, transform: "scale(0.6)", transformOrigin: "500px 110px" }}>
                <path d="M 500 110 C 508 108, 514 100, 520 92" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
                <path d="M 500 110 C 508 112, 514 120, 520 128" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
                <path d="M 500 110 L 522 110" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
              </g>
              <path
                className="hiw-link-main"
                d="M 594 110 C 700 110, 750 110, 833 110"
                stroke="url(#hiwLinkB)"
                strokeWidth="2.5"
                fill="none"
                filter="url(#hiwGlow)"
                strokeLinecap="round"
                style={{ opacity: 0 }}
              />
              <g className="hiw-root" style={{ opacity: 0, transform: "scale(0.6)", transformOrigin: "833px 110px" }}>
                <path d="M 833 110 C 841 108, 847 100, 853 92" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
                <path d="M 833 110 C 841 112, 847 120, 853 128" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
                <path d="M 833 110 L 855 110" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
              </g>
            </svg>

            {steps.map((s, i) => (
              <div
                key={s.n}
                data-idx={i}
                className="hiw-node hiw-card relative rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm"
                style={{
                  ["--acc" as string]: s.color,
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(28px)",
                  filter: visible ? "blur(0)" : "blur(6px)",
                  transition: `opacity 520ms cubic-bezier(.2,.8,.2,1) ${i * 180}ms, transform 520ms cubic-bezier(.2,.8,.2,1) ${i * 180}ms, filter 520ms ease ${i * 180}ms`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="relative grid h-14 w-14 flex-none place-items-center rounded-xl border bg-[#050505]"
                    style={{ borderColor: `${s.color}55`, boxShadow: `0 0 20px ${s.color}33, inset 0 0 10px ${s.color}22` }}
                  >
                    <span className="font-display text-xl font-extrabold tracking-tighter" style={{ color: s.color }}>
                      {s.n}
                    </span>
                    {i > 0 && (
                      <span
                        aria-hidden
                        className="absolute -left-[7px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-2 ring-[#050505]"
                        style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
                      />
                    )}
                    {i < steps.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute -right-[7px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-2 ring-[#050505]"
                        style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
                      />
                    )}
                  </div>
                  <h3 className="font-display text-2xl font-bold tracking-tight text-white">{s.title}</h3>
                </div>
                <p className="mt-5 text-white/60 md:text-[15px]">{s.desc}</p>

                {i === steps.length - 1 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-3 right-4 rounded-full border border-violet-400/40 bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300 transition-opacity duration-500"
                    style={{ opacity: visible ? 1 : 0, transitionDelay: "900ms" }}
                  >
                    Pronto ✓
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}



function Benefits() {
  const items = [
    { icon: Smartphone, title: "Sem app para baixar", desc: "Acesso direto pelo navegador. Zero atrito.", color: "#a78bfa" },
    { icon: QrCode, title: "QR Code exclusivo", desc: "Cada empresa, campanha e cliente com ID seguro.", color: "#22d3ee" },
    { icon: ShieldCheck, title: "Anti-fraude", desc: "Só sua equipe carimba. Tudo registrado.", color: "#a855f7" },
    { icon: BarChart3, title: "Painel completo", desc: "Clientes, visitas, retorno e alertas num só lugar.", color: "#a855f7" },
    { icon: Sparkles, title: "Página personalizada", desc: "Sua marca, suas cores, sua vitrine digital.", color: "#f472b6" },
    { icon: Store, title: "Multi-unidade", desc: "Uma empresa, várias lojas. Relatórios consolidados.", color: "#60a5fa" },
  ];
  const N = items.length;

  return (
    <section className="relative overflow-hidden py-16 md:py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.06),transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-5 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] md:text-xs" style={{ color: "#a78bfa" }}>
            Ecossistema Fidelize
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
            Tudo o que você precisa para fidelizar
          </h2>
          <p className="mt-3 text-sm text-white/60 md:text-base">Uma plataforma. Seis pilares girando em torno da sua marca.</p>
        </div>

        {/* ============ DESKTOP / TABLET: orbit stage ============ */}
        <div className="fz-orbit relative mx-auto mt-10 hidden aspect-square w-full max-w-[720px] md:block">
          {/* LED ring loops */}
          <div aria-hidden className="fz-ring fz-ring-1" />
          <div aria-hidden className="fz-ring fz-ring-2" />
          <div aria-hidden className="fz-ring fz-ring-3" />

          {/* Central logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg viewBox="0 0 512 512" className="fz-core-mark h-56 w-56" aria-hidden="true">
              <defs>
                <linearGradient id="fzHeroCyan" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#7dfcff" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <path d="M 384 256 A 128 128 0 1 1 256 128" fill="none" stroke="url(#fzHeroCyan)" strokeWidth="28" strokeLinecap="round" opacity="0.85" />
              <path d="M 236 108 L 268 128 L 236 148 Z" fill="url(#fzHeroCyan)" />
              <g fill="url(#fzHeroCyan)">
                <rect x="196" y="156" width="40" height="216" rx="12" />
                <rect x="196" y="156" width="140" height="40" rx="12" />
                <rect x="196" y="244" width="104" height="36" rx="10" />
              </g>
            </svg>
          </div>

          {/* n8n connector */}
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 720 720" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="fzLink" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#a78bfa" />
                <stop offset="0.5" stopColor="#a855f7" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
              <filter id="fzLinkGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <circle cx="360" cy="360" r="260" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx="360" cy="360" r="260" fill="none" stroke="url(#fzLink)" strokeWidth="2.5" strokeLinecap="round" filter="url(#fzLinkGlow)" className="fz-n8n-run" />
          </svg>

          {/* Static chips positioned around */}
          <div className="absolute inset-0">
            {items.map((it, i) => {
              const angle = (360 / N) * i - 90;
              const Icon = it.icon;
              return (
                <div
                  key={it.title}
                  className="absolute left-1/2 top-1/2"
                  style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(-1 * var(--fz-radius))) rotate(${-angle}deg)` }}
                >
                  <div className="fz-chip-static" style={{ ["--acc" as string]: it.color }}>
                    <div className="fz-chip">
                      <div className="fz-chip-icon" style={{ color: it.color, boxShadow: `0 0 22px ${it.color}55, inset 0 0 10px ${it.color}33`, borderColor: `${it.color}66` }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="fz-chip-body">
                        <h3 className="font-display text-sm font-bold text-white">{it.title}</h3>
                        <p className="mt-0.5 text-[11px] leading-snug text-white/60">{it.desc}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============ MOBILE: logo em destaque + grid 2 colunas ============ */}
        <div className="mt-10 md:hidden">
          {/* Centro: logo + rings + n8n */}
          <div className="relative mx-auto aspect-square w-full max-w-[280px]">
            <div aria-hidden className="fz-ring fz-ring-1" />
            <div aria-hidden className="fz-ring fz-ring-2" />
            <div aria-hidden className="fz-ring fz-ring-3" />
            <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 720 720">
              <circle cx="360" cy="360" r="300" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <circle cx="360" cy="360" r="300" fill="none" stroke="url(#fzLink)" strokeWidth="3" strokeLinecap="round" filter="url(#fzLinkGlow)" className="fz-n8n-run-mobile" />
              <defs>
                <linearGradient id="fzLink" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#a78bfa" />
                  <stop offset="0.5" stopColor="#a855f7" />
                  <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
                <filter id="fzLinkGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
            </svg>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <svg viewBox="0 0 512 512" className="fz-core-mark h-40 w-40" aria-hidden="true">
                <defs>
                  <linearGradient id="fzHeroCyanM" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#7dfcff" />
                    <stop offset="1" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
                <path d="M 384 256 A 128 128 0 1 1 256 128" fill="none" stroke="url(#fzHeroCyanM)" strokeWidth="28" strokeLinecap="round" opacity="0.85" />
                <path d="M 236 108 L 268 128 L 236 148 Z" fill="url(#fzHeroCyanM)" />
                <g fill="url(#fzHeroCyanM)">
                  <rect x="196" y="156" width="40" height="216" rx="12" />
                  <rect x="196" y="156" width="140" height="40" rx="12" />
                  <rect x="196" y="244" width="104" height="36" rx="10" />
                </g>
              </svg>
            </div>
          </div>

          {/* Grid dos 6 pilares */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <div key={it.title} className="fz-chip" style={{ ["--acc" as string]: it.color }}>
                  <div className="fz-chip-icon shrink-0" style={{ color: it.color, boxShadow: `0 0 18px ${it.color}55, inset 0 0 8px ${it.color}33`, borderColor: `${it.color}66` }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-[13px] font-bold leading-tight text-white">{it.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/60">{it.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Comparison() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = wrap.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const raw = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
        // Anima até 70% e segura no 100% pelos 30% restantes para o usuário
        // ver a cena totalmente montada antes de sair para a próxima âncora.
        // Anima até 45% do scroll e segura totalmente montado nos 55% restantes.
        const p = Math.min(1, raw / 0.6);
        stage.style.setProperty("--p", String(p));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const pains = [
    "Cartão perdido",
    "Carimbo falso",
    "Zero dados do cliente",
    "Custo de reimpressão",
  ];
  const wins = [
    "100% na nuvem",
    "Anti-fraude nativo",
    "CRM + campanhas",
    "Zero custo por cartão",
  ];

  return (
    <section id="comparativo" className="relative bg-[oklch(0.14_0.02_230)]">
      <div ref={wrapRef} className="relative h-[220vh] min-h-[1460px] md:h-[215vh] md:min-h-[1580px]">
        <div
          ref={stageRef}
          className="tear-stage sticky top-0 isolate flex h-[100svh] min-h-[760px] items-center overflow-hidden"
          style={{ ["--p" as never]: 0 }}
        >
          <div className="relative z-20 mx-auto w-full max-w-6xl px-6 pt-2 md:pt-3">

            <div className="relative z-50 mb-6 -mt-16 text-center md:mb-8 md:-mt-24">
              <h2 className="font-display text-3xl font-extrabold leading-[1.15] tracking-tight text-white md:text-5xl pb-1">
                O papel rasga. O digital escala.
              </h2>
              <p className="mt-3 text-base text-white/70 md:text-lg">Role para ver o que muda quando você troca o cartão de papel.</p>
            </div>




            {/* Stage: two cards stacked in the same slot */}
            <div className="tear-scene relative z-30 mx-auto h-[260px] w-full max-w-[560px] md:h-[300px]">
              {/* Digital card underneath */}
              <div className="tear-digital absolute inset-0 grid place-items-center">
                <div className="relative w-[80%] max-w-[420px]">
                <div className="tear-digital-card relative z-20 overflow-hidden rounded-3xl border border-violet-400/40 p-4 md:p-5"
                  style={{
                    background: "linear-gradient(135deg, #0a1420 0%, #0d1a28 50%, #0a0f1a 100%)",
                    boxShadow: "0 20px 60px -10px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                >

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/40 bg-violet-400/10">
                        <Sparkles className="h-4 w-4" style={{ color: "#a78bfa" }} />
                      </div>
                      <span className="font-display text-sm font-bold uppercase tracking-widest text-white">Fidelize</span>
                    </div>
                    <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a78bfa" }}>
                      Ativo
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className={`aspect-square rounded-xl border ${i < 7 ? "border-violet-400/60 bg-violet-400/15" : "border-white/10 bg-white/[0.02]"}`}
                        style={i < 7 ? { boxShadow: "0 0 18px rgba(167,139,250,0.35)" } : undefined}
                      >
                        {i < 7 && <div className="grid h-full w-full place-items-center"><Check className="h-4 w-4" style={{ color: "#a78bfa" }} /></div>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs">
                    <span className="text-white/60">7 / 10 carimbos</span>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-white/70">Cliente Ana Souza</span>
                  </div>
                </div>

                {/* Wins flying in — anchored to card corners */}
                {wins.map((w, i) => (
                  <span
                    key={w}
                    className="tear-win absolute rounded-full border border-violet-400/40 bg-black/40 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur"
                    style={{
                      ["--i" as never]: i,
                      boxShadow: "0 0 24px rgba(167,139,250,0.25)",
                      color: "#e6ffff",
                    } as never}
                  >
                    <Check className="mr-1 inline h-3 w-3" style={{ color: "#a78bfa" }} /> {w}
                  </span>
                ))}
                </div>
              </div>

              {/* Paper card on top — splits in two halves */}
              <div
                className="tear-paper absolute inset-0 grid place-items-center"
                style={{ zIndex: 2, pointerEvents: "none" }}
              >
                <div className="relative w-[80%] max-w-[440px]" style={{ height: 260 }}>
                  {/* Pains — margin notes in black ink, off-card */}
                  {pains.map((p, i) => (
                    <span
                      key={p}
                      className="tear-pain absolute z-20 whitespace-nowrap text-[13px] font-semibold text-white/85"
                      style={{
                        ["--i" as never]: i,
                        fontFamily: "'Caveat', 'Segoe Script', cursive",
                        textShadow: "0 1px 8px rgba(0,0,0,0.6)",
                      } as never}
                    >
                      <span className="mr-1 text-red-400">✗</span>
                      <span className="line-through decoration-red-400/80 decoration-2">{p}</span>
                    </span>
                  ))}
                  <PaperHalf side="left" />
                  <PaperHalf side="right" />
                </div>
              </div>
            </div>

            {/* CTA reveal at the end */}
            <div className="tear-cta relative z-40 mt-10 flex flex-col items-center gap-3 text-center md:mt-14">
              <p className="relative z-40 max-w-xl text-white/70">
                Chega de cartão perdido, carimbo torto e cliente esquecido. Ative o Fidelize em minutos.
              </p>
              <Button asChild size="lg" className="tear-cta-btn rounded-full px-8 font-bold" style={{ background: "#a78bfa", color: "#001010" }}>
                <a href="#precos">
                  Quero assinar agora <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InkStamp({ filled, rot, smudge }: { filled: boolean; rot: number; smudge?: boolean }) {
  // Realistic hand-inked circular stamp (coffee cup) — heavy on filled, empty ring otherwise
  return (
    <div
      className="relative grid h-12 w-12 place-items-center rounded-full"
      style={{
        transform: `rotate(${rot}deg)`,
        border: filled ? "2.5px solid #0a0a0a" : "2px dashed rgba(10,10,10,0.55)",
        boxShadow: filled
          ? "inset 0 0 0 1px rgba(0,0,0,0.35), 0 1px 0 rgba(0,0,0,0.15)"
          : "none",
        background: filled
          ? "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), transparent 55%), rgba(10,10,10,0.06)"
          : "transparent",
        filter: filled ? "url(#inkbleed)" : "none",
      }}
    >
      {filled ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z" />
          <path d="M17 10h2a2 2 0 0 1 0 4h-2" />
          <path d="M7 3c.5 1-.5 2 0 3M11 3c.5 1-.5 2 0 3M15 3c.5 1-.5 2 0 3" />
        </svg>
      ) : (
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">nº</span>
      )}
      {smudge && filled && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3 top-3 h-3 w-6 rounded-full"
          style={{ background: "rgba(10,10,10,0.35)", filter: "blur(2px)", transform: `rotate(${rot + 20}deg)` }}
        />
      )}
    </div>
  );
}

function PaperHalf({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  // Jagged tear edge — irregular fibers on the inner side of each half
  const tearLeft =
    "polygon(0 0, 100% 0, 97% 3%, 99% 7%, 95% 12%, 98% 18%, 93% 23%, 99% 29%, 94% 35%, 100% 41%, 93% 47%, 99% 53%, 94% 59%, 100% 65%, 93% 71%, 98% 77%, 94% 83%, 99% 89%, 95% 95%, 98% 100%, 0 100%)";
  const tearRight =
    "polygon(0 0, 100% 0, 100% 100%, 2% 100%, 5% 95%, 1% 89%, 6% 83%, 2% 77%, 7% 71%, 0 65%, 6% 59%, 1% 53%, 7% 47%, 0 41%, 6% 35%, 1% 29%, 7% 23%, 2% 18%, 5% 12%, 1% 7%, 3% 3%)";

  // 10-stamp grid split 5/5 across halves. 7 filled = 7 carimbos torto
  // Left: stamps 1..5 (all filled). Right: stamps 6..10 (6-7 filled, 8-10 empty)
  const leftStamps: Array<{ filled: boolean; rot: number; smudge?: boolean }> = [
    { filled: true, rot: -8, smudge: true },
    { filled: true, rot: 6 },
    { filled: true, rot: -3 },
    { filled: true, rot: 11, smudge: true },
    { filled: true, rot: -6 },
  ];
  const rightStamps: Array<{ filled: boolean; rot: number; smudge?: boolean }> = [
    { filled: true, rot: 4 },
    { filled: true, rot: -9, smudge: true },
    { filled: false, rot: 2 },
    { filled: false, rot: -4 },
    { filled: false, rot: 7 },
  ];
  const stamps = isLeft ? leftStamps : rightStamps;

  return (
    <div
      className={`tear-half tear-half-${side} absolute top-0 h-full w-1/2 ${isLeft ? "left-0" : "right-0"}`}
      style={{
        background:
          // Paper fibers noise + subtle cream tint (kraft-like) so it doesn't look sterile
          "repeating-linear-gradient(92deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 3px), repeating-linear-gradient(6deg, rgba(0,0,0,0.014) 0 1px, transparent 1px 4px), radial-gradient(ellipse at 30% 20%, rgba(0,0,0,0.05), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.06), transparent 65%), linear-gradient(180deg, #fbfaf5 0%, #f2ede0 100%)",
        boxShadow:
          "0 30px 60px -20px rgba(0,0,0,0.6), inset 0 0 40px rgba(80,60,20,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        color: "#0a0a0a",
        transformOrigin: isLeft ? "right center" : "left center",
        clipPath: isLeft ? tearLeft : tearRight,
        borderRadius: isLeft ? "14px 0 0 14px" : "0 14px 14px 0",
      }}
    >
      {/* SVG filter for ink bleed effect */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id="inkbleed">
          <feGaussianBlur stdDeviation="0.35" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -5" />
        </filter>
      </svg>

      {/* Torn edge shading */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-6 z-10"
        style={{
          [isLeft ? "right" : "left"]: 0,
          background: isLeft
            ? "linear-gradient(90deg, transparent, rgba(0,0,0,0.22))"
            : "linear-gradient(-90deg, transparent, rgba(0,0,0,0.22))",
          mixBlendMode: "multiply",
        }}
      />
      {/* Torn fiber highlights */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-[3px] z-10"
        style={{
          [isLeft ? "right" : "left"]: 0,
          background:
            "repeating-linear-gradient(180deg, rgba(255,255,255,0.9) 0 1px, rgba(0,0,0,0.2) 1px 2px, transparent 2px 5px)",
        }}
      />
      {/* Fold crease across the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.15), transparent)" }}
      />

      <div className="relative h-full w-full p-5" style={{ fontFamily: "'Caveat', 'Segoe Script', cursive" }}>
        {isLeft ? (
          <>
            <div className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-black/85">Cartão Fidelidade</div>
            <div className="mt-0.5 text-[13px] italic text-black/70">Café do Zé — desde 2011</div>
            <div className="mt-1 text-[11px] text-black/55">A cada 10 cafés, o próximo é por nossa conta ☕</div>
          </>
        ) : (
          <div className="flex items-start justify-between">
            <div className="text-[12px] italic text-black/60">Cliente: <span className="font-bold text-black/80">Ana S.</span></div>
            <div className="-mt-1 rotate-6 rounded border-2 border-dashed border-black/75 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-black">
              10 = grátis
            </div>
          </div>
        )}

        {/* Stamp grid — 5 stamps per half in a single row spanning both halves visually */}
        <div className="absolute inset-x-4 bottom-16 flex items-center justify-between">
          {stamps.map((s, i) => (
            <InkStamp key={i} filled={s.filled} rot={s.rot} smudge={s.smudge} />
          ))}
        </div>

        {/* Numbered slots under stamps */}
        <div className="absolute inset-x-4 bottom-9 flex items-center justify-between">
          {stamps.map((_, i) => (
            <span key={i} className="w-12 text-center text-[10px] font-bold text-black/45">
              {(isLeft ? i + 1 : i + 6).toString().padStart(2, "0")}
            </span>
          ))}
        </div>

        {isLeft ? (
          <>
            {/* Coffee ring stain */}
            <div
              aria-hidden
              className="absolute -left-2 bottom-2 h-16 w-16 rounded-full"
              style={{
                border: "3px solid rgba(107,58,30,0.35)",
                boxShadow: "inset 0 0 10px rgba(107,58,30,0.2)",
                transform: "rotate(-8deg) scale(0.9, 1)",
                filter: "blur(0.4px)",
              }}
            />
            {/* Small ink splash */}
            <div
              aria-hidden
              className="absolute right-8 top-4 h-2 w-2 rounded-full"
              style={{ background: "rgba(10,10,10,0.55)", filter: "blur(0.4px)" }}
            />
          </>
        ) : (
          <>
            {/* Tape at top edge */}
            <div
              aria-hidden
              className="absolute -right-3 top-4 h-5 w-20 rotate-12"
              style={{
                background: "linear-gradient(180deg, rgba(240,235,215,0.85), rgba(220,215,195,0.7))",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2), inset 0 0 8px rgba(255,255,255,0.4)",
              }}
            />
            {/* Handwritten complaint */}
            <div className="absolute bottom-2 right-4 text-[15px] italic text-black/85" style={{ transform: "rotate(-3deg)" }}>
              "perdi um... hehe"
            </div>
            {/* Coffee droplet */}
            <div
              aria-hidden
              className="absolute right-16 top-10 h-3 w-3 rounded-full"
              style={{ background: "rgba(107,58,30,0.45)", filter: "blur(0.5px)" }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Examples() {
  const items: Array<{ icon: typeof Cake; title: string; desc: string; kpi: string; kpiLabel: string; channel: string; channelIcon: typeof MessageCircle; tone: string }> = [
    { icon: Cake, title: "Aniversariante do mês", desc: "Mimo automático 3 dias antes.", kpi: "+38%", kpiLabel: "retorno", channel: "WhatsApp", channelIcon: MessageCircle, tone: "#a78bfa" },
    { icon: UserPlus, title: "Indique e ganhe", desc: "QR próprio do cliente. Todo mundo ganha.", kpi: "4.1x", kpiLabel: "CAC menor", channel: "QR + Wpp", channelIcon: QrCode, tone: "#7c3aed" },
    { icon: Clock, title: "Reengajar inativos", desc: "15 dias sem visita? Dispara empurrão.", kpi: "2.4x", kpiLabel: "LTV", channel: "WhatsApp", channelIcon: MessageCircle, tone: "#a78bfa" },
    { icon: Sparkles, title: "1º carimbo grátis", desc: "Ativação imediata do cliente novo.", kpi: "73%", kpiLabel: "ativação", channel: "E-mail", channelIcon: Mail, tone: "#7c3aed" },
    { icon: Crown, title: "Níveis VIP", desc: "Bronze, Prata, Ouro com benefícios.", kpi: "+62%", kpiLabel: "frequência", channel: "Push", channelIcon: Bell, tone: "#a78bfa" },
  ];

  const renderCard = (it: (typeof items)[number], key: string, ariaHidden?: boolean) => {
    const Icon = it.icon;
    const ChannelIcon = it.channelIcon;
    return (
      <article
        key={key}
        aria-hidden={ariaHidden}
        className="camp-card group flex flex-col"
        style={{ ["--tone" as string]: it.tone }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-3xl transition-opacity duration-500 opacity-60 group-hover:opacity-100"
          style={{ background: `radial-gradient(circle, ${it.tone}44, transparent 70%)` }}
        />
        <div className="relative mb-6 flex items-start justify-between">
          <div className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${it.tone}1a` }}>
            <Icon className="h-5 w-5" style={{ color: it.tone }} />
          </div>
          <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/55">
            <ChannelIcon className="h-3 w-3" style={{ color: it.tone }} /> {it.channel}
          </span>
        </div>
        <h3 className="relative font-display text-lg font-bold leading-tight text-white">{it.title}</h3>
        <p className="relative mt-2 text-sm text-white/55">{it.desc}</p>
        <div className="relative mt-6">
          <span className="block text-[10px] font-bold uppercase tracking-widest" style={{ color: it.tone }}>
            Performance
          </span>
          <span className="metric-number mt-1 block text-4xl leading-none">
            {it.kpi}
            <span className="ml-2 align-middle text-xs font-normal text-white/40">{it.kpiLabel}</span>
          </span>
        </div>
        <Link
          to="/auth"
          tabIndex={ariaHidden ? -1 : undefined}
          aria-label={`Usar template ${it.title}`}
          className="relative mt-6 inline-flex w-full items-center justify-center gap-1 rounded-xl border py-3 text-sm font-bold transition-colors duration-300"
          style={{ borderColor: it.tone, color: it.tone }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = it.tone;
            e.currentTarget.style.color = "#001010";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = it.tone;
          }}
        >
          Usar template <ArrowRight className="h-4 w-4" />
        </Link>
      </article>
    );
  };

  return (
    <section
      className="campaigns-section relative z-10 overflow-hidden bg-[oklch(0.14_0.02_230)] pt-10 pb-16 md:pt-14 md:pb-20"
      style={{ marginTop: "0" }}
    >
      <div className="relative mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/5 px-3 py-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: "#a78bfa" }}>
            <Sparkles className="h-3 w-3" /> Templates prontos
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-white md:text-4xl">
            Campanhas <span style={{ color: "#a78bfa" }}>que funcionam</span>
          </h2>
          <p className="mt-3 text-sm text-white/60">5 templates prontos. Ative em 1 clique.</p>
        </div>
      </div>

      {/* Ticker neon em loop infinito */}
      <div className="camp-marquee mt-6">
        <div className="camp-track">
          {items.map((it) => renderCard(it, it.title))}
          {items.map((it) => renderCard(it, `${it.title}-dup`, true))}
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4">




        <p className="mx-auto mt-6 max-w-2xl text-center text-[11px] leading-relaxed text-white/40">
          * Média dos clientes Fidelize com a campanha ativa por pelo menos 90 dias. Resultados variam conforme segmento,
          ticket médio e frequência de uso.
        </p>


        {/* CTA */}
        <div className="mx-auto mt-10 flex flex-col items-center gap-2 text-center">
          <Button asChild size="lg" className="rounded-full px-8 font-bold" style={{ background: "#a78bfa", color: "#001010" }}>
            <a href="#precos">
              Quero assinar agora <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
          <p className="text-[11px] uppercase tracking-widest text-white/40">
            <Gift className="mr-1 inline h-3 w-3" style={{ color: "#a78bfa" }} /> A partir de R$ 29,90/mês · cancele quando quiser
          </p>
        </div>
      </div>
    </section>
  );
}




type Plan = {
  name: string;
  short: string;
  price: string;
  numeric: number;
  desc: string;
  tagline: string;
  features: string[];
  cta: string;
  badge?: string;
  icon: LucideIcon;
  /** slug do plano no banco — usado para abrir o checkout certo após o cadastro */
  slug?: string;
};




function Pricing() {
  const dbPlans = useLandingData()?.plans ?? [];
  const basePlans: Plan[] = [
    { name: "Essencial", short: "Essencial", price: "R$ 29,90", numeric: 29.9, slug: "essencial", desc: "Para começar do jeito certo", tagline: "Ideal pra validar e já fidelizar desde o primeiro cliente.", features: ["Até 300 clientes", "Cartão fidelidade digital", "Notificações push", "Tag Display", "1 funcionário"], cta: "Assinar agora", icon: Sprout },
    { name: "Profissional", short: "Pro", price: "R$ 59,90", numeric: 59.9, slug: "profissional", desc: "Para negócios em crescimento", tagline: "O favorito de quem quer escalar retenção com automações.", features: ["Até 1.000 clientes", "Cardápio virtual e catálogo digital", "5 funcionários", "Avaliações e relatórios completos"], cta: "Assinar agora", badge: "Mais popular", icon: Sparkles },
    { name: "Premium", short: "Premium", price: "R$ 119,90", numeric: 119.9, slug: "ilimitado", desc: "Operação sem limites", tagline: "Recursos completos, equipe ilimitada e marca própria.", features: ["Clientes ilimitados", "Equipe ilimitada", "Carteira Apple/Google", "Integrações avançadas", "Sem marca Fidelize"], cta: "Assinar agora", icon: Building2 },
    { name: "Empresarial", short: "Empresarial", price: "R$ 349,00", numeric: 349, slug: "empresarial", desc: "Para redes e franquias", tagline: "Multi-unidades, suporte dedicado e onboarding assistido.", features: ["Tudo do Premium", "Múltiplas unidades", "Gestor de conta dedicado", "Onboarding assistido", "SLA prioritário"], cta: "Falar com vendas", icon: Building2 },
  ];


  // Preço/nome vêm do painel admin (tabela de planos); o texto de marketing permanece local.
  const plans: Plan[] = basePlans.map((p) => {
    const db = dbPlans.find((d) => d.slug === p.slug);
    if (!db || db.price_monthly == null) return p;
    return { ...p, name: db.name || p.name, price: brl(Number(db.price_monthly)), numeric: Number(db.price_monthly) };
  });

  const [activeIdx, setActiveIdx] = useState(1);
  
  const [prevIdx, setPrevIdx] = useState(1);
  const [shockKey, setShockKey] = useState(0);
  const active = plans[activeIdx];
  const ActiveIcon = active.icon;
  const direction = activeIdx >= prevIdx ? "right" : "left";
  const selectPlan = (i: number) => {
    if (i === activeIdx) return;
    setPrevIdx(activeIdx);
    setActiveIdx(i);
    setShockKey((k) => k + 1);
  };

  return (
    <section id="precos" className="defer-paint relative py-16 md:py-20 overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold">
            Planos <span style={{ color: "#a78bfa" }}>simples</span> e transparentes
          </h2>
          <p className="mt-3 text-muted-foreground">Escolha na dock abaixo. O plano em destaque troca ao vivo.</p>
        </div>

        {/* Featured card */}
        <div className="mt-10 flex justify-center">
          <div key={active.name} className={`relative w-full max-w-md ${direction === "right" ? "plan-swap-right" : "plan-swap-left"}`}>
            {/* expanding halo on swap */}
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-primary/20 blur-3xl plan-halo" />
            {/* LED breathing gradient border */}
            <div className="relative rounded-[2rem] p-[2px] bg-gradient-to-b from-[#a78bfa] via-[#a78bfa]/20 to-transparent shadow-[0_0_40px_rgba(167,139,250,0.15)]">
              <div className="rounded-[calc(2rem-2px)] bg-card p-8 md:p-10 relative overflow-hidden plan-sweep">
                <div className="relative flex items-start justify-between">
                  <div>
                    {active.badge && (
                      <span className="mb-2 inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                        {active.badge}
                      </span>
                    )}
                    <h3 className="font-display text-4xl font-bold">{active.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-xs">{active.tagline}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shrink-0">
                    <ActiveIcon className="h-6 w-6" />
                  </div>
                </div>

                {/* price */}
                <div className="mt-8 flex items-baseline gap-2">
                  <span className="font-display text-6xl font-extrabold tracking-tight" style={{ textShadow: "0 0 20px rgba(167,139,250,0.35)" }}>
                    {active.price}
                  </span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>

                {/* features */}
                <ul className="mt-8 space-y-4">
                  {active.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shrink-0">
                        <Check className="h-3 w-3 text-primary" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button asChild size="lg" className="mt-10 w-full">
                  <Link
                    to="/auth"
                    search={active.slug ? { mode: "signup", plan: active.slug } : { mode: "signup" }}
                    onClick={() => {
                      if (active.slug) {
                        setPlanIntent(active.slug);
                        rememberSelectedPlan(active.slug, active.name, active.numeric);
                        trackPlanFunnel({
                          stage: "landing_select",
                          plan_slug: active.slug,
                          plan_name: active.name,
                          amount: active.numeric,
                          source: "landing_pricing",
                        });
                      }
                    }}
                  >
                    {active.cta}
                  </Link>
                </Button>

              </div>
            </div>
          </div>
        </div>

        {/* Object Dock */}
        <div className="mt-12 flex justify-center">
          <div className="flex items-end gap-3 rounded-[28px] border border-white/10 bg-white/5 p-3 backdrop-blur-2xl shadow-2xl">
            {plans.map((p, i) => {
              const Icon = p.icon;
              const isActive = i === activeIdx;
              return (
                <div key={p.name} className="group relative">
                  {/* tooltip */}
                  <div
                    className={`absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 px-3 py-1 text-[10px] font-semibold transition-opacity ${
                      isActive ? "opacity-100 border-primary/30 bg-primary/10 text-primary" : "opacity-0 group-hover:opacity-100 bg-black/80 text-white"
                    }`}
                  >
                    {p.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectPlan(i)}
                    aria-pressed={isActive}
                    aria-label={p.name}
                    className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl border transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                      isActive
                        ? "h-16 w-16 -translate-y-2 border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_rgba(167,139,250,0.25)]"
                        : "h-14 w-14 border-white/10 bg-white/5 text-muted-foreground hover:-translate-y-3 hover:scale-110 hover:border-white/25 hover:bg-white/10 hover:text-foreground"
                    }`}
                  >
                    <Icon className={isActive ? "h-7 w-7 transition-transform duration-300" : "h-6 w-6 transition-transform duration-300"} />
                    {isActive && (
                      <>
                        <span className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_#a78bfa]" />
                        <span
                          key={shockKey}
                          className="dock-shock pointer-events-none absolute left-1/2 top-1/2 h-full w-full rounded-2xl border border-primary/60"
                        />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison table */}
        <PlansComparison />


        {/* trust line */}
        <p className="mt-8 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
          A partir de {useFromPrice()}/mês · cancele quando quiser
        </p>

      </div>
    </section>
  );
}

const COMPARE_PLANS_BASE = [
  { name: "Essencial", slug: "essencial", price: "R$ 29,90", badge: null as string | null },
  { name: "Profissional", slug: "profissional", price: "R$ 59,90", badge: "Mais vendido" },
  { name: "Premium", slug: "ilimitado", price: "R$ 119,90", badge: null as string | null },
  { name: "Empresarial", slug: "empresarial", price: "R$ 349,00", badge: null as string | null },
];

/** Aplica os preços cadastrados no painel admin sobre a tabela comparativa. */
function useComparePlans() {
  const dbPlans = useLandingData()?.plans ?? [];
  return COMPARE_PLANS_BASE.map((p) => {
    const db = dbPlans.find((d) => d.slug === p.slug);
    return db && db.price_monthly != null
      ? { ...p, name: db.name || p.name, price: brl(Number(db.price_monthly)) }
      : p;
  });
}

const COMPARE_ROWS: { label: string; values: (boolean | string)[] }[] = [
  { label: "Cartão Fidelidade Digital", values: [true, true, true, true] },
  { label: "Avaliação de Atendimento", values: [true, true, true, true] },
  { label: "Árvore de Links", values: [true, true, true, true] },
  { label: "Cardápio Virtual", values: [false, true, true, true] },
  { label: "Catálogo Digital", values: [false, true, true, true] },

  { label: "Notificações Push", values: [true, true, true, true] },
  { label: "Tag Display", values: [true, true, true, true] },
  { label: "QR Codes Inteligentes", values: [true, true, true, true] },
  { label: "Clientes cadastrados", values: ["Até 300", "Até 1.000", "Ilimitados", "Ilimitados"] },
  { label: "Funcionários", values: ["1", "5", "Ilimitados", "Ilimitados"] },
  { label: "Remover marca Fidelize", values: [false, false, true, true] },
  { label: "Múltiplas unidades", values: [false, false, false, true] },
  { label: "Gestor de conta dedicado", values: [false, false, false, true] },
];


function CompareCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") return <span className="text-sm font-semibold">{value}</span>;
  return value ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
      <Check className="h-3.5 w-3.5 text-primary" />
    </span>
  ) : (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted/40">
      <X className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );
}

/** Destaques curtos por plano — usados nos nós do canvas. */
export const COMPARE_HIGHLIGHTS: string[][] = [
  ["Até 300 clientes", "Cartão fidelidade digital", "Notificações push"],
  ["Até 1.000 clientes", "Cardápio e catálogo", "5 funcionários"],
  ["Clientes ilimitados", "Sem marca Fidelize", "Equipe ilimitada"],
  ["Múltiplas unidades", "Gestor dedicado", "SLA prioritário"],
];

function PlansComparison() {
  const [active, setActive] = useState(1);
  const [open, setOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  /** Centraliza o plano em destaque no carrossel ao montar (mobile). */
  useEffect(() => {
    const el = trackRef.current;
    const card = el?.querySelectorAll<HTMLElement>("[data-plan-node]")[1];
    if (el && card && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2;
    }
  }, []);



  /** Sincroniza o plano ativo com o swipe horizontal (mobile/tablet). */
  function handleScroll() {
    const el = trackRef.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-plan-node]"));
    if (!cards.length) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setActive(best);
  }

  function selectPlan(i: number) {
    setActive(i);
    const el = trackRef.current;
    const card = el?.querySelectorAll<HTMLElement>("[data-plan-node]")[i];
    if (el && card) {
      el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: "smooth" });
    }
  }

  const COMPARE_PLANS = useComparePlans();

  return (
    <div className="mt-14">
      <h3 className="text-center font-display text-2xl font-bold md:text-3xl">O que cada plano oferece</h3>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Deslize entre os planos — o comparativo acompanha sua escolha.
      </p>

      {/* Canvas de automação */}
      <div className="relative mt-8 overflow-hidden rounded-[28px] border border-primary/15 bg-card/60 p-5 backdrop-blur md:p-10">
        {/* grid pontilhada */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            color: "var(--primary)",
          }}
        />

        {/* cabos conectores (desktop) */}
        <div aria-hidden className="pointer-events-none absolute inset-x-10 top-1/2 hidden -translate-y-1/2 md:flex">
          {COMPARE_PLANS.map((_, i) => (
            <div key={i} className="flex-1 px-2">
              <div
                className={`h-px w-full rounded-full transition-all duration-500 ${
                  i < active ? "bg-primary/50 shadow-[0_0_10px_var(--primary)]" : "bg-primary/15"
                }`}
              />
            </div>
          ))}
        </div>

        {/* nós dos planos */}
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="no-scrollbar relative -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pt-3 pb-2 md:justify-between md:overflow-visible"
        >
          {COMPARE_PLANS.map((p, i) => {
            const isActive = i === active;
            return (
              <button
                key={p.name}
                data-plan-node
                type="button"
                onClick={() => selectPlan(i)}
                aria-pressed={isActive}
                className={`relative w-[82%] min-w-[82%] shrink-0 snap-center rounded-2xl border p-4 pt-5 text-left transition-all duration-300 sm:w-[46%] sm:min-w-[46%] sm:p-5 md:w-auto md:min-w-0 md:flex-1 ${
                  isActive
                    ? "border-primary bg-background shadow-[0_10px_40px_-18px_var(--primary)] md:-translate-y-1"
                    : "border-primary/15 bg-background hover:border-primary/40"
                }`}
              >
                {p.badge && (
                  <span className="absolute right-3 top-3 z-10 max-w-[60%] truncate rounded-full border border-primary/30 bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground">
                    {p.badge}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                      isActive ? "border-primary/40 bg-primary/15" : "border-primary/15 bg-muted/40"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${isActive ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted-foreground/50"}`} />
                  </span>
                  <span className="font-display text-base font-bold">{p.name}</span>
                </div>
                <div className="mt-4">
                  <span className={`font-display text-2xl font-extrabold ${isActive ? "text-primary" : ""}`}>{p.price}</span>
                  <span className="text-xs text-muted-foreground">/mês</span>
                </div>
                <ul className="mt-4 space-y-2">
                  {COMPARE_HIGHLIGHTS[i].map((h) => (
                    <li key={h} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-primary" : "bg-primary/40"}`} />
                      {h}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* indicadores de swipe */}
        <div className="mt-4 flex justify-center gap-1.5 md:hidden">
          {COMPARE_PLANS.map((p, i) => (
            <span
              key={p.name}
              className={`h-1 rounded-full transition-all ${i === active ? "w-6 bg-primary" : "w-2 bg-primary/25"}`}
            />
          ))}
        </div>
      </div>

      {/* Botão expansivo — só abre no clique */}
      <div className="mt-8 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-6 py-3 text-sm font-semibold shadow-sm transition-colors hover:border-primary/50 hover:text-primary"
        >
          {open ? "Ocultar comparativo" : "Ver comparativo completo"}
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
        <span className={`mt-2 w-px bg-gradient-to-b from-primary/40 to-transparent transition-all duration-300 ${open ? "h-8" : "h-0"}`} />
      </div>

      {/* Comparativo */}
      <div
        className={`grid transition-all duration-500 ease-out ${open ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          {/* Desktop / tablet */}
          <div className="hidden overflow-hidden rounded-2xl border border-primary/15 bg-card/60 backdrop-blur md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-primary/15">
                  <th className="p-4 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Recursos</th>
                  {COMPARE_PLANS.map((p, i) => (
                    <th
                      key={p.name}
                      className={`cursor-pointer p-4 text-center align-bottom transition-colors ${
                        i === active ? "bg-primary/[0.06] text-primary" : ""
                      }`}
                      onClick={() => selectPlan(i)}
                    >
                      {p.badge && (
                        <span className="mb-1 inline-block rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                          ⭐ {p.badge}
                        </span>
                      )}
                      <div className="font-display text-lg font-bold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.price}/mês</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 ? "bg-muted/20" : undefined}>
                    <td className="p-4 text-sm">{row.label}</td>
                    {row.values.map((v, j) => (
                      <td key={j} className={`p-4 text-center ${j === active ? "bg-primary/[0.06]" : ""}`}>
                        <CompareCell value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile — só o plano ativo */}
          <div className="md:hidden">
            <div className="rounded-2xl border border-primary/20 bg-card/60 p-5">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="font-display text-lg font-bold">{COMPARE_PLANS[active].name}</div>
                  {COMPARE_PLANS[active].badge && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      ⭐ {COMPARE_PLANS[active].badge}
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold">{COMPARE_PLANS[active].price}/mês</div>
              </div>
              <ul className="mt-4 space-y-2">
                {COMPARE_ROWS.map((row) => (
                  <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <CompareCell value={row.values[active]} />
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">Deslize os cards acima para comparar outro plano.</p>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">Preços sugeridos. Consulte condições no checkout.</p>
        </div>
      </div>
    </div>
  );
}


function FAQ() {
  return <FaqChatSection />;
}


function CTA() {
  return (
    <section className="defer-paint w-full flex items-center justify-center bg-background px-6 py-16 md:py-20">
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0 items-stretch border-t border-primary/10 pt-10">
        {/* Left: message */}
        <div className="lg:col-span-7 pr-0 lg:pr-16 flex flex-col justify-between">
          <div className="space-y-6">
            <span className="inline-block px-3 py-1 border border-primary/30 text-primary text-[11px] font-bold tracking-widest uppercase font-display">
              Comece agora
            </span>
            <h2 className="font-display text-5xl md:text-7xl font-extrabold text-foreground leading-[0.95] tracking-tighter">
              Pronto para <br />
              seus clientes <br />
              <span className="text-[#a78bfa]">voltarem sempre?</span>
            </h2>
          </div>
          <div className="hidden lg:block mt-12">
            <div className="w-24 h-px bg-[#a78bfa]" />
          </div>
        </div>

        {/* Vertical divider */}
        <div className="hidden lg:block lg:col-span-1 relative">
          <div className="absolute inset-y-0 left-1/2 w-px bg-primary/20" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#a78bfa] rotate-45" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#a78bfa] rotate-45" />
        </div>

        {/* Right: action */}
        <div className="lg:col-span-4 flex flex-col justify-center gap-8">
          <p className="text-muted-foreground text-lg leading-relaxed max-w-sm">
            Crie seu cartão fidelidade digital em minutos. Sem cartão de crédito, sem fidelidade — cancele quando quiser.
          </p>

          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="h-14 rounded-none bg-[#a78bfa] text-background hover:bg-white font-bold uppercase tracking-widest text-sm justify-between shadow-[0_0_30px_rgba(167,139,250,0.25)]">
              <a href="#precos">
                Escolher meu plano
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-none border-primary/30 text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary font-semibold uppercase tracking-widest text-sm transition-colors">
              <a href="#precos">Ver planos</a>
            </Button>
          </div>

          <div className="flex gap-3 items-center opacity-60">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a78bfa] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#a78bfa]" />
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              A partir de R$ 29,90/mês · cancele quando quiser
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
        <Logo />
        <nav className="flex flex-wrap gap-6">
          <Link to="/precos">Preços</Link>
          <Link to="/termos">Termos</Link>
          <Link to="/privacidade">Privacidade</Link>
        </nav>
        <div>© {new Date().getFullYear()} Fidelize</div>
      </div>
    </footer>
  );
}

// ==================== FAQ + Chat com IA ====================

type ChatMsg = { role: "user" | "assistant"; content: string; typing?: boolean };

function useTypewriter(fullText: string, active: boolean, speed = 18) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!active) { setText(fullText); return; }
    setText("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setText(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [fullText, active, speed]);
  return text;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

function ChatBubble({ msg, animate }: { msg: ChatMsg; animate: boolean }) {
  const shown = useTypewriter(msg.content, msg.role === "assistant" && animate, 14);
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/30 px-4 py-2 text-sm text-foreground">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/20 border border-primary/40">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card/60 border border-white/10 px-4 py-2 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {msg.typing ? <TypingDots /> : shown}
        {!msg.typing && animate && shown.length < msg.content.length && <span className="ml-0.5 inline-block h-3 w-0.5 bg-primary animate-pulse" />}
      </div>
    </div>
  );
}

function FaqChatSection() {
  return (
    <section id="faq" className="defer-paint relative border-y border-white/5 bg-gradient-to-b from-background via-card/20 to-background py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-wider text-primary">
            <HelpCircle className="h-3.5 w-3.5" /> Suporte instantâneo
          </div>
          <h2 className="mt-4 font-display text-4xl md:text-5xl font-bold">
            Dúvidas <span className="text-[#a78bfa]">frequentes</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            Clique numa dúvida ou converse com a <strong className="text-primary">Fidê</strong>, nossa assistente inteligente.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <FaqCannedPanel />
          <FaqAIPanel />
        </div>
      </div>
    </section>
  );
}

function FaqCannedPanel() {
  const [selected, setSelected] = useState<number | null>(0);
  const activeAnswer = selected !== null ? FAQ_ITEMS[selected][1] : "";
  return (
    <div className="rounded-3xl border border-white/10 bg-card/40 backdrop-blur-xl p-5 md:p-6 shadow-2xl shadow-violet-500/5">
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 border border-primary/30">
          <MessageCircle className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold">Perguntas mais comuns</div>
          <div className="text-xs text-muted-foreground">Toque numa pergunta para ver a resposta</div>
        </div>
      </div>

      <div className="grid gap-2 mb-4">
        {FAQ_ITEMS.map(([q], i) => (
          <button
            key={q}
            onClick={() => setSelected(i)}
            className={`text-left text-sm rounded-xl border px-4 py-3 transition-all ${
              selected === i
                ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_20px_-5px_rgba(167,139,250,0.4)]"
                : "border-white/10 bg-card/30 hover:border-primary/40 hover:bg-primary/5 text-foreground/90"
            }`}
          >
            <span className="text-primary mr-2">›</span>{q}
          </button>
        ))}
      </div>

      <div className="min-h-[120px] rounded-2xl border border-white/10 bg-background/40 p-4">
        {selected === null ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Escolha uma dúvida acima 👆
          </div>
        ) : (
          <ChatBubble key={selected} msg={{ role: "assistant", content: activeAnswer }} animate />
        )}
      </div>
    </div>
  );
}

function FaqAIPanel() {
  const ask = useServerFn(askFaqAI);
  const checkStatus = useServerFn(getFaqAIStatus);
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Oi! Sou a Fidê 💛 Pergunta o que quiser sobre a Fidelize, tô aqui pra ajudar!" },
    { role: "user", content: "Meu cliente precisa baixar algum app?" },
    { role: "assistant", content: "Não! Ele só escaneia o QR Code do seu balcão e o cartão abre no navegador. Dá pra salvar na tela de início como se fosse um app 😉" },
    { role: "user", content: "E se ele perder o celular, perde os carimbos?" },
    { role: "assistant", content: "Nada disso — os carimbos ficam salvos na conta dele. Entrou de novo com o mesmo telefone/e-mail, tá tudo lá." },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [firstAnswer, setFirstAnswer] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    checkStatus({})
      .then((s) => { if (alive) setAiOnline(Boolean(s?.online)); })
      .catch(() => { if (alive) setAiOnline(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);


  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setFirstAnswer(false);
    const history = messages
      .filter((m) => !m.typing)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", typing: true }]);
    setLoading(true);
    try {
      const { answer } = await ask({ data: { question: q, history } });
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: answer };
        return copy;
      });
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Ops, tive um probleminha 🥲 tenta de novo?" };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  const suggestions = ["Como funciona o QR Code?", "Quanto custa o plano?", "Como recompenso meus clientes?"];

  return (
    <div className="relative rounded-3xl border border-primary/30 bg-gradient-to-br from-card/60 to-background/40 backdrop-blur-xl p-5 md:p-6 shadow-2xl shadow-violet-500/10">
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top,rgba(167,139,250,0.08),transparent_60%)]" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
          <div className="relative">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/20 border border-primary/50">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                aiOnline === null
                  ? "bg-muted-foreground/50"
                  : aiOnline
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-muted-foreground"
              }`}
            />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold flex items-center gap-2">
              Fidê <span className="text-[10px] font-normal rounded bg-primary/20 text-primary px-1.5 py-0.5">IA</span>
            </div>
            {aiOnline === null ? (
              <div className="text-xs text-muted-foreground">● verificando conexão…</div>
            ) : aiOnline ? (
              <div className="text-xs text-emerald-400">● online agora</div>
            ) : (
              <div className="text-xs text-muted-foreground">● offline · IA não conectada</div>
            )}
          </div>

          <div className="text-xs text-muted-foreground hidden sm:block">Não achou sua dúvida?</div>
        </div>

        <div ref={scrollRef} className="h-[280px] overflow-y-auto space-y-3 pr-1 mb-3 scroll-smooth">
          {messages.map((m, i) => (
            <ChatBubble key={i} msg={m} animate={i === messages.length - 1 && m.role === "assistant"} />
          ))}
        </div>

        {firstAnswer && (
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setInput(s)}
                className="text-xs rounded-full border border-white/10 bg-card/40 hover:border-primary/50 hover:bg-primary/10 px-3 py-1.5 text-muted-foreground hover:text-foreground transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {aiOnline === false && (
          <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-300">
            A Fidê está offline: nenhuma chave de IA válida configurada no servidor. Fale com a gente em <strong>/ajuda</strong> 💛
          </div>
        )}

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-background/60 pl-4 pr-1.5 py-1.5 focus-within:border-primary/50 transition">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder={aiOnline === false ? "Fidê offline no momento" : "Pergunte qualquer coisa…"}
            disabled={loading || aiOnline === false}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim() || aiOnline === false}
            className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_15px_rgba(167,139,250,0.4)] hover:shadow-[0_0_20px_rgba(167,139,250,0.6)] disabled:opacity-40 disabled:shadow-none transition"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 text-[10px] text-center text-muted-foreground/70">Powered by IA · respostas podem conter imprecisões</div>

      </div>
    </div>
  );
}
