import { motion, useReducedMotion } from "framer-motion";
import {
  BadgePercent,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Facebook,
  HeartHandshake,
  Instagram,
  MapPin,
  MessageCircle,
  Music2,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Trophy,
  Youtube,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import {
  BioCommerceLanding as BioCommerceLandingV5,
  type BioCommerceBlockData,
  type BioCommerceLandingData,
  type BioCommerceProduct,
  type BioCommerceReview,
} from "./BioCommerceLandingV5";
import {
  getBioCommerceNiche,
  resolveBioCommerceLandingTheme,
  type BioCommerceTheme,
} from "@/lib/bio-commerce-theme";
import { useCart } from "@/lib/cart";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

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

function normalizeLink(kind: string, value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "#";
  if (raw.startsWith("/")) return raw;
  if (kind === "whatsapp") {
    const digits = raw.replace(/\D/g, "");
    if (digits && !/^https?:/i.test(raw)) return `https://wa.me/${digits}`;
  }
  if (kind === "instagram" && !/^https?:/i.test(raw)) return `https://instagram.com/${raw.replace(/^@/, "")}`;
  if (kind === "email" && !raw.startsWith("mailto:")) return `mailto:${raw}`;
  if (kind === "phone" && !raw.startsWith("tel:")) return `tel:${raw.replace(/\s/g, "")}`;
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith("mailto:") && !raw.startsWith("tel:")) return `https://${raw}`;
  return raw;
}

function SocialIcon({ kind }: { kind: string }) {
  if (kind === "instagram") return <Instagram className="h-5 w-5" />;
  if (kind === "facebook") return <Facebook className="h-5 w-5" />;
  if (kind === "tiktok") return <Music2 className="h-5 w-5" />;
  return <Youtube className="h-5 w-5" />;
}

export function BioCommerceLanding(props: {
  data: BioCommerceLandingData;
  slug: string;
  blockData?: BioCommerceBlockData;
  embedded?: boolean;
  interactive?: boolean;
}) {
  const { data, slug, blockData, embedded = false, interactive = true } = props;
  const reducedMotion = useReducedMotion();
  const links = useMemo(() => (data.links ?? []).filter((link: any) => link?.enabled !== false), [data.links]);
  const establishment = data.establishment ?? {};
  const page = data.page ?? {};
  const cover = page.cover_url ?? establishment.cover_url ?? null;
  const theme = resolveBioCommerceLandingTheme((page.theme ?? {}) as BioCommerceTheme, { links, establishment, cover });
  const niche = getBioCommerceNiche(theme.niche_id);
  const cart = useCart(slug);

  const allProducts = useMemo(() => {
    const seen = new Set<string>();
    return [...(blockData?.menu ?? []), ...(blockData?.catalog ?? [])].filter((product) => {
      if (!product?.id || seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    });
  }, [blockData?.catalog, blockData?.menu]);

  const featuredProducts = useMemo(() => {
    const promos = allProducts.filter((product) => product.promo_price != null && product.price != null && Number(product.promo_price) < Number(product.price));
    const regular = allProducts.filter((product) => !promos.some((promo) => promo.id === product.id));
    return [...promos, ...regular].slice(0, 3);
  }, [allProducts]);

  const socialLinks = links.filter((link: any) => ["instagram", "facebook", "tiktok", "youtube"].includes(link.kind)).slice(0, 4);
  const loyaltyLink = links.find((link: any) => link.kind === "cartao");
  const whatsappLink = links.find((link: any) => link.kind === "whatsapp") ?? (establishment.whatsapp ? { kind: "whatsapp", label: "WhatsApp", url: establishment.whatsapp } : null);
  const mapsLink = links.find((link: any) => link.kind === "maps");
  const title = page.title || establishment.name || "Sua loja";
  const motionEnabled = theme.motion !== "none" && !reducedMotion;

  const spotlight = featuredProducts[0] ?? null;
  const spotlightPromo = spotlight && spotlight.promo_price != null && spotlight.price != null && Number(spotlight.promo_price) < Number(spotlight.price);
  const spotlightVariants = spotlight && Array.isArray(spotlight.variants) ? spotlight.variants.filter((variant) => variant?.label) : [];
  const spotlightAvailable = spotlight && spotlight.stock_status !== "out_of_stock" && (spotlight.promo_price != null || spotlight.price != null);

  const scrollToProducts = () => {
    if (!interactive) return;
    document.getElementById("bio-commerce-vitrine")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  const addSpotlight = () => {
    if (!spotlight || !interactive || !spotlightAvailable) return;
    if (spotlightVariants.length) {
      scrollToProducts();
      return;
    }
    cart.add(spotlight.id);
  };

  const featureCards = [
    { icon: Zap, title: "Pedido simples", text: "Escolha, adicione à sacola e finalize sem sair da experiência." },
    { icon: ShieldCheck, title: "Compra conferida", text: "Preço e disponibilidade são validados novamente antes do pedido." },
    { icon: MessageCircle, title: "Atendimento direto", text: "O resumo completo chega pronto para continuar no WhatsApp da loja." },
  ];

  return (
    <div
      className="bc-v6 relative overflow-hidden"
      style={{ background: theme.background, color: theme.text, ["--bc-primary" as any]: theme.primary, ["--bc-accent" as any]: theme.accent }}
    >
      <style>{`
        .bc-v6 .bc-v5 footer{display:none!important}
        .bc-v6 .bc-v5 .text-orange-400,.bc-v6 .bc-v5 .text-orange-300{color:var(--bc-primary)!important}
        .bc-v6 .bc-v5 .bg-orange-500{background:var(--bc-primary)!important}
        .bc-v6 .bc-v5 .from-orange-500{--tw-gradient-from:var(--bc-primary) var(--tw-gradient-from-position)!important;--tw-gradient-to:color-mix(in srgb,var(--bc-primary) 0%,transparent) var(--tw-gradient-to-position)!important}
        .bc-v6 .bc-v5 .to-red-500{--tw-gradient-to:var(--bc-accent) var(--tw-gradient-to-position)!important}
        .bc-v6-editorial-grid{background-image:radial-gradient(circle at 1px 1px,currentColor 1px,transparent 0);background-size:22px 22px}
      `}</style>

      <BioCommerceLandingV5 {...props} />

      <div className={`relative z-10 mx-auto ${theme.content_width === "wide" ? "max-w-6xl" : theme.content_width === "compact" ? "max-w-3xl" : "max-w-5xl"} ${embedded ? "px-2 pb-8" : "px-3 pb-20 sm:px-6 lg:px-8"}`}>
        {spotlight && (
          <motion.section
            initial={motionEnabled ? { opacity: 0, y: 18 } : false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: motionEnabled ? 0.45 : 0 }}
            className={`${embedded ? "mt-4" : "mt-8"} overflow-hidden rounded-[2rem] border`}
            style={{ borderColor: rgba(theme.text, 0.12), background: rgba(theme.text, 0.055), boxShadow: `0 30px 90px ${rgba(theme.primary, 0.15)}` }}
          >
            <div className="grid md:grid-cols-[1.2fr_.8fr]">
              <div className={`${embedded ? "min-h-[230px]" : "min-h-[320px] sm:min-h-[390px]"} relative overflow-hidden bg-black/20`}>
                {spotlight.image_url ? (
                  <motion.img
                    src={spotlight.image_url}
                    alt={spotlight.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    initial={false}
                    whileInView={motionEnabled ? { scale: [1.04, 1] } : undefined}
                    viewport={{ once: true }}
                    transition={{ duration: 1.1 }}
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg,${rgba(theme.primary, 0.45)},${rgba(theme.accent, 0.2)},${theme.background})` }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent md:bg-gradient-to-r md:from-transparent md:via-black/10 md:to-black/55" />
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-xl">Destaque da casa</span>
                  {spotlightPromo && <span className="rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-white" style={{ background: theme.primary }}>Oferta especial</span>}
                </div>
              </div>

              <div className={`${embedded ? "p-4" : "p-5 sm:p-8"} flex flex-col justify-center`}>
                <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: theme.primary }}>{niche.eyebrow}</p>
                <h2 className={`${embedded ? "mt-2 text-2xl" : "mt-3 text-3xl sm:text-4xl"} font-black leading-[1.02] tracking-[-0.04em]`}>{spotlight.name}</h2>
                {spotlight.short_desc && <p className="mt-4 text-sm leading-relaxed opacity-70">{spotlight.short_desc}</p>}
                <div className="mt-5 flex flex-wrap items-end gap-3">
                  <strong className={`${embedded ? "text-2xl" : "text-3xl"} font-black`} style={{ color: theme.primary }}>{money(spotlightPromo ? spotlight.promo_price : spotlight.price, spotlight.currency ?? "BRL")}</strong>
                  {spotlightPromo && <span className="pb-1 text-sm opacity-35 line-through">{money(spotlight.price, spotlight.currency ?? "BRL")}</span>}
                </div>
                {spotlightAvailable && (
                  <button
                    type="button"
                    onClick={addSpotlight}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black text-white shadow-2xl transition active:scale-[.98]"
                    style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})`, boxShadow: `0 18px 48px ${rgba(theme.primary, 0.3)}` }}
                  >
                    {spotlightVariants.length ? <><ShoppingBag className="h-5 w-5" />Escolher opção<ChevronRight className="h-4 w-4" /></> : cart.qtyOf(spotlight.id) > 0 ? <><CheckCircle2 className="h-5 w-5" />{cart.qtyOf(spotlight.id)} na sacola</> : <><Plus className="h-5 w-5" />Adicionar à sacola</>}
                  </button>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {featuredProducts.length > 1 && (
          <section className={`${embedded ? "mt-5" : "mt-8"}`}>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: theme.primary }}>Mais pedidos</p>
                <h2 className={`${embedded ? "text-xl" : "text-2xl"} mt-1 font-black tracking-[-0.03em]`}>Escolhas que chamam atenção</h2>
              </div>
              <Trophy className="h-5 w-5 opacity-35" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {featuredProducts.slice(1).map((product) => {
                const promo = product.promo_price != null && product.price != null && Number(product.promo_price) < Number(product.price);
                const variants = Array.isArray(product.variants) ? product.variants.filter((variant) => variant?.label) : [];
                const available = product.stock_status !== "out_of_stock" && (product.promo_price != null || product.price != null);
                return (
                  <article key={product.id} className="group relative min-h-[230px] overflow-hidden rounded-[1.8rem] border" style={{ borderColor: rgba(theme.text, 0.12), background: rgba(theme.text, 0.055) }}>
                    {product.image_url ? <img src={product.image_url} alt={product.name} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" /> : <div className="absolute inset-0" style={{ background: `linear-gradient(135deg,${rgba(theme.primary, 0.35)},${rgba(theme.accent, 0.14)})` }} />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          {promo && <span className="mb-2 inline-flex rounded-full px-2.5 py-1 text-[9px] font-black" style={{ background: theme.primary }}>OFERTA</span>}
                          <h3 className="line-clamp-2 text-lg font-black leading-tight">{product.name}</h3>
                          <div className="mt-2 flex items-end gap-2"><strong className="text-lg">{money(promo ? product.promo_price : product.price, product.currency ?? "BRL")}</strong>{promo && <span className="text-[10px] text-white/45 line-through">{money(product.price, product.currency ?? "BRL")}</span>}</div>
                        </div>
                        {available && (
                          <button
                            type="button"
                            onClick={() => { if (!interactive) return; if (variants.length) scrollToProducts(); else cart.add(product.id); }}
                            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white shadow-xl transition hover:scale-105 active:scale-95"
                            style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})` }}
                            aria-label={variants.length ? `Escolher opção de ${product.name}` : `Adicionar ${product.name}`}
                          >
                            {cart.qtyOf(product.id) > 0 && !variants.length ? <span className="text-xs font-black">{cart.qtyOf(product.id)}</span> : <Plus className="h-5 w-5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <motion.section
          initial={motionEnabled ? { opacity: 0, y: 16 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: motionEnabled ? 0.4 : 0 }}
          className={`${embedded ? "mt-6" : "mt-10"} grid gap-3 md:grid-cols-3`}
        >
          {featureCards.map(({ icon: Icon, title: cardTitle, text }) => (
            <article key={cardTitle} className="rounded-[1.6rem] border p-4 sm:p-5" style={{ borderColor: rgba(theme.text, 0.11), background: rgba(theme.text, 0.05) }}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: rgba(theme.primary, 0.14), color: theme.primary }}><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-sm font-black">{cardTitle}</h3>
              <p className="mt-2 text-xs leading-relaxed opacity-55">{text}</p>
            </article>
          ))}
        </motion.section>

        {(loyaltyLink || mapsLink || whatsappLink) && (
          <section className={`${embedded ? "mt-6" : "mt-10"} overflow-hidden rounded-[2rem] border`} style={{ borderColor: rgba(theme.text, 0.11), background: `linear-gradient(135deg,${rgba(theme.primary, 0.15)},${rgba(theme.accent, 0.07)},${rgba(theme.text, 0.035)})` }}>
            <div className="bc-v6-editorial-grid p-5 sm:p-7" style={{ color: rgba(theme.text, 0.08) }}>
              <div style={{ color: theme.text }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: theme.primary }}>Tudo perto de você</p>
                    <h2 className={`${embedded ? "text-xl" : "text-2xl sm:text-3xl"} mt-2 font-black tracking-[-0.03em]`}>Continue a experiência com {title}</h2>
                  </div>
                  <HeartHandshake className="h-6 w-6 opacity-35" />
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {loyaltyLink && <a href={interactive ? normalizeLink(loyaltyLink.kind, loyaltyLink.url) : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); }} className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5" style={{ borderColor: rgba(theme.text, 0.12), background: rgba(theme.text, 0.055) }}><Trophy className="h-4 w-4" style={{ color: theme.primary }} /><span className="flex-1">{loyaltyLink.label || "Fidelidade"}</span><ChevronRight className="h-4 w-4 opacity-45" /></a>}
                  {mapsLink && <a href={interactive ? normalizeLink(mapsLink.kind, mapsLink.url) : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); }} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5" style={{ borderColor: rgba(theme.text, 0.12), background: rgba(theme.text, 0.055) }}><MapPin className="h-4 w-4" style={{ color: theme.primary }} /><span className="flex-1">{mapsLink.label || "Como chegar"}</span><ChevronRight className="h-4 w-4 opacity-45" /></a>}
                  {whatsappLink && <a href={interactive ? normalizeLink("whatsapp", whatsappLink.url) : undefined} onClick={(event) => { if (!interactive) event.preventDefault(); }} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5" style={{ borderColor: rgba(theme.text, 0.12), background: rgba(theme.text, 0.055) }}><MessageCircle className="h-4 w-4" style={{ color: theme.primary }} /><span className="flex-1">Falar com a loja</span><ChevronRight className="h-4 w-4 opacity-45" /></a>}
                </div>
              </div>
            </div>
          </section>
        )}

        {(socialLinks.length > 0 || embedded) && (
          <section className={`${embedded ? "mt-6" : "mt-10"} text-center`}>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] opacity-45">Acompanhe a marca</p>
            <h2 className={`${embedded ? "text-xl" : "text-2xl"} mt-2 font-black tracking-[-0.03em]`}>Fique por dentro das novidades</h2>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {(socialLinks.length ? socialLinks : [
                { kind: "instagram", label: "Instagram", url: "#" },
                { kind: "facebook", label: "Facebook", url: "#" },
                { kind: "tiktok", label: "TikTok", url: "#" },
                { kind: "youtube", label: "YouTube", url: "#" },
              ]).map((link: any) => (
                <a
                  key={`${link.kind}-${link.label}`}
                  href={interactive && socialLinks.length ? normalizeLink(link.kind, link.url) : undefined}
                  onClick={(event) => { if (!interactive || !socialLinks.length) event.preventDefault(); }}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-[116px] items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black transition hover:-translate-y-0.5"
                  style={{ borderColor: rgba(theme.text, 0.12), background: rgba(theme.text, 0.05), color: theme.primary }}
                >
                  <SocialIcon kind={link.kind} />
                  <span style={{ color: theme.text }}>{link.label || link.kind}</span>
                </a>
              ))}
            </div>
            {embedded && !socialLinks.length && <p className="mt-3 text-[10px] opacity-35">Prévia: os botões reais aparecem quando o lojista cadastrar suas redes.</p>}
          </section>
        )}

        <footer className={`${embedded ? "mt-7" : "mt-12"} flex flex-col items-center justify-center gap-3 pb-3 text-center`}>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.26em] opacity-45"><Sparkles className="h-3 w-3" /> Bio Commerce by Fidelize</div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[9px] opacity-35"><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Experiência rápida</span><span className="inline-flex items-center gap-1"><BadgePercent className="h-3 w-3" />Ofertas em destaque</span><span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />Marca conectada</span></div>
        </footer>
      </div>
    </div>
  );
}
