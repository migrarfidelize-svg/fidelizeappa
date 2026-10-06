import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  Facebook,
  Globe,
  Heart,
  Images as ImagesIcon,
  Instagram,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Music,
  Music2,
  Pause,
  Phone,
  Play,
  PlayCircle,
  Plus,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  UtensilsCrossed,
  Wifi,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createBioCommerceOrder } from "@/lib/bio-commerce-order.functions";
import {
  getBioCommerceNiche,
  resolveBioCommerceLandingTheme,
  type BioCommerceTheme,
} from "@/lib/bio-commerce-theme";
import { useCart } from "@/lib/cart";
import { trackChannelEvent } from "@/lib/tracking";

export type BioCommerceProduct = {
  id: string;
  menu_id?: string | null;
  name: string;
  short_desc: string | null;
  long_desc?: string | null;
  price: number | null;
  promo_price: number | null;
  currency?: string | null;
  image_url: string | null;
  video_url?: string | null;
  video_poster_url?: string | null;
  variants?: Array<{ label?: string | null; price?: number | null }> | null;
  stock_status?: string | null;
  gallery?: string[] | null;
  brand?: string | null;
  sku?: string | null;
};

export type BioCommerceReview = {
  id: string;
  rating: number | null;
  comment: string | null;
  merchant_reply: string | null;
  submitted_at: string | null;
  customer_name: string;
};

export type BioCommerceBlockData = {
  menu: BioCommerceProduct[];
  catalog: BioCommerceProduct[];
  reviews: BioCommerceReview[];
  stats: { count: number; avg: number } | null;
};

export type BioCommerceLandingData = {
  establishment: any;
  page: any;
  links?: any[];
};

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
  if (theme.card_style === "outline") {
    return { background: rgba(theme.background, strong ? 0.82 : 0.56), border: `1px solid ${rgba(theme.primary, 0.45)}` };
  }
  if (theme.card_style === "soft") {
    return { background: rgba(theme.text, strong ? 0.12 : 0.075), border: `1px solid ${rgba(theme.text, 0.08)}` };
  }
  if (theme.card_style === "elevated") {
    return { background: rgba(theme.background, strong ? 0.94 : 0.86), border: `1px solid ${rgba(theme.text, 0.1)}`, boxShadow: `0 20px 60px ${rgba(theme.primary, 0.12)}` };
  }
  return {
    background: rgba(theme.text, strong ? 0.105 : 0.065),
    border: `1px solid ${rgba(theme.text, 0.12)}`,
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  };
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
  const links = useMemo(() => (data.links ?? []).filter((link: any) => link.enabled !== false), [data.links]);
  const cover = page.cover_url ?? establishment.cover_url ?? null;
  const logo = page.logo_url ?? establishment.logo_url ?? null;
  const theme = resolveBioCommerceLandingTheme((page.theme ?? {}) as BioCommerceTheme, { links, establishment, cover });
  const niche = getBioCommerceNiche(theme.niche_id);
  const reducedMotion = useReducedMotion();
  const motionEnabled = theme.motion !== "none" && !reducedMotion;
  const title = page.title || establishment.name || "Seu negócio";
  const description = page.description || establishment.description || niche.eyebrow;
  const cart = useCart(slug || establishment.slug || "bio-commerce");
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const showcaseRef = useRef<HTMLElement | null>(null);

  const explicitShowcase = links.find((link: any) => link.kind === "menu_carousel");
  const requestedSource = explicitShowcase?.data?.source === "catalog"
    ? "catalog"
    : explicitShowcase?.data?.source === "menu"
      ? "menu"
      : niche.preferred_source;

  const menuProducts = useMemo(() => (blockData.menu ?? []).filter((item) => item.stock_status !== "out_of_stock" || item.price != null), [blockData.menu]);
  const catalogProducts = useMemo(() => (blockData.catalog ?? []).filter((item) => item.stock_status !== "out_of_stock" || item.price != null), [blockData.catalog]);
  const preferred = requestedSource === "menu" ? menuProducts : catalogProducts;
  const fallback = requestedSource === "menu" ? catalogProducts : menuProducts;
  const primaryProducts = (preferred.length ? preferred : fallback).slice(0, 14);
  const primarySource = preferred.length ? requestedSource : requestedSource === "menu" ? "catalog" : "menu";
  const secondaryProducts = (primarySource === "menu" ? catalogProducts : menuProducts).slice(0, 12);
  const allProducts = useMemo(() => {
    const seen = new Set<string>();
    return [...menuProducts, ...catalogProducts].filter((product) => {
      if (seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    });
  }, [menuProducts, catalogProducts]);

  const showcaseTitle = explicitShowcase?.label || niche.showcase_title;
  const reviews = (blockData.reviews ?? []).filter((review) => (review.rating ?? 0) >= 4).slice(0, 4);
  const richLinks = links.filter((link: any) => RICH_KINDS.has(link.kind) && !["menu_carousel", "reviews"].includes(link.kind));

  const findLink = (...kinds: string[]) => links.find((link: any) => kinds.includes(link.kind));
  const whatsappLink = findLink("whatsapp") ?? (establishment.whatsapp ? { id: "est-whatsapp", kind: "whatsapp", label: "WhatsApp", url: establishment.whatsapp } : null);
  const fallbackPrimary = niche.id === "events"
    ? findLink("custom", "site", "whatsapp")
    : findLink("whatsapp", "custom", "site", "phone", "cardapio");

  const quickKinds = ["cardapio", "google", "maps", "cartao", "instagram", "whatsapp", "site", "phone"];
  const quickLinks = links.filter((link: any) => quickKinds.includes(link.kind) && link !== fallbackPrimary).slice(0, 4);
  const socialLinks = links.filter((link: any) => ["instagram", "facebook", "tiktok", "youtube", "email"].includes(link.kind)).slice(0, 5);
  const utilities = links.filter((link: any) => link.kind === "wifi" || link.kind === "pix");
  const secondaryActions = links
    .filter((link: any) => !RICH_KINDS.has(link.kind) && !quickLinks.includes(link) && link !== fallbackPrimary && !["wifi", "pix"].includes(link.kind))
    .slice(0, 4);

  const radius = theme.rounded === "full" ? "rounded-[2rem]" : theme.rounded === "sm" ? "rounded-xl" : theme.rounded === "md" ? "rounded-2xl" : "rounded-3xl";
  const container = theme.content_width === "wide" ? "max-w-6xl" : theme.content_width === "compact" ? "max-w-3xl" : "max-w-5xl";
  const fontClass = theme.font_style === "editorial" ? "font-serif" : "font-sans";

  const track = (label: string, id?: string | null) => {
    if (!interactive) return;
    trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: id ?? null, ref_label: label });
  };

  const openStory = (product: BioCommerceProduct) => {
    const index = allProducts.findIndex((item) => item.id === product.id);
    if (index < 0) return;
    setStoryIndex(index);
    track(`product:${product.name}`, product.id);
  };

  const scrollToShowcase = () => {
    if (!interactive) return;
    showcaseRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    track("cta:showcase");
  };

  const heroHeight = embedded ? "min-h-[500px]" : "min-h-[620px] sm:min-h-[680px]";
  const showCommerceCta = primaryProducts.length > 0;

  return (
    <div className={`${fontClass} relative overflow-x-hidden ${embedded ? "min-h-full" : "min-h-dvh"}`} style={{ background: theme.background, color: theme.text }}>
      <Ambient theme={theme} motionEnabled={motionEnabled} embedded={embedded} />
      <style>{`
        .bc-no-scrollbar::-webkit-scrollbar{display:none}.bc-no-scrollbar{scrollbar-width:none}
        .bc-hero-grain{background-image:radial-gradient(circle at 1px 1px,currentColor 1px,transparent 0);background-size:24px 24px}
      `}</style>

      <div className={`relative z-10 mx-auto ${container} ${embedded ? "px-2 pb-8 pt-2" : "px-3 pb-28 pt-3 sm:px-6 sm:pt-6 lg:px-8"}`}>
        <motion.section initial={motionEnabled ? { opacity: 0, y: 18 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionEnabled ? 0.45 : 0 }}>
          <div className={`relative isolate overflow-hidden border ${radius} ${heroHeight}`} style={{ borderColor: rgba(theme.text, 0.12), boxShadow: `0 36px 110px ${rgba(theme.primary, 0.22)}` }}>
            {cover ? (
              <motion.img
                src={cover}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                initial={false}
                animate={motionEnabled ? { scale: [1.01, 1.05, 1.01] } : undefined}
                transition={motionEnabled ? { duration: 18, repeat: Infinity, ease: "easeInOut" } : undefined}
              />
            ) : (
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg,${rgba(theme.primary, 0.45)},${rgba(theme.accent, 0.18)} 48%,${theme.background})` }} />
            )}
            <div className="absolute inset-0" style={{ background: cover ? `linear-gradient(180deg,${rgba(theme.background, 0.06)} 0%,${rgba(theme.background, 0.12)} 24%,${rgba(theme.background, 0.64)} 64%,${theme.background} 100%)` : `linear-gradient(180deg,transparent,${rgba(theme.background, 0.92)})` }} />
            <div className="bc-hero-grain absolute inset-0 opacity-[0.05]" style={{ color: theme.text }} />

            <div className={`relative z-10 flex ${heroHeight} flex-col justify-between ${embedded ? "p-5" : "p-5 sm:p-8 lg:p-10"}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.22em] backdrop-blur-xl" style={{ borderColor: rgba(theme.text, 0.2), background: rgba(theme.background, 0.3) }}>{niche.eyebrow}</span>
                <button type="button" aria-label="Compartilhar" onClick={() => interactive && navigator.share?.({ title, url: window.location.href }).catch(() => undefined)} className="grid h-10 w-10 place-items-center rounded-full border backdrop-blur-xl" style={{ borderColor: rgba(theme.text, 0.18), background: rgba(theme.background, 0.28) }}><Share2 className="h-4 w-4" /></button>
              </div>

              <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
                <div className="relative">
                  {logo ? (
                    <img src={logo} alt={title} className={`${embedded ? "h-24 w-24" : "h-28 w-28 sm:h-32 sm:w-32"} rounded-[2rem] border object-cover shadow-2xl`} style={{ borderColor: rgba(theme.text, 0.26), boxShadow: `0 22px 68px ${rgba(theme.primary, 0.34)}` }} />
                  ) : (
                    <div className={`${embedded ? "h-24 w-24" : "h-28 w-28 sm:h-32 sm:w-32"} grid place-items-center rounded-[2rem] border text-4xl font-black text-white shadow-2xl`} style={{ borderColor: rgba(theme.text, 0.2), background: `linear-gradient(135deg,${theme.primary},${theme.accent})` }}>{String(title)[0]?.toUpperCase() || "F"}</div>
                  )}
                  <span title="Perfil Fidelize" aria-label="Perfil Fidelize" className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-[3px] border-white bg-[#1689ff] text-white shadow-[0_8px_24px_rgba(22,137,255,.45)]">
                    <BadgeCheck className="h-5 w-5 fill-white text-[#1689ff]" />
                  </span>
                </div>

                <h1 className={`${embedded ? "mt-5 text-3xl" : "mt-6 text-4xl sm:text-6xl"} font-black tracking-[-0.04em]`}>{title}</h1>
                <p className={`mx-auto mt-3 max-w-xl ${embedded ? "text-xs" : "text-sm sm:text-base"} leading-relaxed opacity-85`}>{description}</p>

                {blockData.stats && blockData.stats.count > 0 && (
                  <div className="mt-4 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs backdrop-blur-xl" style={{ borderColor: rgba(theme.text, 0.14), background: rgba(theme.background, 0.32) }}>
                    <Star className="h-3.5 w-3.5" style={{ fill: theme.primary, color: theme.primary }} />
                    <strong>{blockData.stats.avg.toFixed(1)}</strong>
                    <span className="opacity-60">({blockData.stats.count} avaliações)</span>
                  </div>
                )}

                {showCommerceCta ? (
                  <button type="button" onClick={scrollToShowcase} className={`${embedded ? "mt-5" : "mt-6"} group flex w-full max-w-md items-center justify-center gap-3 rounded-full px-5 py-4 text-sm font-black text-white shadow-2xl transition hover:-translate-y-0.5`} style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})`, boxShadow: `0 20px 55px ${rgba(theme.primary, 0.32)}` }}>
                    <ShoppingBag className="h-5 w-5" /> {niche.primary_cta}<ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </button>
                ) : fallbackPrimary ? (
                  <ActionAnchor link={fallbackPrimary} label={niche.primary_cta} theme={theme} interactive={interactive} onTrack={() => track(`link:${fallbackPrimary.label}`, fallbackPrimary.id)} prominent className={`${embedded ? "mt-5" : "mt-6"} w-full max-w-md`} />
                ) : null}

                {whatsappLink && showCommerceCta && (
                  <a href={interactive ? normalizeUrl("whatsapp", whatsappLink.url) : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); else track("whatsapp:hero", whatsappLink.id); }} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold backdrop-blur-xl" style={{ borderColor: rgba(theme.text, 0.18), background: rgba(theme.background, 0.3) }}><MessageCircle className="h-4 w-4" /> Falar com a loja</a>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {quickLinks.length > 0 && (
          <motion.section initial={motionEnabled ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionEnabled ? 0.08 : 0 }} className={`mt-4 grid gap-2 ${quickLinks.length >= 4 ? "grid-cols-4" : quickLinks.length === 3 ? "grid-cols-3" : quickLinks.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
            {quickLinks.map((link: any) => <QuickAction key={link.id ?? `${link.kind}-${link.label}`} link={link} theme={theme} radius={radius} interactive={interactive} onTrack={() => track(`quick:${link.label}`, link.id)} />)}
          </motion.section>
        )}

        {primaryProducts.length > 0 && (
          <motion.section ref={showcaseRef as any} id="bio-commerce-vitrine" initial={motionEnabled ? { opacity: 0, y: 18 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionEnabled ? 0.14 : 0 }} className="scroll-mt-6 pt-8">
            <SectionHeading title={showcaseTitle} eyebrow={primarySource === "menu" ? "Destaques do cardápio" : "Destaques da loja"} theme={theme} />
            <AutoProductRail products={primaryProducts} theme={theme} radius={radius} motionEnabled={motionEnabled && theme.product_style === "carousel"} embedded={embedded} interactive={interactive} cart={cart} onOpen={openStory} onTrack={track} />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a href={primarySource === "menu" ? `/cardapio/${slug}` : `/catalogo/${slug}`} className="inline-flex items-center gap-1 text-xs font-bold opacity-70 transition hover:opacity-100">{primarySource === "menu" ? "Ver cardápio completo" : "Ver catálogo completo"}<ChevronRight className="h-3.5 w-3.5" /></a>
              <span className="text-[10px] opacity-40">Toque em um produto para ver em tela cheia</span>
            </div>
          </motion.section>
        )}

        {secondaryProducts.length > 0 && (
          <section className="mt-9">
            <SectionHeading title={primarySource === "menu" ? "Produtos da loja" : "Mais para você"} eyebrow={primarySource === "menu" ? "Catálogo integrado" : "Cardápio integrado"} theme={theme} />
            <AutoProductRail products={secondaryProducts} theme={theme} radius={radius} motionEnabled={motionEnabled} embedded={embedded} interactive={interactive} cart={cart} onOpen={openStory} onTrack={track} />
            <a href={primarySource === "menu" ? `/catalogo/${slug}` : `/cardapio/${slug}`} className="mt-4 inline-flex items-center gap-1 text-xs font-bold opacity-70 transition hover:opacity-100">{primarySource === "menu" ? "Ver catálogo completo" : "Ver cardápio completo"}<ChevronRight className="h-3.5 w-3.5" /></a>
          </section>
        )}

        {richLinks.length > 0 && (
          <section className={`mt-9 grid gap-4 ${theme.layout === "bento" ? "md:grid-cols-2" : ""}`}>
            {richLinks.map((link: any, index: number) => (
              <motion.div key={link.id ?? index} initial={motionEnabled ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionEnabled ? 0.18 + index * 0.04 : 0 }} className={link.kind === "header_image" ? "md:col-span-2" : ""}>
                <RichModule link={link} theme={theme} radius={radius} interactive={interactive} />
              </motion.div>
            ))}
          </section>
        )}

        {reviews.length > 0 && (
          <motion.section initial={motionEnabled ? { opacity: 0, y: 18 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionEnabled ? 0.22 : 0 }} className="mt-10">
            <SectionHeading title="Quem compra, recomenda" eyebrow="Prova social" theme={theme} />
            <div className="grid gap-3 md:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.id} className={`${radius} p-4 sm:p-5`} style={surface(theme, true)}>
                  <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((value) => <Star key={value} className="h-3.5 w-3.5" style={{ color: theme.primary, fill: (review.rating ?? 0) >= value ? theme.primary : "transparent" }} />)}</div>
                  {review.comment && <p className="mt-3 text-sm leading-relaxed opacity-85">“{review.comment}”</p>}
                  <p className="mt-3 text-xs font-black opacity-65">{review.customer_name}</p>
                </article>
              ))}
            </div>
          </motion.section>
        )}

        {(utilities.length > 0 || secondaryActions.length > 0) && (
          <section className="mt-10">
            <SectionHeading title="Tudo em um só lugar" eyebrow="Facilidades" theme={theme} />
            <div className="grid gap-3 sm:grid-cols-2">
              {secondaryActions.map((link: any) => <ActionAnchor key={link.id ?? `${link.kind}-${link.label}`} link={link} theme={theme} interactive={interactive} onTrack={() => track(`link:${link.label}`, link.id)} />)}
              {utilities.map((link: any) => <UtilityModule key={link.id ?? link.kind} link={link} theme={theme} radius={radius} />)}
            </div>
          </section>
        )}

        {socialLinks.length > 0 && (
          <section className="mt-10 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] opacity-45">Conecte-se com a gente</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{socialLinks.map((link: any) => <SocialAction key={link.id ?? link.kind} link={link} theme={theme} interactive={interactive} onTrack={() => track(`social:${link.label}`, link.id)} />)}</div>
          </section>
        )}

        <footer className={`${embedded ? "mt-8" : "mt-14"} flex items-center justify-center gap-2 pb-4 text-[9px] font-black uppercase tracking-[0.26em] opacity-45`}><Sparkles className="h-3 w-3" /> Bio Commerce by Fidelize</footer>
      </div>

      {!embedded && interactive && cart.count > 0 && (
        <CartDock count={cart.count} total={cart.lines.reduce((sum, line) => {
          const product = allProducts.find((item) => item.id === line.id);
          return sum + (product ? unitPrice(product, line.variant) * line.qty : 0);
        }, 0)} theme={theme} onOpen={() => setCartOpen(true)} />
      )}

      <AnimatePresence>
        {storyIndex != null && allProducts[storyIndex] && (
          <ProductStoryModal
            key={allProducts[storyIndex].id}
            products={allProducts}
            index={storyIndex}
            setIndex={setStoryIndex}
            onClose={() => setStoryIndex(null)}
            cart={cart}
            theme={theme}
            interactive={interactive}
            motionEnabled={motionEnabled}
            onTrack={track}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartOpen && !embedded && (
          <CheckoutSheet
            slug={slug}
            products={allProducts}
            cart={cart}
            theme={theme}
            whatsapp={String(establishment.whatsapp ?? whatsappLink?.url ?? "")}
            onClose={() => setCartOpen(false)}
            onTrack={track}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Ambient({ theme, motionEnabled, embedded }: { theme: any; motionEnabled: boolean; embedded: boolean }) {
  if (theme.background_effect === "solid") return null;
  return (
    <div className={`${embedded ? "absolute" : "fixed"} pointer-events-none inset-0 z-0 overflow-hidden`} aria-hidden="true">
      <motion.div className="absolute -left-24 -top-28 h-[26rem] w-[26rem] rounded-full blur-3xl" style={{ background: rgba(theme.primary, 0.2) }} animate={motionEnabled ? { x: [0, 24, -14, 0], y: [0, -16, 14, 0], scale: [1, 1.08, 0.97, 1] } : undefined} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute -right-24 top-[30%] h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: rgba(theme.accent, 0.16) }} animate={motionEnabled ? { x: [0, -20, 15, 0], y: [0, 22, -12, 0] } : undefined} transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }} />
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px,currentColor 1px,transparent 0)", backgroundSize: "22px 22px", color: theme.text }} />
    </div>
  );
}

function SectionHeading({ title, eyebrow, theme }: { title: string; eyebrow: string; theme: any }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: theme.primary }}>{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black tracking-[-0.02em] sm:text-2xl">{title}</h2>
      </div>
      <Sparkles className="h-5 w-5 opacity-35" />
    </div>
  );
}

function ActionAnchor({ link, label, theme, interactive, onTrack, prominent = false, className = "" }: { link: any; label?: string; theme: any; interactive: boolean; onTrack: () => void; prominent?: boolean; className?: string }) {
  const meta = KIND_META[link.kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  const href = normalizeUrl(link.kind, link.url);
  const style = prominent
    ? { background: `linear-gradient(135deg,${theme.primary},${theme.accent})`, color: "white", boxShadow: `0 18px 48px ${rgba(theme.primary, 0.28)}` }
    : surface(theme);
  return (
    <a href={interactive ? href : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); else onTrack(); }} target={href.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className={`${className} group flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left transition duration-300 hover:-translate-y-0.5`} style={style}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: prominent ? "rgba(255,255,255,.16)" : rgba(theme.primary, 0.14), color: prominent ? "white" : theme.primary }}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{label || link.label || meta.fallback}</span>{link.data?.description && <span className="block truncate text-[11px] opacity-65">{link.data.description}</span>}</span>
      <ChevronRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-1" />
    </a>
  );
}

function QuickAction({ link, theme, radius, interactive, onTrack }: { link: any; theme: any; radius: string; interactive: boolean; onTrack: () => void }) {
  const meta = KIND_META[link.kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  const href = normalizeUrl(link.kind, link.url);
  return (
    <a href={interactive ? href : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); else onTrack(); }} target={href.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className={`flex min-w-0 flex-col items-center justify-center gap-2 px-2 py-3 text-center transition hover:-translate-y-0.5 ${radius}`} style={surface(theme)}>
      <span className="grid h-9 w-9 place-items-center rounded-2xl" style={{ background: rgba(theme.primary, 0.14), color: theme.primary }}><Icon className="h-4 w-4" /></span>
      <span className="w-full truncate text-[9px] font-black sm:text-[10px]">{link.label || meta.fallback}</span>
    </a>
  );
}

function AutoProductRail({ products, theme, radius, motionEnabled, embedded, interactive, cart, onOpen, onTrack }: { products: BioCommerceProduct[]; theme: any; radius: string; motionEnabled: boolean; embedded: boolean; interactive: boolean; cart: ReturnType<typeof useCart>; onOpen: (product: BioCommerceProduct) => void; onTrack: (label: string, id?: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const items = products.length >= 3 ? [...products, ...products] : products;

  useEffect(() => {
    if (!motionEnabled || products.length < 3) return;
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;
      if (!paused.current && el.scrollWidth > el.clientWidth) {
        el.scrollLeft += dt * (embedded ? 0.018 : 0.024);
        const halfway = el.scrollWidth / 2;
        if (el.scrollLeft >= halfway) el.scrollLeft -= halfway;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [embedded, motionEnabled, products.length]);

  return (
    <div
      ref={ref}
      className="bc-no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
      onPointerDown={() => { paused.current = true; }}
      onPointerUp={() => { window.setTimeout(() => { paused.current = false; }, 900); }}
      onPointerCancel={() => { paused.current = false; }}
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      {items.map((product, index) => (
        <ProductCard key={`${product.id}-${index}`} product={product} theme={theme} radius={radius} embedded={embedded} interactive={interactive} cart={cart} onOpen={() => onOpen(product)} onTrack={onTrack} />
      ))}
    </div>
  );
}

function ProductCard({ product, theme, radius, embedded, interactive, cart, onOpen, onTrack }: { product: BioCommerceProduct; theme: any; radius: string; embedded: boolean; interactive: boolean; cart: ReturnType<typeof useCart>; onOpen: () => void; onTrack: (label: string, id?: string | null) => void }) {
  const promo = product.promo_price != null && product.price != null && Number(product.promo_price) < Number(product.price);
  const out = product.stock_status === "out_of_stock";
  const variants = Array.isArray(product.variants) ? product.variants.filter((item) => item?.label) : [];
  const purchasable = !out && (product.promo_price != null || product.price != null);
  const qty = cart.qtyOf(product.id);

  const add = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!interactive || !purchasable) return;
    if (variants.length) {
      onOpen();
      return;
    }
    cart.add(product.id);
    onTrack(`cart:add:${product.name}`, product.id);
  };

  return (
    <article role="button" tabIndex={0} onClick={interactive ? onOpen : undefined} onKeyDown={(event) => { if (interactive && (event.key === "Enter" || event.key === " ")) onOpen(); }} className={`${embedded ? "w-[190px]" : "w-[72vw] max-w-[280px] sm:w-[270px]"} group relative shrink-0 snap-start cursor-pointer overflow-hidden ${radius}`} style={{ ...surface(theme, true), boxShadow: `0 20px 55px ${rgba(theme.primary, 0.1)}` }}>
      <div className={`${embedded ? "h-36" : "h-52 sm:h-56"} relative overflow-hidden`}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center" style={{ background: `linear-gradient(135deg,${rgba(theme.primary, 0.24)},${rgba(theme.accent, 0.12)})` }}><ShoppingBag className="h-8 w-8 opacity-35" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        {promo && <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black text-white" style={{ background: theme.primary }}>OFERTA</span>}
        {product.video_url && <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur"><Play className="h-3.5 w-3.5 fill-current" /></span>}
        {out && <div className="absolute inset-0 grid place-items-center bg-black/55"><span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-black">ESGOTADO</span></div>}
        <div className="absolute inset-x-3 bottom-3 text-white">
          {product.brand && <p className="mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-white/65">{product.brand}</p>}
          <h3 className="line-clamp-2 text-base font-black leading-tight">{product.name}</h3>
          <div className="mt-2 flex items-end gap-2">
            <strong className="text-lg leading-none">{money(promo ? product.promo_price : product.price, product.currency ?? "BRL")}</strong>
            {promo && <span className="text-[10px] text-white/55 line-through">{money(product.price, product.currency ?? "BRL")}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] leading-relaxed opacity-65">{product.short_desc || "Toque para ver detalhes"}</p>
        </div>
        {purchasable && (
          <button type="button" onClick={add} aria-label={qty > 0 ? `Adicionar mais ${product.name}` : `Adicionar ${product.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-lg transition hover:scale-105 active:scale-95" style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})` }}>
            {qty > 0 ? <span className="text-xs font-black">{qty}</span> : <Plus className="h-5 w-5" />}
          </button>
        )}
      </div>
    </article>
  );
}

function ProductStoryModal({ products, index, setIndex, onClose, cart, theme, interactive, motionEnabled, onTrack }: { products: BioCommerceProduct[]; index: number; setIndex: (index: number | null) => void; onClose: () => void; cart: ReturnType<typeof useCart>; theme: any; interactive: boolean; motionEnabled: boolean; onTrack: (label: string, id?: string | null) => void }) {
  const product = products[index];
  const [paused, setPaused] = useState(false);
  const [variant, setVariant] = useState<string | null>(null);
  const variants = Array.isArray(product.variants) ? product.variants.filter((item) => item?.label) : [];
  const out = product.stock_status === "out_of_stock";
  const purchasable = !out && (product.promo_price != null || product.price != null);
  const selectedPrice = unitPrice(product, variant);
  const promo = !variant && product.promo_price != null && product.price != null && Number(product.promo_price) < Number(product.price);
  const qty = cart.qtyOf(product.id, variant ?? (variants.length ? null : undefined));

  useEffect(() => {
    setVariant(variants.length ? null : undefined as any);
  }, [product.id]);

  const go = (direction: number) => {
    const next = (index + direction + products.length) % products.length;
    setIndex(next);
  };

  const add = () => {
    if (!interactive || !purchasable) return;
    if (variants.length && !variant) {
      toast.info("Escolha uma opção antes de adicionar.");
      return;
    }
    cart.add(product.id, 1, variant ?? undefined);
    onTrack(`cart:add:${product.name}`, product.id);
    toast.success(`${product.name} adicionado à sacola.`);
  };

  return (
    <motion.div className="fixed inset-0 z-[120] bg-black/90 sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="relative mx-auto h-full w-full max-w-6xl overflow-hidden bg-[#090909] text-white sm:rounded-[2.3rem] sm:border sm:border-white/10 sm:shadow-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex gap-1.5 px-4 pt-3 sm:px-6 sm:pt-5">
          {products.slice(0, Math.min(products.length, 8)).map((item, progressIndex) => (
            <span key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"><span className={`block h-full rounded-full bg-white transition-all ${progressIndex < index ? "w-full" : progressIndex === index ? "w-3/4" : "w-0"}`} /></span>
          ))}
        </div>

        <div className="absolute inset-x-0 top-7 z-30 flex items-center justify-between px-4 sm:top-10 sm:px-6">
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-xl" aria-label="Fechar"><X className="h-5 w-5" /></button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPaused((value) => !value)} className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-xl" aria-label={paused ? "Continuar" : "Pausar"}>{paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</button>
            <button type="button" onClick={() => interactive && navigator.share?.({ title: product.name, url: window.location.href }).catch(() => undefined)} className="grid h-11 w-11 place-items-center rounded-full bg-black/35 backdrop-blur-xl" aria-label="Compartilhar"><Share2 className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="grid h-full grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(340px,.75fr)]">
          <motion.div key={product.id} drag={interactive ? "x" : false} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (info.offset.x < -70) go(1); else if (info.offset.x > 70) go(-1); }} initial={motionEnabled ? { opacity: 0.2, scale: 1.02 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ duration: motionEnabled ? 0.28 : 0 }} className="relative min-h-[58vh] overflow-hidden bg-black sm:min-h-0">
            {product.video_url && !paused ? (
              <video src={product.video_url} poster={product.video_poster_url ?? product.image_url ?? undefined} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" />
            ) : product.image_url ? (
              <img src={product.image_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center" style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})` }}><ShoppingBag className="h-16 w-16 opacity-60" /></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20 sm:bg-gradient-to-r sm:from-transparent sm:via-transparent sm:to-black/55" />
            {products.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Produto anterior" className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 backdrop-blur sm:grid"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" onClick={() => go(1)} aria-label="Próximo produto" className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 backdrop-blur sm:grid"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
          </motion.div>

          <div className="relative z-10 -mt-16 flex min-h-0 flex-col rounded-t-[2rem] border-t border-white/10 bg-black/80 p-5 backdrop-blur-2xl sm:mt-0 sm:rounded-none sm:border-l sm:border-t-0 sm:bg-[#0c0c0c] sm:p-8 sm:pt-24">
            <div className="flex items-start gap-3">
              {product.image_url && <img src={product.image_url} alt="" className="h-14 w-14 rounded-2xl border border-white/15 object-cover" />}
              <div className="min-w-0 flex-1">
                {product.brand && <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45">{product.brand}</p>}
                <h2 className="text-2xl font-black leading-tight tracking-[-0.025em] sm:text-3xl">{product.name}</h2>
              </div>
              <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/75"><Heart className="h-5 w-5" /></button>
            </div>

            {(product.long_desc || product.short_desc) && <p className="mt-5 text-sm leading-relaxed text-white/70">{product.long_desc || product.short_desc}</p>}

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <strong className="text-3xl font-black" style={{ color: theme.primary }}>{money(selectedPrice, product.currency ?? "BRL")}</strong>
              {promo && <span className="pb-1 text-sm text-white/35 line-through">{money(product.price, product.currency ?? "BRL")}</span>}
            </div>

            {variants.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Escolha uma opção</p>
                <div className="flex flex-wrap gap-2">
                  {variants.map((item) => {
                    const label = String(item?.label ?? "");
                    return <button key={label} type="button" onClick={() => setVariant(label)} className={`rounded-full border px-3 py-2 text-xs font-bold transition ${variant === label ? "text-white" : "text-white/70"}`} style={{ borderColor: variant === label ? theme.primary : "rgba(255,255,255,.16)", background: variant === label ? rgba(theme.primary, 0.22) : "transparent" }}>{label}{item?.price != null ? ` · ${money(Number(item.price), product.currency ?? "BRL")}` : ""}</button>;
                  })}
                </div>
              </div>
            )}

            <div className="mt-auto pt-6">
              {out ? (
                <div className="rounded-full border border-white/15 px-5 py-4 text-center text-sm font-black text-white/60">Produto indisponível</div>
              ) : purchasable ? (
                <button type="button" onClick={add} className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black text-white shadow-2xl transition active:scale-[.98]" style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})`, boxShadow: `0 18px 48px ${rgba(theme.primary, 0.3)}` }}><ShoppingBag className="h-5 w-5" />{qty > 0 ? `Adicionar mais · ${qty} na sacola` : "Adicionar à sacola"}</button>
              ) : (
                <div className="rounded-full border border-white/15 px-5 py-4 text-center text-sm font-bold text-white/70">Consulte a loja para saber o valor</div>
              )}
              <p className="mt-3 text-center text-[10px] text-white/40 sm:hidden">Deslize para os lados para ver outros produtos</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CartDock({ count, total, theme, onOpen }: { count: number; total: number; theme: any; onOpen: () => void }) {
  return (
    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="fixed inset-x-0 bottom-3 z-[90] px-3 sm:bottom-5">
      <button type="button" onClick={onOpen} className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 rounded-full border px-5 py-3.5 text-sm font-black text-white shadow-[0_24px_70px_rgba(0,0,0,.4)] backdrop-blur-xl" style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})`, borderColor: rgba(theme.text, 0.12) }}>
        <span className="inline-flex items-center gap-2"><ShoppingBag className="h-4 w-4" />{count} {count === 1 ? "item" : "itens"}</span>
        <span>Ver sacola · {money(total)}</span>
      </button>
    </motion.div>
  );
}

function CheckoutSheet({ slug, products, cart, theme, whatsapp, onClose, onTrack }: { slug: string; products: BioCommerceProduct[]; cart: ReturnType<typeof useCart>; theme: any; whatsapp: string; onClose: () => void; onTrack: (label: string, id?: string | null) => void }) {
  const createOrder = useServerFn(createBioCommerceOrder);
  const [sending, setSending] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const detailed = useMemo(() => cart.lines.map((line) => {
    const product = products.find((item) => item.id === line.id);
    if (!product) return null;
    const unit = unitPrice(product, line.variant);
    return { product, qty: line.qty, variant: line.variant ?? null, unit, total: unit * line.qty };
  }).filter(Boolean) as Array<{ product: BioCommerceProduct; qty: number; variant: string | null; unit: number; total: number }>, [cart.lines, products]);

  const total = detailed.reduce((sum, line) => sum + line.total, 0);

  const submit = async () => {
    if (name.trim().length < 2) return toast.error("Informe seu nome para continuar.");
    if (fulfillment === "delivery" && address.trim().length < 5) return toast.error("Informe o endereço de entrega.");
    if (!detailed.length) return toast.error("Sua sacola está vazia.");
    setSending(true);
    try {
      const result = await createOrder({ data: {
        slug,
        customer_name: name.trim(),
        customer_phone: phone.trim() || null,
        fulfillment,
        address: address.trim() || null,
        note: note.trim() || null,
        items: cart.lines.map((line) => ({ item_id: line.id, qty: line.qty, variant_label: line.variant ?? null })),
      } });

      const lines = result.lines.map((line: any) => `• ${line.qty}x ${line.name}${line.variant_label ? ` (${line.variant_label})` : ""} — ${money(Number(line.line_total), result.currency)}`).join("\n");
      const message = [
        `*Pedido #${result.order_number}* — ${result.establishment.name}`,
        "",
        lines,
        "",
        `*Total: ${money(Number(result.total), result.currency)}*`,
        "",
        `Nome: ${name.trim()}`,
        phone.trim() ? `Telefone: ${phone.trim()}` : null,
        fulfillment === "delivery" ? `Entrega: ${address.trim()}` : "Retirada no local",
        note.trim() ? `Obs.: ${note.trim()}` : null,
        "",
        "Pedido enviado pelo Bio Commerce Fidelize.",
      ].filter(Boolean).join("\n");

      const number = String(result.establishment.whatsapp || result.establishment.phone || whatsapp || "").replace(/\D/g, "");
      onTrack(`order:${result.order_number}`);
      cart.clear();
      onClose();
      toast.success(`Pedido #${result.order_number} criado!`);
      if (number) window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      else toast.info("Pedido registrado, mas a loja ainda não cadastrou um WhatsApp.");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível enviar o pedido.");
    } finally {
      setSending(false);
    }
  };

  const fieldStyle = { background: rgba(theme.text, 0.055), border: `1px solid ${rgba(theme.text, 0.12)}`, color: theme.text };

  return (
    <motion.div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} onClick={(event) => event.stopPropagation()} className="max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border p-5 shadow-2xl sm:rounded-[2rem] sm:p-6" style={{ ...surface(theme, true), background: theme.background, borderColor: rgba(theme.text, 0.12), color: theme.text }}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.primary }}>Checkout Bio Commerce</p><h2 className="mt-1 text-2xl font-black">Sua sacola</h2></div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full" style={surface(theme)}><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 space-y-3">
          {detailed.map(({ product, qty, variant, unit }) => (
            <div key={`${product.id}-${variant ?? ""}`} className="flex items-center gap-3 rounded-2xl p-2.5" style={surface(theme)}>
              {product.image_url ? <img src={product.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-xl" style={{ background: rgba(theme.primary, 0.12) }}><ShoppingBag className="h-5 w-5" /></div>}
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{product.name}</p>{variant && <p className="truncate text-[10px] opacity-55">{variant}</p>}<p className="text-xs opacity-65">{money(unit, product.currency ?? "BRL")}</p></div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => cart.setQty(product.id, qty - 1, variant)} className="grid h-8 w-8 place-items-center rounded-full" style={surface(theme)}>{qty === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}</button>
                <strong className="w-5 text-center text-sm">{qty}</strong>
                <button type="button" onClick={() => cart.add(product.id, 1, variant)} className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: theme.primary }}><Plus className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t pt-4" style={{ borderColor: rgba(theme.text, 0.1) }}><span className="text-sm font-bold opacity-65">Total</span><strong className="text-2xl" style={{ color: theme.primary }}>{money(total)}</strong></div>

        <div className="mt-5 space-y-3">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome *" maxLength={80} className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={fieldStyle} />
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="WhatsApp / telefone" maxLength={30} className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={fieldStyle} />
          <div className="grid grid-cols-2 gap-2">
            {(["pickup", "delivery"] as const).map((value) => <button key={value} type="button" onClick={() => setFulfillment(value)} className="rounded-2xl px-3 py-3 text-xs font-black" style={fulfillment === value ? { background: theme.primary, color: "white" } : surface(theme)}>{value === "pickup" ? "Retirar no local" : "Entrega"}</button>)}
          </div>
          {fulfillment === "delivery" && <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Endereço de entrega *" maxLength={240} className="w-full rounded-2xl px-4 py-3 text-sm outline-none" style={fieldStyle} />}
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observação (opcional)" maxLength={500} rows={2} className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none" style={fieldStyle} />
        </div>

        <button type="button" onClick={submit} disabled={sending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black text-white shadow-xl disabled:opacity-60" style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})` }}>
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
          {sending ? "Criando pedido…" : "Enviar pedido no WhatsApp"}
        </button>
        <p className="mt-3 text-center text-[10px] opacity-45">O pedido fica registrado na Fidelize e o WhatsApp abre com o resumo completo.</p>
      </motion.div>
    </motion.div>
  );
}

function SocialAction({ link, theme, interactive, onTrack }: { link: any; theme: any; interactive: boolean; onTrack: () => void }) {
  const meta = KIND_META[link.kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  const href = normalizeUrl(link.kind, link.url);
  return <a href={interactive ? href : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); else onTrack(); }} target="_blank" rel="noopener noreferrer" aria-label={link.label || meta.fallback} className="grid h-11 w-11 place-items-center rounded-2xl border transition hover:-translate-y-0.5" style={{ borderColor: rgba(theme.text, 0.12), background: rgba(theme.text, 0.06), color: theme.primary }}><Icon className="h-5 w-5" /></a>;
}

function UtilityModule({ link, theme, radius }: { link: any; theme: any; radius: string }) {
  const [copied, setCopied] = useState(false);
  const isWifi = link.kind === "wifi";
  const value = isWifi ? decodeWifi(link.url) : decodePix(link.url);
  const copyValue = isWifi ? (value as any).password || (value as any).ssid : (value as any).key;
  const Icon = isWifi ? Wifi : KeyRound;
  return (
    <div className={`${radius} p-4`} style={surface(theme)}>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: rgba(theme.primary, 0.14), color: theme.primary }}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-black">{link.label || (isWifi ? "Wi-Fi" : "Pix")}</p><p className="truncate text-[10px] opacity-55">{isWifi ? `Rede: ${(value as any).ssid || "—"}` : `Chave: ${(value as any).key || "—"}`}</p></div>
        <button type="button" onClick={async () => { if (!copyValue) return; await navigator.clipboard.writeText(copyValue); setCopied(true); setTimeout(() => setCopied(false), 1600); }} className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: rgba(theme.text, 0.06) }}>{copied ? <Check className="h-4 w-4" style={{ color: theme.primary }} /> : <Copy className="h-4 w-4" />}</button>
      </div>
    </div>
  );
}

function RichModule({ link, theme, radius, interactive }: { link: any; theme: any; radius: string; interactive: boolean }) {
  const data = link.data ?? {};
  if (link.kind === "header_image") {
    const src = String(data.image_url ?? link.url ?? "").trim();
    if (!src) return null;
    const image = <img src={src} alt={link.label || "Destaque"} className={`max-h-[440px] w-full object-cover ${radius}`} />;
    return data.link_url ? <a href={interactive ? normalizeUrl("custom", data.link_url) : undefined} target="_blank" rel="noopener noreferrer">{image}</a> : image;
  }
  if (link.kind === "video") {
    const parsed = parseVideoUrl(String(data.url ?? link.url ?? ""));
    if (!parsed) return null;
    return <ModuleShell title={link.label || "Vídeo"} icon={<PlayCircle className="h-4 w-4" />} theme={theme} radius={radius}><div className="relative aspect-video overflow-hidden rounded-2xl bg-black/30">{parsed.embed ? <iframe src={parsed.embed} title={link.label || "Vídeo"} className="absolute inset-0 h-full w-full" allowFullScreen loading="lazy" /> : <video src={parsed.direct} controls playsInline className="absolute inset-0 h-full w-full object-cover" />}</div></ModuleShell>;
  }
  if (link.kind === "spotify") {
    const embed = parseSpotifyUrl(String(data.url ?? link.url ?? ""));
    if (!embed) return null;
    return <ModuleShell title={link.label || "Ouça agora"} icon={<Music className="h-4 w-4" />} theme={theme} radius={radius}><iframe src={embed} title={link.label || "Spotify"} className="w-full rounded-2xl" style={{ height: 152, border: 0 }} loading="lazy" /></ModuleShell>;
  }
  if (link.kind === "gallery") {
    const images = Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 9) : [];
    if (!images.length) return null;
    return <ModuleShell title={link.label || "Galeria"} icon={<ImagesIcon className="h-4 w-4" />} theme={theme} radius={radius}><div className="grid grid-cols-3 gap-2">{images.map((src: string, index: number) => <img key={`${src}-${index}`} src={src} alt={`${link.label || "Galeria"} ${index + 1}`} className="aspect-square w-full rounded-2xl object-cover" loading="lazy" />)}</div></ModuleShell>;
  }
  return null;
}

function ModuleShell({ title, icon, theme, radius, children }: { title: string; icon: ReactNode; theme: any; radius: string; children: ReactNode }) {
  return <section className={`${radius} p-4 sm:p-5`} style={surface(theme)}><div className="mb-4 flex items-center gap-2"><span style={{ color: theme.primary }}>{icon}</span><h3 className="text-sm font-black">{title}</h3></div>{children}</section>;
}
