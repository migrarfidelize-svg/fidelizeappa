import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
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
  Music,
  Music2,
  Phone,
  PlayCircle,
  Share2,
  Sparkles,
  Star,
  Ticket,
  UtensilsCrossed,
  Wifi,
  Youtube,
} from "lucide-react";
import { trackChannelEvent } from "@/lib/tracking";
import {
  getBioCommerceNiche,
  resolveBioCommerceLandingTheme,
  type BioCommerceTheme,
} from "@/lib/bio-commerce-theme";

export type BioCommerceProduct = {
  id: string;
  name: string;
  short_desc: string | null;
  price: number | null;
  promo_price: number | null;
  image_url: string | null;
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
  const n = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(n)) return fallback;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function fmtBRL(value: number | null) {
  if (value == null) return "";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  const s = /WIFI:.*?S:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const p = /WIFI:.*?P:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (value: string) => value.replace(/\\(.)/g, "$1");
  return { ssid: unesc(s), password: unesc(p) };
}

function decodePix(url: string) {
  const key = /PIX:.*?K:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const name = /PIX:.*?N:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (value: string) => value.replace(/\\(.)/g, "$1");
  return { key: unesc(key), name: unesc(name) };
}

function parseVideoUrl(value: string) {
  const url = String(value ?? "").trim();
  const yt = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i.exec(url);
  if (yt) return { embed: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1` };
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(url);
  if (vm) return { embed: `https://player.vimeo.com/video/${vm[1]}` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { direct: url };
  return null;
}

function parseSpotifyUrl(value: string) {
  const match = /open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/i.exec(String(value ?? "").trim());
  return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0` : null;
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
  const reduceMotion = useReducedMotion();
  const motionEnabled = theme.motion !== "none" && !reduceMotion;
  const title = page.title || establishment.name || "Seu negócio";
  const description = page.description || establishment.description || niche.eyebrow;

  const findLink = (...kinds: string[]) => links.find((link: any) => kinds.includes(link.kind));
  const primaryLink = theme.niche_id === "food"
    ? findLink("whatsapp", "cardapio", "custom", "site")
    : theme.niche_id === "events"
      ? findLink("custom", "site", "whatsapp")
      : findLink("whatsapp", "custom", "site", "phone");

  const quickKinds = ["cardapio", "google", "maps", "cartao", "instagram", "whatsapp", "site", "phone"];
  const quickLinks = links.filter((link: any) => quickKinds.includes(link.kind) && link !== primaryLink).slice(0, 4);
  const socialLinks = links.filter((link: any) => ["instagram", "facebook", "tiktok", "youtube", "email"].includes(link.kind)).slice(0, 5);
  const utilities = links.filter((link: any) => link.kind === "wifi" || link.kind === "pix");

  const explicitShowcase = links.find((link: any) => link.kind === "menu_carousel");
  const requestedSource = explicitShowcase?.data?.source === "catalog" ? "catalog" : explicitShowcase?.data?.source === "menu" ? "menu" : niche.preferred_source;
  const preferredProducts = requestedSource === "menu" ? blockData.menu : blockData.catalog;
  const fallbackProducts = requestedSource === "menu" ? blockData.catalog : blockData.menu;
  const products = (preferredProducts.length ? preferredProducts : fallbackProducts).slice(0, 10);
  const showcaseSource = preferredProducts.length ? requestedSource : requestedSource === "menu" ? "catalog" : "menu";
  const showcaseTitle = explicitShowcase?.label || niche.showcase_title;
  const reviews = blockData.reviews.filter((review) => (review.rating ?? 0) >= 4).slice(0, 4);
  const richLinks = links.filter((link: any) => RICH_KINDS.has(link.kind) && !["menu_carousel", "reviews"].includes(link.kind));
  const secondaryActions = links.filter((link: any) => !RICH_KINDS.has(link.kind) && !quickLinks.includes(link) && link !== primaryLink && !["wifi", "pix"].includes(link.kind)).slice(0, 4);

  const radius = theme.rounded === "full" ? "rounded-[2rem]" : theme.rounded === "sm" ? "rounded-xl" : theme.rounded === "md" ? "rounded-2xl" : "rounded-3xl";
  const container = theme.content_width === "wide" ? "max-w-6xl" : theme.content_width === "compact" ? "max-w-3xl" : "max-w-5xl";
  const fontClass = theme.font_style === "editorial" ? "font-serif" : "font-sans";
  const heroMin = embedded ? "min-h-[370px]" : "min-h-[460px] sm:min-h-[520px]";

  const track = (link: any) => {
    if (!interactive) return;
    trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: link.id, ref_label: link.label });
  };

  return (
    <div className={`${fontClass} relative overflow-x-hidden ${embedded ? "min-h-full" : "min-h-dvh"}`} style={{ background: theme.background, color: theme.text }}>
      <Ambient theme={theme} motionEnabled={motionEnabled} embedded={embedded} />
      <div className={`relative z-10 mx-auto ${container} ${embedded ? "px-2 pb-10 pt-2" : "px-3 pb-20 pt-3 sm:px-6 sm:pt-6 lg:px-8"}`}>
        <motion.section initial={motionEnabled ? { opacity: 0, y: 16 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionEnabled ? 0.45 : 0 }}>
          <div className={`relative isolate overflow-hidden border ${radius} ${heroMin}`} style={{ borderColor: rgba(theme.text, 0.12), boxShadow: `0 36px 100px ${rgba(theme.primary, 0.2)}` }}>
            {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0" style={{ background: `linear-gradient(135deg,${rgba(theme.primary, 0.35)},${rgba(theme.accent, 0.12)} 48%,${theme.background})` }} />}
            <div className="absolute inset-0" style={{ background: cover ? `linear-gradient(180deg,${rgba(theme.background, 0.04)} 0%,${rgba(theme.background, 0.28)} 34%,${rgba(theme.background, 0.88)} 78%,${theme.background} 100%)` : `linear-gradient(180deg,transparent,${rgba(theme.background, 0.88)})` }} />
            <div className={`relative z-10 flex ${heroMin} flex-col items-center justify-end text-center ${embedded ? "p-5" : "p-6 sm:p-10"}`}>
              <span className="mb-4 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md" style={{ borderColor: rgba(theme.text, 0.18), background: rgba(theme.background, 0.35) }}>{niche.eyebrow}</span>
              {logo ? <img src={logo} alt={title} className={`${embedded ? "h-20 w-20" : "h-24 w-24 sm:h-28 sm:w-28"} rounded-[1.7rem] border object-cover shadow-2xl`} style={{ borderColor: rgba(theme.text, 0.22), boxShadow: `0 18px 55px ${rgba(theme.primary, 0.3)}` }} /> : <div className={`${embedded ? "h-20 w-20" : "h-24 w-24"} grid place-items-center rounded-[1.7rem] text-3xl font-black text-white`} style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})` }}>{String(title)[0]?.toUpperCase() || "F"}</div>}
              <h1 className={`${embedded ? "mt-3 text-3xl" : "mt-4 text-4xl sm:text-5xl"} font-black tracking-tight`}>{title}</h1>
              <p className={`mx-auto mt-2 max-w-2xl ${embedded ? "text-xs" : "text-sm sm:text-base"} leading-relaxed opacity-82`}>{description}</p>
              {blockData.stats && blockData.stats.count > 0 && <div className="mt-3 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs backdrop-blur" style={{ borderColor: rgba(theme.text, 0.12), background: rgba(theme.background, 0.32) }}><Star className="h-3.5 w-3.5" style={{ fill: theme.primary, color: theme.primary }} /><strong>{blockData.stats.avg.toFixed(1)}</strong><span className="opacity-60">({blockData.stats.count} avaliações)</span></div>}
              {primaryLink && <ActionAnchor link={primaryLink} label={niche.primary_cta} theme={theme} onTrack={track} interactive={interactive} prominent className={`${embedded ? "mt-4 w-full" : "mt-5 w-full max-w-md"}`} />}
              <div className="mt-4 flex items-center gap-2">
                <button type="button" onClick={() => interactive && navigator.share?.({ title, url: window.location.href }).catch(() => undefined)} className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold backdrop-blur" style={{ borderColor: rgba(theme.text, 0.14), background: rgba(theme.background, 0.32) }}><Share2 className="h-3.5 w-3.5" /> Compartilhar</button>
              </div>
            </div>
          </div>
        </motion.section>

        {quickLinks.length > 0 && <motion.section initial={motionEnabled ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionEnabled ? 0.08 : 0 }} className={`mt-4 grid gap-2 ${quickLinks.length >= 4 ? "grid-cols-4" : `grid-cols-${Math.min(quickLinks.length, 3)}`}`}>
          {quickLinks.map((link: any) => <QuickAction key={link.id ?? `${link.kind}-${link.label}`} link={link} theme={theme} radius={radius} onTrack={track} interactive={interactive} />)}
        </motion.section>}

        {products.length > 0 && <motion.section initial={motionEnabled ? { opacity: 0, y: 18 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionEnabled ? 0.14 : 0 }} className="mt-7">
          <SectionHeading title={showcaseTitle} eyebrow={showcaseSource === "menu" ? "Vitrine do cardápio" : "Vitrine do catálogo"} theme={theme} />
          <ProductRail products={products} theme={theme} radius={radius} motionEnabled={motionEnabled && theme.product_style === "carousel"} embedded={embedded} />
          {showcaseSource === "menu" && <a href={`/cardapio/${slug}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold opacity-75 hover:opacity-100">Ver cardápio completo <ChevronRight className="h-3.5 w-3.5" /></a>}
          {showcaseSource === "catalog" && <a href={`/catalogo/${slug}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold opacity-75 hover:opacity-100">Ver catálogo completo <ChevronRight className="h-3.5 w-3.5" /></a>}
        </motion.section>}

        {richLinks.length > 0 && <section className={`mt-7 grid gap-4 ${theme.layout === "bento" ? "md:grid-cols-2" : ""}`}>
          {richLinks.map((link: any, index: number) => <motion.div key={link.id ?? index} initial={motionEnabled ? { opacity: 0, y: 14 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionEnabled ? 0.18 + index * 0.04 : 0 }} className={link.kind === "header_image" ? "md:col-span-2" : ""}><RichModule link={link} theme={theme} radius={radius} slug={slug} interactive={interactive} /></motion.div>)}
        </section>}

        {reviews.length > 0 && <motion.section initial={motionEnabled ? { opacity: 0, y: 18 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: motionEnabled ? 0.22 : 0 }} className="mt-8">
          <SectionHeading title="Quem compra, recomenda" eyebrow="Prova social" theme={theme} />
          <div className="grid gap-3 md:grid-cols-2">
            {reviews.map((review) => <article key={review.id} className={`${radius} p-4`} style={surface(theme)}><div className="flex gap-0.5">{[1,2,3,4,5].map((value) => <Star key={value} className="h-3.5 w-3.5" style={{ color: theme.primary, fill: (review.rating ?? 0) >= value ? theme.primary : "transparent" }} />)}</div>{review.comment && <p className="mt-3 text-sm leading-relaxed opacity-85">“{review.comment}”</p>}<p className="mt-3 text-xs font-black opacity-65">{review.customer_name}</p></article>)}
          </div>
        </motion.section>}

        {(utilities.length > 0 || secondaryActions.length > 0) && <section className="mt-8">
          <SectionHeading title="Tudo em um só lugar" eyebrow="Facilidades" theme={theme} />
          <div className="grid gap-3 sm:grid-cols-2">
            {secondaryActions.map((link: any) => <ActionAnchor key={link.id ?? `${link.kind}-${link.label}`} link={link} theme={theme} onTrack={track} interactive={interactive} />)}
            {utilities.map((link: any) => <UtilityModule key={link.id ?? link.kind} link={link} theme={theme} radius={radius} />)}
          </div>
        </section>}

        {socialLinks.length > 0 && <section className="mt-8 text-center"><p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-45">Conecte-se com a gente</p><div className="mt-3 flex flex-wrap items-center justify-center gap-2">{socialLinks.map((link: any) => <SocialAction key={link.id ?? link.kind} link={link} theme={theme} onTrack={track} interactive={interactive} />)}</div></section>}

        <footer className={`${embedded ? "mt-8" : "mt-12"} flex items-center justify-center gap-2 pb-4 text-[9px] font-black uppercase tracking-[0.26em] opacity-45`}><Sparkles className="h-3 w-3" /> Bio Commerce by Fidelize</footer>
      </div>
    </div>
  );
}

function Ambient({ theme, motionEnabled, embedded }: { theme: any; motionEnabled: boolean; embedded: boolean }) {
  if (theme.background_effect === "solid") return null;
  return <div className={`${embedded ? "absolute" : "fixed"} pointer-events-none inset-0 z-0 overflow-hidden`} aria-hidden="true">
    <motion.div className="absolute -left-24 -top-28 h-[26rem] w-[26rem] rounded-full blur-3xl" style={{ background: rgba(theme.primary, 0.2) }} animate={motionEnabled ? { x: [0, 24, -14, 0], y: [0, -16, 14, 0], scale: [1,1.08,.97,1] } : undefined} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }} />
    <motion.div className="absolute -right-24 top-[30%] h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: rgba(theme.accent, 0.16) }} animate={motionEnabled ? { x: [0,-20,15,0], y: [0,22,-12,0] } : undefined} transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }} />
    <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px,currentColor 1px,transparent 0)", backgroundSize: "22px 22px", color: theme.text }} />
  </div>;
}

function SectionHeading({ title, eyebrow, theme }: { title: string; eyebrow: string; theme: any }) {
  return <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: theme.primary }}>{eyebrow}</p><h2 className="mt-1 text-xl font-black sm:text-2xl">{title}</h2></div><Sparkles className="h-5 w-5 opacity-35" /></div>;
}

function surface(theme: any) {
  if (theme.card_style === "outline") return { background: rgba(theme.background, 0.55), border: `1px solid ${rgba(theme.primary, 0.5)}` };
  if (theme.card_style === "soft") return { background: rgba(theme.text, 0.08), border: `1px solid ${rgba(theme.text, 0.08)}` };
  if (theme.card_style === "elevated") return { background: rgba(theme.background, 0.86), border: `1px solid ${rgba(theme.text, 0.1)}`, boxShadow: `0 20px 60px ${rgba(theme.primary, 0.1)}` };
  return { background: rgba(theme.text, 0.07), border: `1px solid ${rgba(theme.text, 0.12)}`, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" };
}

function ActionAnchor({ link, label, theme, onTrack, interactive, prominent = false, className = "" }: { link: any; label?: string; theme: any; onTrack: (link: any) => void; interactive: boolean; prominent?: boolean; className?: string }) {
  const meta = KIND_META[link.kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  const href = normalizeUrl(link.kind, link.url);
  const style = prominent ? { background: `linear-gradient(135deg,${theme.primary},${theme.accent})`, color: "white", boxShadow: `0 18px 48px ${rgba(theme.primary, 0.28)}` } : surface(theme);
  return <a href={interactive ? href : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); else onTrack(link); }} target={href.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className={`${className} group flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left transition duration-300 hover:-translate-y-0.5`} style={style}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: prominent ? "rgba(255,255,255,.16)" : rgba(theme.primary, 0.14), color: prominent ? "white" : theme.primary }}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{label || link.label || meta.fallback}</span>{link.data?.description && <span className="block truncate text-[11px] opacity-65">{link.data.description}</span>}</span><ChevronRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-1" /></a>;
}

function QuickAction({ link, theme, radius, onTrack, interactive }: { link: any; theme: any; radius: string; onTrack: (link: any) => void; interactive: boolean }) {
  const meta = KIND_META[link.kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  const href = normalizeUrl(link.kind, link.url);
  return <a href={interactive ? href : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); else onTrack(link); }} target={href.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className={`flex min-w-0 flex-col items-center justify-center gap-2 px-2 py-3 text-center transition hover:-translate-y-0.5 ${radius}`} style={surface(theme)}><span className="grid h-9 w-9 place-items-center rounded-2xl" style={{ background: rgba(theme.primary, 0.14), color: theme.primary }}><Icon className="h-4 w-4" /></span><span className="w-full truncate text-[9px] font-black sm:text-[10px]">{link.label || meta.fallback}</span></a>;
}

function ProductRail({ products, theme, radius, motionEnabled, embedded }: { products: BioCommerceProduct[]; theme: any; radius: string; motionEnabled: boolean; embedded: boolean }) {
  const auto = motionEnabled && products.length >= 3;
  const items = auto ? [...products, ...products] : products;
  return <div className="overflow-hidden"><motion.div className="flex w-max gap-3" animate={auto ? { x: ["0%", "-50%"] } : undefined} transition={auto ? { duration: embedded ? 26 : 34, repeat: Infinity, ease: "linear" } : undefined}>{items.map((product, index) => <ProductCard key={`${product.id}-${index}`} product={product} theme={theme} radius={radius} embedded={embedded} />)}</motion.div></div>;
}

function ProductCard({ product, theme, radius, embedded }: { product: BioCommerceProduct; theme: any; radius: string; embedded: boolean }) {
  const promo = product.promo_price != null && product.price != null && product.promo_price < product.price;
  return <article className={`${embedded ? "w-[178px]" : "w-[220px] sm:w-[250px]"} shrink-0 overflow-hidden ${radius}`} style={surface(theme)}>{product.image_url ? <img src={product.image_url} alt={product.name} className={`${embedded ? "h-28" : "h-36 sm:h-44"} w-full object-cover`} loading="lazy" /> : <div className={`${embedded ? "h-28" : "h-36 sm:h-44"} grid place-items-center`} style={{ background: `linear-gradient(135deg,${rgba(theme.primary,.24)},${rgba(theme.accent,.12)})` }}><Sparkles className="h-7 w-7 opacity-40" /></div>}<div className="p-3"><h3 className="line-clamp-2 text-sm font-black">{product.name}</h3>{product.short_desc && <p className="mt-1 line-clamp-2 text-[10px] opacity-60">{product.short_desc}</p>}<div className="mt-2 flex flex-wrap items-baseline gap-1.5">{promo && <span className="text-[9px] line-through opacity-40">{fmtBRL(product.price)}</span>}<strong className="text-sm" style={{ color: theme.primary }}>{fmtBRL(promo ? product.promo_price : product.price)}</strong></div></div></article>;
}

function SocialAction({ link, theme, onTrack, interactive }: { link: any; theme: any; onTrack: (link: any) => void; interactive: boolean }) {
  const meta = KIND_META[link.kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  const href = normalizeUrl(link.kind, link.url);
  return <a href={interactive ? href : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); else onTrack(link); }} target="_blank" rel="noopener noreferrer" aria-label={link.label || meta.fallback} className="grid h-11 w-11 place-items-center rounded-2xl border transition hover:-translate-y-0.5" style={{ borderColor: rgba(theme.text, 0.12), background: rgba(theme.text, 0.06), color: theme.primary }}><Icon className="h-5 w-5" /></a>;
}

function UtilityModule({ link, theme, radius }: { link: any; theme: any; radius: string }) {
  const [copied, setCopied] = useState(false);
  const isWifi = link.kind === "wifi";
  const value = isWifi ? decodeWifi(link.url) : decodePix(link.url);
  const copyValue = isWifi ? (value as any).password || (value as any).ssid : (value as any).key;
  const Icon = isWifi ? Wifi : KeyRound;
  return <div className={`${radius} p-4`} style={surface(theme)}><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: rgba(theme.primary,.14), color: theme.primary }}><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-black">{link.label || (isWifi ? "Wi-Fi" : "Pix")}</p><p className="truncate text-[10px] opacity-55">{isWifi ? `Rede: ${(value as any).ssid || "—"}` : `Chave: ${(value as any).key || "—"}`}</p></div><button type="button" onClick={async () => { if (!copyValue) return; await navigator.clipboard.writeText(copyValue); setCopied(true); setTimeout(() => setCopied(false), 1600); }} className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: rgba(theme.text,.06) }}>{copied ? <Check className="h-4 w-4" style={{ color: theme.primary }} /> : <Copy className="h-4 w-4" />}</button></div></div>;
}

function RichModule({ link, theme, radius, slug, interactive }: { link: any; theme: any; radius: string; slug: string; interactive: boolean }) {
  const data = link.data ?? {};
  if (link.kind === "header_image") {
    const src = String(data.image_url ?? link.url ?? "").trim();
    if (!src) return null;
    const content = <img src={src} alt={link.label || "Destaque"} className={`max-h-[440px] w-full object-cover ${radius}`} />;
    return data.link_url ? <a href={interactive ? normalizeUrl("custom", data.link_url) : undefined} target="_blank" rel="noopener noreferrer">{content}</a> : content;
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
    const images = Array.isArray(data.images) ? data.images.filter(Boolean).slice(0, 6) : [];
    if (!images.length) return null;
    return <ModuleShell title={link.label || "Galeria"} icon={<ImagesIcon className="h-4 w-4" />} theme={theme} radius={radius}><div className="grid grid-cols-3 gap-2">{images.map((src: string, index: number) => <img key={`${src}-${index}`} src={src} alt={`${link.label || "Galeria"} ${index + 1}`} className="aspect-square w-full rounded-2xl object-cover" loading="lazy" />)}</div></ModuleShell>;
  }
  return null;
}

function ModuleShell({ title, icon, theme, radius, children }: { title: string; icon: React.ReactNode; theme: any; radius: string; children: React.ReactNode }) {
  return <section className={`${radius} p-4 sm:p-5`} style={surface(theme)}><div className="mb-4 flex items-center gap-2"><span style={{ color: theme.primary }}>{icon}</span><h3 className="text-sm font-black">{title}</h3></div>{children}</section>;
}
