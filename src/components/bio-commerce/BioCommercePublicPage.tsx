import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  Facebook,
  Globe,
  Images as ImagesIcon,
  Instagram,
  KeyRound,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareQuote,
  Music,
  Music2,
  Phone,
  PlayCircle,
  Share2,
  Sparkles,
  Star,
  UserPlus,
  UtensilsCrossed,
  Wifi,
  X,
  Youtube,
  ZoomIn,
} from "lucide-react";
import { getLinkTreeBlockData } from "@/lib/linktree.functions";
import { trackChannelEvent, useChannelPageView } from "@/lib/tracking";
import {
  defaultPresentationForKind,
  resolveBioCommerceTheme,
  type BioCommercePresentation,
  type BioCommerceTheme,
} from "@/lib/bio-commerce-theme";

type PublicData = {
  establishment: any;
  page: any;
  links?: any[];
};

type BlockData = {
  menu: Array<{ id: string; name: string; short_desc: string | null; price: number | null; promo_price: number | null; image_url: string | null }>;
  catalog: Array<{ id: string; name: string; short_desc: string | null; price: number | null; promo_price: number | null; image_url: string | null }>;
  reviews: Array<{ id: string; rating: number | null; comment: string | null; merchant_reply: string | null; submitted_at: string | null; customer_name: string }>;
  stats: { count: number; avg: number } | null;
};

const EMPTY_BLOCK_DATA: BlockData = { menu: [], catalog: [], reviews: [], stats: null };
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

function normalizeUrl(kind: string, value: string) {
  const u = String(value ?? "").trim();
  if (!u) return "#";
  if (u.startsWith("/")) return u;
  if (kind === "whatsapp") {
    const digits = u.replace(/\D/g, "");
    if (digits && !/^https?:/i.test(u)) return `https://wa.me/${digits}`;
  }
  if (kind === "email" && !u.startsWith("mailto:") && u.includes("@")) return `mailto:${u}`;
  if (kind === "phone" && !u.startsWith("tel:")) return `tel:${u.replace(/\s/g, "")}`;
  if (kind === "instagram" && !/^https?:/i.test(u)) return `https://instagram.com/${u.replace(/^@/, "")}`;
  if (!/^https?:\/\//i.test(u) && !u.startsWith("mailto:") && !u.startsWith("tel:")) return `https://${u}`;
  return u;
}

function fmtBRL(n: number | null) {
  if (n == null) return "";
  try {
    return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  } catch {
    return `R$ ${Number(n).toFixed(2)}`;
  }
}

function rgba(hex: string, alpha: number, fallback = "rgba(255,255,255,.12)") {
  const n = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(n)) return fallback;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function decodeWifi(url: string) {
  const s = /WIFI:.*?S:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const p = /WIFI:.*?P:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (v: string) => v.replace(/\\(.)/g, "$1");
  return { ssid: unesc(s), password: unesc(p) };
}

function decodePix(url: string) {
  const type = /PIX:.*?T:([^;]+);/i.exec(url)?.[1] ?? "";
  const key = /PIX:.*?K:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const name = /PIX:.*?N:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (v: string) => v.replace(/\\(.)/g, "$1");
  return { type, key: unesc(key), name: unesc(name) };
}

function parseVideoUrl(u: string): { kind: "youtube" | "vimeo" | "tiktok" | "file" | "unknown"; embed?: string; direct?: string } {
  const url = String(u ?? "").trim();
  if (!url) return { kind: "unknown" };
  const yt = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i.exec(url);
  if (yt) return { kind: "youtube", embed: `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1` };
  const vm = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(url);
  if (vm) return { kind: "vimeo", embed: `https://player.vimeo.com/video/${vm[1]}` };
  const tt = /tiktok\.com\/@[^/]+\/video\/(\d+)/i.exec(url);
  if (tt) return { kind: "tiktok", embed: `https://www.tiktok.com/embed/v2/${tt[1]}` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { kind: "file", direct: url };
  return { kind: "unknown" };
}

function parseSpotifyUrl(u: string) {
  const m = /open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/i.exec(String(u ?? "").trim());
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0` : null;
}

export function BioCommercePublicPage({ data, slug }: { data: PublicData; slug: string }) {
  const est = data.establishment;
  const page = data.page;
  const links = useMemo(() => (data.links ?? []).filter((l: any) => l.enabled !== false), [data.links]);
  useChannelPageView(slug, "linktree");

  const needsBlockData = links.some((l: any) => l.kind === "menu_carousel" || l.kind === "reviews");
  const blockDataQ = useQuery({
    queryKey: ["public-linktree-blocks", slug],
    queryFn: () => getLinkTreeBlockData({ data: { slug } }),
    enabled: needsBlockData,
    staleTime: 60_000,
  });
  const blockData = (blockDataQ.data ?? EMPTY_BLOCK_DATA) as BlockData;

  const cover = page?.cover_url ?? est?.cover_url ?? null;
  const logo = page?.logo_url ?? est?.logo_url ?? null;
  const theme = resolveBioCommerceTheme((page?.theme ?? {}) as BioCommerceTheme, {
    primary: est?.primary_color,
    accent: est?.accent_color,
    cover,
  });
  const reduceMotion = useReducedMotion();
  const motionEnabled = theme.motion !== "none" && !reduceMotion;
  const title = page?.title || est?.name || "Seu negócio";
  const description = page?.description ?? est?.description ?? "";

  const contentClass =
    theme.content_width === "wide" ? "max-w-6xl" : theme.content_width === "compact" ? "max-w-xl" : "max-w-4xl";
  const radiusClass =
    theme.rounded === "sm" ? "rounded-lg" : theme.rounded === "md" ? "rounded-xl" : theme.rounded === "lg" ? "rounded-2xl" : theme.rounded === "full" ? "rounded-[2rem]" : "rounded-3xl";
  const fontClass = theme.font_style === "editorial" ? "font-serif" : "font-sans";

  const regularLinks = links.filter((l: any) => !RICH_KINDS.has(l.kind) && l.kind !== "wifi" && l.kind !== "pix");
  const withPresentation = regularLinks.map((l: any, index: number) => ({
    ...l,
    presentation: ((l.data as any)?.presentation || defaultPresentationForKind(l.kind, index)) as BioCommercePresentation,
  }));
  const highlights = withPresentation.filter((l: any) => l.presentation === "destaque");
  const buttons = withPresentation.filter((l: any) => l.presentation === "botao");
  const cards = withPresentation.filter((l: any) => l.presentation === "card");
  const shortcuts = withPresentation.filter((l: any) => l.presentation === "atalho");
  const utilityLinks = links.filter((l: any) => l.kind === "wifi" || l.kind === "pix");
  const richLinks = links.filter((l: any) => RICH_KINDS.has(l.kind));

  const entrance = (index = 0) => ({
    initial: motionEnabled ? { opacity: 0, y: 16 } : false,
    animate: { opacity: 1, y: 0 },
    transition: { duration: motionEnabled ? 0.42 : 0, delay: motionEnabled ? Math.min(index * 0.045, 0.28) : 0, ease: [0.22, 1, 0.36, 1] as any },
  });

  const surfaceStyle = surfaceForTheme(theme);

  return (
    <div className={`${fontClass} relative min-h-dvh overflow-x-hidden`} style={{ background: theme.background, color: theme.text }}>
      <BackgroundEffects theme={theme} motionEnabled={motionEnabled} />

      <main className={`relative z-10 mx-auto ${contentClass} px-4 pb-24 sm:px-6 lg:px-8`}>
        <motion.section {...entrance(0)} className="pt-4 sm:pt-8">
          <Hero
            title={title}
            description={description}
            logo={logo}
            cover={cover}
            estName={est?.name ?? title}
            theme={theme}
            radiusClass={radiusClass}
            links={links}
            slug={slug}
          />
        </motion.section>

        {highlights.length > 0 && (
          <motion.section {...entrance(1)} className="mt-5 grid gap-3 sm:grid-cols-2">
            {highlights.slice(0, 4).map((link: any, index: number) => (
              <ActionLink key={link.id ?? `${link.kind}-${index}`} link={link} slug={slug} theme={theme} radiusClass={radiusClass} emphasis />
            ))}
          </motion.section>
        )}

        {shortcuts.length > 0 && (
          <motion.section {...entrance(2)} className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {shortcuts.map((link: any, index: number) => (
              <Shortcut key={link.id ?? `${link.kind}-${index}`} link={link} slug={slug} theme={theme} radiusClass={radiusClass} />
            ))}
          </motion.section>
        )}

        {(buttons.length > 0 || cards.length > 0 || utilityLinks.length > 0) && (
          <motion.section {...entrance(3)} className="mt-6 grid gap-3 md:grid-cols-2">
            {[...buttons, ...cards].map((link: any, index: number) => (
              <ActionLink key={link.id ?? `${link.kind}-${index}`} link={link} slug={slug} theme={theme} radiusClass={radiusClass} />
            ))}
            {utilityLinks.map((link: any, index: number) => (
              <UtilityCard key={link.id ?? `${link.kind}-${index}`} link={link} theme={theme} radiusClass={radiusClass} />
            ))}
          </motion.section>
        )}

        {richLinks.length > 0 && (
          <section className={`mt-7 grid gap-5 ${theme.layout === "bento" ? "lg:grid-cols-2" : ""}`}>
            {richLinks.map((link: any, index: number) => (
              <motion.div key={link.id ?? `${link.kind}-${index}`} {...entrance(index + 4)} className={link.kind === "header_image" ? "lg:col-span-2" : ""}>
                <RichBlock
                  link={link}
                  slug={slug}
                  blockData={blockData}
                  theme={theme}
                  radiusClass={radiusClass}
                  surfaceStyle={surfaceStyle}
                />
              </motion.div>
            ))}
          </section>
        )}

        {links.length === 0 && (
          <motion.div {...entrance(2)} className={`mt-8 p-8 text-center ${radiusClass}`} style={surfaceStyle}>
            <Sparkles className="mx-auto h-6 w-6 opacity-70" style={{ color: theme.primary }} />
            <p className="mt-3 text-sm opacity-70">Novidades chegando por aqui.</p>
          </motion.div>
        )}

        <motion.footer {...entrance(8)} className="mt-12 flex items-center justify-center gap-2 pb-4 text-[10px] font-semibold uppercase tracking-[0.25em] opacity-45">
          <Sparkles className="h-3 w-3" /> Bio Commerce by Fidelize
        </motion.footer>
      </main>
    </div>
  );
}

function BackgroundEffects({ theme, motionEnabled }: { theme: ReturnType<typeof resolveBioCommerceTheme>; motionEnabled: boolean }) {
  if (theme.background_effect === "solid") return null;
  const animate = motionEnabled && ["aurora", "mesh", "ambient"].includes(theme.background_effect ?? "")
    ? { x: [0, 30, -20, 0], y: [0, -24, 18, 0], scale: [1, 1.08, 0.96, 1] }
    : undefined;
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ background: rgba(theme.primary, theme.background_effect === "soft-glow" ? 0.12 : 0.22) }}
        animate={animate}
        transition={animate ? { duration: 18, repeat: Infinity, ease: "easeInOut" } : undefined}
      />
      <motion.div
        className="absolute -right-28 top-[22%] h-[32rem] w-[32rem] rounded-full blur-3xl"
        style={{ background: rgba(theme.accent, theme.background_effect === "soft-glow" ? 0.1 : 0.18) }}
        animate={animate ? { x: [0, -25, 18, 0], y: [0, 30, -18, 0], scale: [1, 0.95, 1.08, 1] } : undefined}
        transition={animate ? { duration: 22, repeat: Infinity, ease: "easeInOut" } : undefined}
      />
      <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "24px 24px", color: theme.text }} />
    </div>
  );
}

function Hero({
  title,
  description,
  logo,
  cover,
  estName,
  theme,
  radiusClass,
  links,
  slug,
}: {
  title: string;
  description: string;
  logo: string | null;
  cover: string | null;
  estName: string;
  theme: ReturnType<typeof resolveBioCommerceTheme>;
  radiusClass: string;
  links: any[];
  slug: string;
}) {
  const immersive = !!cover && theme.hero_style !== "minimal";
  const heroMinHeight = immersive ? "min-h-[340px] sm:min-h-[420px]" : "min-h-[250px]";
  return (
    <div
      className={`relative isolate flex ${heroMinHeight} overflow-hidden ${radiusClass} border shadow-2xl`}
      style={{ borderColor: rgba(theme.text, 0.12), boxShadow: `0 32px 90px ${rgba(theme.primary, 0.16)}` }}
    >
      {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" />}
      <div
        className="absolute inset-0"
        style={{
          background: cover
            ? `linear-gradient(180deg, ${rgba(theme.background, 0.14)} 0%, ${rgba(theme.background, 0.72)} 58%, ${theme.background} 100%)`
            : `linear-gradient(135deg, ${rgba(theme.primary, 0.26)}, ${rgba(theme.accent, 0.12)} 48%, ${rgba(theme.background, 0.96)})`,
        }}
      />
      <div className="relative z-10 mt-auto w-full p-5 text-center sm:p-8">
        {logo ? (
          <img
            src={logo}
            alt={estName}
            className="mx-auto h-24 w-24 rounded-3xl border object-cover shadow-2xl sm:h-28 sm:w-28"
            style={{ borderColor: rgba(theme.text, 0.24), boxShadow: `0 18px 55px ${rgba(theme.primary, 0.24)}` }}
          />
        ) : (
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-3xl text-3xl font-black shadow-2xl" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`, color: "white" }}>
            {String(estName)[0]?.toUpperCase() || "F"}
          </div>
        )}
        <h1 className={`mt-4 text-3xl font-black tracking-tight sm:text-4xl ${theme.font_style === "editorial" ? "font-serif" : ""}`}>{title}</h1>
        {description && <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed opacity-80 sm:text-base">{description}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <SaveContactButton slug={slug} name={estName} description={description} logo={logo} links={links} theme={theme} />
          <SharePageButton theme={theme} />
        </div>
      </div>
    </div>
  );
}

function surfaceForTheme(theme: ReturnType<typeof resolveBioCommerceTheme>): React.CSSProperties {
  if (theme.card_style === "outline") return { background: rgba(theme.background, 0.42), border: `1px solid ${rgba(theme.primary, 0.55)}` };
  if (theme.card_style === "soft") return { background: rgba(theme.text, 0.08), border: `1px solid ${rgba(theme.text, 0.08)}`, boxShadow: `0 16px 40px ${rgba(theme.primary, 0.08)}` };
  if (theme.card_style === "elevated") return { background: rgba(theme.background, 0.82), border: `1px solid ${rgba(theme.text, 0.1)}`, boxShadow: `0 22px 60px ${rgba(theme.primary, 0.13)}` };
  return { background: rgba(theme.text, 0.07), border: `1px solid ${rgba(theme.text, 0.13)}`, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" };
}

function ActionLink({ link, slug, theme, radiusClass, emphasis = false }: { link: any; slug: string; theme: ReturnType<typeof resolveBioCommerceTheme>; radiusClass: string; emphasis?: boolean }) {
  const meta = KIND_META[link.kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  const href = normalizeUrl(link.kind, link.url);
  const isInternal = href.startsWith("/");
  const style: React.CSSProperties = emphasis
    ? { background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`, color: "#fff", boxShadow: `0 16px 45px ${rgba(theme.primary, 0.25)}` }
    : surfaceForTheme(theme);
  const cls = `group flex min-h-16 items-center gap-3 px-5 py-4 text-left transition duration-300 hover:-translate-y-0.5 ${radiusClass}`;
  const content = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: emphasis ? "rgba(255,255,255,.16)" : rgba(theme.primary, 0.14), color: emphasis ? "#fff" : theme.primary }}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold sm:text-[15px]">{link.label || meta.fallback}</span>
        {link.data?.description && <span className="mt-0.5 block line-clamp-1 text-xs opacity-65">{link.data.description}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-55 transition-transform group-hover:translate-x-0.5" />
    </>
  );
  const onClick = () => trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: link.id, ref_label: link.label });
  if (isInternal) return <a href={href} onClick={onClick} className={cls} style={style}>{content}</a>;
  return <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls} style={style}>{content}</a>;
}

function Shortcut({ link, slug, theme, radiusClass }: { link: any; slug: string; theme: ReturnType<typeof resolveBioCommerceTheme>; radiusClass: string }) {
  const meta = KIND_META[link.kind] ?? KIND_META.custom;
  const Icon = meta.icon;
  return (
    <a
      href={normalizeUrl(link.kind, link.url)}
      target={String(link.url ?? "").startsWith("/") ? undefined : "_blank"}
      rel="noopener noreferrer"
      onClick={() => trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: link.id, ref_label: link.label })}
      className={`group flex min-h-[84px] flex-col items-center justify-center gap-2 p-2 text-center transition duration-300 hover:-translate-y-1 ${radiusClass}`}
      style={surfaceForTheme(theme)}
    >
      <Icon className="h-5 w-5 transition-transform group-hover:scale-110" style={{ color: theme.primary }} />
      <span className="line-clamp-1 w-full text-[10px] font-semibold opacity-85">{link.label || meta.fallback}</span>
    </a>
  );
}

function UtilityCard({ link, theme, radiusClass }: { link: any; theme: ReturnType<typeof resolveBioCommerceTheme>; radiusClass: string }) {
  const [open, setOpen] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState("");
  const isWifi = link.kind === "wifi";
  const wifi = isWifi ? decodeWifi(link.url) : null;
  const pix = !isWifi ? decodePix(link.url) : null;
  const Icon = isWifi ? Wifi : KeyRound;

  const copy = async (value: string, key: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success("Copiado com sucesso");
      setTimeout(() => setCopied(""), 1300);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className={`${radiusClass} overflow-hidden`} style={surfaceForTheme(theme)}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-h-16 w-full items-center gap-3 px-5 py-4 text-left">
        <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ background: rgba(theme.primary, 0.14), color: theme.primary }}><Icon className="h-5 w-5" /></span>
        <span className="flex-1 text-sm font-bold">{link.label || (isWifi ? "Wi-Fi" : "Pix")}</span>
        <ChevronRight className={`h-4 w-4 opacity-55 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-2 border-t px-4 py-4" style={{ borderColor: rgba(theme.text, 0.1) }}>
              {isWifi ? (
                <>
                  <CopyRow label="Rede" value={wifi?.ssid || "—"} copied={copied === "ssid"} onCopy={() => copy(wifi?.ssid ?? "", "ssid")} theme={theme} />
                  <CopyRow label="Senha" value={wifi?.password ? (showSecret ? wifi.password : "••••••••") : "—"} copied={copied === "pwd"} onCopy={() => copy(wifi?.password ?? "", "pwd")} theme={theme} extra={wifi?.password ? <button onClick={() => setShowSecret((v) => !v)} className="opacity-60">{showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button> : null} />
                </>
              ) : (
                <>
                  {pix?.type && <p className="text-[10px] uppercase tracking-wider opacity-55">Tipo: {pix.type}</p>}
                  <CopyRow label="Chave" value={pix?.key || "—"} copied={copied === "pix"} onCopy={() => copy(pix?.key ?? "", "pix")} theme={theme} />
                  {pix?.name && <CopyRow label="Nome" value={pix.name} copied={copied === "name"} onCopy={() => copy(pix.name, "name")} theme={theme} />}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CopyRow({ label, value, copied, onCopy, theme, extra }: { label: string; value: string; copied: boolean; onCopy: () => void; theme: ReturnType<typeof resolveBioCommerceTheme>; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl px-3 py-2 text-xs" style={{ background: rgba(theme.text, 0.06) }}>
      <span className="w-12 shrink-0 uppercase tracking-wide opacity-50">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono">{value}</span>
      {extra}
      <button type="button" onClick={onCopy} className="opacity-65 hover:opacity-100" aria-label={`Copiar ${label}`}>
        {copied ? <Check className="h-4 w-4" style={{ color: theme.primary }} /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SectionShell({ title, icon, theme, radiusClass, children }: { title?: string; icon?: React.ReactNode; theme: ReturnType<typeof resolveBioCommerceTheme>; radiusClass: string; children: React.ReactNode }) {
  return (
    <section className={`${radiusClass} overflow-hidden p-4 sm:p-5`} style={surfaceForTheme(theme)}>
      {title && <div className="mb-4 flex items-center gap-2 text-sm font-black"><span style={{ color: theme.primary }}>{icon}</span><h2>{title}</h2></div>}
      {children}
    </section>
  );
}

function RichBlock({ link, slug, blockData, theme, radiusClass, surfaceStyle }: { link: any; slug: string; blockData: BlockData; theme: ReturnType<typeof resolveBioCommerceTheme>; radiusClass: string; surfaceStyle: React.CSSProperties }) {
  const d = (link.data ?? {}) as Record<string, any>;

  if (link.kind === "header_image") {
    const src = String(d.image_url ?? link.url ?? "").trim();
    if (!src) return null;
    const image = <img src={src} alt={link.label || "Destaque"} loading="lazy" decoding="async" className={`h-auto max-h-[420px] w-full object-cover ${radiusClass}`} />;
    return d.link_url ? <a href={normalizeUrl("custom", String(d.link_url))} target="_blank" rel="noopener noreferrer" onClick={() => trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: link.id, ref_label: link.label })}>{image}</a> : image;
  }

  if (link.kind === "video") {
    const parsed = parseVideoUrl(String(d.url ?? link.url ?? ""));
    if (parsed.kind === "unknown") return null;
    return (
      <SectionShell title={link.label || "Vídeo"} icon={<PlayCircle className="h-4 w-4" />} theme={theme} radiusClass={radiusClass}>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black/30">
          {parsed.embed ? <iframe src={parsed.embed} title={link.label || "Vídeo"} className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" /> : parsed.direct ? <video src={parsed.direct} controls playsInline className="absolute inset-0 h-full w-full object-cover" /> : null}
        </div>
      </SectionShell>
    );
  }

  if (link.kind === "spotify") {
    const embed = parseSpotifyUrl(String(d.url ?? link.url ?? ""));
    if (!embed) return null;
    return <SectionShell title={link.label || "Ouça agora"} icon={<Music className="h-4 w-4" />} theme={theme} radiusClass={radiusClass}><iframe src={embed} title={link.label || "Spotify"} className="w-full rounded-2xl" style={{ height: 152, border: 0 }} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" /></SectionShell>;
  }

  if (link.kind === "gallery") {
    const images = Array.isArray(d.images) ? d.images.filter((v: any) => typeof v === "string" && v.trim()) : [];
    if (!images.length) return null;
    return <SectionShell title={link.label || "Galeria"} icon={<ImagesIcon className="h-4 w-4" />} theme={theme} radiusClass={radiusClass}><Gallery images={images} label={link.label || "Imagem"} theme={theme} /></SectionShell>;
  }

  if (link.kind === "menu_carousel") {
    const source = (d.source ?? "menu") as "menu" | "catalog";
    const limit = Math.max(3, Math.min(12, Number(d.limit ?? 8)));
    const items = (source === "catalog" ? blockData.catalog : blockData.menu).slice(0, limit);
    if (!items.length) return null;
    const grid = theme.product_style === "grid";
    return (
      <SectionShell title={link.label || (source === "catalog" ? "Produtos em destaque" : "Destaques do cardápio")} icon={<UtensilsCrossed className="h-4 w-4" />} theme={theme} radiusClass={radiusClass}>
        <div className={grid ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
          {items.map((item) => <ProductCard key={item.id} item={item} theme={theme} radiusClass={radiusClass} grid={grid} />)}
        </div>
        <Link to={source === "catalog" ? "/catalogo/$slug" : "/cardapio/$slug"} params={{ slug }} onClick={() => trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: link.id, ref_label: link.label })} className="mt-4 flex items-center justify-center gap-2 text-xs font-bold opacity-75 transition hover:opacity-100">
          Ver {source === "catalog" ? "catálogo" : "cardápio"} completo <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </SectionShell>
    );
  }

  if (link.kind === "reviews") {
    const min = Number(d.min_rating ?? 4);
    const limit = Math.max(1, Math.min(10, Number(d.limit ?? 3)));
    const reviews = blockData.reviews.filter((r) => (r.rating ?? 0) >= min).slice(0, limit);
    if (!reviews.length) return null;
    return (
      <SectionShell title={link.label || "O que nossos clientes dizem"} icon={<MessageSquareQuote className="h-4 w-4" />} theme={theme} radiusClass={radiusClass}>
        {blockData.stats && <div className="mb-4 flex items-center gap-2 text-sm"><Star className="h-4 w-4" style={{ color: theme.primary, fill: theme.primary }} /><strong>{blockData.stats.avg.toFixed(1)}</strong><span className="opacity-55">({blockData.stats.count} avaliações)</span></div>}
        <div className="grid gap-3 md:grid-cols-2">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-2xl p-4" style={{ background: rgba(theme.text, 0.055), border: `1px solid ${rgba(theme.text, 0.08)}` }}>
              <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className="h-3.5 w-3.5" style={{ color: theme.primary, fill: (review.rating ?? 0) >= n ? theme.primary : "transparent" }} />)}</div>
              {review.comment && <p className="mt-2 text-sm leading-relaxed opacity-85">“{review.comment}”</p>}
              <p className="mt-2 text-xs font-bold opacity-65">{review.customer_name}</p>
              {review.merchant_reply && <p className="mt-2 border-l-2 pl-3 text-xs opacity-65" style={{ borderColor: theme.primary }}><strong>Resposta:</strong> {review.merchant_reply}</p>}
            </article>
          ))}
        </div>
      </SectionShell>
    );
  }

  return <div style={surfaceStyle} className={radiusClass} />;
}

function ProductCard({ item, theme, radiusClass, grid }: { item: BlockData["menu"][number]; theme: ReturnType<typeof resolveBioCommerceTheme>; radiusClass: string; grid: boolean }) {
  const promo = item.promo_price != null && item.price != null && item.promo_price < item.price;
  return (
    <article className={`${grid ? "w-full" : "w-[190px] sm:w-[220px]"} shrink-0 snap-start overflow-hidden ${radiusClass}`} style={{ background: rgba(theme.text, 0.06), border: `1px solid ${rgba(theme.text, 0.08)}` }}>
      {item.image_url ? <img src={item.image_url} alt={item.name} loading="lazy" decoding="async" className="h-32 w-full object-cover sm:h-40" /> : <div className="grid h-32 place-items-center text-[10px] opacity-40 sm:h-40">Sem imagem</div>}
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-black">{item.name}</h3>
        {item.short_desc && <p className="mt-1 line-clamp-2 text-[11px] opacity-60">{item.short_desc}</p>}
        <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
          {promo && <span className="text-[10px] line-through opacity-45">{fmtBRL(item.price)}</span>}
          {(promo ? item.promo_price : item.price) != null && <span className="text-sm font-black" style={{ color: theme.primary }}>{fmtBRL(promo ? item.promo_price : item.price)}</span>}
        </div>
      </div>
    </article>
  );
}

function Gallery({ images, label, theme }: { images: string[]; label: string; theme: ReturnType<typeof resolveBioCommerceTheme> }) {
  const [open, setOpen] = useState<number | null>(null);
  const count = images.length;
  const close = () => setOpen(null);
  const prev = () => setOpen((i) => (i == null ? i : (i - 1 + count) % count));
  const next = () => setOpen((i) => (i == null ? i : (i + 1) % count));
  useEffect(() => {
    if (open == null) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, count]);
  return (
    <>
      <div className={`grid gap-2 ${count === 1 ? "grid-cols-1" : count === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {images.map((src, index) => <button key={`${src}-${index}`} type="button" onClick={() => setOpen(index)} className="group relative aspect-square overflow-hidden rounded-2xl"><img src={src} alt={`${label} ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100"><ZoomIn className="h-5 w-5 text-white" /></span></button>)}
      </div>
      <AnimatePresence>
        {open != null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] grid place-items-center bg-black/95 p-4 backdrop-blur" onClick={close} role="dialog" aria-modal="true">
            <button type="button" onClick={close} className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white"><X className="h-5 w-5" /></button>
            {count > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 top-1/2 rounded-full bg-white/10 p-3 text-white"><ChevronLeft className="h-6 w-6" /></button>}
            <img src={images[open]} alt={`${label} ${open + 1}`} className="max-h-[84vh] max-w-[92vw] object-contain" onClick={(e) => e.stopPropagation()} />
            {count > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 top-1/2 rounded-full bg-white/10 p-3 text-white"><ChevronRight className="h-6 w-6" /></button>}
            <span className="absolute bottom-4 text-xs text-white/60">{open + 1} / {count}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function vcardEscape(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function SaveContactButton({ slug, name, description, logo, links, theme }: { slug: string; name: string; description: string | null; logo: string | null; links: any[]; theme: ReturnType<typeof resolveBioCommerceTheme> }) {
  const handleDownload = () => {
    const phones = Array.from(new Set(links.filter((l) => l.kind === "phone" || l.kind === "whatsapp").map((l) => l.url.replace(/\D/g, "")).filter(Boolean)));
    const emails = Array.from(new Set(links.filter((l) => l.kind === "email").map((l) => l.url.replace(/^mailto:/i, "").trim()).filter((v) => v.includes("@"))));
    const urls = Array.from(new Set(links.filter((l) => ["site", "instagram", "facebook", "tiktok", "youtube", "maps", "google", "cardapio", "cartao", "custom"].includes(l.kind)).map((l) => normalizeUrl(l.kind, l.url))));
    const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vcardEscape(name)}`, `N:${vcardEscape(name)};;;;`, `ORG:${vcardEscape(name)}`];
    if (description) lines.push(`NOTE:${vcardEscape(description)}`);
    phones.forEach((p) => lines.push(`TEL;TYPE=CELL,VOICE:${p}`));
    emails.forEach((e) => lines.push(`EMAIL;TYPE=INTERNET:${e}`));
    urls.forEach((u) => lines.push(`URL:${u}`));
    if (logo) lines.push(`PHOTO;VALUE=URI:${logo}`);
    lines.push("END:VCARD");
    const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${name.replace(/[^\w\-]+/g, "_") || "contato"}.vcf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    toast.success("Contato pronto para adicionar à agenda.");
    trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: "save-contact", ref_label: "Salvar contato" });
  };
  return <button type="button" onClick={handleDownload} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold backdrop-blur" style={{ background: rgba(theme.text, 0.1), border: `1px solid ${rgba(theme.text, 0.16)}` }}><UserPlus className="h-3.5 w-3.5" /> Salvar contato</button>;
}

function SharePageButton({ theme }: { theme: ReturnType<typeof resolveBioCommerceTheme> }) {
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: document.title, url: window.location.href });
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copiado.");
      }
    } catch {
      // Cancelamento do compartilhamento não precisa gerar erro para o visitante.
    }
  };
  return <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold backdrop-blur" style={{ background: rgba(theme.text, 0.1), border: `1px solid ${rgba(theme.text, 0.16)}` }}><Share2 className="h-3.5 w-3.5" /> Compartilhar</button>;
}
