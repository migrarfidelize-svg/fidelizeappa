import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUpRight, Instagram, MessageCircle, Sparkles, X } from "lucide-react";
import { trackChannelEvent } from "@/lib/tracking";
import type { BioCommerceLandingData } from "./BioCommerceLanding";

const WHATSAPP_FALLBACK = "5562981006469";
const WELCOME_MESSAGE = "Olá, Kariny! Vim pelo seu link e gostaria de conhecer melhor seus serviços e consultar os horários disponíveis. Pode me ajudar?";
const SERVICES = [
  ["01", "Alongamento de unhas", "Formatos, estilos e acabamentos sob consulta."],
  ["02", "Esmaltação em gel", "Opções de cores e detalhes para cada ocasião."],
  ["03", "Banho de gel", "Conheça os cuidados e possibilidades do serviço."],
  ["04", "Manutenção", "Consulte os cuidados adequados às suas unhas."],
] as const;

function safeImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try { const url = new URL(raw); return url.protocol === "https:" ? url.href : null; }
  catch { return null; }
}
function safeInstagram(raw: unknown): string | null {
  const url = safeImage(raw);
  return url && /^https:\/\/(www\.)?instagram\.com\//i.test(url) ? url : null;
}
function verifiedPhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  return /^\d{2}9\d{8}$/.test(local) ? "55" + local : null;
}
function portfolio(data: BioCommerceLandingData) {
  const theme = (data.page?.theme ?? {}) as Record<string, unknown>;
  const imgs = Array.isArray(theme.portfolio) ? theme.portfolio : [];
  const gallery = (data.links ?? []).filter(l => l.kind === "gallery" || l.kind === "header_image").flatMap(l => {
    const cfg = (l.data ?? {}) as Record<string, unknown>;
    return [l.url, cfg.image_url, ...(Array.isArray(cfg.images) ? cfg.images : [])];
  });
  const seen = new Set<string>();
  return [...imgs, ...gallery].map(entry => {
    const raw = typeof entry === "string" ? entry : entry && typeof entry === "object"
      ? ((entry as Record<string, unknown>).url ?? (entry as Record<string, unknown>).src ?? (entry as Record<string, unknown>).image_url) : null;
    const url = safeImage(raw);
    const alt = entry && typeof entry === "object" && typeof (entry as any).alt === "string" ? (entry as any).alt : "Trabalho de nail design";
    return url ? { url, alt } : null;
  }).filter((p): p is {url:string;alt:string} => {
    if (!p || seen.has(p.url)) return false;
    seen.add(p.url); return true;
  }).slice(0, 12);
}

export function KarinyNailsExclusivePage({ data }: { data: BioCommerceLandingData }) {
  const est = data.establishment;
  const [selected, setSelected] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const photos = useMemo(() => portfolio(data), [data]);
  const name = data.page?.title || est.name || "Kariny Nails";
  const phone = verifiedPhone(est.whatsapp) ?? WHATSAPP_FALLBACK;
  const whatsapp = "https://wa.me/" + phone + "?text=" + encodeURIComponent(WELCOME_MESSAGE);
  const instagram = safeInstagram(est.instagram) ?? safeInstagram((data.page?.theme as any)?.instagram);
  const cover = safeImage(data.page?.cover_url) ?? safeImage(est.cover_url) ?? photos[0]?.url;
  const avatar = safeImage(data.page?.logo_url) ?? safeImage(est.logo_url);
  const track = (label: string) => trackChannelEvent({ slug: est.slug || "kariny-nails", channel: "linktree", event_type: "link_click", ref_label: "kariny:" + label });
  const ext = (label: string) => ({ target: "_blank" as const, rel: "noopener noreferrer", onClick: () => track(label) });
  useEffect(() => {
    if (selected === null) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [selected]);
  useEffect(() => {
    const body = document.body, html = document.documentElement;
    const oldBody = body.style.backgroundColor, oldHtml = html.style.backgroundColor;
    body.style.backgroundColor = "#120d14"; html.style.backgroundColor = "#120d14";
    return () => { body.style.backgroundColor = oldBody; html.style.backgroundColor = oldHtml; };
  }, []);

  return (
    <div data-kariny-edition="editorial-premium-20261103" className="min-h-dvh w-full min-w-0 overflow-x-clip bg-[#120d14] text-[#fff9f5] [font-family:Inter,system-ui,sans-serif]">
      <div aria-hidden="true" className="pointer-events-none absolute left-[-110px] top-28 h-[480px] w-[480px] rounded-full bg-[#b3748f]/[.13] blur-[130px]"/>
      <header className="relative z-30 mx-auto flex min-h-[88px] w-[calc(100%-32px)] max-w-[1160px] items-center justify-between gap-3 border-b border-white/10 py-3 sm:w-[calc(100%-48px)]">
        <a href="#inicio" aria-label="Kariny Nails, início" className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-[#dcabba]/45 bg-[#4c3044] font-[Georgia] text-xl text-[#f6d8df]">{avatar ? <img src={avatar} alt="" className="h-full w-full object-cover"/> : "K"}</span>
          <span className="min-w-0"><span className="block truncate text-[15px] font-semibold tracking-wide">{name}</span><span className="block text-[9px] font-bold uppercase tracking-[.25em] text-[#dcabba]">Nail Design Studio</span></span>
        </a>
        <nav aria-label="Navegação principal" className="hidden gap-8 text-xs text-white/70 md:flex">
          <a href="#servicos" className="hover:text-white">Serviços</a><a href="#portfolio" className="hover:text-white">Portfólio</a><a href="#contato" className="hover:text-white">Contato</a>
        </nav>
        <a href={whatsapp} {...ext("nav:agendar")} className="hidden min-h-10 items-center gap-2 rounded-full border border-[#e9c7d0]/35 px-5 text-xs font-semibold hover:bg-white/10 sm:inline-flex">Agendar horário <ArrowUpRight size={15}/></a>
        <button type="button" aria-expanded={menuOpen} aria-label="Abrir menu" onClick={() => setMenuOpen(v=>!v)} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 md:hidden">{menuOpen?<X size={18}/>:<span className="text-lg">☰</span>}</button>
      </header>
      {menuOpen&&<nav aria-label="Menu mobile" className="relative z-30 mx-4 flex flex-col rounded-xl border border-white/10 bg-[#2b1e2a] p-2 md:hidden">{[["Serviços","#servicos"],["Portfólio","#portfolio"],["Contato","#contato"]].map(([label,href])=><a key={href} href={href} onClick={()=>setMenuOpen(false)} className="rounded-lg px-4 py-3 text-sm hover:bg-white/10">{label}</a>)}</nav>}

      <main>
        <section id="inicio" className="relative mx-auto grid min-h-[630px] w-[calc(100%-32px)] max-w-[1160px] items-center gap-12 py-16 sm:w-[calc(100%-48px)] md:grid-cols-[1.06fr_.94fr] md:py-24">
          <div className="relative z-10">
            <p className="mb-8 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.22em] text-[#dcabba]"><span className="h-px w-9 bg-[#dcabba]"/> A arte está nos detalhes</p>
            <h1 className="font-[Georgia] text-[clamp(3.4rem,7.8vw,7rem)] font-normal leading-[.97] tracking-[-.055em]">Suas unhas.<br/><em className="text-[#e5b4c0]">Sua assinatura.</em></h1>
            <p className="mt-8 max-w-md text-[15px] leading-[1.9] text-[#f0dfe6]/70">Um espaço dedicado à beleza das suas mãos, com atenção ao seu estilo, aos detalhes e à experiência de cada atendimento.</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href={whatsapp} {...ext("hero:whatsapp")} className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-full bg-[#f3dcd8] px-6 text-sm font-bold text-[#281921] transition-colors hover:bg-white">Quero agendar meu horário <ArrowUpRight size={16}/></a>
              <a href="#portfolio" className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-full border border-white/25 px-6 text-sm font-semibold hover:bg-white/10">Conhecer o trabalho <ArrowDown size={15}/></a>
            </div>
            <div className="mt-14 flex flex-wrap items-center gap-6 border-t border-white/10 pt-6"><span className="text-[10px] font-bold uppercase tracking-[.17em] text-white/45">Beleza · Cuidado · Identidade</span>{instagram&&<a href={instagram} {...ext("hero:instagram")} className="inline-flex items-center gap-2 text-xs text-[#e5b4c0]"><Instagram size={16}/> Instagram <ArrowUpRight size={13}/></a>}</div>
          </div>
          <div className="relative mx-auto w-full max-w-[475px] md:ml-auto">
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-4 -left-4 -top-4 right-4 rounded-t-[160px] rounded-b-[24px] border border-[#d7a4b4]/20"/>
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-[160px] rounded-b-[24px] border border-[#d7a4b4]/35 bg-[linear-gradient(155deg,#56384b,#211721_72%,#694357)] shadow-[0_24px_85px_#0008]">
              {cover?<img src={cover} alt="Destaque do estúdio Kariny Nails" loading="eager" fetchPriority="high" className="h-full w-full object-cover"/>:<div className="flex h-full flex-col items-center justify-center"><span className="font-[Georgia] text-[clamp(6rem,16vw,11rem)] tracking-[-.14em] text-[#f1ccd8]">KN</span><span className="text-[10px] uppercase tracking-[.28em] text-white/50">Kariny Nails Studio</span></div>}
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent"/>
              <span className="absolute bottom-7 left-7 z-10 text-[10px] uppercase tracking-[.2em] text-white/85">Beleza em cada detalhe</span>
            </div>
            <div className="absolute -bottom-5 -right-2 grid h-[84px] w-[84px] place-items-center rounded-full border border-[#f0cad3]/40 bg-[#392434] text-center text-[10px] font-semibold uppercase leading-[1.4] tracking-wider text-[#f0cad3] sm:-right-6">Feito<br/>com cuidado</div>
          </div>
        </section>

        <section id="servicos" className="border-y border-white/10 bg-[#1b151d] py-20 md:py-28"><div className="mx-auto w-[calc(100%-32px)] max-w-[1160px] sm:w-[calc(100%-48px)]">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-8"><div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.23em] text-[#dcabba]">A experiência</p><h2 className="font-[Georgia] text-[clamp(2.5rem,5vw,4.7rem)] leading-[1.05] tracking-[-.05em]">Cada detalhe<br/><em className="text-[#e5b4c0]">faz a diferença.</em></h2></div><p className="max-w-xs text-sm leading-7 text-white/55">Conheça algumas possibilidades. Confirme as técnicas disponíveis, os valores e a agenda diretamente com a profissional.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{SERVICES.map(s=><a key={s[0]} href={whatsapp} {...ext("servico:"+s[0])} className="group flex min-h-[265px] flex-col justify-between rounded-[22px] border border-[#d7a4b4]/20 bg-gradient-to-br from-[#342433] to-[#1e1820] p-6 transition-colors hover:border-[#d7a4b4]/70"><div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#dcabba]"><span>{s[0]} / Serviço</span><ArrowUpRight size={17}/></div><div><h3 className="font-[Georgia] text-[28px] leading-[1.12]">{s[1]}</h3><p className="mt-4 text-xs leading-6 text-white/60">{s[2]}</p></div></a>)}</div>
        </div></section>

        <section id="portfolio" className="mx-auto w-[calc(100%-32px)] max-w-[1160px] py-20 sm:w-[calc(100%-48px)] md:py-28">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6"><div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.23em] text-[#dcabba]">Inspiração e portfólio</p><h2 className="font-[Georgia] text-[clamp(2.5rem,5vw,4.7rem)] leading-[1.04] tracking-[-.05em]">O poder de um<br/><em className="text-[#e5b4c0]">belo acabamento.</em></h2></div>{instagram&&<a href={instagram} {...ext("portfolio:instagram")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-xs font-semibold">Ver Instagram <ArrowUpRight size={15}/></a>}</div>
          {photos.length>0?<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5">{photos.slice(0,6).map((pic,i)=><button type="button" key={pic.url} aria-label={"Ampliar foto "+(i+1)} onClick={()=>setSelected(i)} className="group relative aspect-[3/4] overflow-hidden rounded-[22px] border border-white/15 bg-[#302331]"><img src={pic.url} alt={pic.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-5 pb-5 pt-12 text-left text-[10px] font-bold uppercase tracking-wider">Detalhe {i+1} <ArrowUpRight size={13} className="inline"/></span></button>)}</div>
            :<div className="grid gap-3 sm:grid-cols-3">{[1,2,3].map(i=><div key={i} className="flex aspect-[3/4] flex-col items-center justify-center rounded-[22px] border border-[#d7a4b4]/15 bg-[radial-gradient(circle_at_20%_15%,#67485d,#251b2a_75%)] p-5 text-center"><Sparkles size={27} className="mb-5 text-[#dcabba]"/><span className="font-[Georgia] text-3xl italic text-[#f0cad3]">Seu estilo</span><span className="mt-3 text-[9px] font-bold uppercase tracking-[.2em] text-white/45">Portfólio em preparação</span></div>)}</div>}
          <p className="mt-5 text-xs leading-6 text-white/45">{photos.length ? "Seleção de trabalhos cadastrados na Fidelize." : "Espaço reservado para fotografias reais dos trabalhos da Kariny."}</p>
        </section>
        <section id="contato" className="border-t border-[#e8bfc9]/15 bg-[radial-gradient(ellipse_at_80%_25%,#5f3d51,#291a2b_60%,#1a121b)] py-20 md:py-28"><div className="mx-auto grid w-[calc(100%-32px)] max-w-[1160px] items-end gap-10 sm:w-[calc(100%-48px)] md:grid-cols-[1fr_auto]"><div><p className="mb-6 text-[10px] font-bold uppercase tracking-[.22em] text-[#dcabba]">Seu próximo momento de cuidado</p><h2 className="font-[Georgia] text-[clamp(3rem,7vw,6.7rem)] leading-[.98] tracking-[-.055em]">Seu horário.<br/><em className="text-[#e5b4c0]">Seu momento.</em></h2><p className="mt-7 max-w-md text-sm leading-7 text-white/60">Entre em contato com a Kariny para consultar a agenda e conhecer as possibilidades de atendimento.</p></div><div className="flex flex-col gap-3"><a href={whatsapp} {...ext("contato:whatsapp")} className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-full bg-[#f3dcd8] px-6 text-sm font-bold text-[#281821] hover:bg-white">Conversar no WhatsApp <MessageCircle size={17}/></a>{instagram&&<a href={instagram} {...ext("contato:instagram")} className="inline-flex min-h-[50px] items-center justify-center gap-3 rounded-full border border-white/30 px-6 text-sm font-semibold">Ver Instagram <Instagram size={17}/></a>}</div></div></section>
      </main>
      <footer className="mx-auto flex w-[calc(100%-32px)] max-w-[1160px] flex-wrap justify-between gap-3 border-t border-white/10 py-8 text-xs text-white/40 sm:w-[calc(100%-48px)]"><span>© {new Date().getFullYear()} {name}.</span><span>Beleza em cada detalhe.</span></footer>
      <a href={whatsapp} {...ext("flutuante:whatsapp")} aria-label="Agendar via WhatsApp" className="fixed bottom-5 right-4 z-40 inline-flex min-h-[52px] items-center gap-2 rounded-full border border-[#e9c7d0]/45 bg-[#f3dcd8] px-5 text-xs font-bold text-[#281821] shadow-[0_12px_44px_#0009] md:bottom-7 md:right-7"><MessageCircle size={17}/> Agendar</a>
      {selected!==null&&photos[selected]&&<div role="dialog" aria-modal="true" aria-label="Ampliar foto" onClick={()=>setSelected(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-[#080608]/95 p-4"><button type="button" autoFocus onClick={()=>setSelected(null)} aria-label="Fechar foto" className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-[#342332]"><X size={20}/></button><img src={photos[selected].url} alt={photos[selected].alt} onClick={e=>e.stopPropagation()} className="max-h-[85dvh] max-w-full rounded-xl object-contain"/></div>}
    </div>
  );
}
