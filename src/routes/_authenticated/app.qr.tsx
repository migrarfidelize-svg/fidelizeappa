import { RouteLoading } from "@/components/RouteLoading";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogoPaletteSync } from "@/components/LogoPaletteSync";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  Star, Copy, Share2, FileImage, FileText, Lock, Sparkles, Radio, CheckCircle2, AlertTriangle,
  Save, Layers, Eye, Trash2, Palette, ShoppingBag, Move, RotateCcw, XCircle,
  Wifi, QrCode as QrCodeIcon, CreditCard, PawPrint, Bike, Snowflake, ParkingCircle,
  Printer, ScanLine, Cloud, UserCircle2, Maximize2, Ruler, X, Check,
  FlipHorizontal2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHero } from "@/components/PageHero";
import { QrDestinationCard } from "@/components/QrDestinationCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { useMyFeature } from "@/hooks/useMyFeature";

import { DisplayStorePreview } from "@/components/DisplayStorePreview";
import { PrintOrderDialog } from "@/components/PrintOrderDialog";
import { LogoUploadButton } from "@/components/LogoUploadButton";
import { QrTagsManager } from "@/components/QrTagsManager";


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


import {
  listPosterDesigns, savePosterDesign, applyPosterDesign, deletePosterDesign,
  getQrScanStats,
} from "@/lib/poster-designs.functions";
import { persistJson, readJson } from "@/lib/idb-storage";
import { getQrDestinationStatus } from "@/lib/linktree.functions";
import { qrDestinationPath, buildFidelizeUrl } from "@/lib/qr-destination-url";

const URL_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "is.gd", "buff.ly",
  "encurtador.com.br", "cutt.ly", "rebrand.ly", "shorturl.at", "rb.gy",
]);

/** Root registrable-ish domain (last two labels). Good enough for a UI hint. */
function rootDomain(host: string): string {
  const parts = host.toLowerCase().split(".");
  return parts.length <= 2 ? host.toLowerCase() : parts.slice(-2).join(".");
}

type QrDest = "reviews" | "linktree" | "landing" | "menu" | "catalog";
type CopyPreset = {
  title: string;
  subtitle: string;
  ctaNearQR: string;
  ctaFooter: string;
  primaryLabel: string;
};
const COPY_PRESETS: Record<QrDest, CopyPreset> = {
  reviews: {
    title: "Como foi seu atendimento?",
    subtitle: "Sua opinião ajuda nossa equipe a melhorar. Leva menos de 30 segundos.",
    ctaNearQR: "Aponte a câmera para avaliar",
    ctaFooter: "Escaneie e conte pra gente",
    primaryLabel: "Avalie nosso atendimento",
  },
  landing: {
    title: "Ganhe carimbos a cada visita",
    subtitle: "Junte carimbos e troque por recompensas exclusivas. Ative seu cartão em 10 segundos.",
    ctaNearQR: "Aponte a câmera e ative seu cartão",
    ctaFooter: "Escaneie e comece a acumular",
    primaryLabel: "Meu Cartão Fidelidade",
  },
  menu: {
    title: "Nosso cardápio digital",
    subtitle: "Fotos, preços e novidades sempre atualizados. Aponte a câmera e peça sem esperar.",
    ctaNearQR: "Aponte a câmera para ver o cardápio",
    ctaFooter: "Escaneie para abrir o cardápio",
    primaryLabel: "Ver cardápio",
  },
  linktree: {
    title: "Tudo sobre a gente",
    subtitle: "Cardápio, redes sociais, Wi‑Fi e Pix num só lugar. É só apontar a câmera.",
    ctaNearQR: "Aponte a câmera para abrir",
    ctaFooter: "Escaneie para ver tudo",
    primaryLabel: "Nossos links",
  },
  catalog: {
    title: "Nosso catálogo digital",
    subtitle: "Confira nossos produtos, coleções e novidades em tempo real.",
    ctaNearQR: "Aponte a câmera para ver o catálogo",
    ctaFooter: "Escaneie para abrir o catálogo",
    primaryLabel: "Ver catálogo",
  },
};

import { buildDefaultDesignName, QR_DEST_LABEL as DEST_LABEL } from "@/lib/qr-design-name";


export const Route = createFileRoute("/_authenticated/app/qr")({
  head: () => ({ meta: [{ title: "QR Codes — Fidelize" }] }),
  validateSearch: (search: Record<string, unknown>) => {
    const d = String(search?.dest ?? "");
    return { 
      dest: (["reviews", "linktree", "landing", "menu", "catalog"].includes(d) ? d : undefined) as QrDest | undefined,
      source: (search?.source as string) || undefined,
    } as { dest?: QrDest; source?: string };
  },

  component: ReviewQrPage,
});


/** Poster formats — landscape 15×10cm is the default. */
type FormatKey = "counter15x10" | "story" | "feed" | "a5";
const FORMATS: Record<FormatKey, { label: string; aspect: string; mm: { w: number; h: number }; description: string; orientation: "landscape" | "portrait" | "square" }> = {
  counter15x10: { label: "Balcão 10×15", aspect: "2 / 3", mm: { w: 100, h: 150 }, description: "Padrão vertical para balcão e mesa", orientation: "portrait" },
  a5:           { label: "Mesa 7×10cm", aspect: "7 / 10", mm: { w: 70, h: 100 }, description: "Adesivo frontal para suporte de mesa (7×10cm + 3mm sangria)", orientation: "portrait" },
  feed:         { label: "Feed 1:1", aspect: "1 / 1", mm: { w: 200, h: 200 }, description: "Instagram/Feed", orientation: "square" },
  story:        { label: "Story 9:16", aspect: "9 / 16", mm: { w: 108, h: 192 }, description: "Story/Reels", orientation: "portrait" },
};

type Destination = "fidelize" | "google";
type TemplateKey = "glass" | "minimal" | "bold" | "editorial";

const TEMPLATES: Record<TemplateKey, { label: string; description: string; defaults: { primaryColor: string; backgroundColor: string; textColor: string } }> = {
  glass:     { label: "Glass Cyan",  description: "Fundo escuro com brilho cyan (padrão)", defaults: { primaryColor: "#00c2c7", backgroundColor: "#0d1117", textColor: "#ffffff" } },
  minimal:   { label: "Minimal",     description: "Branco limpo, tipografia sóbria",       defaults: { primaryColor: "#111827", backgroundColor: "#ffffff", textColor: "#111827" } },
  bold:      { label: "Bold",        description: "Cor cheia, contraste alto",             defaults: { primaryColor: "#ffffff", backgroundColor: "#ff5b3d", textColor: "#ffffff" } },
  editorial: { label: "Editorial",   description: "Sépia sofisticado, estilo revista",     defaults: { primaryColor: "#8b6f3a", backgroundColor: "#f4ede0", textColor: "#2a1f14" } },
};

type SavedDesign = {
  id: string;
  name: string;
  createdAt: number;
  data: {
    template: TemplateKey;
    format: FormatKey;
    destination: Destination;
    googleUrl: string;
    showGoogleLogo: boolean;
    nfcMode: boolean;
    title: string;
    subtitle: string;
    ctaNearQR: string;
    ctaFooter: string;
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
  };
};

/** Draggable elements on the poster canvas. */
type LayoutKey = "header" | "title" | "subtitle" | "primaryQr" | "secondaryQr" | "nfc" | "ctaNear" | "ctaFooter";
type LayoutPos = { x: number; y: number }; // percent 0-100 (element center)
type PosterLayout = Record<LayoutKey, LayoutPos>;

const DEFAULT_LAYOUT: PosterLayout = {
  header:      { x: 50, y: 14 },
  title:       { x: 50, y: 37 },
  subtitle:    { x: 50, y: 43 },
  primaryQr:   { x: 50, y: 65 },
  secondaryQr: { x: 74, y: 65 },
  nfc:         { x: 50, y: 80 },
  ctaNear:     { x: 50, y: 87 },
  ctaFooter:   { x: 50, y: 94 },
};


/** Layouts ajustados por formato — canvas quadrado (feed) e paisagem precisam
 * de espaçamento vertical mais denso para não sobrepor a estrela ao QR. */
const LAYOUT_BY_FORMAT: Record<FormatKey, PosterLayout> = {
  counter15x10: DEFAULT_LAYOUT,
  a5:           DEFAULT_LAYOUT,
  story:        DEFAULT_LAYOUT,
  feed: {
    header:      { x: 50, y: 11 },
    title:       { x: 50, y: 24 },
    subtitle:    { x: 50, y: 33 },
    primaryQr:   { x: 50, y: 55 },
    secondaryQr: { x: 72, y: 55 },
    nfc:         { x: 50, y: 78 },
    ctaNear:     { x: 50, y: 88 },
    ctaFooter:   { x: 50, y: 95 },
  },
};

const LAYOUT_LANDSCAPE: PosterLayout = {
  header:      { x: 26, y: 20 },
  title:       { x: 26, y: 44 },
  subtitle:    { x: 26, y: 58 },
  ctaNear:     { x: 26, y: 72 },
  nfc:         { x: 26, y: 85 },
  primaryQr:   { x: 74, y: 40 },
  secondaryQr: { x: 74, y: 78 },
  ctaFooter:   { x: 50, y: 96 },
};

/** Preset badges the merchant can drop onto the poster. */
type BadgeKey = "stars5" | "wifi" | "pix" | "card" | "pet" | "delivery" | "ac" | "parking";
const BADGE_CATALOG: Record<BadgeKey, { label: string; Icon: LucideIcon; short: string }> = {
  stars5:   { label: "5 estrelas",              Icon: Star,          short: "★★★★★" },
  wifi:     { label: "Wi-Fi grátis",            Icon: Wifi,          short: "Wi-Fi grátis" },
  pix:      { label: "Aceitamos Pix",           Icon: QrCodeIcon,    short: "Aceitamos Pix" },
  card:     { label: "Aceitamos cartão",        Icon: CreditCard,    short: "Cartão / Débito" },
  pet:      { label: "Pet friendly",            Icon: PawPrint,      short: "Pet friendly" },
  delivery: { label: "Delivery próprio",        Icon: Bike,          short: "Delivery próprio" },
  ac:       { label: "Ambiente climatizado",    Icon: Snowflake,     short: "Ar-condicionado" },
  parking:  { label: "Estacionamento",          Icon: ParkingCircle, short: "Estacionamento" },
};
const BADGE_KEYS = Object.keys(BADGE_CATALOG) as BadgeKey[];
type BadgeInstance = { key: BadgeKey; x: number; y: number };
const DEFAULT_BADGE_POS: Record<BadgeKey, { x: number; y: number }> = {
  stars5:   { x: 22, y: 50 },
  wifi:     { x: 50, y: 30 },

  pix:      { x: 22, y: 72 },
  card:     { x: 78, y: 72 },
  pet:      { x: 22, y: 82 },
  delivery: { x: 78, y: 82 },
  ac:       { x: 22, y: 92 },
  parking:  { x: 78, y: 92 },
};

const LANDSCAPE_BADGE_POS: Record<BadgeKey, { x: number; y: number }> = {
  stars5:   { x: 26, y: 31 },
  wifi:     { x: 26, y: 14 },
  pix:      { x: 26, y: 76 },
  card:     { x: 26, y: 86 },
  pet:      { x: 74, y: 18 },
  delivery: { x: 74, y: 88 },
  ac:       { x: 50, y: 90 },
  parking:  { x: 50, y: 82 },
};

function defaultBadgePosition(key: BadgeKey, isLandscape: boolean) {
  return isLandscape ? LANDSCAPE_BADGE_POS[key] : DEFAULT_BADGE_POS[key];
}

/** URL validation for QR destinations. */
type UrlCheck = { level: "empty" | "ok" | "warn" | "error"; message: string };

function checkGoogleUrl(v: string): UrlCheck {
  const t = v.trim();
  if (!t) return { level: "empty", message: 'Copie o link "Deixe uma avaliação" do seu Google Business.' };
  let u: URL;
  try { u = new URL(t); } catch { return { level: "error", message: "URL inválida — verifique se copiou o link completo." }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { level: "error", message: "O link deve começar com https://" };
  const ok = /^(g\.page|maps\.app\.goo\.gl|search\.google\.com|www\.google\.com|goo\.gl|maps\.google\.com)$/i;
  if (!ok.test(u.hostname)) return { level: "warn", message: `"${u.hostname}" não parece um domínio do Google (g.page, maps.app.goo.gl, google.com).` };
  if (u.protocol === "http:") return { level: "warn", message: "Preferimos https:// para evitar avisos de segurança no celular." };
  return { level: "ok", message: `Link Google válido — ${u.hostname}` };
}

function checkGenericUrl(v: string, referenceHost?: string): UrlCheck {
  const t = v.trim();
  if (!t) return { level: "empty", message: "Cole o link do cardápio, loja, WhatsApp ou Instagram." };
  let u: URL;
  try { u = new URL(t); } catch { return { level: "error", message: "URL inválida — comece com https:// e verifique se está completa." }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { level: "error", message: "O link deve começar com https://" };
  if (u.protocol === "http:") return { level: "warn", message: "Preferimos https:// para evitar avisos de segurança no celular." };
  if (URL_SHORTENERS.has(u.hostname.toLowerCase())) {
    return { level: "warn", message: `Encurtador detectado (${u.hostname}) — o cliente não vê o destino final. Prefira o link direto do seu domínio.` };
  }
  if (referenceHost && rootDomain(u.hostname) !== rootDomain(referenceHost)) {
    return { level: "warn", message: `O 2º QR aponta para "${u.hostname}", diferente de "${referenceHost}". Confirme que é seu — evita direcionar clientes a um domínio errado.` };
  }
  return { level: "ok", message: `Link válido — ${u.hostname}` };
}

/** Append UTM tags to a URL without breaking existing ones. */
function withUtm(rawUrl: string, campaign: string): string {
  try {
    const u = new URL(rawUrl);
    if (!u.searchParams.get("utm_source")) u.searchParams.set("utm_source", "qr_poster");
    if (!u.searchParams.get("utm_medium")) u.searchParams.set("utm_medium", "print");
    if (!u.searchParams.get("utm_campaign")) u.searchParams.set("utm_campaign", campaign || "review");
    return u.toString();
  } catch { return rawUrl; }
}

/** WCAG contrast ratio between two hex colors. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(v.padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relLum([r, g, b]: [number, number, number]): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrastRatio(a: string, b: string): number {
  const la = relLum(hexToRgb(a)); const lb = relLum(hexToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const QR_STEPS: { id: number; label: string; title: string; hint: string; icon: LucideIcon }[] = [
  { id: 1, label: "Destino", title: "Para onde o QR leva", hint: "Escolha o destino do scan, o link público e um 2º QR opcional.", icon: QrCodeIcon },
  { id: 2, label: "Formato", title: "Formato e modelo do cartaz", hint: "Tamanho da peça, logo do estabelecimento e estilo visual.", icon: Layers },
  { id: 3, label: "Conteúdo", title: "Textos e cores", hint: "Título, chamadas, escala tipográfica e paleta da peça.", icon: Palette },
  { id: 4, label: "Extras", title: "Designs e emblemas", hint: "Salve variações para a equipe e adicione selos ao cartaz.", icon: Sparkles },
  { id: 5, label: "Baixar", title: "Exportar e imprimir", hint: "PNG, PDF, SVG, link do QR e displays físicos de balcão.", icon: FileImage },
];

function QrStepper({ step, onSelect }: { step: number; onSelect: (s: number) => void }) {
  const pct = ((step - 1) / (QR_STEPS.length - 1)) * 100;
  return (
    <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-primary/20 bg-card/70 p-3 backdrop-blur-xl sm:p-4">
      <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative">
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-border/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(pct, 6)}%` }}
          />
        </div>

        <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QR_STEPS.map((s) => {
            const Icon = s.icon;
            const active = s.id === step;
            const done = s.id < step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={active ? "step" : undefined}
                className={`group relative flex min-w-[5.75rem] shrink-0 snap-start items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all duration-300 sm:min-w-[7.5rem] sm:flex-1 sm:gap-2.5 sm:px-3 sm:py-2.5 ${
                  active
                    ? "border-primary bg-primary/10 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.9)]"
                    : done
                      ? "border-primary/30 bg-primary/5 hover:border-primary/60"
                      : "border-border/60 bg-background/40 hover:border-primary/40"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-black transition ${
                    active ? "bg-primary text-primary-foreground" : done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Etapa {s.id}
                  </span>
                  <span className={`block truncate text-[13px] font-bold ${active ? "text-primary" : "text-foreground"}`}>
                    {s.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReviewQrPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const isPwa = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches || search.source === "pwa";
  const backTo = isPwa ? "/auth" : "/app";

  const [step, setStep] = useState(1);



  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as
    | { id: string; name: string; slug: string; primary_color?: string; accent_color?: string; logo_url?: string | null }
    | undefined;

  const { allowed, isLoading: featLoading } = useMyFeature(est?.id, "qr_generator");


  // Persisted preferences
  const storageKey = est ? `review-qr:${est.id}` : "review-qr:draft";
  const designsKey = est ? `review-qr-designs:${est.id}` : "review-qr-designs:draft";

  const [template, setTemplate] = useState<TemplateKey>("glass");
  const [format, setFormat] = useState<FormatKey>("counter15x10");

  const [destination, setDestination] = useState<Destination>("fidelize");
  const [qrDest, setQrDest] = useState<QrDest>("reviews");
  const [googleUrl, setGoogleUrl] = useState("");
  const [showGoogleLogo, setShowGoogleLogo] = useState(true);
  const [nfcMode, setNfcMode] = useState(false);
  const [contentScale, setContentScale] = useState(100); // % scale, 60–180
  const [ecc, setEcc] = useState<"L" | "M" | "Q" | "H">("H");
  const [utmEnabled, setUtmEnabled] = useState(true);
  const [bleedMarks, setBleedMarks] = useState(true);
  const [title, setTitle] = useState("Como foi seu atendimento?");
  const [subtitle, setSubtitle] = useState("Sua opinião ajuda nossa equipe a melhorar. Leva menos de 30 segundos.");
  const [ctaNearQR, setCtaNearQR] = useState("Aponte a câmera para avaliar");
  const [ctaFooter, setCtaFooter] = useState("Escaneie e conte pra gente");
  const [primaryColor, setPrimaryColor] = useState("#00c2c7");
  const [backgroundColor, setBackgroundColor] = useState("#0d1117");
  const [textColor, setTextColor] = useState("#ffffff");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [primaryLabel, setPrimaryLabel] = useState("Avalie nosso atendimento");
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  const [secondaryUrl, setSecondaryUrl] = useState("");
  const [secondaryLabel, setSecondaryLabel] = useState("Ver nosso cardápio");
  const [secondaryQrDataUrl, setSecondaryQrDataUrl] = useState("");
  const [exporting, setExporting] = useState(false);
  const [displayMode, setDisplayMode] = useState(false);
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [designName, setDesignName] = useState("");
  const [layout, setLayout] = useState<PosterLayout>(DEFAULT_LAYOUT);
  const [editLayout, setEditLayout] = useState(false);
  const [landscape, setLandscape] = useState(false);
  // Track the previous format so we can migrate default layouts on change
  // without wiping user customizations.
  const prevFormatRef = useRef<FormatKey>("counter15x10");
  const prevLandscapeRef = useRef(false);
  const [badges, setBadges] = useState<BadgeInstance[]>([{ key: "wifi", ...DEFAULT_BADGE_POS.wifi }]);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [savedTarget, setSavedTarget] = useState<"ls" | "idb" | "fail">("ls");
  const [savedTick, setSavedTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSavedTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const [printOpen, setPrintOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [realScale, setRealScale] = useState(false);
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [fullscreen]);
  const posterRef = useRef<HTMLDivElement>(null);

  const qc = useQueryClient();

  /* Cloud designs (shared between establishment members) */
  const listDesignsFn = useServerFn(listPosterDesigns);
  const saveDesignFn = useServerFn(savePosterDesign);
  const applyDesignFn = useServerFn(applyPosterDesign);
  const deleteDesignFn = useServerFn(deletePosterDesign);
  const { data: cloudDesigns } = useQuery({
    queryKey: ["poster-designs", est?.id],
    queryFn: () => listDesignsFn({ data: { establishmentId: est!.id } }),
    enabled: !!est?.id,
  });

  /* QR scan stats */
  const scanStatsFn = useServerFn(getQrScanStats);
  const { data: scanStats } = useQuery({
    queryKey: ["qr-scan-stats", est?.id],
    queryFn: () => scanStatsFn({ data: { establishmentId: est!.id } }),
    enabled: !!est?.id,
    refetchInterval: 60_000,
  });


  // Ref to the latest saveCurrentDesign, defined further below in the file
  const saveCurrentDesignRef = useRef<null | (() => Promise<void>)>(null);

  // Dialog state for confirming preset application when destination changes
  const [presetDialog, setPresetDialog] = useState<{
    open: boolean;
    to: QrDest | null;
    preset: CopyPreset | null;
    current: CopyPreset | null;
    hasEdits: boolean;
    fromLabel: string;
    toLabel: string;
  }>({ open: false, to: null, preset: null, current: null, hasEdits: false, fromLabel: "", toLabel: "" });


  const applyPreset = (preset: CopyPreset) => {
    setTitle(preset.title);
    setSubtitle(preset.subtitle);
    setCtaNearQR(preset.ctaNearQR);
    setCtaFooter(preset.ctaFooter);
    setPrimaryLabel(preset.primaryLabel);
  };

  // Listen to QR destination changes → open confirmation popup
  useEffect(() => {
    const destLabels: Record<QrDest, string> = {
      reviews: "Avaliação",
      landing: "Cartão Fidelidade",
      linktree: "Bio Commerce",
      menu: "Cardápio digital",
      catalog: "Catálogo digital",
    };
    function onChanged(e: Event) {
      const detail = (e as CustomEvent).detail as { from: QrDest; to: QrDest; establishmentId: string };
      if (!detail || !est?.id || detail.establishmentId !== est.id) return;
      setQrDest(detail.to);
      const from = COPY_PRESETS[detail.from];
      const to = COPY_PRESETS[detail.to];
      if (!from || !to) return;
      const stillDefault =
        title === from.title &&
        subtitle === from.subtitle &&
        ctaNearQR === from.ctaNearQR &&
        ctaFooter === from.ctaFooter &&
        primaryLabel === from.primaryLabel;
      setPresetDialog({
        open: true,
        to: detail.to,
        preset: to,
        current: { title, subtitle, ctaNearQR, ctaFooter, primaryLabel },
        hasEdits: !stillDefault,
        fromLabel: destLabels[detail.from] ?? "",
        toLabel: destLabels[detail.to] ?? "",
      });

    }
    window.addEventListener("qr-destination-changed", onChanged as EventListener);
    return () => window.removeEventListener("qr-destination-changed", onChanged as EventListener);
  }, [est?.id, title, subtitle, ctaNearQR, ctaFooter, primaryLabel]);

  // Load current QR destination for this establishment so the pre-defined
  // public URL in the editor reflects the destination selected in the card.
  const getQrDestFn = useServerFn(getQrDestinationStatus);
  const qrDestQuery = useQuery({
    queryKey: ["qr-destination", est?.id],
    queryFn: () => getQrDestFn({ data: { establishment_id: est!.id } }),
    enabled: !!est?.id,
  });
  useEffect(() => {
    const d = qrDestQuery.data?.destination as QrDest | undefined;
    if (d) setQrDest(d);
  }, [qrDestQuery.data?.destination]);




  // Load persisted state (localStorage → IndexedDB fallback)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const s = await readJson<Record<string, unknown>>(storageKey);
        if (s && !cancelled) {
          if (s.template) setTemplate(s.template as TemplateKey);
          if (s.format) setFormat(s.format as FormatKey);
          if (s.destination) setDestination(s.destination as typeof destination);
          if (typeof s.googleUrl === "string") setGoogleUrl(s.googleUrl);
          if (typeof s.showGoogleLogo === "boolean") setShowGoogleLogo(s.showGoogleLogo);
          if (typeof s.nfcMode === "boolean") setNfcMode(s.nfcMode);
          if (typeof s.contentScale === "number") setContentScale(s.contentScale);
          if (s.ecc === "L" || s.ecc === "M" || s.ecc === "Q" || s.ecc === "H") setEcc(s.ecc);
          if (typeof s.utmEnabled === "boolean") setUtmEnabled(s.utmEnabled);
          if (typeof s.bleedMarks === "boolean") setBleedMarks(s.bleedMarks);
          if (typeof s.title === "string") setTitle(s.title);
          if (typeof s.subtitle === "string") setSubtitle(s.subtitle);
          if (typeof s.ctaNearQR === "string") setCtaNearQR(s.ctaNearQR);
          if (typeof s.ctaFooter === "string") setCtaFooter(s.ctaFooter);
          if (typeof s.primaryColor === "string") setPrimaryColor(s.primaryColor);
          if (typeof s.backgroundColor === "string") setBackgroundColor(s.backgroundColor);
          if (typeof s.textColor === "string") setTextColor(s.textColor);
          if (typeof s.primaryLabel === "string") setPrimaryLabel(s.primaryLabel);
          if (typeof s.secondaryEnabled === "boolean") setSecondaryEnabled(s.secondaryEnabled);
          if (typeof s.secondaryUrl === "string") setSecondaryUrl(s.secondaryUrl);
          if (typeof s.secondaryLabel === "string") setSecondaryLabel(s.secondaryLabel);
          if (s.layout && typeof s.layout === "object") setLayout({ ...DEFAULT_LAYOUT, ...(s.layout as PosterLayout) });
          if (Array.isArray(s.badges)) {
            setBadges((s.badges as unknown[]).filter((b: unknown): b is BadgeInstance =>
              !!b && typeof b === "object"
              && typeof (b as BadgeInstance).key === "string"
              && (BADGE_KEYS as string[]).includes((b as BadgeInstance).key)
              && typeof (b as BadgeInstance).x === "number"
              && typeof (b as BadgeInstance).y === "number"
            ));
          }
        }
        const d = await readJson<SavedDesign[]>(designsKey);
        if (d && !cancelled) setDesigns(d);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [storageKey, designsKey]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      const result = await persistJson(storageKey, {
        template, format, destination, googleUrl, showGoogleLogo, nfcMode, contentScale,
        ecc, utmEnabled, bleedMarks,
        title, subtitle, ctaNearQR, ctaFooter,
        primaryColor, backgroundColor, textColor,
        primaryLabel, secondaryEnabled, secondaryUrl, secondaryLabel,
        layout, badges,
      });
      if (cancelled) return;
      setSavedTarget(result);
      if (result !== "fail") setLastSavedAt(Date.now());
      else toast.error("Falha ao salvar automaticamente — espaço do navegador esgotado.");
    }, 400);
    return () => { cancelled = true; window.clearTimeout(handle); };
  }, [storageKey, template, format, destination, googleUrl, showGoogleLogo, nfcMode, contentScale, ecc, utmEnabled, bleedMarks, title, subtitle, ctaNearQR, ctaFooter, primaryColor, backgroundColor, textColor, primaryLabel, secondaryEnabled, secondaryUrl, secondaryLabel, layout, badges]);

  function applyTemplate(key: TemplateKey) {
    setTemplate(key);
    const t = TEMPLATES[key];
    setPrimaryColor(t.defaults.primaryColor);
    setBackgroundColor(t.defaults.backgroundColor);
    setTextColor(t.defaults.textColor);
  }

  function persistDesigns(next: SavedDesign[]) {
    setDesigns(next);
    void persistJson(designsKey, next);
  }

  async function saveCurrentDesign() {
    const name = designName.trim() || buildDefaultDesignName(qrDest as any, cloudDesigns, designs);
    const payload = {
      template, format, destination, googleUrl, showGoogleLogo, nfcMode, contentScale,
      title, subtitle, ctaNearQR, ctaFooter,
      primaryColor, backgroundColor, textColor,
      primaryLabel, secondaryEnabled, secondaryUrl, secondaryLabel,
      layout, badges,
    };
    if (est?.id) {
      try {
        await saveDesignFn({ data: { establishmentId: est.id, name, data: payload } });
        setDesignName("");
        toast.success(`Design "${name}" salvo na nuvem`);
        qc.invalidateQueries({ queryKey: ["poster-designs", est.id] });
        return;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao salvar na nuvem — salvando local");
      }
    }
    const entry: SavedDesign = {
      id: (crypto?.randomUUID?.() ?? String(Date.now())),
      name,
      createdAt: Date.now(),
      data: {
        template, format, destination, googleUrl, showGoogleLogo, nfcMode,
        title, subtitle, ctaNearQR, ctaFooter,
        primaryColor, backgroundColor, textColor,
      },
    };
    persistDesigns([entry, ...designs].slice(0, 20));
    setDesignName("");
    toast.success(`Design "${name}" salvo (offline)`);
  }
  saveCurrentDesignRef.current = saveCurrentDesign;

  function loadDesign(d: SavedDesign) {
    const s = d.data;
    setTemplate(s.template);
    setFormat(s.format);
    setDestination(s.destination);
    setGoogleUrl(s.googleUrl);
    setShowGoogleLogo(s.showGoogleLogo);
    setNfcMode(s.nfcMode);
    setTitle(s.title);
    setSubtitle(s.subtitle);
    setCtaNearQR(s.ctaNearQR);
    setCtaFooter(s.ctaFooter);
    setPrimaryColor(s.primaryColor);
    setBackgroundColor(s.backgroundColor);
    setTextColor(s.textColor);
    toast.success(`Design "${d.name}" carregado`);
  }

  function applyCloudDesign(d: { id: string; name: string; data: Record<string, unknown> }) {
    const s = d.data as Record<string, unknown>;
    if (typeof s.template === "string") setTemplate(s.template as TemplateKey);
    if (typeof s.format === "string") setFormat(s.format as FormatKey);
    if (typeof s.destination === "string") setDestination(s.destination as Destination);
    if (typeof s.googleUrl === "string") setGoogleUrl(s.googleUrl);
    if (typeof s.showGoogleLogo === "boolean") setShowGoogleLogo(s.showGoogleLogo);
    if (typeof s.nfcMode === "boolean") setNfcMode(s.nfcMode);
    if (typeof s.contentScale === "number") setContentScale(s.contentScale);
    if (typeof s.title === "string") setTitle(s.title);
    if (typeof s.subtitle === "string") setSubtitle(s.subtitle);
    if (typeof s.ctaNearQR === "string") setCtaNearQR(s.ctaNearQR);
    if (typeof s.ctaFooter === "string") setCtaFooter(s.ctaFooter);
    if (typeof s.primaryColor === "string") setPrimaryColor(s.primaryColor);
    if (typeof s.backgroundColor === "string") setBackgroundColor(s.backgroundColor);
    if (typeof s.textColor === "string") setTextColor(s.textColor);
    if (typeof s.primaryLabel === "string") setPrimaryLabel(s.primaryLabel);
    if (typeof s.secondaryEnabled === "boolean") setSecondaryEnabled(s.secondaryEnabled);
    if (typeof s.secondaryUrl === "string") setSecondaryUrl(s.secondaryUrl);
    if (typeof s.secondaryLabel === "string") setSecondaryLabel(s.secondaryLabel);
    if (s.layout && typeof s.layout === "object") setLayout({ ...DEFAULT_LAYOUT, ...(s.layout as PosterLayout) });
    if (Array.isArray(s.badges)) setBadges(s.badges as BadgeInstance[]);
    applyDesignFn({ data: { id: d.id } })
      .then(() => qc.invalidateQueries({ queryKey: ["poster-designs", est?.id] }))
      .catch(() => { /* silent */ });
    toast.success(`Design "${d.name}" aplicado`);
  }

  async function removeCloudDesign(id: string) {
    try {
      await deleteDesignFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["poster-designs", est?.id] });
      toast.success("Design removido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover");
    }
  }

  function deleteDesign(id: string) {
    persistDesigns(designs.filter(d => d.id !== id));
    toast.success("Design local removido");
  }

  /* Badge helpers */
  function toggleBadge(key: BadgeKey) {
    setBadges((prev) => {
      const exists = prev.find((b) => b.key === key);
      if (exists) return prev.filter((b) => b.key !== key);
      const def = defaultBadgePosition(key, landscape);
      return [...prev, { key, x: def.x, y: def.y }];
    });
  }
  function moveBadge(key: BadgeKey, x: number, y: number) {
    setBadges((prev) => prev.map((b) => (b.key === key ? { ...b, x, y } : b)));
  }



  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrDestPath = qrDestinationPath(qrDest);
  const fidelizeUrl = est ? buildFidelizeUrl(origin, est.slug, qrDest) : "";
  const rawTargetUrl = destination === "fidelize" ? fidelizeUrl : googleUrl.trim();
  const primaryIsPlaceholder = destination === "google" && !rawTargetUrl;
  const baseTargetUrl = rawTargetUrl || (destination === "google"
    ? "https://g.page/exemplo-fidelize/review"
    : "https://fidelize.app/preview");
  const targetUrl = utmEnabled ? withUtm(baseTargetUrl, est?.slug ?? "review") : baseTargetUrl;

  const googleCheck = useMemo(() => checkGoogleUrl(googleUrl), [googleUrl]);
  const secondaryRawUrl = secondaryUrl.trim();
  const primaryHost = useMemo(() => {
    try { return new URL(rawTargetUrl || fidelizeUrl).hostname; } catch { return undefined; }
  }, [rawTargetUrl, fidelizeUrl]);
  const secondaryCheck = useMemo(() => checkGenericUrl(secondaryUrl, primaryHost), [secondaryUrl, primaryHost]);
  const googleReady = destination === "google" && googleCheck.level === "ok";
  const secondaryIsPlaceholder = secondaryEnabled && !secondaryRawUrl;
  const secondaryReady = secondaryEnabled && secondaryCheck.level === "ok";
  const primaryBlocking = destination === "google" && (googleCheck.level === "error" || googleCheck.level === "empty");
  const secondaryBlocking = secondaryEnabled && (secondaryCheck.level === "error" || secondaryCheck.level === "empty");
  const secondaryTargetUrl = useMemo(() => {
    const raw = secondaryRawUrl || "https://fidelize.app/preview-cardapio";
    return utmEnabled ? withUtm(raw, est?.slug ?? "review") : raw;
  }, [secondaryRawUrl, utmEnabled, est?.slug]);

  /* Encoded URL that actually goes into the QR image — routes through the
     public tracker so scans are counted server-side. Falls back to the raw
     targetUrl during SSR / when we don't have a slug yet. */
  const qrEncodedPrimaryUrl = useMemo(() => {
    if (!est?.slug || !origin) return targetUrl;
    // Only route Fidelize destinations through the tracker (Google/etc redirect
    // straight to the merchant destination for max compatibility).
    if (destination !== "fidelize") return targetUrl;
    return `${origin}/api/public/r/qr/${est.slug}/main`;
  }, [origin, est?.slug, targetUrl, destination]);
  const qrEncodedSecondaryUrl = useMemo(() => {
    if (!est?.slug || !origin) return secondaryTargetUrl;
    const u = new URL(`${origin}/api/public/r/qr/${est.slug}/second`);
    u.searchParams.set("u", secondaryTargetUrl);
    return u.toString();
  }, [origin, est?.slug, secondaryTargetUrl]);

  // Contrast / readability diagnostics
  const textBgRatio = useMemo(() => contrastRatio(textColor, backgroundColor), [textColor, backgroundColor]);
  const qrCodeRatio = contrastRatio("#111827", "#ffffff"); // QR dark vs light

  useEffect(() => {
    QRCode.toDataURL(qrEncodedPrimaryUrl, {
      width: 1200, margin: 1, errorCorrectionLevel: ecc,
      color: { dark: "#111827", light: "#ffffff" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [qrEncodedPrimaryUrl, ecc]);

  useEffect(() => {
     if (!secondaryEnabled) {
      setSecondaryQrDataUrl("");
      // Com apenas 1 QR, centralizamos automaticamente o QR principal.
      setLayout((prev) => (prev.primaryQr.x === DEFAULT_LAYOUT.primaryQr.x && prev.primaryQr.y === DEFAULT_LAYOUT.primaryQr.y
        ? prev
        : { ...prev, primaryQr: { ...DEFAULT_LAYOUT.primaryQr } }));
      return;
    }
    setLayout((prev) => {
      const primaryUntouched = prev.primaryQr.x === DEFAULT_LAYOUT.primaryQr.x && prev.primaryQr.y === DEFAULT_LAYOUT.primaryQr.y;
      const secondaryUntouched = prev.secondaryQr.x === DEFAULT_LAYOUT.secondaryQr.x && prev.secondaryQr.y === DEFAULT_LAYOUT.secondaryQr.y;
      if (!primaryUntouched && !secondaryUntouched) return prev;
      return {
        ...prev,
        primaryQr: primaryUntouched ? { x: 22, y: 58 } : prev.primaryQr,
        secondaryQr: secondaryUntouched ? { x: 78, y: 58 } : prev.secondaryQr,
      };
    });
    QRCode.toDataURL(qrEncodedSecondaryUrl, {
      width: 1200, margin: 1, errorCorrectionLevel: ecc,
      color: { dark: "#111827", light: "#ffffff" },
    }).then(setSecondaryQrDataUrl).catch(() => setSecondaryQrDataUrl(""));
  }, [secondaryEnabled, qrEncodedSecondaryUrl, ecc]);

  const baseDims = FORMATS[format];
  const dims = landscape
    ? {
        ...baseDims,
        label: `${baseDims.label} · horizontal`,
        aspect: baseDims.aspect.split("/").reverse().join(" / "),
        mm: { w: baseDims.mm.h, h: baseDims.mm.w },
        orientation: "landscape" as const,
      }
    : baseDims;

  // Ao trocar de formato ou orientação, migra o layout se estava no default
  // do formato anterior (evita elementos sobrepostos, principalmente no Feed
  // 1:1 e na versão horizontal). Se o usuário customizou, apenas clampa.
  useEffect(() => {
    const prevF = prevFormatRef.current;
    const prevL = prevLandscapeRef.current;
    if (prevF === format && prevL === landscape) return;
    const prevDefault = prevL ? LAYOUT_LANDSCAPE : LAYOUT_BY_FORMAT[prevF];
    const isPristine = JSON.stringify(layout) === JSON.stringify(prevDefault);
    const nextDefault = landscape ? LAYOUT_LANDSCAPE : LAYOUT_BY_FORMAT[format];
    if (isPristine) {
      setLayout(nextDefault);
    } else {
      // Clampa cada item na área útil (2–98%) para evitar overflow silencioso.
      setLayout((cur) => {
        const out = { ...cur } as PosterLayout;
        (Object.keys(out) as LayoutKey[]).forEach((k) => {
          out[k] = {
            x: Math.max(4, Math.min(96, out[k].x)),
            y: Math.max(4, Math.min(96, out[k].y)),
          };
        });
        return out;
      });
    }
    // Migra badges que ainda estavam no default anterior; em especial a
    // estrela 5★, que no horizontal precisa ficar acima do título para não
    // encavalar com texto/QR. Se o usuário moveu manualmente, apenas clampa.
    setBadges((prev) =>
      prev.map((b) => {
        const prevBadgeDefault = defaultBadgePosition(b.key, prevL);
        const badgePristine = Math.abs(b.x - prevBadgeDefault.x) < 0.01 && Math.abs(b.y - prevBadgeDefault.y) < 0.01;
        const nextBadgeDefault = defaultBadgePosition(b.key, landscape);
        const next = badgePristine ? nextBadgeDefault : b;
        return {
          ...b,
          x: Math.max(4, Math.min(96, next.x)),
          y: Math.max(4, Math.min(96, next.y)),
        };
      })
    );
    prevFormatRef.current = format;
    prevLandscapeRef.current = landscape;
  }, [format, landscape, layout]);

  /**
   * Renders the poster to PNG at 300 DPI print resolution.
   * pixelRatio is computed from the on-screen preview size so the output
   * always matches (mm ÷ 25.4 × 300) px, no matter how big the preview is.
   */
  async function renderPosterPng(): Promise<string> {
    const el = posterRef.current;
    if (!el) throw new Error("Preview indisponível");
    const rect = el.getBoundingClientRect();
    // Social formats (Story/Feed) exportam na resolução nativa do Instagram
    // para preservar a proporção exata do post (1080×1920 e 1080×1080).
    // Print formats exportam a 300 DPI a partir do tamanho físico em mm.
    const socialTargetW =
      format === "story" ? 1080 :
      format === "feed" ? 1080 :
      null;
    const targetPx = socialTargetW ?? Math.max(600, Math.round((dims.mm.w / 25.4) * 300));
    const pixelRatio = Math.max(2, targetPx / Math.max(1, rect.width));
    // Force layout-guides off during export
    const wasEditing = editLayout;
    if (wasEditing) setEditLayout(false);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      return await toPng(el, {
        pixelRatio,
        cacheBust: true,
        filter: (node) => !(node instanceof HTMLElement && node.dataset?.exportIgnore === "true"),
      });
    } finally {
      if (wasEditing) setEditLayout(true);
    }
  }


  async function exportPng() {
    if (!posterRef.current) return;
    if (primaryBlocking) { toast.error(googleCheck.message); return; }
    if (secondaryBlocking) { toast.error(secondaryCheck.message); return; }
    setExporting(true);
    try {
      const url = await renderPosterPng();
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-avaliacao-${est?.slug ?? "estabelecimento"}-${format}-300dpi.png`;
      a.click();
      if (format === "story") toast.success("PNG baixado (1080×1920 · Story/Reels)");
      else if (format === "feed") toast.success("PNG baixado (1080×1080 · Feed)");
      else toast.success(`PNG 300 DPI baixado (${Math.round((dims.mm.w/25.4)*300)}×${Math.round((dims.mm.h/25.4)*300)}px)`);

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar PNG");
    } finally { setExporting(false); }
  }

  async function exportPdf() {
    if (!posterRef.current) return;
    if (primaryBlocking) { toast.error(googleCheck.message); return; }
    if (secondaryBlocking) { toast.error(secondaryCheck.message); return; }
    setExporting(true);
    try {
      const url = await renderPosterPng();
      const mmW = dims.mm.w;
      const mmH = dims.mm.h;
      const bleed = bleedMarks ? 3 : 0;          // 3 mm sangria
      const pageW = mmW + bleed * 2;
      const pageH = mmH + bleed * 2;
      const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: pageW > pageH ? "landscape" : "portrait", compress: true });
      // Place the artwork inset by the bleed so the design covers to the trim edges
      pdf.addImage(url, "PNG", bleed, bleed, mmW, mmH, undefined, "FAST");

      if (bleedMarks) {
        // Crop marks (marcas de corte) — 5 mm long, 0.2 mm thick, 3 mm offset from trim
        const markLen = 5;
        const off = 1; // gap between trim and mark start
        pdf.setLineWidth(0.15);
        pdf.setDrawColor(0, 0, 0);
        const corners: Array<[number, number]> = [
          [bleed, bleed],                 // top-left
          [bleed + mmW, bleed],           // top-right
          [bleed, bleed + mmH],           // bottom-left
          [bleed + mmW, bleed + mmH],     // bottom-right
        ];
        for (const [x, y] of corners) {
          const dx = x < bleed + mmW / 2 ? -1 : 1;
          const dy = y < bleed + mmH / 2 ? -1 : 1;
          // horizontal mark
          pdf.line(x + dx * off, y, x + dx * (off + markLen), y);
          // vertical mark
          pdf.line(x, y + dy * off, x, y + dy * (off + markLen));
        }
        // Small footer info (outside trim area, in the bleed margin)
        pdf.setFontSize(5);
        pdf.setTextColor(120);
        pdf.text(`Trim ${mmW}×${mmH}mm · Bleed 3mm · 300 DPI · RGB (converta para CMYK na gráfica)`, bleed, pageH - 0.8);
      }

      pdf.save(`qr-avaliacao-${est?.slug ?? "estabelecimento"}-${format}-${bleedMarks ? "print" : "300dpi"}.pdf`);
      toast.success(bleedMarks
        ? `PDF de impressão baixado (${mmW}×${mmH}mm + 3mm sangria + marcas de corte)`
        : `PDF 300 DPI baixado (${mmW}×${mmH}mm)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar PDF");
    } finally { setExporting(false); }
  }

  async function exportSvg() {
    if (primaryBlocking) { toast.error(googleCheck.message); return; }
    setExporting(true);
    try {
      let svg = await QRCode.toString(targetUrl, {
        type: "svg", errorCorrectionLevel: ecc, margin: 1,
        color: { dark: "#111827", light: "#ffffff" },
      });
      // Normalize header: garantir xmlns, viewBox e tamanho responsivo (100%)
      // para renderizar corretamente em qualquer editor (Illustrator, Figma,
      // Canva) e no upload do Instagram.
      const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
      const widthMatch = svg.match(/<svg[^>]*\swidth="([^"]+)"/);
      const heightMatch = svg.match(/<svg[^>]*\sheight="([^"]+)"/);
      let vb = viewBoxMatch?.[1];
      if (!vb && widthMatch && heightMatch) {
        const w = parseFloat(widthMatch[1]);
        const h = parseFloat(heightMatch[1]);
        if (!Number.isNaN(w) && !Number.isNaN(h)) vb = `0 0 ${w} ${h}`;
      }
      // Reescreve a tag <svg ...> preservando o restante do documento
      svg = svg.replace(/<svg\b[^>]*>/, (_tag) => {
        const attrs = [
          'xmlns="http://www.w3.org/2000/svg"',
          'xmlns:xlink="http://www.w3.org/1999/xlink"',
          vb ? `viewBox="${vb}"` : "",
          'width="100%"',
          'height="100%"',
          'preserveAspectRatio="xMidYMid meet"',
          'shape-rendering="crispEdges"',
        ].filter(Boolean).join(" ");
        return `<svg ${attrs}>`;
      });
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-avaliacao-${est?.slug ?? "estabelecimento"}-vetorial.svg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("SVG vetorial baixado — escala infinita para gráfica");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar SVG");
    } finally { setExporting(false); }
  }


  async function share() {
    if (!targetUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: "Avalie nosso atendimento", url: targetUrl });
      else { await navigator.clipboard.writeText(targetUrl); toast.success("Link copiado"); }
    } catch { /* cancelled */ }
  }

  const [copiedPublic, setCopiedPublic] = useState(false);
  async function copyLink() {
    if (!targetUrl) return;
    await navigator.clipboard.writeText(targetUrl);
    toast.success("Link copiado");
  }
  async function copyPublicUrl() {
    if (!fidelizeUrl) return;
    try {
      await navigator.clipboard.writeText(fidelizeUrl);
      setCopiedPublic(true);
      toast.success("Link público copiado");
      setTimeout(() => setCopiedPublic(false), 1800);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }


  async function copyNfcUrl() {
    if (!targetUrl) return;
    await navigator.clipboard.writeText(targetUrl);
    toast.success("URL copiada — cole no app do seu NFC tag (NFC Tools, etc.)");
  }

  if (!est) return <RouteLoading label="Carregando…" fullscreen={false} className="min-h-[40vh]" />;

  if (!featLoading && !allowed) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-8">
        <Card className="border-primary/30">
          <CardContent className="space-y-4 p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">QR de avaliação</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Recurso opcional. Faça upgrade para gerar um QR Code dedicado à página pública de avaliações.
              </p>
            </div>
            <ul className="mx-auto max-w-md space-y-1 text-left text-sm text-muted-foreground">
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Página pública <code>/{qrDestPath}/{est.slug}</code></li>
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Cartaz 15×10 para balcão, mesa e recibo</li>
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Modo NFC + 2º QR para cardápio/loja</li>
            </ul>
            <Button asChild size="lg" className="mt-2"><Link to="/app/planos">Ver planos disponíveis</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-clip p-3 sm:p-4 md:p-8">
      <PageHero
        icon={Star}
        eyebrow="Marketing · QR"
        title="QR Code do estabelecimento"
        subtitle="Um único cartaz, três destinos: Avaliação, Bio Commerce ou Cartão Fidelidade. Escolha abaixo para onde o cliente será direcionado ao escanear."
      />

      {step === 1 && (
        <>
          <QrDestinationCard establishmentId={est.id} initialDest={search.dest} />
          <QrTagsManager establishmentId={est.id} />
        </>
      )}

      <QrStepper step={step} onSelect={setStep} />


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* CONTROLS — glass panel */}
        <Card id="qr-editor" className="scroll-mt-4 border-primary/15 bg-card/70 backdrop-blur-xl">
          <CardContent className="space-y-6 p-4 sm:p-5">
            <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                {(() => { const I = QR_STEPS[step - 1].icon; return <I className="h-4 w-4" />; })()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold">{QR_STEPS[step - 1].title}</div>
                <div className="text-[11px] text-muted-foreground">{QR_STEPS[step - 1].hint}</div>
              </div>
            </div>

            {/* Destination — Main QR */}
            {step === 1 && (
            <>
            <div className="space-y-3">

              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">QR principal</Label>

              {/* Fidelize-only destination */}
              <div className="rounded-lg border bg-background/50 p-3 text-xs">
                <div className="text-muted-foreground">Link público (pré-definido)</div>
                <div className="mt-1 flex min-w-0 items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-muted/60 px-2 py-1 text-primary">{fidelizeUrl}</code>
                  <Button
                    size="sm"
                    variant={copiedPublic ? "default" : "outline"}
                    className="h-8 shrink-0 gap-1.5 px-2.5"
                    onClick={copyPublicUrl}
                    disabled={!fidelizeUrl || copiedPublic}
                    aria-label="Copiar link público"
                  >
                    {copiedPublic ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{copiedPublic ? "Copiado" : "Copiar"}</span>
                  </Button>
                </div>
              </div>



              {/* Editable label shown ON the poster below the main QR */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">Texto no cartaz (QR principal)</Label>
                <Input
                  value={primaryLabel}
                  onChange={(e) => setPrimaryLabel(e.target.value)}
                  placeholder="Ex: Avalie nosso atendimento"
                  maxLength={40}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Secondary QR — Cardápio / Loja / etc */}
            <div className="space-y-3 rounded-xl border border-dashed border-border/60 p-3">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-primary" /> Adicionar 2º QR Code
                  </div>
                  <div className="text-[11px] text-muted-foreground">Cardápio, loja, WhatsApp, Instagram — qualquer link extra no mesmo cartaz.</div>
                </div>
                <Switch checked={secondaryEnabled} onCheckedChange={setSecondaryEnabled} />
              </label>

              {secondaryEnabled && (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground">Link do 2º QR</Label>
                    <Input
                      value={secondaryUrl}
                      onChange={(e) => setSecondaryUrl(e.target.value)}
                      placeholder="https://seurestaurante.com/cardapio"
                      maxLength={500}
                      aria-invalid={secondaryCheck.level === "error"}
                      className={`text-xs transition-colors ${
                        secondaryCheck.level === "error" ? "border-destructive focus-visible:ring-destructive/40" :
                        secondaryCheck.level === "warn"  ? "border-amber-500/60" :
                        secondaryCheck.level === "ok"    ? "border-emerald-500/60" : ""
                      }`}
                    />
                    <ValidationLine check={secondaryCheck} />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{secondaryUrl.length}/500</span>
                      {secondaryUrl && (
                        <button type="button" onClick={() => setSecondaryUrl("")} className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive">
                          <XCircle className="h-3 w-3" /> limpar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-muted-foreground">Texto no cartaz (2º QR)</Label>
                    <Input
                      value={secondaryLabel}
                      onChange={(e) => setSecondaryLabel(e.target.value)}
                      placeholder="Ex: Ver nosso cardápio"
                      maxLength={40}
                      className="text-xs"
                    />
                  </div>


                </div>
              )}
            </div>


            {/* NFC (moved above templates) */}
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3">
              <div className="flex items-start gap-2">
                <Radio className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold">Modo NFC</div>
                  <div className="text-[11px] text-muted-foreground">Adiciona o selo NFC no cartaz e libera o botão para gravar a URL em uma tag física.</div>
                </div>
              </div>
              <Switch
                checked={nfcMode}
                onCheckedChange={(v) => {
                  setNfcMode(v);
                  if (v) setLayout((prev) => ({ ...prev, nfc: { ...DEFAULT_LAYOUT.nfc } }));
                }}
              />
            </label>
            </>
            )}







            {/* Format */}
            {step === 2 && (
            <>
            <div className="space-y-3">

              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Formato do cartaz</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(FORMATS) as FormatKey[]).map((k) => {
                  const f = FORMATS[k];
                  const active = format === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFormat(k)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition ${active ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/40"}`}
                    >
                      <div
                        className={`border-2 rounded-sm ${active ? "border-primary" : "border-muted-foreground/50"}`}
                        style={{
                          width: f.orientation === "landscape" ? 32 : f.orientation === "square" ? 22 : 18,
                          height: f.orientation === "landscape" ? 22 : f.orientation === "square" ? 22 : 32,
                        }}
                      />
                      <span className={`text-[10px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>{f.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">{dims.description} · {dims.mm.w}×{dims.mm.h}mm</div>

              {/* CTA: Loja física */}
              <button
                type="button"
                onClick={() => document.getElementById("loja-displays")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="group relative w-full overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/10 to-accent/15 p-3 text-left transition hover:border-primary hover:shadow-[0_0_30px_-8px_hsl(var(--primary)/0.6)]"
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <div className="relative flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-foreground">Adquira seu display físico de balcão</div>
                    <div className="text-[11px] text-muted-foreground">Transforme mais clientes em avaliações 5★ — acrílico premium, NFC e brilho de vitrine.</div>
                  </div>
                  <span className="text-primary transition-transform group-hover:translate-x-1">→</span>
                </div>
              </button>
            </div>

            {/* Logo do estabelecimento */}
            {est && (
              <div className="space-y-3">
                <Label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <FileImage className="h-3.5 w-3.5" /> Logo do estabelecimento
                </Label>
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
                  <div
                    className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-lg border border-border/60"
                    style={{ background: est.logo_url ? "#ffffff" : "hsl(var(--muted))" }}
                  >
                    {est.logo_url ? (
                      <img src={est.logo_url} alt={est.name} className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {est.name.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      {est.logo_url ? "Aparece no topo do cartaz." : "Envie um logo para exibir no cartaz."}
                    </p>
                    <LogoUploadButton
                      establishmentId={est.id}
                      currentLogoUrl={est.logo_url}
                      size="sm"
                      variant="outline"
                      invalidateKeys={[["poster-designs", est.id]]}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Templates */}

            <div className="space-y-3">
              <Label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Layers className="h-3.5 w-3.5" /> Modelo de cartaz
              </Label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => {
                  const t = TEMPLATES[k];
                  const active = template === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => applyTemplate(k)}
                      title={`${t.label} — ${t.description}`}
                      className={`group relative overflow-hidden rounded-lg border-2 p-1.5 text-left transition ${active ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-primary/40"}`}
                    >
                      <div className="mb-1 grid h-6 grid-cols-3 gap-0.5 rounded-sm p-0.5" style={{ background: t.defaults.backgroundColor }}>
                        <div className="rounded-[2px]" style={{ background: t.defaults.primaryColor }} />
                        <div className="rounded-[2px]" style={{ background: t.defaults.textColor, opacity: 0.6 }} />
                        <div className="rounded-[2px]" style={{ background: t.defaults.primaryColor, opacity: 0.5 }} />
                      </div>
                      <div className={`text-[10px] font-bold leading-tight truncate ${active ? "text-primary" : "text-foreground"}`}>{t.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            </>
            )}


            {step === 3 && (
            <>
            <div className="space-y-3">


              <div className="space-y-1.5">
                <Label className="text-xs">Título</Label>
                <Input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subtítulo</Label>
                <Textarea value={subtitle} maxLength={160} rows={2} onChange={(e) => setSubtitle(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Chamada perto do QR</Label>
                  <Input value={ctaNearQR} maxLength={40} onChange={(e) => setCtaNearQR(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rodapé</Label>
                  <Input value={ctaFooter} maxLength={40} onChange={(e) => setCtaFooter(e.target.value)} />
                </div>
              </div>

              {/* Global text scale — impacts título, subtítulo, CTAs, rótulos e selo NFC */}
              <div className="space-y-1.5 rounded-lg border border-border/50 bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Tamanho dos textos</Label>
                  <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{contentScale}%</span>
                </div>
                <Slider
                  min={60}
                  max={180}
                  step={5}
                  value={[contentScale]}
                  onValueChange={(v) => setContentScale(v[0] ?? 100)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Ajusta título, subtítulo, chamadas, rótulos dos QRs e selo NFC de forma proporcional.
                </p>
              </div>
            </div>


            {/* Colors */}
            <LogoPaletteSync
              logoUrl={est?.logo_url ?? null}
              onApply={(p) => {
                setPrimaryColor(p.primary);
                setBackgroundColor(p.background);
                setTextColor(p.text);
              }}
              hint="Extraímos as cores da sua logo e ajustamos automaticamente cor principal, fundo e texto do QR/cartaz."
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor principal</Label>
                <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 p-1" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fundo</Label>
                <Input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-10 p-1" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Texto</Label>
                <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-10 p-1" />
              </div>
            </div>
            </>
            )}


            {/* Saved designs */}
            {step === 4 && (
            <>
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">

              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">
                <Palette className="h-3.5 w-3.5" /> Meus designs salvos
              </div>
              <div className="flex gap-2">
                <Input
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="Nome do design (ex: Balcão azul)"
                  className="h-9 text-xs"
                  maxLength={40}
                />
                <Button onClick={saveCurrentDesign} size="sm" className="h-9 shrink-0">
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar
                </Button>
              </div>
              {/* Cloud designs (shared between establishment members) */}
              {cloudDesigns && cloudDesigns.length > 0 && (
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {cloudDesigns.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 rounded-lg border bg-background/70 p-1.5">
                      <button
                        type="button"
                        onClick={() => applyCloudDesign({
                          id: d.id,
                          name: d.name,
                          data: (d.data && typeof d.data === "object" && !Array.isArray(d.data)) ? d.data as Record<string, unknown> : {},
                        })}
                        className="flex flex-1 items-center gap-2 rounded px-1.5 py-0.5 text-left hover:bg-primary/10"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
                          <Cloud className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">{d.name}</div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <UserCircle2 className="h-3 w-3" />
                            <span className="truncate">{d.applied_by_name ?? d.created_by_name ?? "Equipe"}</span>
                          </div>
                        </div>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeCloudDesign(d.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {designs.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Locais (offline)</div>
                  {designs.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 rounded-lg border bg-background/70 p-1.5">
                      <button
                        type="button"
                        onClick={() => loadDesign(d)}
                        className="flex flex-1 items-center gap-2 rounded px-1.5 py-0.5 text-left hover:bg-primary/10"
                      >
                        <div
                          className="h-6 w-6 shrink-0 rounded-md ring-1 ring-border"
                          style={{ background: `linear-gradient(135deg, ${d.data.backgroundColor} 50%, ${d.data.primaryColor} 50%)` }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">{d.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {TEMPLATES[d.data.template].label} · {FORMATS[d.data.format].label}
                          </div>
                        </div>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteDesign(d.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {(!cloudDesigns || cloudDesigns.length === 0) && designs.length === 0 && (
                <div className="text-[11px] text-muted-foreground">
                  Nenhum design salvo ainda. Ajuste as cores/textos e clique em Salvar para guardar variações — ficam disponíveis para toda a equipe.
                </div>
              )}
            </div>

            {/* Emblemas / selos arrastáveis */}
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-widest text-primary">
                <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Emblemas</span>
                <span className="text-[10px] font-normal normal-case text-muted-foreground">Arraste após adicionar</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {BADGE_KEYS.map((k) => {
                  const meta = BADGE_CATALOG[k];
                  const Icon = meta.Icon;
                  const active = badges.some((b) => b.key === k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleBadge(k)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] transition ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-semibold">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
              {badges.length > 0 && (
                <button
                  type="button"
                  onClick={() => setBadges([])}
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                >
                  Remover todos os emblemas
                </button>
              )}
            </div>
            </>
            )}


            {/* Scans do QR e Enviar para gráfica parceira — ocultos ao lojista por enquanto.
                Tracking e diálogo de impressão continuam disponíveis no código. */}



            {/* QR avançado + Impressão profissional — ocultos ao lojista.
                Estado permanece ativo com defaults: ecc="H", utmEnabled=true, bleedMarks=true.
                Contraste WCAG segue sendo calculado silenciosamente. */}

            {/* Actions */}
            {step === 5 && (
            <>
            <div className="grid grid-cols-2 gap-2 pt-1 [&_button]:h-11 [&_button]:text-xs sm:[&_button]:text-sm">
              <Button onClick={exportPng} disabled={exporting || !targetUrl}>
                <FileImage className="mr-2 h-4 w-4" /> Baixar PNG
              </Button>
              <Button onClick={exportPdf} disabled={exporting || !targetUrl} variant="outline">
                <FileText className="mr-2 h-4 w-4" /> Baixar PDF
              </Button>
              <Button onClick={exportSvg} disabled={exporting || !targetUrl} variant="outline">
                <FileImage className="mr-2 h-4 w-4" /> Baixar SVG
              </Button>
              <Button onClick={copyLink} variant="outline" disabled={!targetUrl}>
                <Copy className="mr-2 h-4 w-4" /> Copiar link
              </Button>
            </div>


            {/* ===== STORE PREVIEW: Adquirir display físico ===== */}
            <div id="loja-displays" className="scroll-mt-4"><DisplayStorePreview /></div>
            </>
            )}

            {/* Navegação entre etapas — fixa no rodapé do painel em telas pequenas */}
            <div className="sticky bottom-0 z-20 -mx-4 grid grid-cols-[auto_1fr_auto] items-center gap-2 border-t border-border/60 bg-card/95 px-3 py-3 backdrop-blur-md sm:static sm:mx-0 sm:flex sm:justify-between sm:gap-3 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-4 sm:backdrop-blur-none">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11 justify-self-start px-3 sm:h-9"
                onClick={() => {
                  if (step === 1) {
                    navigate({ to: backTo });
                  } else {
                    setStep((s) => Math.max(1, s - 1));
                  }
                }}
              >
                ← Voltar
              </Button>

              <span className="text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-[11px]">
                Etapa {step}/{QR_STEPS.length}
              </span>
              <Button
                type="button"
                size="sm"
                className="h-11 justify-self-end px-3 sm:h-9"
                disabled={step === QR_STEPS.length}
                onClick={() => setStep((s) => Math.min(QR_STEPS.length, s + 1))}
              >
                Avançar →
              </Button>
            </div>

          </CardContent>
        </Card>


        {/* PREVIEW */}
        <div id="qr-preview" className="min-w-0 scroll-mt-4">
          <div className="sticky top-4 flex flex-col items-center gap-3">

            {/* CTA: Loja física */}
            <div className="flex w-full max-w-[420px] items-center gap-2">
              <button
                type="button"
                onClick={() => document.getElementById("loja-displays")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="group relative flex flex-1 items-center justify-between overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/10 to-accent/15 p-3 text-left transition hover:border-primary hover:shadow-[0_0_30px_-8px_hsl(var(--primary)/0.6)]"
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative flex items-center gap-2 text-xs font-bold">
                  <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                  Quero meu display físico de balcão
                </span>
                <span className="relative text-primary transition-transform group-hover:translate-x-1">→</span>
              </button>
            </div>


            {lastSavedAt !== null && (
              <div className="sr-only" aria-live="polite">
                {savedTarget === "idb" ? "Salvo offline" : "Salvo"}
              </div>
            )}
            <div className="flex w-full max-w-[440px] flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-start">
            <div
              className="relative mx-auto w-full max-w-[360px] flex-1 sm:max-w-[320px]"

              style={displayMode ? { perspective: "1600px", perspectiveOrigin: "50% 65%" } : undefined}
            >

              {/* Showroom backdrop — dark wall + wooden counter (only in display mode) */}
              {displayMode && (
                <div className="pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10 overflow-hidden rounded-3xl">
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 25%, #1a2540 0%, #0a0e1a 55%, #05070d 100%)",
                    }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-[45%]"
                    style={{
                      background:
                        "linear-gradient(180deg, #3a2a1e 0%, #251710 45%, #120a06 100%)",
                      boxShadow: "inset 0 40px 60px -20px rgba(0,0,0,0.6)",
                    }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-[45%] opacity-40"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, transparent 0 40px, rgba(255,255,255,0.04) 40px 41px)",
                    }}
                  />
                  {/* warm counter glow */}
                  <div
                    className="absolute inset-x-0 bottom-[35%] h-24"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 100%, rgba(255,220,170,0.15), transparent 60%)",
                    }}
                  />
                </div>
              )}

              <div className="pointer-events-none absolute -inset-8 rounded-3xl bg-gradient-to-br from-primary/15 via-transparent to-transparent blur-3xl" />

              <div
                className="relative overflow-hidden rounded-lg shadow-2xl ring-1 ring-primary/20 transition-transform duration-500"
                style={{
                  aspectRatio: dims.aspect,
                  transform: displayMode ? "rotateX(12deg) rotateY(-3deg)" : undefined,
                  transformOrigin: "bottom center",
                  boxShadow: displayMode
                    ? "0 40px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,229,255,0.15)"
                    : undefined,
                }}
              >
                <PosterCanvas
                  ref={posterRef}
                  template={template}
                  format={format}
                  title={title}
                  subtitle={subtitle}
                  ctaNearQR={ctaNearQR}
                  ctaFooter={ctaFooter}
                  primaryColor={primaryColor}
                  backgroundColor={backgroundColor}
                  textColor={textColor}
                  qrDataUrl={qrDataUrl}
                  targetUrl={targetUrl}
                  establishmentName={est.name}
                  logoUrl={est.logo_url ?? null}
                  destination={destination}
                  showGoogleLogo={showGoogleLogo}
                  nfcMode={nfcMode}
                  contentScale={contentScale}
                  primaryLabel={primaryLabel}
                  secondaryEnabled={secondaryEnabled}
                  secondaryQrDataUrl={secondaryQrDataUrl}
                  secondaryLabel={secondaryLabel}
                  layout={layout}
                  setLayout={setLayout}
                  editable={editLayout}
                  badges={badges}
                  moveBadge={moveBadge}
                  landscape={landscape}
                />


                {/* Acrylic glare overlay (mounted inside so it inherits transform) */}
                {displayMode && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0 z-20"
                      style={{
                        background:
                          "linear-gradient(115deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.32) 48%, rgba(255,255,255,0.05) 55%, rgba(255,255,255,0.18) 66%, rgba(255,255,255,0) 78%)",
                        mixBlendMode: "screen",
                      }}
                    />
                    <div
                      className="pointer-events-none absolute inset-0 z-20"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 30%)",
                        mixBlendMode: "screen",
                      }}
                    />
                    {/* side acrylic edges */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[3px] bg-gradient-to-b from-white/70 via-white/25 to-white/40" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[3px] bg-gradient-to-b from-white/70 via-white/25 to-white/40" />
                  </>
                )}
              </div>

              {/* Acrylic L-stand base (horizontal foot rotated flat) */}
              {displayMode && (
                <div
                  className="pointer-events-none absolute left-1/2 z-10"
                  style={{
                    bottom: "-2px",
                    width: "108%",
                    height: "34px",
                    transform: "translateX(-50%) rotateX(78deg)",
                    transformOrigin: "top center",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(220,230,240,0.35) 55%, rgba(180,200,220,0.15) 100%)",
                    borderRadius: "6px",
                    boxShadow:
                      "0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.7)",
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 45%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.5) 55%, transparent 100%)",
                      opacity: 0.55,
                      mixBlendMode: "screen",
                    }}
                  />
                </div>
              )}

              {/* Contact shadow under stand */}
              {displayMode && (
                <div
                  className="pointer-events-none mx-auto mt-4 h-6 w-[80%] rounded-[50%]"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 45%, transparent 75%)",
                    filter: "blur(6px)",
                  }}
                />
              )}
            </div>

            {/* Layout editor controls — horizontal em mobile, vertical em ≥sm */}
            <div
              role="group"
              aria-label="Editor de posições do cartaz"
              className="flex w-full shrink-0 flex-row gap-2 pt-2 sm:w-10 sm:flex-col"
            >
              <Button
                type="button"
                size="sm"
                variant={editLayout ? "default" : "outline"}
                onClick={() => setEditLayout((v) => !v)}
                aria-label={editLayout ? "Concluir edição de posições" : "Editar posições dos elementos"}
                aria-pressed={editLayout}
                className="flex h-10 w-full flex-row items-center justify-center gap-1.5 px-2 text-xs sm:h-32 sm:w-10 sm:flex-col sm:px-0"
              >
                <Move className="h-3.5 w-3.5" />
                <span
                  className="font-semibold tracking-wider sm:[writing-mode:vertical-rl] sm:[transform:rotate(180deg)]"
                >
                  {editLayout ? "Concluir" : "Editar"}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={landscape ? "default" : "outline"}
                onClick={() => setLandscape((v) => !v)}
                aria-label={landscape ? "Voltar para orientação vertical" : "Girar para orientação horizontal"}
                aria-pressed={landscape}
                title={landscape ? "Voltar para vertical" : "Girar para horizontal"}
                className="flex h-10 w-full flex-row items-center justify-center gap-1.5 px-2 text-xs sm:h-32 sm:w-10 sm:flex-col sm:px-0"
              >
                <FlipHorizontal2 className="h-3.5 w-3.5" />
                <span className="font-semibold tracking-wider sm:[writing-mode:vertical-rl] sm:[transform:rotate(180deg)]">
                  {landscape ? "Vertical" : "Horizontal"}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const def = landscape ? LAYOUT_LANDSCAPE : LAYOUT_BY_FORMAT[format];
                  setLayout(def);
                  toast.success("Posições restauradas");
                }}
                aria-label="Restaurar posições padrão"
                className="flex h-10 w-full flex-row items-center justify-center gap-1.5 px-2 text-xs sm:h-32 sm:w-10 sm:flex-col sm:px-0"
                disabled={JSON.stringify(layout) === JSON.stringify(landscape ? LAYOUT_LANDSCAPE : LAYOUT_BY_FORMAT[format])}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span
                  className="font-semibold tracking-wider sm:[writing-mode:vertical-rl] sm:[transform:rotate(180deg)]"
                >
                  Resetar
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFullscreen(true)}
                aria-label="Inspecionar em tela cheia"
                title="Tela cheia (inspecionar escala real)"
                className="flex h-10 w-full flex-row items-center justify-center gap-1.5 px-2 text-xs sm:h-32 sm:w-10 sm:flex-col sm:px-0 border-primary/40"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="font-semibold tracking-wider sm:[writing-mode:vertical-rl] sm:[transform:rotate(180deg)]">
                  Tela cheia
                </span>
              </Button>

            </div>

            </div>

            <p className="text-center text-xs text-muted-foreground">

              {editLayout
                ? "Arraste cada elemento (logo, título, QR, textos) para reposicionar. Toque em Concluir para exportar."
                : displayMode
                ? "Simulação em display acrílico de balcão — inclinado 12° para trás."
                : `Preview em escala. Exportação em 300 DPI — ${Math.round((dims.mm.w/25.4)*300)}×${Math.round((dims.mm.h/25.4)*300)}px (${dims.mm.w}×${dims.mm.h}mm).`}
            </p>
          </div>
        </div>

      </div>

      {/* Atalho flutuante (mobile): alterna entre editor e prévia sem rolagem manual */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:bottom-4 lg:hidden">
        <button
          type="button"
          onClick={() => {
            const preview = document.getElementById("qr-preview");
            if (!preview) return;
            const r = preview.getBoundingClientRect();
            const previewVisible = r.top < window.innerHeight * 0.5 && r.bottom > 0;
            if (previewVisible) {
              document.getElementById("qr-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
              preview.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-5 text-sm font-bold text-primary shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.7)] backdrop-blur-md active:scale-95"
        >
          <Eye className="h-4 w-4" />
          Prévia / Editor
        </button>
      </div>



      {est && (
        <PrintOrderDialog
          open={printOpen}
          onOpenChange={setPrintOpen}
          establishmentId={est.id}
          establishmentSlug={est.slug}
          format={format}
          getPngBlob={async () => {
            try {
              const dataUrl = await renderPosterPng();
              const res = await fetch(dataUrl);
              return await res.blob();
            } catch { return null; }
          }}
          getSvgBlob={async () => {
            try {
              const svg = await QRCode.toString(qrEncodedPrimaryUrl, {
                type: "svg", errorCorrectionLevel: ecc, margin: 1,
                color: { dark: "#111827", light: "#ffffff" },
              });
              return new Blob([svg], { type: "image/svg+xml" });
            } catch { return null; }
          }}
        />
      )}

      <AlertDialog
        open={presetDialog.open}
        onOpenChange={(open) => setPresetDialog((s) => ({ ...s, open }))}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <AlertDialogTitle className="text-center text-xl">
              Aplicar textos sugeridos para {presetDialog.toLabel || "este destino"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {presetDialog.hasEdits ? (
                <>
                  Você tem <strong>edições personalizadas</strong> no cartaz atual
                  {presetDialog.fromLabel ? <> ({presetDialog.fromLabel})</> : null}.
                  Escolha se deseja salvar o design atual antes de trocar pelos textos otimizados para{" "}
                  <strong>{presetDialog.toLabel}</strong>.
                </>
              ) : (
                <>
                  Vamos adaptar título, subtítulo e chamadas do cartaz para o segmento{" "}
                  <strong>{presetDialog.toLabel}</strong>. Você pode editar depois.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {presetDialog.preset && presetDialog.current && (() => {
            const fields: Array<{ key: keyof CopyPreset; label: string }> = [
              { key: "title", label: "Título" },
              { key: "subtitle", label: "Subtítulo" },
              { key: "ctaNearQR", label: "CTA próx. ao QR" },
              { key: "ctaFooter", label: "CTA rodapé" },
              { key: "primaryLabel", label: "Botão primário" },
            ];
            const rows = fields.map((f) => {
              const from = (presetDialog.current as CopyPreset)[f.key] ?? "";
              const to = (presetDialog.preset as CopyPreset)[f.key] ?? "";
              return { ...f, from, to, changed: from !== to };
            });
            const changedCount = rows.filter((r) => r.changed).length;
            return (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Diferenças
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {changedCount === 0
                      ? "Nenhuma mudança"
                      : `${changedCount} campo${changedCount > 1 ? "s" : ""} alterado${changedCount > 1 ? "s" : ""}`}
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {rows.map((r) => (
                    <div
                      key={r.key as string}
                      className={`rounded-md border p-2 text-xs ${
                        r.changed
                          ? "border-amber-500/40 bg-amber-500/[0.04]"
                          : "border-border/40 bg-background/40 opacity-70"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold text-foreground">{r.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            r.changed
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.changed ? "muda" : "igual"}
                        </span>
                      </div>
                      {r.changed ? (
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                          <div className="rounded bg-rose-500/10 px-2 py-1 text-rose-300 line-through decoration-rose-500/50">
                            {r.from || <span className="italic opacity-60">vazio</span>}
                          </div>
                          <div className="hidden text-center text-muted-foreground sm:block">→</div>
                          <div className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-300">
                            {r.to || <span className="italic opacity-60">vazio</span>}
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground truncate">{r.to || "—"}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}


          <AlertDialogFooter className="sm:flex-col sm:space-x-0 sm:gap-2.5">
            {presetDialog.hasEdits ? (
              <>
                {/* PRIMARY — verde/emerald: ação recomendada (não perde nada) */}
                <AlertDialogAction
                  onClick={async () => {
                    const preset = presetDialog.preset;
                    try {
                      const name = buildDefaultDesignName(qrDest as any, cloudDesigns, designs);
                      setDesignName(name);
                      await saveCurrentDesignRef.current?.();
                    } finally {
                      if (preset) applyPreset(preset);
                    }
                  }}
                  className="group relative w-full h-auto justify-start gap-3 rounded-xl bg-emerald-600 px-4 py-3 text-left text-white shadow-lg shadow-emerald-600/25 ring-1 ring-emerald-400/40 hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                    <Save className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Recomendado</span>
                    <span className="text-sm font-semibold">Salvar design atual e aplicar</span>
                    <span className="text-[11px] font-normal text-white/80">Guarda uma cópia antes de trocar os textos</span>
                  </span>
                </AlertDialogAction>

                {/* SECONDARY — âmbar: aplica sem salvar (perde edições) */}
                <AlertDialogAction
                  onClick={() => presetDialog.preset && applyPreset(presetDialog.preset)}
                  className="group relative w-full h-auto justify-start gap-3 rounded-xl bg-amber-500 px-4 py-3 text-left text-white shadow-md shadow-amber-500/20 ring-1 ring-amber-300/40 hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-200"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/85">Atenção</span>
                    <span className="text-sm font-semibold">Aplicar sem salvar</span>
                    <span className="text-[11px] font-normal text-white/85">Descarta as edições atuais do cartaz</span>
                  </span>
                </AlertDialogAction>

                {/* CANCEL — outline neutro: mantém como está */}
                <AlertDialogCancel className="mt-0 w-full h-auto justify-start gap-3 rounded-xl border-2 border-border bg-background px-4 py-3 text-left hover:bg-muted">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-muted ring-1 ring-border">
                    <X className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cancelar</span>
                    <span className="text-sm font-semibold text-foreground">Manter meus textos</span>
                    <span className="text-[11px] font-normal text-muted-foreground">Não altera nada no cartaz</span>
                  </span>
                </AlertDialogCancel>
              </>
            ) : (
              <>
                <AlertDialogAction
                  onClick={() => presetDialog.preset && applyPreset(presetDialog.preset)}
                  className="group relative w-full h-auto justify-start gap-3 rounded-xl bg-emerald-600 px-4 py-3 text-left text-white shadow-lg shadow-emerald-600/25 ring-1 ring-emerald-400/40 hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Recomendado</span>
                    <span className="text-sm font-semibold">Aplicar textos sugeridos</span>
                    <span className="text-[11px] font-normal text-white/80">Otimizado para {presetDialog.toLabel || "este destino"}</span>
                  </span>
                </AlertDialogAction>
                <AlertDialogCancel className="mt-0 w-full h-auto justify-start gap-3 rounded-xl border-2 border-border bg-background px-4 py-3 text-left hover:bg-muted">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-muted ring-1 ring-border">
                    <X className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cancelar</span>
                    <span className="text-sm font-semibold text-foreground">Agora não</span>
                    <span className="text-[11px] font-normal text-muted-foreground">Continuar com os textos atuais</span>
                  </span>
                </AlertDialogCancel>
              </>
            )}
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>



      {fullscreen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Inspeção em tela cheia"
        >
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/60 px-4 py-2 text-white">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-bold uppercase tracking-wider text-primary">Tela cheia</span>
              <span className="opacity-80">{FORMATS[format].label} · {dims.mm.w}×{dims.mm.h}mm</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Format switcher — mesma escala relativa */}
              <div className="flex overflow-hidden rounded-lg border border-white/20 text-[11px]">
                {(["counter15x10", "a5", "feed", "story"] as FormatKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFormat(k)}
                    className={`px-2.5 py-1.5 font-semibold transition ${format === k ? "bg-primary text-primary-foreground" : "text-white/80 hover:bg-white/10"}`}
                  >
                    {FORMATS[k].label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setRealScale((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${realScale ? "border-primary bg-primary text-primary-foreground" : "border-white/20 text-white hover:bg-white/10"}`}
                title="Alterna entre ajustar à tela e escala 1:1 real (mm)"
              >
                <Ruler className="h-3.5 w-3.5" />
                {realScale ? "Escala real 1:1" : "Ajustar à tela"}
              </button>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/10"
                aria-label="Fechar tela cheia (Esc)"
              >
                <X className="h-3.5 w-3.5" /> Fechar
              </button>
            </div>
          </div>

          {/* Stage */}
          <div className="relative flex-1 overflow-auto">
            <div className="flex min-h-full min-w-full items-center justify-center p-6">
              <div
                className="relative overflow-hidden rounded-md shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
                style={
                  realScale
                    ? { width: `${dims.mm.w}mm`, height: `${dims.mm.h}mm` }
                    : {
                        aspectRatio: dims.aspect,
                        height: "min(calc(100dvh - 8rem), 92dvh)",
                        maxWidth: "calc(100vw - 3rem)",
                      }
                }
              >
                <PosterCanvas
                  template={template}
                  format={format}
                  title={title}
                  subtitle={subtitle}
                  ctaNearQR={ctaNearQR}
                  ctaFooter={ctaFooter}
                  primaryColor={primaryColor}
                  backgroundColor={backgroundColor}
                  textColor={textColor}
                  qrDataUrl={qrDataUrl}
                  targetUrl={targetUrl}
                  establishmentName={est?.name ?? ""}
                  logoUrl={est?.logo_url ?? null}
                  destination={destination}
                  showGoogleLogo={showGoogleLogo}
                  nfcMode={nfcMode}
                  contentScale={contentScale}
                  primaryLabel={primaryLabel}
                  secondaryEnabled={secondaryEnabled}
                  secondaryQrDataUrl={secondaryQrDataUrl}
                  secondaryLabel={secondaryLabel}
                  layout={layout}
                  setLayout={setLayout}
                  editable={false}
                  badges={badges}
                  moveBadge={moveBadge}
                  landscape={landscape}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/60 px-4 py-2 text-center text-[11px] text-white/60">
            {realScale
              ? "Renderizado em milímetros — a proporção física entre Balcão 10×15 e Mesa 7×10 é fiel na sua tela (aprox. 96dpi)."
              : "Ajustado à tela mantendo a proporção do formato. Ative Escala 1:1 para comparar tamanhos reais."}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Poster canvas                                                       */
/* ------------------------------------------------------------------ */

import { forwardRef } from "react";

interface PosterProps {
  template: TemplateKey;
  format: FormatKey;
  title: string;
  subtitle: string;
  ctaNearQR: string;
  ctaFooter: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  qrDataUrl: string;
  targetUrl: string;
  establishmentName: string;
  logoUrl: string | null;
  destination: Destination;
  showGoogleLogo: boolean;
  nfcMode: boolean;
  contentScale: number;
  primaryLabel: string;
  secondaryEnabled: boolean;
  secondaryQrDataUrl: string;
  secondaryLabel: string;
  layout: PosterLayout;
  setLayout: (updater: (prev: PosterLayout) => PosterLayout) => void;
  editable: boolean;
  badges: BadgeInstance[];
  moveBadge: (key: BadgeKey, x: number, y: number) => void;
  landscape?: boolean;
}

const PosterCanvas = forwardRef<HTMLDivElement, PosterProps>(function PosterCanvas(props, ref) {
  const bg = props.template === "glass"
    ? `radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, ${props.primaryColor} 22%, transparent) 0%, transparent 60%), ${props.backgroundColor}`
    : props.backgroundColor;
  const overlay = props.template === "editorial"
    ? "repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0 1px, transparent 1px 4px)"
    : props.template === "bold"
      ? `radial-gradient(circle at 20% 10%, color-mix(in oklab, #ffffff 20%, transparent) 0%, transparent 40%)`
      : "none";
  // Safe area: no Story, o topo (username/perfil) e o rodapé (CTA/reações)
  // do Instagram sobrepõem ~14% e ~18% da imagem. No Feed, garantimos ~5%
  // de respiro em todos os lados para o auto-crop. Draggable items usam
  // coordenadas percentuais relativas ao container mais próximo, então o
  // wrapper interno reduz a área útil sem alterar o tamanho do pôster.
  const safe =
    props.format === "story"
      ? { top: "14%", right: "6%", bottom: "18%", left: "6%" }
      : props.format === "feed"
        ? { top: "5%", right: "5%", bottom: "5%", left: "5%" }
        : { top: "0", right: "0", bottom: "0", left: "0" };
  return (
    <div
      ref={ref}
      className="absolute inset-0"
      style={{ background: bg, color: props.textColor }}
    >
      {overlay !== "none" && (
        <div className="pointer-events-none absolute inset-0" style={{ background: overlay }} />
      )}
      <div
        className="absolute"
        style={{ top: safe.top, right: safe.right, bottom: safe.bottom, left: safe.left }}
      >
        <PortraitBody {...props} />
      </div>
    </div>
  );
});


/**
 * Renders a single draggable poster element positioned by percentage.
 * When editable=true, the item shows a dashed guide and reacts to pointer drag,
 * updating its (x, y) center coordinates in the shared layout state.
 */
function DraggableItem({
  itemKey, layout, setLayout, editable, className = "", style, children,
}: {
  itemKey: LayoutKey;
  layout: PosterLayout;
  setLayout: (updater: (prev: PosterLayout) => PosterLayout) => void;
  editable: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pos = layout[itemKey];

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    const parent = ref.current?.parentElement;
    if (!parent) return;
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !draggingRef.current) return;
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
    setLayout((prev) => ({ ...prev, [itemKey]: { x, y } }));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  return (
    <div
      ref={ref}
      data-draggable={editable ? "layout" : undefined}
      onPointerDown={onPointerDown}

      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      tabIndex={editable ? 0 : -1}
      role={editable ? "button" : undefined}
      aria-label={editable ? `${LAYOUT_LABELS[itemKey]} — arraste para reposicionar` : undefined}
      className={`absolute ${editable ? "cursor-move select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm" : ""} ${className}`}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: "translate(-50%, -50%)",
        touchAction: editable ? "none" : undefined,
        ...style,
      }}
    >
      {editable && (
        <div
          data-export-ignore="true"
          className="pointer-events-none absolute -inset-2 rounded-md border border-dashed border-primary/70 bg-primary/5"
        >
          <div className="absolute -top-4 left-0 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground shadow">
            {LAYOUT_LABELS[itemKey]}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

const LAYOUT_LABELS: Record<LayoutKey, string> = {
  header: "Logo",
  title: "Título",
  subtitle: "Subtítulo",
  primaryQr: "QR principal",
  secondaryQr: "2º QR",
  nfc: "NFC",
  ctaNear: "Chamada",
  ctaFooter: "Rodapé",
};

function PortraitBody(p: PosterProps) {
  // Format-aware multiplier: harmoniza tipografia e QRs quando o canvas
  // muda drasticamente de proporção (Feed é quadrado/curto, Story é bem alto).
  // Referência 1.0 = Balcão 10×15.
  const baseMult =
    p.format === "feed" ? 0.72 :
    p.format === "story" ? 0.82 :
    p.format === "a5" ? 0.95 :
    1;
  // Em modo horizontal a altura útil vira a menor dimensão, então
  // reduzimos tipografia e QRs para caberem em duas colunas sem
  // sobrepor os elementos vizinhos.
  const landscapePenalty = p.landscape ? 0.62 : 1;
  const formatMult = baseMult * landscapePenalty;
  const effectiveScale = p.contentScale * formatMult;
  // Story é 9:16 (muito estreito): reduz ainda mais o QR quando o 2º está ativo
  // para evitar que os dois balões estourem a largura útil e se sobreponham.
  const storyDualPenalty = p.format === "story" && p.secondaryEnabled ? 0.82 : 1;
  const primarySize = Math.round((p.secondaryEnabled ? 104 : 128) * formatMult * storyDualPenalty);
  return (
    <div className="relative h-full w-full">
      {/* Header block (logo + name + stars) */}
      <DraggableItem itemKey="header" layout={p.layout} setLayout={p.setLayout} editable={p.editable}>
        <div className="flex flex-col items-center gap-1">
          <BrandLogo url={p.logoUrl} name={p.establishmentName} primary={p.primaryColor} sizePx={Math.round(56 * formatMult)} />
          <div className="font-bold" style={{ color: p.textColor, fontSize: `${14 * formatMult}px` }}>{p.establishmentName}</div>
          <Stars color={p.primaryColor} size={Math.round(14 * formatMult)} center />
        </div>
      </DraggableItem>

      {/* Title */}
      <DraggableItem itemKey="title" layout={p.layout} setLayout={p.setLayout} editable={p.editable} className="w-[84%]">
        <h2 className="text-center font-black leading-tight [text-wrap:balance]" style={{ color: p.textColor, fontSize: `${19 * (effectiveScale / 100)}px` }}>{p.title}</h2>
      </DraggableItem>

      {/* Subtitle */}
      <DraggableItem itemKey="subtitle" layout={p.layout} setLayout={p.setLayout} editable={p.editable} className="w-[76%]">
        <p className="text-center opacity-70 [text-wrap:balance]" style={{ color: p.textColor, fontSize: `${11 * (effectiveScale / 100)}px` }}>{p.subtitle}</p>
      </DraggableItem>


      {/* Primary QR */}
      <DraggableItem itemKey="primaryQr" layout={p.layout} setLayout={p.setLayout} editable={p.editable}>
        <LabeledQr
          qr={p.qrDataUrl}
          label={p.primaryLabel}
          primary={p.primaryColor}
          text={p.textColor}
          badge={null}
          size={primarySize}
          scale={effectiveScale}
        />
      </DraggableItem>

      {/* Secondary QR */}
      {p.secondaryEnabled && (
        <DraggableItem itemKey="secondaryQr" layout={p.layout} setLayout={p.setLayout} editable={p.editable}>
          <LabeledQr
            qr={p.secondaryQrDataUrl}
            label={p.secondaryLabel}
            primary={p.primaryColor}
            text={p.textColor}
            badge={null}
            size={primarySize}
            scale={effectiveScale}
          />

        </DraggableItem>
      )}

      {/* CTA near QR */}
      <DraggableItem itemKey="ctaNear" layout={p.layout} setLayout={p.setLayout} editable={p.editable} className="w-[90%]">
        <div className="text-center font-bold uppercase tracking-widest" style={{ color: p.primaryColor, fontSize: `${12 * (effectiveScale / 100)}px` }}>
          {p.ctaNearQR}
        </div>
      </DraggableItem>

      {/* CTA footer */}
      <DraggableItem itemKey="ctaFooter" layout={p.layout} setLayout={p.setLayout} editable={p.editable} className="w-[90%]">
        <div className="flex flex-col items-center gap-1">
          <div className="text-center opacity-70" style={{ color: p.textColor, fontSize: `${10 * (effectiveScale / 100)}px` }}>{p.ctaFooter}</div>
          {p.nfcMode && <NfcBadge primary={p.primaryColor} sizePct={effectiveScale} />}
        </div>
      </DraggableItem>


      {/* Preset badges — draggable icons/emblems */}
      {p.badges.map((b) => {
        const meta = BADGE_CATALOG[b.key];
        const Icon = meta.Icon;
        return (
          <BadgeDraggable
            key={b.key}
            badge={b}
            editable={p.editable}
            move={p.moveBadge}
          >
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-sm"
              style={{
                background: `color-mix(in oklab, ${p.primaryColor} 12%, ${p.backgroundColor})`,
                color: p.textColor,
                border: `1px solid color-mix(in oklab, ${p.primaryColor} 40%, transparent)`,
                fontSize: `${10 * (p.contentScale / 100)}px`,
              }}
            >
              <Icon className="h-3 w-3" style={{ color: p.primaryColor }} />
              <span className="whitespace-nowrap font-semibold">{meta.short}</span>
            </div>
          </BadgeDraggable>
        );
      })}

    </div>
  );
}

/** Draggable wrapper for a preset badge instance. */
function BadgeDraggable({
  badge, editable, move, children,
}: {
  badge: BadgeInstance;
  editable: boolean;
  move: (key: BadgeKey, x: number, y: number) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editable || !draggingRef.current) return;
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
    move(badge.key, x, y);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  return (
    <div
      ref={ref}
      data-draggable={editable ? "badge" : undefined}
      onPointerDown={onPointerDown}

      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      tabIndex={editable ? 0 : -1}
      role={editable ? "button" : undefined}
      aria-label={editable ? `Emblema ${badge.key} — arraste para reposicionar` : undefined}
      className={`absolute ${editable ? "cursor-move select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" : ""}`}
      style={{
        left: `${badge.x}%`,
        top: `${badge.y}%`,
        transform: "translate(-50%, -50%)",
        touchAction: editable ? "none" : undefined,
      }}
    >
      {editable && (
        <div data-export-ignore="true" className="pointer-events-none absolute -inset-1.5 rounded-full border border-dashed border-primary/70 bg-primary/5" />
      )}
      {children}
    </div>
  );
}

/** Compact inline validation message for URL fields. */
function ValidationLine({ check }: { check: UrlCheck }) {
  if (check.level === "empty") {
    return <div className="text-[11px] text-muted-foreground">{check.message}</div>;
  }
  if (check.level === "ok") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
        <CheckCircle2 className="h-3.5 w-3.5" /> {check.message}
      </div>
    );
  }
  if (check.level === "warn") {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
        <AlertTriangle className="h-3.5 w-3.5" /> {check.message}
      </div>
    );
  }
  return (
    <div role="alert" className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
      <XCircle className="h-3.5 w-3.5" /> {check.message}
    </div>
  );
}

function LabeledQr({ qr, label, primary, text, badge, size, scale = 100 }: { qr: string; label: string; primary: string; text: string; badge: "google" | null; size: number; scale?: number }) {
  const boxSize = size + 20; // padding compensation, identical for both QRs
  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: boxSize }}>
      <div className="rounded-xl bg-white p-2.5 shadow-lg" style={{ width: boxSize, height: boxSize }}>
        {qr ? (
          <img src={qr} alt={label} className="block" style={{ width: size, height: size }} />
        ) : (
          <div className="grid place-items-center text-[10px] text-slate-400" style={{ width: size, height: size }}>gerando…</div>
        )}
      </div>
      {label && (
        <div
          className="text-center font-bold leading-tight"
          style={{
            color: text,
            fontSize: `${10 * (scale / 100)}px`,
            width: boxSize,
            minHeight: `${2 * 10 * (scale / 100) * 1.15}px`,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {label}
        </div>
      )}
      {badge === "google" && <GoogleBadge />}
    </div>
  );
}




function QrBlock({ qr }: { qr: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-lg">
      {qr ? (
        <img src={qr} alt="QR" className="h-[128px] w-[128px] block" />
      ) : (
        <div className="grid h-[128px] w-[128px] place-items-center text-[10px] text-slate-400">gerando…</div>
      )}
    </div>
  );
}

function NfcBlock({ primary }: { primary: string }) {
  return (
    <div
      className="flex h-[152px] w-[152px] flex-col items-center justify-center gap-1.5 rounded-xl p-3 shadow-lg"
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${primary} 22%, #ffffff) 0%, #ffffff 100%)`,
        border: `2px solid ${primary}`,
      }}
    >
      <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke={primary} strokeWidth="4" strokeLinecap="round">
        <path d="M20 22c6 6 6 14 0 20" />
        <path d="M28 16c10 8 10 24 0 32" />
        <path d="M36 10c14 10 14 34 0 44" />
        <circle cx="14" cy="32" r="2.5" fill={primary} stroke="none" />
      </svg>
      <div className="text-center text-[10px] font-black uppercase tracking-widest" style={{ color: primary }}>
        Toque aqui
      </div>
      <div className="text-center text-[8px] font-semibold uppercase tracking-widest text-slate-500">
        NFC
      </div>
    </div>
  );
}



function BrandLogo({ url, name, primary, sizePx = 40 }: { url: string | null; name: string; primary: string; sizePx?: number }) {
  const dim = { width: sizePx, height: sizePx };
  if (url) return <img src={url} alt={name} className="shrink-0 rounded-full object-cover ring-2" style={{ ...dim, borderColor: primary }} />;
  const initial = name.slice(0, 1).toUpperCase();
  return (
    <div className="shrink-0 grid place-items-center rounded-full font-black text-white" style={{ ...dim, background: primary, fontSize: `${sizePx * 0.42}px` }}>
      {initial}
    </div>
  );
}


function Stars({ color, size, center }: { color: string; size: number; center?: boolean }) {
  return (
    <div className={`${center ? "inline-flex mx-auto" : "flex"} items-center gap-[2px] leading-none`} style={{ color }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" fill="currentColor" style={{ display: "block", flexShrink: 0 }}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function GoogleBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-sm">
      <GoogleColorG />
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-800">Google Reviews</span>
    </div>
  );
}

function GoogleColorG() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function NfcBadge({ primary, sizePct = 100 }: { primary: string; sizePct?: number }) {
  const scale = Math.max(60, Math.min(180, sizePct)) / 100;
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        background: `color-mix(in oklab, ${primary} 20%, transparent)`,
        border: `1px solid ${primary}`,
        padding: `${4 * scale}px ${10 * scale}px`,
        gap: `${6 * scale}px`,
      }}
    >
      <Radio style={{ color: primary, width: 12 * scale, height: 12 * scale }} />
      <span className="font-bold uppercase tracking-widest" style={{ color: primary, fontSize: `${9 * scale}px` }}>NFC</span>
    </div>
  );
}

/** Relative "há Xs" timestamp — refreshed by parent tick prop. */
function RelativeTime({ timestamp, tick: _tick }: { timestamp: number; tick: number }) {
  const diff = Math.max(0, Date.now() - timestamp);
  const sec = Math.floor(diff / 1000);
  let label: string;
  if (sec < 5) label = "agora";
  else if (sec < 60) label = `há ${sec}s`;
  else if (sec < 3600) label = `há ${Math.floor(sec / 60)}min`;
  else label = `há ${Math.floor(sec / 3600)}h`;
  return <span>{label}</span>;
}
