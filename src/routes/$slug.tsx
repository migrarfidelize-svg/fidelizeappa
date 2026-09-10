import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPublicLinkTreeBySlug, getLinkTreeBlockData } from "@/lib/linktree.functions";
import { trackChannelEvent, useChannelPageView } from "@/lib/tracking";
import { ExternalLink, Instagram, MessageCircle, Globe, MapPin, Youtube, Facebook, Music2, Mail, Phone, Star, Wifi, KeyRound, Copy, Check, Eye, EyeOff, UserPlus, UtensilsCrossed, CreditCard, PlayCircle, Music, Images as ImagesIcon, MessageSquareQuote, ChevronLeft, ChevronRight, X as XIcon, ZoomIn } from "lucide-react";
import { useEffect } from "react";


const opts = (slug: string) =>
  queryOptions({
    queryKey: ["public-linktree", slug],
    queryFn: () => getPublicLinkTreeBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/$slug")({
  loader: async ({ params, context }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!d) throw notFound();
    const { applySeoCacheHeaders } = await import("@/lib/seo-cache.server");
    applySeoCacheHeaders({
      version: [
        (d as any).page?.updated_at,
        (d as any).establishment?.updated_at,
        (d as any).establishment?.logo_url,
        (d as any).links?.length,
      ],
    });
    return d;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.establishment.name} — Links` },
          { name: "description", content: loaderData.page?.description ?? loaderData.establishment.description ?? `Links oficiais de ${loaderData.establishment.name}` },
          { property: "og:title", content: `${loaderData.establishment.name} — Links` },
          { property: "og:description", content: loaderData.page?.description ?? `Links oficiais de ${loaderData.establishment.name}` },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "Não encontrado" }, { name: "robots", content: "noindex" }],
  }),
  component: PublicLinkTreePage,
  errorComponent: ({ error }) => {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "INACTIVE") {
      return (
        <div className="min-h-dvh grid place-items-center p-6 text-center bg-neutral-950 text-white">
          <div>
            <h1 className="font-display text-3xl font-bold">Estabelecimento indisponível</h1>
            <p className="text-white/60 mt-2">Esta página está temporariamente desativada.</p>
            <Link to="/" className="mt-6 inline-block underline">Voltar</Link>
          </div>
        </div>
      );
    }
    if (msg === "UNPUBLISHED") {
      return (
        <div className="min-h-dvh grid place-items-center p-6 text-center bg-neutral-950 text-white">
          <div>
            <h1 className="font-display text-3xl font-bold">Página em construção</h1>
            <p className="text-white/60 mt-2">Este estabelecimento ainda não publicou seus links.</p>
            <Link to="/" className="mt-6 inline-block underline">Voltar</Link>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-center bg-neutral-950 text-white">
        <div>
          <h1 className="font-display text-3xl font-bold">Ops! Algo deu errado</h1>
          <p className="text-white/60 mt-2">Não foi possível carregar a página. Tente novamente em instantes.</p>
          <Link to="/" className="mt-6 inline-block underline">Voltar</Link>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center p-6 text-center bg-neutral-950 text-white">
      <div>
        <h1 className="font-display text-3xl font-bold">Página não encontrada</h1>
        <p className="text-white/60 mt-2">O link pode ter sido removido ou não existe.</p>
        <Link to="/" className="mt-6 inline-block underline">Voltar</Link>
      </div>
    </div>
  ),
});

const KIND_ICONS: Record<string, any> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music2,
  youtube: Youtube,
  site: Globe,
  google: Star,
  maps: MapPin,
  email: Mail,
  phone: Phone,
  wifi: Wifi,
  pix: KeyRound,
  cardapio: UtensilsCrossed,
  cartao: CreditCard,
  custom: ExternalLink,
};

function decodeWifi(url: string): { ssid: string; password: string } {
  const s = /WIFI:.*?S:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const p = /WIFI:.*?P:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (v: string) => v.replace(/\\(.)/g, "$1");
  return { ssid: unesc(s), password: unesc(p) };
}

type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
const PIX_TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Aleatória",
};
function decodePix(url: string): { type: PixKeyType; key: string; name: string } {
  const t = (/PIX:.*?T:([^;]+);/i.exec(url)?.[1] ?? "email") as PixKeyType;
  const k = /PIX:.*?K:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const n = /PIX:.*?N:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (v: string) => v.replace(/\\(.)/g, "$1");
  const valid: PixKeyType[] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];
  return { type: valid.includes(t) ? t : "email", key: unesc(k), name: unesc(n) };
}



function normalizeUrl(kind: string, url: string) {
  const u = url.trim();
  if (kind === "whatsapp") {
    const digits = u.replace(/\D/g, "");
    if (digits && !u.startsWith("http")) return `https://wa.me/${digits}`;
  }
  if (kind === "email" && !u.startsWith("mailto:") && u.includes("@")) return `mailto:${u}`;
  if (kind === "phone" && !u.startsWith("tel:")) return `tel:${u.replace(/\s/g, "")}`;
  if (kind === "instagram" && !u.startsWith("http")) return `https://instagram.com/${u.replace(/^@/, "")}`;
  if (!/^https?:\/\//i.test(u) && !u.startsWith("mailto:") && !u.startsWith("tel:")) return `https://${u}`;
  return u;
}

function PublicLinkTreePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  const est = data!.establishment;
  const page = data!.page;
  const links = data!.links ?? [];
  useChannelPageView(slug, "linktree");

  const hasRichBlocks = useMemo(
    () => links.some((l: any) => ["menu_carousel", "reviews"].includes(l.kind)),
    [links],
  );
  const blockDataQ = useQuery({
    queryKey: ["public-linktree-blocks", slug],
    queryFn: () => getLinkTreeBlockData({ data: { slug } }),
    enabled: hasRichBlocks,
    staleTime: 60_000,
  });
  const blockData = blockDataQ.data ?? { menu: [], catalog: [], reviews: [], stats: null };


  const theme = (page?.theme as Record<string, string> | null) ?? {};
  const primary = theme.primary || est.primary_color || "#0ea5e9";
  const accent = theme.accent || est.accent_color || "#8b5cf6";
  const bg = theme.background || "#0b0f19";
  const text = theme.text || "#ffffff";
  const rounded =
    theme.rounded === "sm" ? "rounded-md"
    : theme.rounded === "md" ? "rounded-lg"
    : theme.rounded === "lg" ? "rounded-xl"
    : theme.rounded === "full" ? "rounded-full"
    : "rounded-2xl";
  const buttonStyle = theme.button_style || "solid";

  const title = page?.title || est.name;
  const description = page?.description ?? est.description;
  const logo = page?.logo_url ?? est.logo_url;
  const cover = page?.cover_url ?? est.cover_url;

  const buttonClass = (i: number) => {
    const grad = `linear-gradient(135deg, ${primary} 0%, ${accent} 120%)`;
    if (buttonStyle === "outline") {
      return { style: { borderColor: primary, color: text, background: "transparent" }, className: `border-2 ${rounded}` };
    }
    if (buttonStyle === "glass") {
      return { style: { background: "rgba(255,255,255,0.08)", color: text, backdropFilter: "blur(12px)" }, className: `border border-white/15 ${rounded}` };
    }
    return { style: { background: grad, color: "#fff" }, className: rounded };
  };

  return (
    <div className="min-h-dvh w-full" style={{ background: bg, color: text }}>
      {cover && (
        <div className="h-40 w-full overflow-hidden">
          <img src={cover} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover opacity-60" />
        </div>
      )}
      <div className="mx-auto max-w-md px-5 pb-16 pt-8 text-center">
        {logo ? (
          <img src={logo} alt={est.name} className="mx-auto h-24 w-24 rounded-2xl object-cover ring-2 ring-white/20" />
        ) : (
          <div
            className="mx-auto grid h-24 w-24 place-items-center rounded-2xl text-3xl font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
          >
            {est.name[0]}
          </div>
        )}
        <h1 className="mt-4 font-display text-2xl font-bold">{title}</h1>
        {description && <p className="mt-2 text-sm opacity-80">{description}</p>}

        <div className="mt-3 flex items-center justify-center">
          <SaveContactButton
            slug={slug}
            name={est.name}
            logo={logo ?? null}
            description={est.description ?? null}
            links={links}
            text={text}
            primary={primary}
          />
        </div>

        {links.length === 0 ? (
          <p className="mt-10 opacity-60 text-sm">Nenhum link disponível ainda.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {links.map((l, i) => {
              const Icon = KIND_ICONS[l.kind] ?? ExternalLink;
              const cfg = buttonClass(i);
              if (l.kind === "wifi") {
                return (
                  <li key={l.id}>
                    <WifiCard label={l.label} url={l.url} rounded={rounded} primary={primary} accent={accent} text={text} buttonStyle={buttonStyle} cfg={cfg} />
                  </li>
                );
              }
              if (l.kind === "pix") {
                return (
                  <li key={l.id}>
                    <PixCard label={l.label} url={l.url} rounded={rounded} primary={primary} accent={accent} text={text} buttonStyle={buttonStyle} cfg={cfg} />
                  </li>
                );
              }

              const RICH_KINDS = ["video", "spotify", "gallery", "menu_carousel", "reviews", "header_image"];
              if (RICH_KINDS.includes(l.kind)) {
                return (
                  <li key={l.id} className="text-left">
                    <RichBlock
                      link={l as any}
                      slug={slug}
                      blockData={blockData}
                      rounded={rounded}
                      primary={primary}
                      accent={accent}
                      text={text}
                    />
                  </li>
                );
              }

              return (
                <li key={l.id}>
                  <a
                    href={normalizeUrl(l.kind, l.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: l.id, ref_label: l.label })}
                    className={`flex items-center justify-center gap-3 px-5 py-4 text-sm font-semibold transition-transform active:scale-[0.97] hover:scale-[1.02] ${cfg.className}`}
                    style={cfg.style}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{l.label}</span>
                  </a>
                </li>
              );
            })}


          </ul>
        )}

        <div className="mt-12 text-[10px] uppercase tracking-widest opacity-50">
          <Link to="/">Powered by Fidelize</Link>
        </div>
      </div>
    </div>
  );
}

type BtnCfg = { style: React.CSSProperties; className: string };

function WifiCard({
  label, url, rounded, primary, accent, text, buttonStyle, cfg,
}: {
  label: string; url: string; rounded: string;
  primary: string; accent: string; text: string; buttonStyle: string; cfg: BtnCfg;
}) {
  const { ssid, password } = decodeWifi(url);
  const [open, setOpen] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState<"" | "ssid" | "pwd">("");

  const copy = async (v: string, which: "ssid" | "pwd", labelPt: string) => {
    if (!v || copied) return;
    try {
      await navigator.clipboard.writeText(v);
      setCopied(which);
      toast.success(`${labelPt} copiada`, { description: v.length > 40 ? v.slice(0, 40) + "…" : v });
      setTimeout(() => setCopied(""), 1400);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  const panelBg =
    buttonStyle === "glass"
      ? "rgba(255,255,255,0.06)"
      : buttonStyle === "outline"
      ? "transparent"
      : `linear-gradient(135deg, ${primary}22, ${accent}22)`;
  const panelBorder = buttonStyle === "outline" ? `2px solid ${primary}` : "1px solid rgba(255,255,255,0.15)";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-full flex items-center justify-center gap-3 px-5 py-4 text-sm font-semibold transition-transform active:scale-[0.97] hover:scale-[1.02] ${cfg.className}`}
        style={cfg.style}
      >
        <Wifi className="h-5 w-5" />
        <span>{label || "Wi-Fi do local"}</span>
      </button>

      {open && (
        <div
          className={`mt-2 px-4 py-4 text-left ${rounded}`}
          style={{ background: panelBg, border: panelBorder, color: text, backdropFilter: "blur(12px)" }}
        >
          <div className="space-y-2">
            <FieldRow
              k="Rede"
              v={ssid || "—"}
              copied={copied === "ssid"}
              onCopy={() => copy(ssid, "ssid", "Rede Wi-Fi")}
              text={text}
            />
            <FieldRow
              k="Senha"
              v={password ? (showPwd ? password : "•".repeat(Math.min(password.length, 12))) : "—"}
              copied={copied === "pwd"}
              onCopy={() => copy(password, "pwd", "Senha")}
              text={text}
              right={
                password ? (
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="opacity-70 hover:opacity-100"
                    aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                ) : null
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  k, v, copied, onCopy, text, right,
}: { k: string; v: string; copied: boolean; onCopy: () => void; text: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-sm">
      <span className="text-[10px] uppercase tracking-wider opacity-60 w-12 shrink-0">{k}</span>
      <span className="flex-1 truncate font-mono" style={{ color: text }}>{v}</span>
      {right}
      <button
        type="button"
        onClick={onCopy}
        disabled={copied}
        className="opacity-70 hover:opacity-100 transition disabled:cursor-not-allowed disabled:opacity-100"
        aria-label={`Copiar ${k}`}
        aria-live="polite"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function PixCard({
  label, url, rounded, primary, accent, text, buttonStyle, cfg,
}: {
  label: string; url: string; rounded: string;
  primary: string; accent: string; text: string; buttonStyle: string; cfg: BtnCfg;
}) {
  const { type, key, name } = decodePix(url);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"" | "key" | "name">("");

  const copy = async (v: string, which: "key" | "name", labelPt: string) => {
    if (!v || copied) return;
    try {
      await navigator.clipboard.writeText(v);
      setCopied(which);
      toast.success(`${labelPt} copiada`, { description: v.length > 40 ? v.slice(0, 40) + "…" : v });
      setTimeout(() => setCopied(""), 1400);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  const panelBg =
    buttonStyle === "glass"
      ? "rgba(255,255,255,0.06)"
      : buttonStyle === "outline"
      ? "transparent"
      : `linear-gradient(135deg, ${primary}22, ${accent}22)`;
  const panelBorder = buttonStyle === "outline" ? `2px solid ${primary}` : "1px solid rgba(255,255,255,0.15)";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`w-full flex items-center justify-center gap-3 px-5 py-4 text-sm font-semibold transition-transform active:scale-[0.97] hover:scale-[1.02] ${cfg.className}`}
        style={cfg.style}
      >
        <KeyRound className="h-5 w-5" />
        <span>{label || (name ? `Pix · ${name}` : "Chave Pix")}</span>
      </button>

      {open && (
        <div
          className={`mt-2 px-4 py-4 text-left ${rounded}`}
          style={{ background: panelBg, border: panelBorder, color: text, backdropFilter: "blur(12px)" }}
        >
          <p className="text-[10px] uppercase tracking-wider opacity-60 mb-2">
            Tipo · {PIX_TYPE_LABEL[type]}
          </p>
          <div className="space-y-2">
            <FieldRow
              k="Chave"
              v={key || "—"}
              copied={copied === "key"}
              onCopy={() => copy(key, "key", "Chave Pix")}
              text={text}
            />
            {name && (
              <FieldRow
                k="Nome"
                v={name}
                copied={copied === "name"}
                onCopy={() => copy(name, "name", "Nome do beneficiário")}
                text={text}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function vcardEscape(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function buildVCard(opts: {
  name: string;
  description: string | null;
  logoUrl: string | null;
  phones: string[];
  emails: string[];
  urls: string[];
}) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vcardEscape(opts.name)}`, `N:${vcardEscape(opts.name)};;;;`, `ORG:${vcardEscape(opts.name)}`];
  if (opts.description) lines.push(`NOTE:${vcardEscape(opts.description)}`);
  opts.phones.forEach((p) => lines.push(`TEL;TYPE=CELL,VOICE:${p}`));
  opts.emails.forEach((e) => lines.push(`EMAIL;TYPE=INTERNET:${e}`));
  opts.urls.forEach((u) => lines.push(`URL:${u}`));
  if (opts.logoUrl) lines.push(`PHOTO;VALUE=URI:${opts.logoUrl}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function SaveContactButton({
  slug, name, logo, description, links, text, primary,
}: {
  slug: string;
  name: string;
  logo: string | null;
  description: string | null;
  links: { id: string; kind: string; label: string; url: string }[];
  text: string;
  primary: string;
}) {
  const phones = Array.from(
    new Set(
      links
        .filter((l) => l.kind === "phone" || l.kind === "whatsapp")
        .map((l) => {
          const digits = l.url.replace(/\D/g, "");
          if (!digits) return "";
          return l.kind === "whatsapp" || digits.length > 10 ? `+${digits}` : digits;
        })
        .filter(Boolean),
    ),
  );
  const emails = Array.from(
    new Set(
      links
        .filter((l) => l.kind === "email")
        .map((l) => l.url.replace(/^mailto:/i, "").trim())
        .filter((v) => v.includes("@")),
    ),
  );
  const urls = Array.from(
    new Set(
      links
        .filter((l) => ["site", "instagram", "facebook", "tiktok", "youtube", "maps", "google", "cardapio", "cartao", "custom"].includes(l.kind))
        .map((l) => normalizeUrl(l.kind, l.url)),
    ),
  );

  const handleDownload = () => {
    const vcf = buildVCard({ name, description, logoUrl: logo, phones, emails, urls });
    const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w\-]+/g, "_") || "contato"}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast.success("Contato baixado", { description: "Abra o arquivo para adicionar à sua agenda." });
    trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: "save-contact", ref_label: "Salvar contato" });
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      aria-label="Salvar contato na agenda"
      title="Salvar contato na agenda"
      className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium opacity-70 transition hover:opacity-100 hover:bg-white/10 backdrop-blur"
      style={{ color: text, borderColor: `${primary}55` }}
    >
      <UserPlus className="h-3.5 w-3.5" />
      <span>Salvar contato</span>
    </button>
  );
}

// ============================================================================
// Rich blocks
// ============================================================================
type RichLink = {
  id: string;
  kind: string;
  label: string;
  url: string;
  data?: Record<string, any> | null;
};
type BlockData = {
  menu: Array<{ id: string; name: string; short_desc: string | null; price: number | null; promo_price: number | null; image_url: string | null }>;
  catalog: Array<{ id: string; name: string; short_desc: string | null; price: number | null; promo_price: number | null; image_url: string | null }>;
  reviews: Array<{ id: string; rating: number | null; comment: string | null; merchant_reply: string | null; submitted_at: string | null; customer_name: string }>;
  stats: { count: number; avg: number } | null;
};

function parseVideoUrl(u: string): { kind: "youtube" | "vimeo" | "tiktok" | "file" | "unknown"; embed?: string; direct?: string } {
  const url = (u ?? "").trim();
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

function parseSpotifyUrl(u: string): string | null {
  const m = /open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/i.exec((u ?? "").trim());
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`;
}

function fmtBRL(n: number | null) {
  if (n == null) return "";
  try { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); } catch { return `R$ ${n.toFixed(2)}`; }
}

function BlockCard({ title, icon, rounded, primary, accent, children }: { title?: string; icon?: React.ReactNode; rounded: string; primary: string; accent: string; children: React.ReactNode }) {
  return (
    <div
      className={`overflow-hidden ${rounded}`}
      style={{
        background: `linear-gradient(135deg, ${primary}18, ${accent}12)`,
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(12px)",
      }}
    >
      {title && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-wider opacity-80">
          {icon}
          <span>{title}</span>
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}

function RichBlock({
  link, slug, blockData, rounded, primary, accent, text,
}: {
  link: RichLink; slug: string; blockData: BlockData; rounded: string;
  primary: string; accent: string; text: string;
}) {
  const d = (link.data ?? {}) as Record<string, any>;

  if (link.kind === "header_image") {
    const src = String(d.image_url ?? "");
    const href = String(d.link_url ?? "").trim();
    if (!src) return null;
    const img = (
      <img
        src={src}
        alt={link.label || ""}
        loading="lazy"
        decoding="async"
        className={`w-full h-auto object-cover ${rounded}`}
      />
    );
    return href ? (
      <a
        href={normalizeUrl("custom", href)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: link.id, ref_label: link.label })}
        className="block"
      >
        {img}
      </a>
    ) : img;
  }

  if (link.kind === "video") {
    const parsed = parseVideoUrl(String(d.url ?? ""));
    if (parsed.kind === "unknown") return null;
    return (
      <BlockCard title={link.label} icon={<PlayCircle className="h-3.5 w-3.5" />} rounded={rounded} primary={primary} accent={accent}>
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "16/9" }}>
          {parsed.embed ? (
            <iframe
              src={parsed.embed}
              title={link.label || "Vídeo"}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : parsed.direct ? (
            <video src={parsed.direct} controls playsInline className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
        </div>
      </BlockCard>
    );
  }

  if (link.kind === "spotify") {
    const embed = parseSpotifyUrl(String(d.url ?? ""));
    if (!embed) return null;
    return (
      <BlockCard title={link.label} icon={<Music className="h-3.5 w-3.5" />} rounded={rounded} primary={primary} accent={accent}>
        <iframe
          src={embed}
          title={link.label || "Spotify"}
          className="w-full rounded-lg"
          style={{ height: 152, border: 0 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </BlockCard>
    );
  }

  if (link.kind === "gallery") {
    const images: string[] = Array.isArray(d.images) ? d.images.filter((s: any) => typeof s === "string" && s.trim()) : [];
    if (images.length === 0) return null;
    return (
      <BlockCard title={link.label} icon={<ImagesIcon className="h-3.5 w-3.5" />} rounded={rounded} primary={primary} accent={accent}>
        <GalleryGrid images={images} label={link.label || "Imagem"} primary={primary} />
      </BlockCard>
    );
  }


  if (link.kind === "menu_carousel") {
    const source = (d.source ?? "menu") as "menu" | "catalog";
    const limit = Math.max(3, Math.min(12, Number(d.limit ?? 8)));
    const items = (source === "catalog" ? blockData.catalog : blockData.menu).slice(0, limit);
    if (items.length === 0) return null;
    return (
      <BlockCard title={link.label || (source === "catalog" ? "Catálogo" : "Cardápio")} icon={<UtensilsCrossed className="h-3.5 w-3.5" />} rounded={rounded} primary={primary} accent={accent}>
        <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((it) => {
            const priceEl = it.promo_price != null && it.promo_price < (it.price ?? Infinity) ? (
              <div className="text-xs">
                <span className="line-through opacity-60 mr-1">{fmtBRL(it.price)}</span>
                <span className="font-semibold" style={{ color: primary }}>{fmtBRL(it.promo_price)}</span>
              </div>
            ) : it.price != null ? (
              <div className="text-xs font-semibold" style={{ color: primary }}>{fmtBRL(it.price)}</div>
            ) : null;
            return (
              <div key={it.id} className="w-40 shrink-0 snap-start rounded-lg overflow-hidden bg-black/25">
                {it.image_url ? (
                  <img src={it.image_url} alt={it.name} loading="lazy" decoding="async" className="h-28 w-full object-cover" />
                ) : (
                  <div className="h-28 w-full grid place-items-center opacity-40 text-[10px]">Sem imagem</div>
                )}
                <div className="p-2 space-y-1">
                  <div className="text-xs font-semibold line-clamp-2" style={{ color: text }}>{it.name}</div>
                  {priceEl}
                </div>
              </div>
            );
          })}
        </div>
        <Link
          to={source === "catalog" ? "/catalogo/$slug" : "/cardapio/$slug"}
          params={{ slug }}
          onClick={() => trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: link.id, ref_label: link.label })}
          className="mt-2 block text-center text-xs font-semibold opacity-80 hover:opacity-100 underline underline-offset-2"
        >
          Ver {source === "catalog" ? "catálogo" : "cardápio"} completo →
        </Link>
      </BlockCard>
    );
  }

  if (link.kind === "reviews") {
    const min = Number(d.min_rating ?? 4);
    const limit = Math.max(1, Math.min(10, Number(d.limit ?? 3)));
    const filtered = blockData.reviews.filter((r) => (r.rating ?? 0) >= min).slice(0, limit);
    if (filtered.length === 0) return null;
    const avg = blockData.stats?.avg ?? null;
    return (
      <BlockCard title={link.label || "O que dizem sobre nós"} icon={<MessageSquareQuote className="h-3.5 w-3.5" />} rounded={rounded} primary={primary} accent={accent}>
        {avg != null && (
          <div className="flex items-center justify-center gap-1 mb-2 text-xs">
            <Star className="h-3.5 w-3.5" style={{ color: primary, fill: primary }} />
            <span className="font-semibold">{avg.toFixed(1)}</span>
            <span className="opacity-60">· {blockData.stats!.count} avaliações</span>
          </div>
        )}
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg bg-black/25 p-3">
              <div className="flex items-center gap-1 text-xs">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className="h-3 w-3" style={{ color: primary, fill: (r.rating ?? 0) >= n ? primary : "transparent" }} />
                ))}
                <span className="ml-1 opacity-70">{r.customer_name}</span>
              </div>
              {r.comment && <p className="mt-1 text-xs opacity-90">"{r.comment}"</p>}
              {r.merchant_reply && (
                <p className="mt-1 pl-2 border-l-2 text-[11px] opacity-75" style={{ borderColor: primary }}>
                  <strong>Resposta:</strong> {r.merchant_reply}
                </p>
              )}
            </div>
          ))}
        </div>
      </BlockCard>
    );
  }

  return null;
}

// ============================================================================
// GalleryGrid — grid responsivo + lightbox com teclado, swipe e miniaturas
// ============================================================================
function GalleryGrid({ images, label, primary }: { images: string[]; label: string; primary: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const count = images.length;

  const close = () => setOpenIdx(null);
  const prev = () => setOpenIdx((i) => (i == null ? i : (i - 1 + count) % count));
  const next = () => setOpenIdx((i) => (i == null ? i : (i + 1) % count));

  useEffect(() => {
    if (openIdx == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdx, count]);

  // Swipe (touch) no lightbox
  const touchRef = { current: null as null | { x: number; y: number } };
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    }
    touchRef.current = null;
  };

  return (
    <>
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: count === 1 ? "1fr" : count === 2 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
        }}
      >
        {images.map((src, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setOpenIdx(idx)}
            className="group relative overflow-hidden rounded-lg bg-black/25 focus:outline-none focus:ring-2"
            style={{ aspectRatio: "1 / 1", ["--tw-ring-color" as any]: primary }}
            aria-label={`Ampliar ${label} ${idx + 1}`}
          >
            <img
              src={src}
              alt={`${label} ${idx + 1}`}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
              <ZoomIn className="h-6 w-6 text-white drop-shadow" />
            </div>
          </button>
        ))}
      </div>

      {openIdx != null && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={`${label} — imagem ${openIdx + 1} de ${count}`}
          onClick={close}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 text-white text-sm" onClick={(e) => e.stopPropagation()}>
            <span className="tabular-nums font-mono opacity-80">
              {openIdx + 1} / {count}
            </span>
            <button
              type="button"
              onClick={close}
              className="rounded-full p-2 hover:bg-white/10 transition"
              aria-label="Fechar"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Imagem principal */}
          <div
            className="relative flex-1 grid place-items-center overflow-hidden px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[openIdx]}
              alt={`${label} ${openIdx + 1}`}
              className="max-h-[80vh] max-w-full object-contain select-none"
              draggable={false}
            />

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); prev(); }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur p-2 sm:p-3 text-white transition"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); next(); }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur p-2 sm:p-3 text-white transition"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                </button>
              </>
            )}
          </div>

          {/* Miniaturas */}
          {count > 1 && (
            <div className="p-3" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {images.map((src, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setOpenIdx(idx)}
                    className={`shrink-0 overflow-hidden rounded-md transition ${idx === openIdx ? "ring-2 opacity-100" : "opacity-50 hover:opacity-100"}`}
                    style={{ ["--tw-ring-color" as any]: primary }}
                    aria-label={`Ir para imagem ${idx + 1}`}
                    aria-current={idx === openIdx ? "true" : undefined}
                  >
                    <img src={src} alt="" className="h-14 w-14 object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
