import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  Facebook,
  Globe,
  Images as ImagesIcon,
  Instagram,
  KeyRound,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Music,
  Music2,
  Phone,
  Play,
  PlayCircle,
  Plus,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UtensilsCrossed,
  Wifi,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createBioCommerceOrder } from "@/lib/bio-commerce-order.functions";
import { getPublicYouTubeFeed } from "@/lib/youtube-feed.functions";
import {
  getBioCommerceNiche,
  resolveBioCommerceLandingTheme,
  type BioCommerceTheme,
} from "@/lib/bio-commerce-theme";
import { useCart } from "@/lib/cart";
import { trackChannelEvent } from "@/lib/tracking";
import type {
  BioCommerceBlockData,
  BioCommerceLandingData,
  BioCommerceProduct,
  BioCommerceReview,
} from "./BioCommerceLandingV4";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

type ExperienceMode = "commerce" | "booking" | "links";
type CatalogMode = "menu" | "catalog" | null;

const EMPTY_BLOCK_DATA: BioCommerceBlockData = { menu: [], catalog: [], reviews: [], stats: null };
const RICH_KINDS = new Set(["video", "spotify", "gallery", "menu_carousel", "reviews", "header_image"]);

const KIND_META: Record<string, { icon: any; fallback: string }> = {
  whatsapp: { icon: MessageCircle, fallback: "WhatsApp" },
  instagram: { icon: Instagram, fallback: "Instagram" },
  facebook: { icon: Facebook, fallback: "Facebook" },
  tiktok: { icon: Music2, fallback: "TikTok" },
  youtube: { icon: Youtube, fallback: "YouTube" },
  site: { icon: Globe, fallback: "Site" },
  google: { icon: Star, fallback: "Avaliações" },
  maps: { icon: MapPin, fallback: "Como chegar" },
  email: { icon: Mail, fallback: "E-mail" },
  phone: { icon: Phone, fallback: "Telefone" },
  wifi: { icon: Wifi, fallback: "Wi-Fi" },
  pix: { icon: KeyRound, fallback: "Pix" },
  cardapio: { icon: UtensilsCrossed, fallback: "Cardápio" },
  cartao: { icon: CreditCard, fallback: "Fidelidade" },
  custom: { icon: ExternalLink, fallback: "Acessar" },
};

function rgba(hex: string, alpha: number, fallback = "rgba(255,255,255,.12)") {
  const raw = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(raw)) return fallback;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function money(value: number | null | undefined, currency = "BRL") {
  if (value == null || !Number.isFinite(Number(value))) return "Sob consulta";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value));
  } catch {
    return `R$ ${Number(value).toFixed(2)}`;
  }
}

function unitPrice(product: BioCommerceProduct, variant?: string | null) {
  const selected = variant && Array.isArray(product.variants)
    ? product.variants.find((item) => String(item?.label ?? "") === variant)
    : null;
  return Number(selected?.price ?? product.promo_price ?? product.price ?? 0);
}

function normalizeUrl(kind: string, value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "#";
  if (raw.startsWith("/")) return raw;
  if (kind === "whatsapp") {
    const digits = raw.replace(/\D/g, "");
    if (digits && !/^https?:/i.test(raw)) return `https://wa.me/${digits}`;
  }
  if (kind === "email" && !raw.startsWith("mailto:") && raw.includes("@")) return `mailto:${raw}`;
  if (kind === "phone" && !raw.startsWith("tel:")) return `tel:${raw.replace(/\s/g, "")}`;
  if (kind === "instagram" && !/^https?:/i.test(raw)) return `https://instagram.com/${raw.replace(/^@/, "")}`;
  if (kind === "facebook" && !/^https?:/i.test(raw)) return `https://facebook.com/${raw.replace(/^@/, "")}`;
  if (kind === "tiktok" && !/^https?:/i.test(raw)) return `https://tiktok.com/@${raw.replace(/^@/, "")}`;
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith("mailto:") && !raw.startsWith("tel:")) return `https://${raw}`;
  return raw;
}

function decodeWifi(url: string) {
  const ssid = /WIFI:.*?S:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const password = /WIFI:.*?P:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unescape = (value: string) => value.replace(/\\(.)/g, "$1");
  return { ssid: unescape(ssid), password: unescape(password) };
}

function decodePix(url: string) {
  const key = /PIX:.*?K:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const name = /PIX:.*?N:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unescape = (value: string) => value.replace(/\\(.)/g, "$1");
  return { key: unescape(key), name: unescape(name) };
}

function parseVideoUrl(value: string) {
  const url = String(value ?? "").trim();
  const youtube = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i.exec(url);
  if (youtube) return { embed: `https://www.youtube.com/embed/${youtube[1]}?rel=0&modestbranding=1` };
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(url);
  if (vimeo) return { embed: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { direct: url };
  return null;
}

function parseSpotifyUrl(value: string) {
  const match = /open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/i.exec(String(value ?? "").trim());
  return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0` : null;
}

function surface(theme: any, strong = false) {
  if (theme.card_style === "outline") return { background: rgba(theme.background, strong ? 0.84 : 0.58), border: `1px solid ${rgba(theme.primary, 0.42)}` };
  if (theme.card_style === "soft") return { background: rgba(theme.text, strong ? 0.12 : 0.075), border: `1px solid ${rgba(theme.text, 0.08)}` };
  if (theme.card_style === "elevated") return { background: rgba(theme.background, strong ? 0.96 : 0.88), border: `1px solid ${rgba(theme.text, 0.1)}`, boxShadow: `0 20px 60px ${rgba(theme.primary, 0.12)}` };
  return { background: rgba(theme.text, strong ? 0.105 : 0.065), border: `1px solid ${rgba(theme.text, 0.12)}`, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" };
}

function detectBusinessFlavor(establishment: any, title: string) {
  const haystack = [title, establishment?.name, establishment?.description, establishment?.category, establishment?.segment, establishment?.business_type].filter(Boolean).join(" ").toLowerCase();
  if (/barbear|barber/.test(haystack)) return "barber";
  if (/manicure|unha|nail/.test(haystack)) return "nails";
  if (/sal[aã]o|cabelo|hair|est[eé]tica|spa/.test(haystack)) return "beauty";
  if (/academia|fitness|cross|pilates|personal|studio/.test(haystack)) return "fitness";
  if (/cl[ií]nica|m[eé]dic|odonto|fisi|terapia|nutri/.test(haystack)) return "health";
  return "generic";
}

function bookingCopy(flavor: string) {
  if (flavor === "barber") return { eyebrow: "Seu estilo, no seu horário", title: "Cortes e serviços", cta: "Agendar este serviço" };
  if (flavor === "nails") return { eyebrow: "Seu momento de cuidado", title: "Serviços de unhas", cta: "Agendar este serviço" };
  if (flavor === "fitness") return { eyebrow: "Comece sua evolução", title: "Planos e experiências", cta: "Quero conhecer" };
  if (flavor === "health") return { eyebrow: "Atendimento com confiança", title: "Serviços e cuidados", cta: "Agendar atendimento" };
  return { eyebrow: "Escolha seu atendimento", title: "Serviços em destaque", cta: "Agendar agora" };
}

function resolveExperienceMode(input: { page: any; nicheId: string; links: any[]; menuCount: number; catalogCount: number }) : ExperienceMode {
  const explicit = String(input.page?.theme?.experience_mode ?? "");
  if (explicit === "commerce" || explicit === "booking" || explicit === "links") return explicit;
  const hasShowcase = input.links.some((link: any) => link.kind === "menu_carousel" || link.kind === "cardapio");
  const hasProducts = input.menuCount + input.catalogCount > 0;
  if (["beauty", "health", "fitness"].includes(input.nicheId) && hasProducts && hasShowcase) return "booking";
  if (hasProducts && hasShowcase) return "commerce";
  return "links";
}

export function BioCommerceLanding({
  data,
  slug,
  blockData = EMPTY_BLOCK_DATA,
  embedded = false,
  interactive = true,
}: {
  data: BioCommerceLandingData;
  slug: string;
  blockData?: BioCommerceBlockData;
  embedded?: boolean;
  interactive?: boolean;
}) {
  const establishment = data.establishment ?? {};
  const page = data.page ?? {};
  const links = useMemo(() => (data.links ?? []).filter((link: any) => link?.enabled !== false), [data.links]);
  const cover = page.cover_url ?? establishment.cover_url ?? null;
  const logo = page.logo_url ?? establishment.logo_url ?? null;
  const theme = resolveBioCommerceLandingTheme((page.theme ?? {}) as BioCommerceTheme, { links, establishment, cover }) as any;
  const niche = getBioCommerceNiche(theme.niche_id);
  const reducedMotion = useReducedMotion();
  const motionEnabled = theme.motion !== "none" && !reducedMotion;
  const title = page.title || establishment.name || "Seu negócio";
  const description = page.description || establishment.description || niche.eyebrow;
  const flavor = detectBusinessFlavor(establishment, title);
  const booking = bookingCopy(flavor);
  const cart = useCart(slug || establishment.slug || "bio-commerce");
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [catalogMode, setCatalogMode] = useState<CatalogMode>(null);
  const showcaseRef = useRef<HTMLElement | null>(null);
  const linkHubRef = useRef<HTMLElement | null>(null);

  const menuProducts = useMemo(() => (blockData.menu ?? []).filter((item) => item.stock_status !== "out_of_stock" || item.price != null), [blockData.menu]);
  const catalogProducts = useMemo(() => (blockData.catalog ?? []).filter((item) => item.stock_status !== "out_of_stock" || item.price != null), [blockData.catalog]);
  const mode = resolveExperienceMode({ page, nicheId: niche.id, links, menuCount: menuProducts.length, catalogCount: catalogProducts.length });
  const explicitShowcase = links.find((link: any) => link.kind === "menu_carousel");
  const requestedSource = explicitShowcase?.data?.source === "catalog" ? "catalog" : explicitShowcase?.data?.source === "menu" ? "menu" : niche.preferred_source;
  const preferred = requestedSource === "menu" ? menuProducts : catalogProducts;
  const fallback = requestedSource === "menu" ? catalogProducts : menuProducts;
  const primaryProducts = mode === "links" ? [] : (preferred.length ? preferred : fallback).slice(0, 16);
  const primarySource = preferred.length ? requestedSource : requestedSource === "menu" ? "catalog" : "menu";
  const secondaryProducts = mode === "links" ? [] : (primarySource === "menu" ? catalogProducts : menuProducts).slice(0, 12);
  const allProducts = useMemo(() => {
    const seen = new Set<string>();
    return [...menuProducts, ...catalogProducts].filter((product) => {
      if (!product?.id || seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    });
  }, [menuProducts, catalogProducts]);

  const reviews = (blockData.reviews ?? []).filter((review) => (review.rating ?? 0) >= 4).slice(0, 4);
  const richLinks = links.filter((link: any) => RICH_KINDS.has(link.kind) && !["menu_carousel", "reviews"].includes(link.kind));
  const actionLinks = links.filter((link: any) => !RICH_KINDS.has(link.kind) && !["wifi", "pix"].includes(link.kind));
  const utilities = links.filter((link: any) => ["wifi", "pix"].includes(link.kind));
  const socialLinks = links.filter((link: any) => ["instagram", "facebook", "tiktok", "youtube", "email"].includes(link.kind));
  const youtubeLink = links.find((link: any) => link.kind === "youtube" && link.url);
  const whatsappLink = links.find((link: any) => link.kind === "whatsapp") ?? (establishment.whatsapp ? { id: "est-whatsapp", kind: "whatsapp", label: "WhatsApp", url: establishment.whatsapp } : null);
  const bookingLink = links.find((link: any) => ["custom", "site"].includes(link.kind) && /agenda|agend|hor[aá]rio|booking/i.test(`${link.label ?? ""} ${link.url ?? ""}`));
  const primaryLink = actionLinks.find((link: any) => link.data?.presentation === "destaque") ?? actionLinks[0] ?? null;

  const container = theme.content_width === "wide" ? "max-w-6xl" : theme.content_width === "compact" ? "max-w-3xl" : "max-w-5xl";
  const radius = theme.rounded === "full" ? "rounded-[2rem]" : theme.rounded === "sm" ? "rounded-xl" : theme.rounded === "md" ? "rounded-2xl" : "rounded-3xl";
  const fontClass = theme.font_style === "editorial" ? "font-serif" : "font-sans";

  const track = (label: string, id?: string | null) => {
    if (!interactive) return;
    trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: id ?? null, ref_label: label });
  };

  const openStory = (product: BioCommerceProduct) => {
    const index = allProducts.findIndex((item) => item.id === product.id);
    if (index < 0 || !interactive) return;
    setStoryIndex(index);
    track(`product:${product.name}`, product.id);
  };

  const scrollToShowcase = () => {
    if (!interactive) return;
    showcaseRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    track(mode === "booking" ? "cta:services" : "cta:showcase");
  };

  const scrollToLinks = () => {
    if (!interactive) return;
    linkHubRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
  };

  const openInternalCatalog = (kind: CatalogMode) => {
    if (!interactive) return;
    setCatalogMode(kind);
  };

  const bookProduct = (product: BioCommerceProduct) => {
    if (!interactive) return;
    track(`booking:${product.name}`, product.id);
    const target = bookingLink ? normalizeUrl(bookingLink.kind, bookingLink.url) : whatsappLink ? normalizeUrl("whatsapp", whatsappLink.url) : "";
    if (!target) return toast.info("A loja ainda não configurou um canal de agendamento.");
    if (target.includes("wa.me/")) {
      const joiner = target.includes("?") ? "&" : "?";
      window.open(`${target}${joiner}text=${encodeURIComponent(`Olá! Quero agendar: ${product.name}.`)}`, "_blank", "noopener,noreferrer");
      return;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const heroCta = mode === "commerce"
    ? niche.primary_cta
    : mode === "booking"
      ? booking.cta.replace("este serviço", "agora")
      : primaryLink?.label || "Ver meus links";

  return (
    <div className={`${fontClass} relative min-h-full overflow-x-hidden`} style={{ background: theme.background, color: theme.text }}>
      <Ambient theme={theme} motionEnabled={motionEnabled} embedded={embedded} />
      <style>{`.bc-v8-scroll::-webkit-scrollbar{display:none}.bc-v8-scroll{scrollbar-width:none}.bc-v8-grain{background-image:radial-gradient(circle at 1px 1px,currentColor 1px,transparent 0);background-size:24px 24px}`}</style>

      <div className={`relative z-10 mx-auto ${container} ${embedded ? "px-2 pb-8 pt-2" : "px-3 pb-28 pt-3 sm:px-6 sm:pt-6 lg:px-8"}`}>
        <Hero
          embedded={embedded}
          cover={cover}
          logo={logo}
          title={title}
          description={description}
          theme={theme}
          niche={niche}
          mode={mode}
          booking={booking}
          stats={blockData.stats}
          motionEnabled={motionEnabled}
          cta={heroCta}
          onPrimary={() => mode === "links" ? (primaryLink ? openLink(primaryLink, interactive, track, openInternalCatalog) : scrollToLinks()) : scrollToShowcase()}
          onShare={() => interactive && navigator.share?.({ title, url: window.location.href }).catch(() => undefined)}
        />

        {actionLinks.length > 0 && (
          <section ref={linkHubRef as any} className="mt-4 scroll-mt-6">
            <LinkHub links={actionLinks} theme={theme} radius={radius} interactive={interactive} mode={mode} track={track} openInternalCatalog={openInternalCatalog} />
          </section>
        )}

        {primaryProducts.length > 0 && (
          <section ref={showcaseRef as any} id="bio-commerce-vitrine" className="scroll-mt-6 pt-8">
            <SectionHeading
              eyebrow={mode === "booking" ? booking.eyebrow : primarySource === "menu" ? "Destaques do cardápio" : "Destaques da loja"}
              title={mode === "booking" ? booking.title : explicitShowcase?.label || niche.showcase_title}
              theme={theme}
            />
            <ProductSpotlight product={primaryProducts[0]} theme={theme} radius={radius} embedded={embedded} mode={mode} cart={cart} onOpen={() => openStory(primaryProducts[0])} onBook={() => bookProduct(primaryProducts[0])} />
            {primaryProducts.length > 1 && <div className="mt-4"><AutoProductRail products={primaryProducts} theme={theme} radius={radius} motionEnabled={motionEnabled} embedded={embedded} interactive={interactive} mode={mode} cart={cart} onOpen={openStory} onBook={bookProduct} onTrack={track} /></div>}
            <button type="button" onClick={() => openInternalCatalog(primarySource === "menu" ? "menu" : "catalog")} className="mt-4 inline-flex items-center gap-1 text-xs font-bold opacity-70 transition hover:opacity-100">
              {primarySource === "menu" ? "Ver cardápio completo" : "Ver catálogo completo"}<ChevronRight className="h-3.5 w-3.5" />
            </button>
          </section>
        )}

        {secondaryProducts.length > 0 && (
          <section className="mt-9">
            <SectionHeading eyebrow="Mais opções" title={primarySource === "menu" ? "Produtos da loja" : "Mais para você"} theme={theme} />
            <AutoProductRail products={secondaryProducts} theme={theme} radius={radius} motionEnabled={motionEnabled} embedded={embedded} interactive={interactive} mode={mode} cart={cart} onOpen={openStory} onBook={bookProduct} onTrack={track} />
            <button type="button" onClick={() => openInternalCatalog(primarySource === "menu" ? "catalog" : "menu")} className="mt-4 inline-flex items-center gap-1 text-xs font-bold opacity-70 transition hover:opacity-100">
              {primarySource === "menu" ? "Ver catálogo completo" : "Ver cardápio completo"}<ChevronRight className="h-3.5 w-3.5" />
            </button>
          </section>
        )}

        {youtubeLink && <YouTubeShowcase link={youtubeLink} theme={theme} embedded={embedded} interactive={interactive} track={track} />}

        {richLinks.length > 0 && (
          <section className={`mt-9 grid gap-4 ${theme.layout === "bento" ? "md:grid-cols-2" : ""}`}>
            {richLinks.map((link: any, index: number) => <motion.div key={link.id ?? index} initial={motionEnabled ? { opacity: 0, y: 14 } : false} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: motionEnabled ? index * 0.04 : 0 }} className={link.kind === "header_image" ? "md:col-span-2" : ""}><RichModule link={link} theme={theme} radius={radius} interactive={interactive} /></motion.div>)}
          </section>
        )}

        {reviews.length > 0 && (
          <section className="mt-10">
            <SectionHeading eyebrow="Prova social" title="Quem conhece, recomenda" theme={theme} />
            <div className="grid gap-3 md:grid-cols-2">{reviews.map((review) => <article key={review.id} className={`${radius} p-4 sm:p-5`} style={surface(theme, true)}><div className="flex gap-0.5">{[1,2,3,4,5].map((value) => <Star key={value} className="h-3.5 w-3.5" style={{ color: theme.primary, fill: (review.rating ?? 0) >= value ? theme.primary : "transparent" }} />)}</div>{review.comment && <p className="mt-3 text-sm leading-relaxed opacity-85">“{review.comment}”</p>}<p className="mt-3 text-xs font-black opacity-65">{review.customer_name}</p></article>)}</div>
          </section>
        )}

        {utilities.length > 0 && (
          <section className="mt-10">
            <SectionHeading eyebrow="Facilidades" title="Tudo em um só lugar" theme={theme} />
            <div className="grid gap-3 sm:grid-cols-2">{utilities.map((link: any) => <UtilityModule key={link.id ?? link.kind} link={link} theme={theme} radius={radius} />)}</div>
          </section>
        )}

        {socialLinks.length > 0 && (
          <section className="mt-10 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] opacity-45">Conecte-se com a gente</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{socialLinks.map((link: any) => <SocialAction key={link.id ?? `${link.kind}-${link.label}`} link={link} theme={theme} interactive={interactive} track={track} />)}</div>
          </section>
        )}

        <footer className={`${embedded ? "mt-8" : "mt-14"} flex items-center justify-center gap-2 pb-4 text-[9px] font-black uppercase tracking-[0.26em] opacity-45`}><Sparkles className="h-3 w-3" /> Bio Commerce by Fidelize</footer>
      </div>

      {!embedded && interactive && mode === "commerce" && cart.count > 0 && (
        <CartDock count={cart.count} total={cart.lines.reduce((sum, line) => { const product = allProducts.find((item) => item.id === line.id); return sum + (product ? unitPrice(product, line.variant) * line.qty : 0); }, 0)} theme={theme} onOpen={() => setCartOpen(true)} />
      )}

      <AnimatePresence>{storyIndex != null && allProducts[storyIndex] && <ProductStoryModal key={allProducts[storyIndex].id} products={allProducts} index={storyIndex} setIndex={setStoryIndex} onClose={() => setStoryIndex(null)} cart={cart} theme={theme} interactive={interactive} motionEnabled={motionEnabled} mode={mode} onBook={bookProduct} onTrack={track} />}</AnimatePresence>
      <AnimatePresence>{cartOpen && !embedded && mode === "commerce" && <CheckoutSheet slug={slug} products={allProducts} cart={cart} theme={theme} whatsapp={String(establishment.whatsapp ?? whatsappLink?.url ?? "")} onClose={() => setCartOpen(false)} onTrack={track} />}</AnimatePresence>
      <AnimatePresence>{catalogMode && !embedded && <FullCatalogOverlay mode={catalogMode} products={catalogMode === "menu" ? menuProducts : catalogProducts} theme={theme} experienceMode={mode} cart={cart} onClose={() => setCatalogMode(null)} onOpen={openStory} onBook={bookProduct} />}</AnimatePresence>
    </div>
  );
}

function openLink(link: any, interactive: boolean, track: (label: string, id?: string | null) => void, openInternalCatalog: (mode: CatalogMode) => void) {
  if (!interactive) return;
  const href = normalizeUrl(link.kind, link.url);
  track(`link:${link.label || link.kind}`, link.id);
  if (link.kind === "cardapio" || /^\/cardapio\//.test(href)) return openInternalCatalog("menu");
  if (/^\/catalogo\//.test(href)) return openInternalCatalog("catalog");
  window.open(href, href.startsWith("/") ? "_self" : "_blank", href.startsWith("/") ? undefined : "noopener,noreferrer");
}

function Ambient({ theme, motionEnabled, embedded }: { theme: any; motionEnabled: boolean; embedded: boolean }) {
  if (theme.background_effect === "solid") return null;
  return <div className={`${embedded ? "absolute" : "fixed"} pointer-events-none inset-0 z-0 overflow-hidden`} aria-hidden="true"><motion.div className="absolute -left-24 -top-28 h-[26rem] w-[26rem] rounded-full blur-3xl" style={{ background: rgba(theme.primary, .2) }} animate={motionEnabled ? { x:[0,24,-14,0], y:[0,-16,14,0], scale:[1,1.08,.97,1] } : undefined} transition={{ duration:18, repeat:Infinity, ease:"easeInOut" }} /><motion.div className="absolute -right-24 top-[32%] h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: rgba(theme.accent, .15) }} animate={motionEnabled ? { x:[0,-22,14,0], y:[0,18,-8,0] } : undefined} transition={{ duration:20, repeat:Infinity, ease:"easeInOut" }} /></div>;
}

function Hero({ embedded, cover, logo, title, description, theme, niche, mode, booking, stats, motionEnabled, cta, onPrimary, onShare }: any) {
  const heroHeight = embedded ? "min-h-[500px]" : "min-h-[620px] sm:min-h-[680px]";
  return <motion.section initial={motionEnabled ? { opacity:0, y:18 } : false} animate={{ opacity:1, y:0 }} transition={{ duration: motionEnabled ? .45 : 0 }}><div className={`relative isolate overflow-hidden border ${embedded ? "rounded-[2.4rem]" : "rounded-[2rem] sm:rounded-[2.4rem]"} ${heroHeight}`} style={{ borderColor:rgba(theme.text,.12), boxShadow:`0 36px 110px ${rgba(theme.primary,.22)}` }}>{cover ? <motion.img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" initial={false} animate={motionEnabled ? { scale:[1.01,1.05,1.01] } : undefined} transition={motionEnabled ? { duration:18, repeat:Infinity, ease:"easeInOut" } : undefined} /> : <div className="absolute inset-0" style={{ background:`linear-gradient(135deg,${rgba(theme.primary,.48)},${rgba(theme.accent,.2)} 48%,${theme.background})` }} />}<div className="absolute inset-0" style={{ background: cover ? `linear-gradient(180deg,${rgba(theme.background,.04)},${rgba(theme.background,.16)} 28%,${rgba(theme.background,.72)} 67%,${theme.background})` : `linear-gradient(180deg,transparent,${rgba(theme.background,.92)})` }} /><div className="bc-v8-grain absolute inset-0 opacity-[.05]" style={{ color:theme.text }} /><div className={`relative z-10 flex ${heroHeight} flex-col justify-between ${embedded ? "p-5" : "p-5 sm:p-8 lg:p-10"}`}><div className="flex items-center justify-between gap-3"><span className="rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[.22em] backdrop-blur-xl" style={{ borderColor:rgba(theme.text,.2), background:rgba(theme.background,.3) }}>{mode === "booking" ? booking.eyebrow : mode === "links" ? "Todos os caminhos da marca" : niche.eyebrow}</span><button type="button" onClick={onShare} className="grid h-10 w-10 place-items-center rounded-full border backdrop-blur-xl" style={{ borderColor:rgba(theme.text,.18), background:rgba(theme.background,.28) }} aria-label="Compartilhar"><Share2 className="h-4 w-4" /></button></div><div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center"><div className="relative">{logo ? <img src={logo} alt={title} className={`${embedded ? "h-24 w-24" : "h-28 w-28 sm:h-32 sm:w-32"} rounded-[2rem] border object-cover shadow-2xl`} style={{ borderColor:rgba(theme.text,.26), boxShadow:`0 22px 68px ${rgba(theme.primary,.34)}` }} /> : <div className={`${embedded ? "h-24 w-24" : "h-28 w-28 sm:h-32 sm:w-32"} grid place-items-center rounded-[2rem] border text-4xl font-black text-white`} style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})`, borderColor:rgba(theme.text,.2) }}>{String(title)[0]?.toUpperCase() || "F"}</div>}<span title="Perfil Fidelize" className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-[3px] border-white bg-[#1689ff] shadow-[0_8px_24px_rgba(22,137,255,.45)]"><BadgeCheck className="h-5 w-5 fill-white text-[#1689ff]" /></span></div><h1 className={`${embedded ? "mt-5 text-3xl" : "mt-6 text-4xl sm:text-6xl"} font-black tracking-[-.04em]`}>{title}</h1><p className={`mx-auto mt-3 max-w-xl ${embedded ? "text-xs" : "text-sm sm:text-base"} leading-relaxed opacity-85`}>{description}</p>{stats && stats.count > 0 && <div className="mt-4 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs backdrop-blur-xl" style={{ borderColor:rgba(theme.text,.14), background:rgba(theme.background,.32) }}><Star className="h-3.5 w-3.5" style={{ color:theme.primary, fill:theme.primary }} /><strong>{stats.avg.toFixed(1)}</strong><span className="opacity-60">({stats.count} avaliações)</span></div>}<button type="button" onClick={onPrimary} className={`${embedded ? "mt-5" : "mt-6"} group flex w-full max-w-md items-center justify-center gap-3 rounded-full px-5 py-4 text-sm font-black text-white shadow-2xl transition hover:-translate-y-.5`} style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})`, boxShadow:`0 20px 55px ${rgba(theme.primary,.32)}` }}>{mode === "booking" ? <CalendarDays className="h-5 w-5" /> : mode === "commerce" ? <ShoppingBag className="h-5 w-5" /> : <ExternalLink className="h-5 w-5" />}{cta}<ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" /></button></div></div></div></motion.section>;
}

function SectionHeading({ eyebrow, title, theme }: { eyebrow:string; title:string; theme:any }) {
  return <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.22em]" style={{ color:theme.primary }}>{eyebrow}</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em] sm:text-3xl">{title}</h2></div>;
}

function LinkHub({ links, theme, radius, interactive, mode, track, openInternalCatalog }: any) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => ref.current?.scrollBy({ left: direction * Math.max(260, ref.current.clientWidth * .72), behavior:"smooth" });
  const cards = links;
  return <div className="relative"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.22em] opacity-45">Acesso rápido</p><h2 className="mt-1 text-lg font-black">{mode === "links" ? "Escolha para onde ir" : "Tudo da marca em um toque"}</h2></div>{cards.length > 4 && <div className="hidden gap-2 sm:flex"><button onClick={() => scroll(-1)} className="grid h-9 w-9 place-items-center rounded-full border" style={surface(theme)} aria-label="Links anteriores"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => scroll(1)} className="grid h-9 w-9 place-items-center rounded-full border" style={surface(theme)} aria-label="Próximos links"><ChevronRight className="h-4 w-4" /></button></div>}</div><div ref={ref} className="bc-v8-scroll flex gap-2 overflow-x-auto overscroll-x-contain pb-1 pr-8 scroll-smooth">{cards.map((link:any, index:number) => { const meta = KIND_META[link.kind] ?? KIND_META.custom; const Icon = meta.icon; return <button key={link.id ?? `${link.kind}-${index}`} type="button" onClick={() => openLink(link, interactive, track, openInternalCatalog)} className={`${radius} group flex min-h-[86px] w-[142px] shrink-0 flex-col items-start justify-between border p-3 text-left transition hover:-translate-y-.5 sm:w-[158px]`} style={surface(theme, index === 0 && mode === "links")}><span className="grid h-9 w-9 place-items-center rounded-2xl" style={{ background:rgba(theme.primary,.14), color:theme.primary }}><Icon className="h-4 w-4" /></span><span className="mt-3 line-clamp-2 text-xs font-black leading-tight">{link.label || meta.fallback}</span></button>; })}</div>{cards.length > 4 && <div className="pointer-events-none absolute inset-y-10 right-0 w-10 bg-gradient-to-l from-black/15 to-transparent sm:hidden" />}</div>;
}

function ProductSpotlight({ product, theme, radius, embedded, mode, cart, onOpen, onBook }: any) {
  if (!product) return null;
  const promo = product.promo_price != null && product.price != null && Number(product.promo_price) < Number(product.price);
  const variants = Array.isArray(product.variants) ? product.variants.filter((item:any) => item?.label) : [];
  const qty = cart.qtyOf(product.id);
  const add = () => variants.length ? onOpen() : cart.add(product.id);
  return <article className={`group relative overflow-hidden border ${radius} ${embedded ? "min-h-[300px]" : "min-h-[390px] sm:min-h-[450px]"}`} style={{ borderColor:rgba(theme.text,.12), boxShadow:`0 28px 90px ${rgba(theme.primary,.15)}` }}>{product.image_url ? <img src={product.image_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover transition duration-1000 group-hover:scale-[1.03]" /> : <div className="absolute inset-0" style={{ background:`linear-gradient(135deg,${rgba(theme.primary,.55)},${rgba(theme.accent,.18)},${theme.background})` }} />}<div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" /><div className="absolute left-4 top-4 flex gap-2"><span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[9px] font-black uppercase tracking-[.18em] text-white backdrop-blur-xl">Destaque</span>{promo && <span className="rounded-full px-3 py-1.5 text-[9px] font-black text-white" style={{ background:theme.primary }}>OFERTA</span>}</div><div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7"><div className="max-w-xl"><h3 className={`${embedded ? "text-2xl" : "text-3xl sm:text-4xl"} font-black leading-[1.02] tracking-[-.04em]`}>{product.name}</h3>{product.short_desc && <p className="mt-3 line-clamp-2 text-sm text-white/70">{product.short_desc}</p>}<div className="mt-4 flex items-end gap-3"><strong className="text-2xl font-black" style={{ color:theme.primary }}>{money(promo ? product.promo_price : product.price, product.currency ?? "BRL")}</strong>{promo && <span className="pb-1 text-sm text-white/40 line-through">{money(product.price, product.currency ?? "BRL")}</span>}</div><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={onOpen} className="rounded-full border border-white/20 bg-black/35 px-4 py-3 text-xs font-black backdrop-blur-xl">Ver detalhes</button>{mode === "booking" ? <button type="button" onClick={onBook} className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-xs font-black text-white" style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})` }}><CalendarDays className="h-4 w-4" />Agendar</button> : <button type="button" onClick={add} className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-xs font-black text-white" style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})` }}><ShoppingBag className="h-4 w-4" />{qty > 0 ? `${qty} na sacola` : variants.length ? "Escolher opção" : "Adicionar"}</button>}</div></div></div></article>;
}

function AutoProductRail({ products, theme, radius, motionEnabled, embedded, interactive, mode, cart, onOpen, onBook, onTrack }: any) {
  const ref = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const resumeTimer = useRef<number | null>(null);
  const items = products.length >= 3 ? [...products, ...products] : products;
  useEffect(() => {
    if (!motionEnabled || products.length < 3) return;
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now:number) => {
      const dt = Math.min(42, now-last); last = now;
      if (!paused.current && el.scrollWidth > el.clientWidth) {
        el.scrollLeft += dt * (embedded ? .035 : .055);
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [embedded, motionEnabled, products.length]);
  const pause = () => { paused.current = true; if (resumeTimer.current) window.clearTimeout(resumeTimer.current); };
  const resume = (delay=0) => { if (resumeTimer.current) window.clearTimeout(resumeTimer.current); resumeTimer.current = window.setTimeout(() => { paused.current = false; }, delay); };
  const scroll = (direction:number) => { pause(); ref.current?.scrollBy({ left: direction * 280, behavior:"smooth" }); resume(1100); };
  return <div className="relative"><div ref={ref} className="bc-v8-scroll flex gap-3 overflow-x-auto overscroll-x-contain pb-1" onPointerDown={pause} onPointerUp={() => resume(800)} onPointerCancel={() => resume(300)} onMouseEnter={pause} onMouseLeave={() => resume()} onTouchStart={pause} onTouchEnd={() => resume(800)}>{items.map((product:any,index:number) => <ProductCard key={`${product.id}-${index}`} product={product} theme={theme} radius={radius} embedded={embedded} interactive={interactive} mode={mode} cart={cart} onOpen={() => onOpen(product)} onBook={() => onBook(product)} onTrack={onTrack} />)}</div>{products.length > 2 && <><button type="button" onClick={() => scroll(-1)} className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border bg-black/45 text-white backdrop-blur-xl sm:grid" aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => scroll(1)} className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border bg-black/45 text-white backdrop-blur-xl sm:grid" aria-label="Próximo"><ChevronRight className="h-4 w-4" /></button></>}</div>;
}

function ProductCard({ product, theme, radius, embedded, interactive, mode, cart, onOpen, onBook, onTrack }: any) {
  const promo = product.promo_price != null && product.price != null && Number(product.promo_price) < Number(product.price);
  const out = product.stock_status === "out_of_stock";
  const variants = Array.isArray(product.variants) ? product.variants.filter((item:any) => item?.label) : [];
  const purchasable = !out && (product.promo_price != null || product.price != null);
  const qty = cart.qtyOf(product.id);
  const action = (event:React.MouseEvent) => { event.stopPropagation(); if (!interactive || out) return; if (mode === "booking") return onBook(); if (!purchasable) return onOpen(); if (variants.length) return onOpen(); cart.add(product.id); onTrack(`cart:add:${product.name}`, product.id); };
  return <article role="button" tabIndex={0} onClick={interactive ? onOpen : undefined} onKeyDown={(event) => { if (interactive && (event.key === "Enter" || event.key === " ")) onOpen(); }} className={`${embedded ? "w-[190px]" : "w-[72vw] max-w-[286px] sm:w-[276px]"} group relative shrink-0 cursor-pointer overflow-hidden ${radius}`} style={{ ...surface(theme,true), boxShadow:`0 20px 55px ${rgba(theme.primary,.1)}` }}><div className={`${embedded ? "h-36" : "h-52 sm:h-56"} relative overflow-hidden`}>{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" loading="lazy" /> : <div className="grid h-full place-items-center" style={{ background:`linear-gradient(135deg,${rgba(theme.primary,.24)},${rgba(theme.accent,.12)})` }}><ShoppingBag className="h-8 w-8 opacity-35" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />{promo && <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black text-white" style={{ background:theme.primary }}>OFERTA</span>}{out && <div className="absolute inset-0 grid place-items-center bg-black/55"><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-black">ESGOTADO</span></div>}<div className="absolute inset-x-3 bottom-3 text-white"><h3 className="line-clamp-2 text-base font-black leading-tight">{product.name}</h3><div className="mt-2 flex items-end gap-2"><strong className="text-lg leading-none">{money(promo ? product.promo_price : product.price, product.currency ?? "BRL")}</strong>{promo && <span className="text-[10px] text-white/55 line-through">{money(product.price, product.currency ?? "BRL")}</span>}</div></div></div><div className="flex min-h-[76px] items-center gap-2 p-3"><p className="line-clamp-2 min-w-0 flex-1 text-[11px] leading-relaxed opacity-65">{product.short_desc || (mode === "booking" ? "Toque para conhecer e agendar" : "Toque para ver detalhes")}</p>{!out && <button type="button" onClick={action} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-lg transition hover:scale-105 active:scale-95" style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})` }} aria-label={mode === "booking" ? `Agendar ${product.name}` : `Adicionar ${product.name}`}>{mode === "booking" ? <CalendarDays className="h-4 w-4" /> : qty > 0 ? <span className="text-xs font-black">{qty}</span> : <Plus className="h-5 w-5" />}</button>}</div></article>;
}

function ProductStoryModal({ products, index, setIndex, onClose, cart, theme, interactive, motionEnabled, mode, onBook, onTrack }: any) {
  const product = products[index];
  const [variant,setVariant] = useState<string | null>(null);
  const variants = Array.isArray(product.variants) ? product.variants.filter((item:any) => item?.label) : [];
  const out = product.stock_status === "out_of_stock";
  const purchasable = !out && (product.promo_price != null || product.price != null);
  const selectedPrice = unitPrice(product, variant);
  const promo = !variant && product.promo_price != null && product.price != null && Number(product.promo_price) < Number(product.price);
  const qty = cart.qtyOf(product.id, variant ?? undefined);
  useEffect(() => { setVariant(null); }, [product.id]);
  useEffect(() => { const old=document.body.style.overflow; document.body.style.overflow="hidden"; return () => { document.body.style.overflow=old; }; }, []);
  const go = (direction:number) => setIndex((index + direction + products.length) % products.length);
  const add = () => { if (!interactive || !purchasable) return; if (variants.length && !variant) return toast.info("Escolha uma opção antes de adicionar."); cart.add(product.id,1,variant ?? undefined); onTrack(`cart:add:${product.name}`,product.id); toast.success(`${product.name} adicionado à sacola.`); };
  return <motion.div className="fixed inset-0 z-[170] bg-black/92 sm:p-5" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}><div className="relative mx-auto grid h-[100dvh] w-full max-w-6xl grid-rows-[46dvh_minmax(0,1fr)] overflow-hidden bg-[#090909] text-white sm:h-[calc(100dvh-2.5rem)] sm:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)] sm:grid-rows-1 sm:rounded-[2.3rem] sm:border sm:border-white/10"><div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex gap-1.5 px-4 pt-3 sm:px-6 sm:pt-5">{products.slice(0,Math.min(products.length,8)).map((item:any,p:number) => <span key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"><span className={`block h-full rounded-full bg-white ${p < index ? "w-full" : p===index ? "w-3/4" : "w-0"}`} /></span>)}</div><div className="absolute inset-x-0 top-7 z-40 flex items-center justify-between px-4 sm:top-10 sm:px-6"><button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-black/40 backdrop-blur-xl"><X className="h-5 w-5" /></button><button onClick={() => interactive && navigator.share?.({ title:product.name, url:window.location.href }).catch(()=>undefined)} className="grid h-11 w-11 place-items-center rounded-full bg-black/40 backdrop-blur-xl"><Share2 className="h-5 w-5" /></button></div><motion.div key={product.id} drag={interactive ? "x" : false} dragConstraints={{ left:0,right:0 }} onDragEnd={(_,info) => { if (info.offset.x < -70) go(1); else if (info.offset.x > 70) go(-1); }} initial={motionEnabled ? { opacity:.25, scale:1.02 } : false} animate={{ opacity:1, scale:1 }} className="relative min-h-0 overflow-hidden bg-black">{product.video_url ? <video src={product.video_url} poster={product.video_poster_url ?? product.image_url ?? undefined} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" /> : product.image_url ? <img src={product.image_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 grid place-items-center" style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})` }}><ShoppingBag className="h-16 w-16 opacity-60" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20 sm:bg-gradient-to-r sm:from-transparent sm:via-transparent sm:to-black/55" />{products.length > 1 && <><button onClick={() => go(-1)} className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 sm:grid"><ChevronLeft className="h-5 w-5" /></button><button onClick={() => go(1)} className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/40 sm:grid"><ChevronRight className="h-5 w-5" /></button></>}</motion.div><div className="flex min-h-0 flex-col border-t border-white/10 bg-[#0c0c0c] sm:border-l sm:border-t-0"><div className="bc-v8-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-5 sm:px-8 sm:pt-24"><h2 className="text-2xl font-black leading-tight tracking-[-.025em] sm:text-3xl">{product.name}</h2>{(product.long_desc || product.short_desc) && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/70">{product.long_desc || product.short_desc}</p>}<div className="mt-5 flex flex-wrap items-end gap-3"><strong className="text-3xl font-black" style={{ color:theme.primary }}>{money(selectedPrice,product.currency ?? "BRL")}</strong>{promo && <span className="pb-1 text-sm text-white/35 line-through">{money(product.price,product.currency ?? "BRL")}</span>}</div>{variants.length > 0 && <div className="mt-6"><p className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-white/45">Escolha uma opção</p><div className="flex flex-wrap gap-2">{variants.map((item:any) => { const label=String(item?.label ?? ""); return <button key={label} onClick={() => setVariant(label)} className="rounded-full border px-3 py-2 text-xs font-bold" style={{ borderColor:variant===label ? theme.primary : "rgba(255,255,255,.16)", background:variant===label ? rgba(theme.primary,.22) : "transparent" }}>{label}{item?.price != null ? ` · ${money(Number(item.price),product.currency ?? "BRL")}` : ""}</button>; })}</div></div>}</div><div className="shrink-0 border-t border-white/10 bg-black/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl sm:px-8">{out ? <div className="rounded-full border border-white/15 px-5 py-4 text-center text-sm font-black text-white/60">Indisponível</div> : mode === "booking" ? <button onClick={() => onBook(product)} className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black text-white" style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})` }}><CalendarDays className="h-5 w-5" />Agendar este serviço</button> : purchasable ? <button onClick={add} className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black text-white" style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})` }}><ShoppingBag className="h-5 w-5" />{qty > 0 ? `Adicionar mais · ${qty} na sacola` : "Adicionar à sacola"}</button> : <div className="rounded-full border border-white/15 px-5 py-4 text-center text-sm font-bold text-white/70">Consulte a loja para saber o valor</div>}<p className="mt-2 text-center text-[10px] text-white/35 sm:hidden">Deslize para os lados para navegar</p></div></div></div></motion.div>;
}

function YouTubeShowcase({ link, theme, embedded, interactive, track }: any) {
  const getFeed = useServerFn(getPublicYouTubeFeed);
  const feed = useQuery({ queryKey:["bio-youtube",link.url], queryFn:() => getFeed({ data:{ url:String(link.url) } }), enabled:!!link.url && interactive, staleTime:20*60*1000, retry:false });
  const videos = feed.data?.videos ?? [];
  if (!videos.length) return <section className="mt-10"><SectionHeading eyebrow="YouTube" title={link.label || "Acompanhe nosso canal"} theme={theme} /><a href={interactive ? normalizeUrl("youtube",link.url) : undefined} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 rounded-[1.8rem] border p-5" style={surface(theme,true)}><span className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-600 text-white"><Youtube className="h-6 w-6" /></span><span><strong className="block text-sm">Ver canal no YouTube</strong><span className="text-xs opacity-55">Vídeos, novidades e conteúdos da marca</span></span></span><ChevronRight className="h-5 w-5 opacity-45" /></a></section>;
  return <section className="mt-10"><SectionHeading eyebrow="Últimos vídeos" title={feed.data?.title || link.label || "No YouTube"} theme={theme} /><div className="bc-v8-scroll flex gap-3 overflow-x-auto pb-1">{videos.slice(0,embedded ? 3 : 5).map((video:any) => <a key={video.id} href={interactive ? video.url : undefined} target="_blank" rel="noopener noreferrer" onClick={() => track(`youtube:${video.title}`,video.id)} className="group w-[76vw] max-w-[310px] shrink-0 overflow-hidden rounded-[1.7rem] border" style={surface(theme,true)}><div className="relative aspect-video overflow-hidden bg-black">{video.thumbnail && <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}<span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white shadow-xl"><Play className="h-5 w-5 fill-current" /></span></span></div><p className="line-clamp-2 p-3 text-sm font-black leading-tight">{video.title}</p></a>)}</div></section>;
}

function RichModule({ link, theme, radius, interactive }: any) {
  if (link.kind === "video") { const media=parseVideoUrl(link.data?.url || link.url); if (!media) return null; return <section className={`${radius} overflow-hidden`} style={surface(theme,true)}>{link.label && <p className="px-4 pt-4 text-xs font-black">{link.label}</p>}<div className="aspect-video">{media.embed ? <iframe src={media.embed} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : <video src={media.direct} controls playsInline className="h-full w-full object-cover" />}</div></section>; }
  if (link.kind === "spotify") { const src=parseSpotifyUrl(link.data?.url || link.url); return src ? <section className={`${radius} overflow-hidden p-2`} style={surface(theme,true)}><iframe src={src} className="h-[152px] w-full" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" /></section> : null; }
  if (link.kind === "gallery") { const images=Array.isArray(link.data?.images) ? link.data.images.filter(Boolean) : []; return images.length ? <section><div className="bc-v8-scroll flex gap-3 overflow-x-auto">{images.map((src:string,index:number) => <img key={`${src}-${index}`} src={src} alt="" className={`h-64 w-[78%] shrink-0 object-cover ${radius}`} loading="lazy" />)}</div></section> : null; }
  if (link.kind === "header_image") { const src=link.data?.image_url || link.url; if (!src) return null; const image=<img src={src} alt={link.label || "Banner"} className="h-52 w-full object-cover sm:h-64" />; return <section className={`${radius} overflow-hidden`} style={surface(theme,true)}>{link.data?.link_url && interactive ? <a href={normalizeUrl("custom",link.data.link_url)} target="_blank" rel="noopener noreferrer">{image}</a> : image}</section>; }
  return null;
}

function UtilityModule({ link, theme, radius }: any) {
  if (link.kind === "wifi") { const wifi=decodeWifi(link.url); return <div className={`${radius} p-4`} style={surface(theme,true)}><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background:rgba(theme.primary,.14),color:theme.primary }}><Wifi className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-black">Wi-Fi</p><p className="truncate text-xs opacity-60">{wifi.ssid || "Rede do estabelecimento"}</p></div></div>{wifi.password && <button onClick={() => { navigator.clipboard.writeText(wifi.password); toast.success("Senha copiada!"); }} className="mt-3 inline-flex items-center gap-2 text-xs font-bold"><Copy className="h-3.5 w-3.5" />Copiar senha</button>}</div>; }
  const pix=decodePix(link.url); return <div className={`${radius} p-4`} style={surface(theme,true)}><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background:rgba(theme.primary,.14),color:theme.primary }}><KeyRound className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-black">Pix</p><p className="truncate text-xs opacity-60">{pix.key || link.label}</p></div></div>{pix.key && <button onClick={() => { navigator.clipboard.writeText(pix.key); toast.success("Chave Pix copiada!"); }} className="mt-3 inline-flex items-center gap-2 text-xs font-bold"><Copy className="h-3.5 w-3.5" />Copiar chave</button>}</div>;
}

function SocialAction({ link, theme, interactive, track }: any) {
  const meta=KIND_META[link.kind] ?? KIND_META.custom; const Icon=meta.icon; return <a href={interactive ? normalizeUrl(link.kind,link.url) : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); else track(`social:${link.label || link.kind}`,link.id); }} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-black transition hover:-translate-y-.5" style={surface(theme)}><Icon className="h-4 w-4" style={{ color:theme.primary }} />{link.label || meta.fallback}</a>;
}

function FullCatalogOverlay({ mode, products, theme, experienceMode, cart, onClose, onOpen, onBook }: any) {
  useEffect(() => { const old=document.body.style.overflow; document.body.style.overflow="hidden"; return () => { document.body.style.overflow=old; }; }, []);
  return <motion.div className="fixed inset-0 z-[180] overflow-y-auto bg-black/90 text-white backdrop-blur-2xl" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}><div className="mx-auto min-h-dvh max-w-6xl px-3 pb-24 pt-4 sm:px-6"><div className="sticky top-3 z-30 flex items-center justify-between rounded-3xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-2xl"><div><p className="text-[9px] font-black uppercase tracking-[.22em]" style={{ color:theme.primary }}>Bio Commerce</p><h2 className="text-xl font-black">{mode === "menu" ? "Cardápio completo" : "Catálogo completo"}</h2></div><button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-white/15"><X className="h-5 w-5" /></button></div>{products.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{products.map((product:any) => { const promo=product.promo_price != null && product.price != null && Number(product.promo_price) < Number(product.price); const qty=cart.qtyOf(product.id); return <article key={product.id} className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[.055]"><button type="button" onClick={() => onOpen(product)} className="block w-full text-left"><div className="relative aspect-[4/5] overflow-hidden bg-white/5">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ShoppingBag className="h-8 w-8 opacity-30" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" /><div className="absolute inset-x-3 bottom-3"><h3 className="line-clamp-2 text-sm font-black">{product.name}</h3><strong className="mt-1 block text-sm" style={{ color:theme.primary }}>{money(promo ? product.promo_price : product.price,product.currency ?? "BRL")}</strong></div></div></button><div className="p-3"><p className="line-clamp-2 min-h-8 text-[11px] text-white/55">{product.short_desc || "Toque para ver detalhes."}</p><button onClick={() => experienceMode === "booking" ? onBook(product) : cart.add(product.id)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full px-3 py-2.5 text-xs font-black" style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})` }}>{experienceMode === "booking" ? <><CalendarDays className="h-4 w-4" />Agendar</> : <>{qty > 0 ? `${qty} na sacola` : <><Plus className="h-4 w-4" />Adicionar</>}</>}</button></div></article>; })}</div> : <div className="mt-14 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">Nenhum item publicado nesta vitrine.</div>}</div></motion.div>;
}

function CartDock({ count, total, theme, onOpen }: any) {
  return <motion.div initial={{ y:80,opacity:0 }} animate={{ y:0,opacity:1 }} exit={{ y:80,opacity:0 }} className="fixed inset-x-0 bottom-3 z-[120] px-3"><button onClick={onOpen} className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-full border px-5 py-3.5 text-sm font-black text-white shadow-[0_24px_70px_rgba(0,0,0,.4)]" style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})`, borderColor:rgba(theme.text,.12) }}><span className="inline-flex items-center gap-2"><ShoppingBag className="h-4 w-4" />{count} {count===1 ? "item" : "itens"}</span><span>Ver sacola · {money(total)}</span></button></motion.div>;
}

function CheckoutSheet({ slug, products, cart, theme, whatsapp, onClose, onTrack }: any) {
  const createOrder=useServerFn(createBioCommerceOrder); const [sending,setSending]=useState(false); const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [fulfillment,setFulfillment]=useState<"pickup"|"delivery">("pickup"); const [address,setAddress]=useState(""); const [note,setNote]=useState("");
  const detailed=useMemo(() => cart.lines.map((line:any) => { const product=products.find((item:any) => item.id===line.id); if(!product) return null; const unit=unitPrice(product,line.variant); return { product,qty:line.qty,variant:line.variant ?? null,unit,total:unit*line.qty }; }).filter(Boolean),[cart.lines,products]);
  const total=detailed.reduce((sum:number,line:any) => sum+line.total,0);
  const submit=async() => { if(name.trim().length<2) return toast.error("Informe seu nome para continuar."); if(fulfillment==="delivery" && address.trim().length<5) return toast.error("Informe o endereço de entrega."); if(!detailed.length) return toast.error("Sua sacola está vazia."); setSending(true); try { const result:any=await createOrder({ data:{ slug,customer_name:name.trim(),customer_phone:phone.trim()||null,fulfillment,address:address.trim()||null,note:note.trim()||null,items:cart.lines.map((line:any) => ({ item_id:line.id,qty:line.qty,variant_label:line.variant ?? null })) } }); const lines=result.lines.map((line:any)=>`• ${line.qty}x ${line.name}${line.variant_label ? ` (${line.variant_label})` : ""} — ${money(Number(line.line_total),result.currency)}`).join("\n"); const message=[`*Pedido #${result.order_number}* — ${result.establishment.name}`,"",lines,"",`*Total: ${money(Number(result.total),result.currency)}*`,"",`Nome: ${name.trim()}`,phone.trim()?`Telefone: ${phone.trim()}`:null,fulfillment==="delivery"?`Entrega: ${address.trim()}`:"Retirada no local",note.trim()?`Obs.: ${note.trim()}`:null,"","Pedido enviado pelo Bio Commerce Fidelize."].filter(Boolean).join("\n"); const number=String(result.establishment.whatsapp||result.establishment.phone||whatsapp||"").replace(/\D/g,""); onTrack(`order:${result.order_number}`); cart.clear(); onClose(); toast.success(`Pedido #${result.order_number} criado!`); if(number) window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,"_blank","noopener,noreferrer"); else toast.info("Pedido registrado, mas a loja ainda não cadastrou um WhatsApp."); } catch(error:any) { toast.error(error?.message ?? "Não foi possível enviar o pedido."); } finally { setSending(false); } };
  const field={ background:rgba(theme.text,.055), border:`1px solid ${rgba(theme.text,.12)}`, color:theme.text };
  return <motion.div className="fixed inset-0 z-[190] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} onClick={onClose}><motion.div initial={{ y:80,opacity:0 }} animate={{ y:0,opacity:1 }} exit={{ y:80,opacity:0 }} onClick={(e)=>e.stopPropagation()} className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border p-5 sm:rounded-[2rem] sm:p-6" style={{ ...surface(theme,true), background:theme.background, color:theme.text }}><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em]" style={{ color:theme.primary }}>Checkout Bio Commerce</p><h2 className="mt-1 text-2xl font-black">Sua sacola</h2></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full" style={surface(theme)}><X className="h-5 w-5" /></button></div><div className="mt-5 space-y-3">{detailed.map((line:any) => <div key={`${line.product.id}-${line.variant ?? ""}`} className="flex items-center gap-3 rounded-2xl p-2.5" style={surface(theme)}>{line.product.image_url ? <img src={line.product.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-xl"><ShoppingBag className="h-5 w-5" /></div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{line.product.name}</p><p className="text-xs opacity-60">{money(line.unit,line.product.currency ?? "BRL")}</p></div><div className="flex items-center gap-1"><button onClick={() => cart.setQty(line.product.id,line.qty-1,line.variant)} className="grid h-8 w-8 place-items-center rounded-full" style={surface(theme)}>{line.qty===1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}</button><span className="w-6 text-center text-xs font-black">{line.qty}</span><button onClick={() => cart.setQty(line.product.id,line.qty+1,line.variant)} className="grid h-8 w-8 place-items-center rounded-full" style={surface(theme)}><Plus className="h-3.5 w-3.5" /></button></div></div>)}</div><div className="mt-5 flex items-center justify-between border-t pt-4" style={{ borderColor:rgba(theme.text,.12) }}><span className="text-sm font-bold opacity-65">Total</span><strong className="text-2xl" style={{ color:theme.primary }}>{money(total)}</strong></div><div className="mt-5 grid gap-3"><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Seu nome" className="rounded-2xl px-4 py-3 text-sm outline-none" style={field} /><input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="Seu telefone (opcional)" className="rounded-2xl px-4 py-3 text-sm outline-none" style={field} /><div className="grid grid-cols-2 gap-2"><button onClick={()=>setFulfillment("pickup")} className="rounded-2xl border px-3 py-3 text-xs font-black" style={{ ...surface(theme), borderColor:fulfillment==="pickup"?theme.primary:rgba(theme.text,.12) }}>Retirar</button><button onClick={()=>setFulfillment("delivery")} className="rounded-2xl border px-3 py-3 text-xs font-black" style={{ ...surface(theme), borderColor:fulfillment==="delivery"?theme.primary:rgba(theme.text,.12) }}>Entrega</button></div>{fulfillment==="delivery" && <input value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Endereço de entrega" className="rounded-2xl px-4 py-3 text-sm outline-none" style={field} />}<textarea value={note} onChange={(e)=>setNote(e.target.value)} rows={3} placeholder="Observação do pedido" className="resize-none rounded-2xl px-4 py-3 text-sm outline-none" style={field} /></div><button onClick={submit} disabled={sending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black text-white disabled:opacity-60" style={{ background:`linear-gradient(135deg,${theme.primary},${theme.accent})` }}><MessageCircle className="h-5 w-5" />{sending ? "Concluindo…" : "Concluir e enviar no WhatsApp"}</button></motion.div></motion.div>;
}
