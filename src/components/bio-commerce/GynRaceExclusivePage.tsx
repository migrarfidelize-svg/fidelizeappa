import { useEffect, useState, type ReactNode } from "react";
import {
  Activity, ArrowDown, ArrowUpRight,
  CircuitBoard, Clock3, Cog, Instagram, MapPin, Menu, MessageCircle,
  Route as RouteIcon, ShieldCheck, Wrench, Zap,
} from "lucide-react";
import { GoogleMapsReviewsSection } from "./GoogleMapsReviewsSection";
import { trackChannelEvent } from "@/lib/tracking";
import type { BioCommerceLandingData } from "./BioCommerceLanding";

const INSTAGRAM = "https://www.instagram.com/gynrace_/";
const INSTAGRAM_MESSAGES = "https://ig.me/m/gynrace_";

const SERVICES = [
  { id: "difusores", number: "01", icon: CircuitBoard, title: "Difusores eletrônicos", detail: "Tecnologia, controle e presença em cada aceleração.", note: "TECNOLOGIA • CONTROLE" },
  { id: "escapamentos", number: "02", icon: Activity, title: "Escapamentos esportivos", detail: "Soluções para realçar a personalidade e a experiência da sua moto.", note: "ACABAMENTO • PERFORMANCE" },
  { id: "revisoes", number: "03", icon: Wrench, title: "Revisões premium", detail: "Cuidado técnico criterioso para rodar com mais confiança.", note: "PRECISÃO • CUIDADO" },
  { id: "diagnostico", number: "04", icon: Cog, title: "Diagnósticos especializados", detail: "Análise cuidadosa para encontrar a solução certa.", note: "ANÁLISE • PRECISÃO" },
  { id: "projetos", number: "05", icon: Zap, title: "Projetos especiais", detail: "Adaptações e soluções personalizadas para sua proposta.", note: "EXCLUSIVIDADE • IDENTIDADE" },
  { id: "manutencao", number: "06", icon: ShieldCheck, title: "Manutenção de motos", detail: "Atenção aos detalhes do seu projeto, do início ao fim.", note: "CUIDADO • SEGURANÇA" },
] as const;

const WHATSAPP_PLACEHOLDERS = new Set(["", "00000000000"]);

/** Somente números de celular brasileiros validáveis, para não publicar CTA quebrado. */
function verifiedWhatsApp(value: unknown): string | null {
  const text = String(value ?? "").replace(/\D/g, "");
  if (WHATSAPP_PLACEHOLDERS.has(text) || text.length < 10) return null;
  const normalized = text.startsWith("55") ? text.slice(2) : text;
  if (normalized.length !== 11 || !/^\d{2}9\d{8}$/.test(normalized)) return null;
  return "55" + normalized;
}

function safeExternal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}

type GoogleReviewsConfig = { place_id: string; maps_url: string; rating?: number; total?: number; verified_at?: string };

export function GynRaceExclusivePage({ data }: { data: BioCommerceLandingData }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const est = data.establishment;
  const page = data.page;
  const theme = ((page?.theme ?? {}) as Record<string, any>);
  const maps = safeExternal(est.google_maps_url)
    ?? "https://www.google.com/maps/search/?api=1&query=GYNRACE%20Goi%C3%A2nia";
  const instagram = safeExternal(est.instagram) ?? INSTAGRAM;
  const whatsapp = verifiedWhatsApp(est.whatsapp);
  const waUrl = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá, equipe GYNRACE! Gostaria de um orçamento para minha moto.")}` : null;
  const remoteCover = typeof page?.cover_url === "string" && /^(https:\/\/|data:image\/(?:webp|jpeg|png);base64,)/.test(page.cover_url)
    ? page.cover_url : null;
  // O arquivo visual faz parte da própria compilação. Mesmo que o editor
  // ainda traga o URL da antiga produção, sempre usa a imagem da release atual.
  // O lojista poderá substituir a capa por uma foto HTTPS personalizada.
  const cover = !remoteCover || remoteCover.includes("/assets/gynrace/mt09-garage.svg")
    ? "/assets/gynrace/mt09-garage.svg" : remoteCover;
  const avatar = safeExternal(est.logo_url) ?? safeExternal(page?.logo_url);
  const googleReviews = (theme.google_reviews ?? null) as GoogleReviewsConfig | null;

  // Prevent white overscroll on iOS / Instagram's internal browser without changing global app theme.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const htmlBg = html.style.backgroundColor;
    const bodyBg = body.style.backgroundColor;
    const previousOverscroll = body.style.overscrollBehaviorX;
    html.style.backgroundColor = "#03060d";
    body.style.backgroundColor = "#03060d";
    body.style.overscrollBehaviorX = "none";
    return () => {
      html.style.backgroundColor = htmlBg;
      body.style.backgroundColor = bodyBg;
      body.style.overscrollBehaviorX = previousOverscroll;
    };
  }, []);

  const track = (label: string) => {
    trackChannelEvent({slug: est.slug || "gynrace", channel:"linktree", event_type:"link_click", ref_label:"gynrace:"+label});
  };
  const link = (href: string, label: string, children: ReactNode, className = "") =>
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => track(label)} className={className}>{children}</a>;

  return (
    <div data-gynrace-edition="racing-2026-10-29" className="gynrace-site relative min-h-dvh w-full min-w-0 overflow-x-clip bg-[#03060d] text-white [font-family:Inter,system-ui,sans-serif]">
      <style>{`
        .gynrace-site{--gr-blue:#1676ff;--gr-ice:#7dd5ff;background:#03060d;color:#f8fbff}
        .gynrace-site::selection{background:#0c63ed;color:#fff}
        .gr-shell{width:100%;max-width:1240px;margin:0 auto;padding-left:clamp(18px,4vw,60px);padding-right:clamp(18px,4vw,60px)}
        .gr-shimmer{position:relative;overflow:hidden;isolation:isolate}
        .gr-shimmer:after{content:"";position:absolute;inset:-80% auto -80% -120%;width:26%;transform:rotate(25deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);transition:left .75s ease;pointer-events:none}
        .gr-shimmer:hover:after{left:140%}
        .gr-glass{background:linear-gradient(125deg,rgba(24,40,68,.79),rgba(7,13,25,.87));border:1px solid rgba(107,151,234,.20);box-shadow:inset 0 1px rgba(255,255,255,.035),0 18px 48px rgba(0,0,0,.18)}
        .gr-eyebrow{font-size:10px;letter-spacing:.28em;text-transform:uppercase;font-weight:800;color:#8cc6ff}
        .gr-service{transition:border-color .24s ease,transform .24s ease,background .24s ease}
        .gr-service:hover{border-color:rgba(65,153,255,.75);transform:translateY(-3px);background:linear-gradient(145deg,rgba(28,59,103,.88),rgba(6,15,30,.9))}
        .gr-rise{animation:grEnter .7s cubic-bezier(.2,.7,.15,1) both}
        .gr-rise-delay{animation-delay:.12s}
        .gr-float{animation:grFloat 8s ease-in-out infinite}
        @keyframes grEnter{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes grFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-9px,0)}}
        .gr-bg-photo{filter:grayscale(1) contrast(1.3) brightness(.7);opacity:.14;mix-blend-mode:screen;mask-image:linear-gradient(to bottom,#000 5%,#000 60%,transparent 100%)}
        .gr-hero-grid{background-image:linear-gradient(rgba(39,100,186,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(39,100,186,.08) 1px,transparent 1px);background-size:46px 46px;mask-image:linear-gradient(#000,transparent)}
        .gr-number{font-variant-numeric:tabular-nums}
        @media(prefers-reduced-motion:reduce){.gynrace-site *, .gynrace-site *:before,.gynrace-site *:after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
        @media(max-width:640px){.gr-service:hover{transform:none}.gr-bg-photo{opacity:.11}}
      `}</style>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[950px] overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 gr-hero-grid" />
        <div className="absolute -right-[21%] top-24 h-[500px] w-[90%] rounded-full bg-[#0761eb]/20 blur-[115px] gr-float"/>
        <div className="absolute -left-[40%] top-[510px] h-[320px] w-[85%] rounded-full bg-[#0252c7]/10 blur-[120px]" />
        {cover && <img src={cover} className="gr-bg-photo absolute -right-12 top-0 h-[800px] w-[min(85vw,850px)] rotate-[-6deg] object-cover object-center" alt="" />}
      </div>

      <header className="gr-shell relative z-20 flex h-[74px] items-center justify-between border-b border-blue-200/10">
        <a href="#inicio" className="flex items-center gap-2.5 font-black tracking-[.10em]" aria-label="GYNRACE, voltar ao início">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#1d8cff]/50 bg-[#1162d7]/15 text-[#7bd4ff]"><Zap className="h-5 w-5"/></span>
          <span className="text-[18px] italic">GYN<span className="text-[#419dff]">RACE</span><span className="align-top text-[9px]">®</span></span>
        </a>
        <nav className="hidden items-center gap-7 text-xs font-semibold text-[#bacde5] md:flex">
          <a href="#servicos" className="hover:text-white">Serviços</a>
          <a href="#projetos" className="hover:text-white">Projetos</a>
          <a href="#avaliacoes" className="hover:text-white">Avaliações</a>
          <a href="#localizacao" className="hover:text-white">Localização</a>
        </nav>
        <button type="button" onClick={() => setMenuOpen(v=>!v)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[.06] md:hidden" aria-label="Abrir menu" aria-expanded={menuOpen}><Menu className="h-5 w-5"/></button>
        {link(instagram,"nav:instagram",<>Conhecer a GYNRACE <ArrowUpRight className="h-4 w-4"/></>,"hidden min-h-10 items-center gap-2 rounded-xl border border-[#2c83e9]/55 bg-[#1261d0]/10 px-4 text-xs font-bold text-[#d6e9ff] transition hover:bg-[#1261d0]/30 md:inline-flex")}
      </header>

      {menuOpen && <nav className="gr-shell relative z-30 grid gap-1 border-b border-white/10 bg-[#071022] py-3 text-sm md:hidden">
        {[["Serviços","#servicos"],["Projetos","#projetos"],["Avaliações","#avaliacoes"],["Localização","#localizacao"]].map(([label,href])=> <a key={href} href={href} onClick={()=>setMenuOpen(false)} className="rounded-xl px-4 py-3 font-semibold text-[#cfe3ff] hover:bg-blue-500/10">{label}</a>)}
      </nav>}

      <main id="inicio" className="relative z-10">
        <section className="gr-shell relative grid min-h-[650px] items-center gap-10 pb-14 pt-10 md:min-h-[700px] md:grid-cols-[1.1fr_.9fr] md:pt-20">
          <div className="gr-rise relative z-10">
            <div className="mb-7 flex items-center gap-4">
              <div className="relative h-[72px] w-[72px] overflow-hidden rounded-full border-2 border-[#208dff] bg-[#142642] p-1 shadow-[0_0_22px_rgba(12,122,255,.48)]">
                {avatar ? <img src={avatar} alt="Foto de perfil da GYNRACE" className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" /> : <Zap className="m-auto mt-4 h-7 w-7 text-blue-300"/>}
              </div>
              <div><p className="text-lg font-black">@gynrace_</p><span className="text-[11px] font-bold uppercase tracking-[.19em] text-[#6db6ff]">GOIÂNIA • GOIÁS</span></div>
            </div>
            <p className="gr-eyebrow mb-5"><span className="mr-3 inline-block h-[2px] w-7 align-middle bg-[#238dff]"/> CUSTOM • TECH • PERFORMANCE</p>
            <h1 className="max-w-[720px] text-[clamp(43px,8.9vw,88px)] font-black uppercase italic leading-[.93] tracking-[-.07em]">
              SUA MOTO.<br/><span className="text-[#3b99ff]">OUTRO NÍVEL.</span>
            </h1>
            <p className="mt-7 max-w-[530px] text-[15px] leading-7 text-[#c0cde0] sm:text-[17px]">
              Difusores eletrônicos e manuais, escapamentos esportivos, manutenção premium e projetos especiais. Técnica e personalidade em cada detalhe.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {link(INSTAGRAM_MESSAGES,"hero:orcamento",<>Solicitar orçamento <ArrowUpRight className="h-4 w-4"/></>,"gr-shimmer inline-flex min-h-13 items-center justify-center gap-3 rounded-xl border border-[#499fff] bg-gradient-to-r from-[#1377ff] to-[#073cb8] px-6 py-3.5 text-sm font-bold shadow-[0_12px_36px_rgba(13,108,255,.32)] transition hover:shadow-[0_17px_45px_rgba(13,108,255,.52)]")}
              <a href="#servicos" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-white/20 bg-[#0a1428]/80 px-6 py-3.5 text-sm font-bold text-white transition hover:border-blue-400/60">Explorar serviços <ArrowDown className="h-4 w-4"/></a>
            </div>
            <div className="mt-9 flex items-center gap-3 border-t border-white/10 pt-5 text-[11px] font-semibold uppercase tracking-[.13em] text-[#99b4d4]"><ShieldCheck className="h-5 w-5 text-[#5aacff]" /> Especialistas em motos esportivas e performance</div>
          </div>

          <div className="gr-rise gr-rise-delay relative flex h-[350px] items-center justify-center md:h-[540px]">
            <div className="absolute inset-[12%] rounded-full border border-[#1c79ff]/20 shadow-[0_0_100px_rgba(20,112,255,.15)]"/>
            <div className="absolute inset-[19%] rounded-full border border-dashed border-[#2f89f9]/30"/>
            <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/25 blur-[80px]"/>
            {cover ? <div className="relative aspect-[4/4.8] h-[97%] max-h-[520px] w-[91%] overflow-hidden rounded-[28px] border border-blue-400/25 bg-[#09121f] shadow-[0_24px_65px_rgba(0,0,0,.5),0_0_38px_rgba(5,95,233,.22)]">
              <img src={cover} className="h-full w-full object-cover" alt="Moto esportiva da GYNRACE em ambiente de oficina" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020610] via-transparent to-transparent"/>
              <div className="absolute bottom-6 left-5 right-5"><p className="gr-eyebrow">PROJETO EM EVIDÊNCIA</p><h2 className="mt-2 text-2xl font-black italic">PRESENÇA É TUDO.</h2></div>
            </div> : <div className="grid h-[90%] w-[88%] place-items-center rounded-[28px] border border-blue-500/25 bg-gradient-to-br from-[#112c52] via-[#071222] to-[#04070d]"><Zap className="h-28 w-28 text-blue-400/40" /></div>}
            <div className="absolute -bottom-3 right-0 rounded-2xl border border-[#4e9fff]/30 bg-[#081b38]/95 px-5 py-4 shadow-[0_0_30px_rgba(0,100,255,.18)]"><span className="gr-eyebrow">DE GOIÂNIA PARA AS RUAS</span><p className="mt-1 text-lg font-black italic">PERFORMANCE <span className="text-[#429eff]">GYNRACE.</span></p></div>
          </div>
        </section>

        <section className="gr-shell grid gap-3 pb-16 sm:grid-cols-3">
          {[
            {icon:Zap, label:"Engenharia & tecnologia", text:"Soluções para uma experiência diferenciada."},
            {icon:Wrench,label:"Cuidado técnico",text:"Revisões, manutenção e diagnósticos."},
            {icon:RouteIcon,label:"Projetos exclusivos",text:"Cada moto com sua própria identidade."},
          ].map((item)=> <div key={item.label} className="gr-glass flex min-h-[110px] items-start gap-4 rounded-2xl p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1267db]/15 text-[#5eb4ff]"><item.icon className="h-6 w-6"/></span><div><h3 className="text-sm font-black">{item.label}</h3><p className="mt-1.5 text-xs leading-5 text-[#9faecc]">{item.text}</p></div></div>)}
        </section>

        <section id="servicos" className="relative border-t border-blue-200/10 bg-gradient-to-b from-[#071323]/90 to-[#03060d] py-20">
          <div className="gr-shell">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
              <div><p className="gr-eyebrow">01 / O QUE FAZEMOS</p><h2 className="mt-3 text-[clamp(30px,6vw,54px)] font-black uppercase italic leading-tight tracking-[-.05em]">PRECISÃO EM CADA <span className="text-[#459fff]">SERVIÇO.</span></h2></div>
              <p className="max-w-[260px] text-sm leading-6 text-[#b1c1d7]">Sua moto merece soluções cuidadosas, do diagnóstico ao acabamento final.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map(s=> <a key={s.id} href={INSTAGRAM_MESSAGES} target="_blank" rel="noopener noreferrer" onClick={() => track("service:"+s.id)} className="gr-service gr-glass group relative flex min-h-[235px] flex-col rounded-[22px] p-6">
                <div className="mb-8 flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-[13px] border border-blue-400/25 bg-blue-500/10 text-[#61b4ff]"><s.icon className="h-6 w-6"/></span><span className="gr-number text-xs font-bold tracking-widest text-[#537da8]">{s.number}</span></div>
                <h3 className="text-lg font-black uppercase leading-tight tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-5 text-[#a5b6d0]">{s.detail}</p>
                <div className="mt-auto flex items-center justify-between pt-6"><span className="text-[9px] font-black tracking-[.14em] text-[#559ad9]">{s.note}</span><ArrowUpRight className="h-4 w-4 text-[#6eb4ff] transition group-hover:translate-x-1 group-hover:-translate-y-1"/></div>
              </a>)}
            </div>
          </div>
        </section>

        <section id="projetos" className="gr-shell py-20">
          <div className="mb-9"><p className="gr-eyebrow">02 / EM DESTAQUE</p><h2 className="mt-3 text-[clamp(31px,6vw,53px)] font-black uppercase italic leading-tight tracking-[-.045em]">MUITO ALÉM <span className="text-[#439aff]">DA OFICINA.</span></h2><p className="mt-3 max-w-[580px] text-sm leading-6 text-[#afc2da]">Mais personalidade para sua moto. Conheça nossos trabalhos e acompanhe a evolução de cada projeto no Instagram.</p></div>
          <div className="relative isolate h-[380px] overflow-hidden rounded-[26px] border border-blue-400/20 bg-gradient-to-br from-[#122c4d] via-[#081324] to-[#020509] shadow-[0_16px_60px_rgba(4,35,78,.2)] sm:h-[560px]">
            {cover ? <img src={cover} alt="Moto e ambiente da GYNRACE" className="absolute inset-0 h-full w-full object-cover object-center"/> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,#0d70b955,transparent_50%)]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#02060f] via-[#02060f]/20 to-transparent"/>
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-4 p-5 sm:p-9">
              <div><p className="gr-eyebrow">VISÃO, ESTILO E TECNOLOGIA</p><h3 className="mt-2 max-w-md text-2xl font-black uppercase italic sm:text-4xl">Projetos com personalidade</h3><p className="mt-2 text-xs text-[#bccae0] sm:text-sm">Cada detalhe faz parte da experiência.</p></div>
              <a href={instagram} target="_blank" rel="noopener noreferrer" onClick={()=>track("projects:gallery")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-blue-300/30 bg-blue-500/40 backdrop-blur-lg" aria-label="Ver todos os projetos no Instagram"><ArrowUpRight className="h-5 w-5"/></a>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between"><span className="text-xs font-semibold tracking-[.18em] text-[#8cadd6]">PROJETOS GYNRACE</span>{link(instagram,"projects:instagram",<>Explorar no Instagram <ArrowUpRight className="h-4 w-4"/></>,"inline-flex items-center gap-2 text-xs font-bold text-[#77baff] hover:text-white")}</div>
        </section>

        <div id="avaliacoes" className="gr-shell">
          {googleReviews?.place_id && googleReviews?.maps_url ? (
            <GoogleMapsReviewsSection slug="gynrace" config={googleReviews} />
          ) : (
            <div className="rounded-3xl border border-blue-400/25 bg-[#0a1425] p-7 text-center"><h2 className="text-xl font-black">O que nossos clientes dizem</h2><p className="mt-3 text-sm text-[#b0c4df]">Conheça as opiniões públicas no Google.</p>{link(maps,"reviews:maps",<>Abrir avaliações <ArrowUpRight className="h-4 w-4"/></>,"mt-4 inline-flex items-center gap-2 text-[#65b5ff]")}</div>
          )}
        </div>

        <section id="localizacao" className="gr-shell pb-20 pt-12">
          <div className="gr-glass relative overflow-hidden rounded-[28px] p-6 sm:p-10">
            <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-[#0b65ff]/14 blur-[90px]" />
            <div className="relative grid gap-6 md:grid-cols-[1fr_.6fr] md:items-center">
              <div><p className="gr-eyebrow">03 / NOSSA LOCALIZAÇÃO</p><h2 className="mt-3 text-3xl font-black uppercase italic tracking-[-.03em] sm:text-5xl">A SUA PRÓXIMA <span className="text-[#499fff]">PARADA.</span></h2><p className="mt-4 text-sm leading-7 text-[#aec0db]">Jardim América • Goiânia, Goiás. Visite a GYNRACE e conheça nossas soluções para motos esportivas.</p></div>
              <div className="flex flex-col gap-3">
                {link(maps,"location:maps",<> <MapPin className="h-5 w-5"/> Traçar rota até a GYNRACE <ArrowUpRight className="ml-auto h-4 w-4"/></>,"gr-shimmer flex min-h-14 items-center gap-3 rounded-xl border border-blue-400/50 bg-[#0860d5] px-5 text-sm font-black transition hover:bg-[#1378ef]")}
                {link(instagram,"location:instagram",<> <Instagram className="h-5 w-5"/> Acompanhar projetos <ArrowUpRight className="ml-auto h-4 w-4"/></>,"flex min-h-14 items-center gap-3 rounded-xl border border-white/15 bg-white/[.055] px-5 text-sm font-black transition hover:border-blue-400/40")}
              </div>
            </div>
          </div>
        </section>

        <section className="relative isolate overflow-hidden border-t border-blue-400/15 bg-[linear-gradient(90deg,#061c3c,#071329_52%,#03060d)]">
          {cover && <img src={cover} alt="" aria-hidden="true" className="gr-bg-photo pointer-events-none absolute right-0 top-0 h-full w-[55%] object-cover opacity-[.13]"/>}
          <div className="gr-shell relative grid min-h-[300px] items-center gap-6 py-16 md:grid-cols-[1fr_auto]">
            <div><p className="gr-eyebrow">PRONTO PARA O PRÓXIMO NÍVEL?</p><h2 className="mt-4 max-w-2xl text-[clamp(32px,7vw,63px)] font-black uppercase italic leading-[1.02] tracking-[-.05em]">A PRÓXIMA HISTÓRIA <br/> COMEÇA <span className="text-[#429bff]">NA SUA MOTO.</span></h2><p className="mt-4 max-w-md text-sm leading-6 text-[#c5d1e4]">Fale com quem entende do assunto e conte o que você tem em mente.</p></div>
            <div className="flex flex-col items-start gap-3 md:items-stretch">
              {link(INSTAGRAM_MESSAGES,"bottom:orcamento",<>Conversar com a GYNRACE <ArrowUpRight className="h-5 w-5"/></>,"gr-shimmer flex min-h-14 items-center justify-center gap-3 rounded-xl border border-[#62adff] bg-gradient-to-r from-[#1377ff] to-[#073aaa] px-7 text-sm font-black shadow-[0_14px_30px_rgba(10,88,255,.25)]")}
              {waUrl ? link(waUrl,"bottom:whatsapp",<>WhatsApp <MessageCircle className="h-4 w-4"/></>,"flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#3372b6]/50 bg-[#091d35] px-5 text-sm font-bold") :
                <span className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 text-center text-[11px] text-[#9bb5d5]"><Clock3 className="h-4 w-4"/> WhatsApp disponível em breve</span>}
            </div>
          </div>
        </section>
      </main>

      <footer className="gr-shell relative z-10 flex flex-wrap items-center justify-between gap-4 py-7 text-xs text-[#8fa8cb]">
        <span className="font-black tracking-widest text-white">GYNRACE® <span className="font-normal text-[#93afcb]">| Performance para motos esportivas</span></span>
        <div className="flex items-center gap-5">{link(instagram,"footer:instagram",<>Instagram <ArrowUpRight className="inline h-3.5 w-3.5"/></>,"hover:text-white")}{link(maps,"footer:maps",<>Goiânia • GO <ArrowUpRight className="inline h-3.5 w-3.5"/></>,"hover:text-white")}</div>
      </footer>
    </div>
  );
}
