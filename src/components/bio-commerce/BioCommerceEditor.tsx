import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  Facebook,
  Globe,
  ImageIcon,
  Images,
  Instagram,
  KeyRound,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareQuote,
  Monitor,
  Music,
  Music2,
  Palette,
  Pencil,
  Phone,
  PlayCircle,
  Plus,
  QrCode,
  Save,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  UtensilsCrossed,
  Wand2,
  Wifi,
  Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RouteLoading } from "@/components/RouteLoading";
import { LogoPaletteSync } from "@/components/LogoPaletteSync";
import { ConfigureQrButton } from "@/components/merchant/ConfigureQrButton";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getMyLinkTree, upsertLinkTree } from "@/lib/linktree.functions";
import { saveBioCommerceTheme } from "@/lib/bio-commerce.functions";
import { getPublicLinkTreeUrl } from "@/lib/public-link-url";
import { getErrorMessage as friendlyError } from "@/lib/error-messages";
import { PIX_TYPE_LABEL, validatePixKey } from "@/lib/pix-validation";
import {
  BIO_COMMERCE_PRESETS,
  defaultPresentationForKind,
  resolveBioCommerceTheme,
  type BioCommerceBackgroundEffect,
  type BioCommerceCardStyle,
  type BioCommerceContentWidth,
  type BioCommerceFontStyle,
  type BioCommerceHeroStyle,
  type BioCommerceLayout,
  type BioCommerceMotion,
  type BioCommerceMotionIntensity,
  type BioCommercePresentation,
  type BioCommerceProductStyle,
  type BioCommerceSocialStyle,
} from "@/lib/bio-commerce-theme";

type LinkKind =
  | "whatsapp" | "instagram" | "facebook" | "tiktok" | "youtube"
  | "site" | "google" | "maps" | "email" | "phone" | "wifi" | "pix"
  | "cardapio" | "cartao" | "custom"
  | "video" | "spotify" | "gallery" | "menu_carousel" | "reviews" | "header_image";

type LinkRow = {
  id?: string;
  _uid?: string;
  kind: LinkKind;
  label: string;
  url: string;
  icon?: string | null;
  enabled: boolean;
  sort_order: number;
  data?: Record<string, any>;
};

type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
type StageId = "identidade" | "tema" | "conteudo" | "aparencia" | "publicar";
type PreviewMode = "mobile" | "desktop";

const STAGES: Array<{ id: StageId; label: string; helper: string }> = [
  { id: "identidade", label: "Identidade", helper: "Marca e endereço" },
  { id: "tema", label: "Tema", helper: "Escolha a experiência" },
  { id: "conteudo", label: "Conteúdo", helper: "Links e vitrines" },
  { id: "aparencia", label: "Aparência", helper: "Detalhes e efeitos" },
  { id: "publicar", label: "Revisar", helper: "Salvar e publicar" },
];

const KIND_META: Record<LinkKind, { label: string; icon: any; placeholder: string; isBlock?: boolean; group: "essenciais" | "vendas" | "social" | "midia" }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, placeholder: "5511999999999", group: "essenciais" },
  cardapio: { label: "Cardápio Digital", icon: UtensilsCrossed, placeholder: "/cardapio/seu-slug", group: "vendas" },
  cartao: { label: "Fidelidade", icon: CreditCard, placeholder: "/cartao/seu-slug", group: "vendas" },
  maps: { label: "Localização", icon: MapPin, placeholder: "https://maps.google.com/...", group: "essenciais" },
  wifi: { label: "Wi-Fi", icon: Wifi, placeholder: "Rede e senha", group: "essenciais" },
  pix: { label: "Pix", icon: KeyRound, placeholder: "Chave Pix", group: "vendas" },
  custom: { label: "Link personalizado", icon: ExternalLink, placeholder: "https://...", group: "essenciais" },
  instagram: { label: "Instagram", icon: Instagram, placeholder: "@seuperfil", group: "social" },
  facebook: { label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/...", group: "social" },
  tiktok: { label: "TikTok", icon: Music2, placeholder: "https://tiktok.com/@...", group: "social" },
  youtube: { label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@...", group: "social" },
  site: { label: "Site", icon: Globe, placeholder: "https://seusite.com", group: "social" },
  google: { label: "Google Reviews", icon: Star, placeholder: "https://g.page/.../review", group: "social" },
  email: { label: "E-mail", icon: Mail, placeholder: "contato@seudominio.com", group: "social" },
  phone: { label: "Telefone", icon: Phone, placeholder: "1130000000", group: "social" },
  menu_carousel: { label: "Vitrine de produtos", icon: LayoutGrid, placeholder: "", isBlock: true, group: "vendas" },
  reviews: { label: "Avaliações", icon: MessageSquareQuote, placeholder: "", isBlock: true, group: "vendas" },
  header_image: { label: "Banner / Promoção", icon: ImageIcon, placeholder: "https://...", isBlock: true, group: "vendas" },
  video: { label: "Vídeo", icon: PlayCircle, placeholder: "YouTube, Vimeo, TikTok ou MP4", isBlock: true, group: "midia" },
  spotify: { label: "Spotify", icon: Music, placeholder: "https://open.spotify.com/...", isBlock: true, group: "midia" },
  gallery: { label: "Galeria de fotos", icon: Images, placeholder: "", isBlock: true, group: "midia" },
};

const CLASSIC_PRESETS = [
  { id: "classic-cyan-circuit", label: "Cyan Circuit", niche: "Clássico", primary: "#a78bfa", accent: "#ff2fd0", background: "#0b1220", text: "#ffffff", button_style: "glass" as const, rounded: "xl" as const },
  { id: "classic-porcelain", label: "Porcelain", niche: "Clássico", primary: "#0284c7", accent: "#e11d8a", background: "#f8fafc", text: "#0f172a", button_style: "solid" as const, rounded: "full" as const },
  { id: "classic-sunset-neon", label: "Sunset Neon", niche: "Clássico", primary: "#f59e0b", accent: "#ef4444", background: "#1a0b2e", text: "#fff7ed", button_style: "outline" as const, rounded: "lg" as const },
];

const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

function sanitizePublicSlug(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function encodeWifi(ssid: string, password: string, security: "WPA" | "nopass" = "WPA") {
  const esc = (s: string) => s.replace(/([\\;,":])/g, "\\$1");
  return `WIFI:S:${esc(ssid)};T:${password ? security : "nopass"};P:${esc(password)};;`;
}

function decodeWifi(url: string) {
  const s = /WIFI:.*?S:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const p = /WIFI:.*?P:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (v: string) => v.replace(/\\(.)/g, "$1");
  return { ssid: unesc(s), password: unesc(p) };
}

function encodePix(type: PixKeyType, key: string, name: string) {
  const esc = (s: string) => s.replace(/([\\;,":])/g, "\\$1");
  return `PIX:T:${type};K:${esc(key)};N:${esc(name)};;`;
}

function decodePix(url: string): { type: PixKeyType; key: string; name: string } {
  const rawType = (/PIX:.*?T:([^;]+);/i.exec(url)?.[1] ?? "email") as PixKeyType;
  const key = /PIX:.*?K:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const name = /PIX:.*?N:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const allowed: PixKeyType[] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];
  const unesc = (v: string) => v.replace(/\\(.)/g, "$1");
  return { type: allowed.includes(rawType) ? rawType : "email", key: unesc(key), name: unesc(name) };
}

export function BioCommerceEditor() {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const getEstablishments = useServerFn(getMyEstablishments);
  const getTree = useServerFn(getMyLinkTree);
  const saveTree = useServerFn(upsertLinkTree);
  const saveAdvancedTheme = useServerFn(saveBioCommerceTheme);

  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEstablishments() });
  const est = memberships?.[0]?.establishment as
    | { id: string; slug: string; name: string; logo_url: string | null; primary_color: string; accent_color: string }
    | undefined;
  const query = useQuery({
    queryKey: ["my-linktree", est?.id],
    queryFn: () => getTree({ data: { establishment_id: est!.id } }),
    enabled: !!est?.id,
  });

  const [stage, setStage] = useState<StageId>("identidade");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [published, setPublished] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [presetId, setPresetId] = useState("bio-adaptive");
  const [primary, setPrimary] = useState("#7c3aed");
  const [accent, setAccent] = useState("#ec4899");
  const [background, setBackground] = useState("#080b12");
  const [text, setText] = useState("#ffffff");
  const [buttonStyle, setButtonStyle] = useState<"solid" | "outline" | "glass">("glass");
  const [rounded, setRounded] = useState<"sm" | "md" | "lg" | "xl" | "full">("xl");
  const [layout, setLayout] = useState<BioCommerceLayout>("commerce");
  const [heroStyle, setHeroStyle] = useState<BioCommerceHeroStyle>("brand");
  const [cardStyle, setCardStyle] = useState<BioCommerceCardStyle>("glass");
  const [backgroundEffect, setBackgroundEffect] = useState<BioCommerceBackgroundEffect>("ambient");
  const [fontStyle, setFontStyle] = useState<BioCommerceFontStyle>("modern");
  const [contentWidth, setContentWidth] = useState<BioCommerceContentWidth>("comfortable");
  const [motionStyle, setMotionStyle] = useState<BioCommerceMotion>("smooth");
  const [motionIntensity, setMotionIntensity] = useState<BioCommerceMotionIntensity>("medium");
  const [productStyle, setProductStyle] = useState<BioCommerceProductStyle>("carousel");
  const [socialStyle, setSocialStyle] = useState<BioCommerceSocialStyle>("icons");

  useEffect(() => {
    if (!est) return;
    const page = query.data?.page;
    if (!page) {
      setTitle(est.name);
      setLogoUrl(est.logo_url ?? "");
      setPrimary(est.primary_color || "#7c3aed");
      setAccent(est.accent_color || "#ec4899");
      setPublicSlug(sanitizePublicSlug(est.slug));
      return;
    }

    setTitle(page.title ?? est.name ?? "");
    setDescription(page.description ?? "");
    setLogoUrl(page.logo_url ?? est.logo_url ?? "");
    setCoverUrl(page.cover_url ?? "");
    setPublicSlug(sanitizePublicSlug((page as any).public_slug ?? est.slug ?? ""));
    setPublished(!!page.published);
    setLinks((query.data?.links ?? []).map((link: any) => ({
      id: link.id,
      _uid: link.id ?? uid(),
      kind: link.kind,
      label: link.label,
      url: link.url,
      icon: link.icon,
      enabled: link.enabled,
      sort_order: link.sort_order,
      data: (link.data ?? {}) as Record<string, any>,
    })));

    const resolved = resolveBioCommerceTheme((page.theme ?? {}) as any, {
      primary: est.primary_color,
      accent: est.accent_color,
      cover: page.cover_url,
    });
    setPresetId(resolved.preset_id ?? "bio-adaptive");
    setPrimary(resolved.primary);
    setAccent(resolved.accent);
    setBackground(resolved.background);
    setText(resolved.text);
    setButtonStyle((resolved.button_style as any) ?? "glass");
    setRounded((resolved.rounded as any) ?? "xl");
    setLayout((resolved.layout as BioCommerceLayout) ?? "commerce");
    setHeroStyle((resolved.hero_style as BioCommerceHeroStyle) ?? "brand");
    setCardStyle((resolved.card_style as BioCommerceCardStyle) ?? "glass");
    setBackgroundEffect((resolved.background_effect as BioCommerceBackgroundEffect) ?? "ambient");
    setFontStyle((resolved.font_style as BioCommerceFontStyle) ?? "modern");
    setContentWidth((resolved.content_width as BioCommerceContentWidth) ?? "comfortable");
    setMotionStyle((resolved.motion as BioCommerceMotion) ?? "smooth");
    setMotionIntensity((resolved.motion_intensity as BioCommerceMotionIntensity) ?? "medium");
    setProductStyle((resolved.product_style as BioCommerceProductStyle) ?? "carousel");
    setSocialStyle((resolved.social_style as BioCommerceSocialStyle) ?? "icons");
  }, [query.data, est]);

  const publicUrl = est
    ? getPublicLinkTreeUrl(publicSlug || sanitizePublicSlug(est.slug), typeof window !== "undefined" ? window.location.origin : undefined)
    : "";

  const stageIndex = STAGES.findIndex((item) => item.id === stage);
  const motionAllowed = !reduceMotion && motionStyle !== "none";

  function applyPremiumPreset(id: string) {
    const preset = BIO_COMMERCE_PRESETS.find((item) => item.preset_id === id);
    if (!preset) return;
    setPresetId(preset.preset_id);
    setPrimary(preset.primary);
    setAccent(preset.accent);
    setBackground(preset.background);
    setText(preset.text);
    setButtonStyle(preset.button_style);
    setRounded(preset.rounded);
    setLayout(preset.layout);
    setHeroStyle(preset.hero_style);
    setCardStyle(preset.card_style);
    setBackgroundEffect(preset.background_effect);
    setFontStyle(preset.font_style);
    setContentWidth(preset.content_width);
    setMotionStyle(preset.motion);
    setMotionIntensity(preset.motion_intensity);
    setProductStyle(preset.product_style);
    setSocialStyle(preset.social_style);
  }

  function applyClassicPreset(id: string) {
    const preset = CLASSIC_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setPresetId(id);
    setPrimary(preset.primary);
    setAccent(preset.accent);
    setBackground(preset.background);
    setText(preset.text);
    setButtonStyle(preset.button_style);
    setRounded(preset.rounded);
    setLayout("commerce");
    setHeroStyle(coverUrl ? "immersive" : "brand");
    setCardStyle(preset.button_style === "glass" ? "glass" : preset.button_style === "outline" ? "outline" : "elevated");
    setBackgroundEffect("ambient");
    setFontStyle("modern");
    setContentWidth("comfortable");
    setMotionStyle("smooth");
    setMotionIntensity("low");
    setProductStyle("carousel");
    setSocialStyle("icons");
  }

  function addLink(kind: LinkKind) {
    if (links.length >= 50) {
      toast.error("O Bio Commerce aceita até 50 blocos.");
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const slug = est?.slug ?? "";
    const prefill = kind === "cardapio" && slug ? `${origin}/cardapio/${slug}` : kind === "cartao" && slug ? `${origin}/cartao/${slug}` : "";
    const defaults: Partial<Record<LinkKind, Record<string, any>>> = {
      video: { url: "", presentation: "bloco" },
      spotify: { url: "", presentation: "bloco" },
      gallery: { images: [] as string[], presentation: "bloco" },
      menu_carousel: { source: "menu", limit: 8, presentation: "bloco" },
      reviews: { limit: 3, min_rating: 4, presentation: "bloco" },
      header_image: { image_url: "", link_url: "", presentation: "bloco" },
    };
    const row: LinkRow = {
      _uid: uid(),
      kind,
      label: KIND_META[kind].label,
      url: prefill,
      enabled: true,
      sort_order: links.length,
      data: { ...(defaults[kind] ?? {}), presentation: defaults[kind]?.presentation ?? defaultPresentationForKind(kind, links.length) },
    };
    setLinks((current) => [...current, row]);
    setEditingIndex(links.length);
  }

  function updateLink(index: number, patch: Partial<LinkRow>) {
    setLinks((current) => current.map((link, idx) => idx === index ? { ...link, ...patch } : link));
  }

  function removeLink(index: number) {
    setLinks((current) => current.filter((_, idx) => idx !== index).map((link, idx) => ({ ...link, sort_order: idx })));
    setEditingIndex((current) => current === index ? null : current != null && current > index ? current - 1 : current);
  }

  function moveLink(index: number, direction: -1 | 1) {
    setLinks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((link, idx) => ({ ...link, sort_order: idx }));
    });
    setEditingIndex(index + direction);
  }

  function validateBeforeSave() {
    const normalizedSlug = sanitizePublicSlug(publicSlug);
    if (normalizedSlug.length < 3) {
      toast.error("Escolha um endereço público com pelo menos 3 caracteres.");
      return false;
    }
    for (const [index, link] of links.entries()) {
      const meta = KIND_META[link.kind];
      if (meta.isBlock) {
        if (link.kind === "video" && !String(link.data?.url ?? "").trim()) {
          toast.error(`Bloco #${index + 1}: informe a URL do vídeo.`);
          return false;
        }
        if (link.kind === "spotify" && !String(link.data?.url ?? "").trim()) {
          toast.error(`Bloco #${index + 1}: informe a URL do Spotify.`);
          return false;
        }
        if (link.kind === "header_image" && !String(link.data?.image_url ?? "").trim()) {
          toast.error(`Bloco #${index + 1}: informe a imagem do banner.`);
          return false;
        }
        if (link.kind === "gallery" && !(Array.isArray(link.data?.images) && link.data!.images.some((v: string) => String(v).trim()))) {
          toast.error(`Bloco #${index + 1}: adicione pelo menos uma imagem.`);
          return false;
        }
        continue;
      }
      if (link.kind === "wifi") {
        if (!decodeWifi(link.url).ssid.trim()) {
          toast.error(`Link #${index + 1}: informe o nome da rede Wi-Fi.`);
          return false;
        }
      } else if (link.kind === "pix") {
        const parsed = decodePix(link.url);
        const validation = validatePixKey(parsed.type, parsed.key);
        if (!validation.ok) {
          toast.error(`Link #${index + 1} (Pix · ${PIX_TYPE_LABEL[parsed.type]}): ${validation.message}`);
          return false;
        }
      } else if (!link.label.trim() || !link.url.trim()) {
        toast.error(`Link #${index + 1}: nome e destino são obrigatórios.`);
        return false;
      }
    }
    setPublicSlug(normalizedSlug);
    return true;
  }

  async function save(publish?: boolean) {
    if (!est || !validateBeforeSave()) return;
    const normalizedSlug = sanitizePublicSlug(publicSlug);
    setSaving(true);
    try {
      const result = await saveTree({
        data: {
          establishment_id: est.id,
          public_slug: normalizedSlug,
          title: title.trim() || null,
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
          cover_url: coverUrl.trim() || null,
          theme: { primary, accent, background, text, button_style: buttonStyle, rounded },
          social: {},
          links: links.map((link, index) => ({ ...link, sort_order: index, data: link.data ?? {} })),
          published: typeof publish === "boolean" ? publish : undefined,
        },
      });

      try {
        await saveAdvancedTheme({
          data: {
            establishment_id: est.id,
            theme: {
              preset_id: presetId,
              layout,
              hero_style: heroStyle,
              card_style: cardStyle,
              background_effect: backgroundEffect,
              font_style: fontStyle,
              content_width: contentWidth,
              motion: motionStyle,
              motion_intensity: motionIntensity,
              product_style: productStyle,
              social_style: socialStyle,
            },
          },
        });
      } catch (advancedError) {
        toast.warning("Conteúdo salvo, mas a personalização premium não pôde ser concluída. Tente salvar novamente.");
        console.error("[BioCommerce] advanced theme save failed", advancedError);
      }

      if (typeof publish === "boolean") setPublished(!!result.published);
      if ((result as any).public_slug) setPublicSlug((result as any).public_slug);
      await queryClient.invalidateQueries({ queryKey: ["my-linktree", est.id] });
      await queryClient.invalidateQueries({ queryKey: ["public-linktree", normalizedSlug] });
      await queryClient.invalidateQueries({ queryKey: ["public-linktree", est.slug] });
      toast.success(publish === true ? "Bio Commerce publicado!" : publish === false ? "Bio Commerce despublicado." : "Alterações salvas.");
      query.refetch();
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setSaving(false);
    }
  }

  if (!est || query.isLoading) return <RouteLoading label="Carregando Bio Commerce…" fullscreen={false} className="min-h-[50vh]" />;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 overflow-x-hidden p-3 sm:p-5 lg:p-8">
      <header className="sticky top-0 z-30 -mx-3 border-b bg-background/90 px-3 py-3 backdrop-blur-xl sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span>
              <div>
                <h1 className="font-display text-xl font-bold sm:text-2xl">Bio Commerce</h1>
                <p className="hidden text-xs text-muted-foreground sm:block">Sua vitrine digital, seus links e suas vendas em uma experiência premium.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ConfigureQrButton dest="linktree" label="QR Code" />
            {published && <Button variant="outline" size="sm" asChild><a href={publicUrl} target="_blank" rel="noreferrer"><Eye className="mr-1.5 h-4 w-4" /> Ver público</a></Button>}
            <Button variant="secondary" size="sm" onClick={() => save()} disabled={saving}><Save className="mr-1.5 h-4 w-4" />{saving ? "Salvando…" : "Salvar"}</Button>
          </div>
        </div>
      </header>

      <ProgressNav stage={stage} onChange={setStage} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stage}
              initial={motionAllowed ? { opacity: 0, x: 16 } : false}
              animate={{ opacity: 1, x: 0 }}
              exit={motionAllowed ? { opacity: 0, x: -12 } : { opacity: 1 }}
              transition={{ duration: motionAllowed ? 0.22 : 0 }}
            >
              {stage === "identidade" && (
                <IdentityStage
                  title={title} setTitle={setTitle}
                  description={description} setDescription={setDescription}
                  logoUrl={logoUrl} setLogoUrl={setLogoUrl}
                  coverUrl={coverUrl} setCoverUrl={setCoverUrl}
                  publicSlug={publicSlug} setPublicSlug={(value) => setPublicSlug(sanitizePublicSlug(value))}
                  publicUrl={publicUrl} published={published}
                />
              )}
              {stage === "tema" && (
                <ThemeStage
                  presetId={presetId}
                  onPremium={applyPremiumPreset}
                  onClassic={applyClassicPreset}
                  logoUrl={logoUrl}
                  onPalette={(palette) => {
                    setPrimary(palette.primary); setAccent(palette.accent); setBackground(palette.background); setText(palette.text);
                  }}
                />
              )}
              {stage === "conteudo" && (
                <ContentStage
                  links={links}
                  editingIndex={editingIndex}
                  setEditingIndex={setEditingIndex}
                  addLink={addLink}
                  updateLink={updateLink}
                  removeLink={removeLink}
                  moveLink={moveLink}
                />
              )}
              {stage === "aparencia" && (
                <AppearanceStage
                  primary={primary} setPrimary={setPrimary}
                  accent={accent} setAccent={setAccent}
                  background={background} setBackground={setBackground}
                  text={text} setText={setText}
                  buttonStyle={buttonStyle} setButtonStyle={setButtonStyle}
                  rounded={rounded} setRounded={setRounded}
                  layout={layout} setLayout={setLayout}
                  heroStyle={heroStyle} setHeroStyle={setHeroStyle}
                  cardStyle={cardStyle} setCardStyle={setCardStyle}
                  backgroundEffect={backgroundEffect} setBackgroundEffect={setBackgroundEffect}
                  fontStyle={fontStyle} setFontStyle={setFontStyle}
                  contentWidth={contentWidth} setContentWidth={setContentWidth}
                  motionStyle={motionStyle} setMotionStyle={setMotionStyle}
                  motionIntensity={motionIntensity} setMotionIntensity={setMotionIntensity}
                  productStyle={productStyle} setProductStyle={setProductStyle}
                  socialStyle={socialStyle} setSocialStyle={setSocialStyle}
                />
              )}
              {stage === "publicar" && (
                <ReviewStage
                  title={title || est.name}
                  publicUrl={publicUrl}
                  published={published}
                  links={links}
                  presetId={presetId}
                  saving={saving}
                  onSave={() => save()}
                  onPublish={() => save(true)}
                  onUnpublish={() => save(false)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 flex items-center justify-between">
            <Button variant="outline" onClick={() => setStage(STAGES[Math.max(0, stageIndex - 1)].id)} disabled={stageIndex === 0}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
            {stageIndex < STAGES.length - 1 ? (
              <Button onClick={() => setStage(STAGES[stageIndex + 1].id)}>Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button>
            ) : (
              <Button onClick={() => save(true)} disabled={saving}>{published ? "Atualizar publicação" : "Publicar Bio Commerce"}</Button>
            )}
          </div>
        </div>

        <div className="xl:sticky xl:top-28 xl:self-start">
          <PreviewPanel
            mode={previewMode}
            setMode={setPreviewMode}
            title={title || est.name}
            description={description}
            logoUrl={logoUrl}
            coverUrl={coverUrl}
            links={links}
            theme={{ primary, accent, background, text, buttonStyle, rounded, layout, heroStyle, cardStyle, backgroundEffect, fontStyle, contentWidth, motionStyle, motionIntensity, productStyle, socialStyle }}
          />
        </div>
      </div>
    </div>
  );
}

function ProgressNav({ stage, onChange }: { stage: StageId; onChange: (stage: StageId) => void }) {
  const activeIndex = STAGES.findIndex((item) => item.id === stage);
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card/70 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-[620px] items-center gap-1">
        {STAGES.map((item, index) => {
          const active = item.id === stage;
          const complete = index < activeIndex;
          return (
            <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`relative flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${active ? "bg-white/20" : complete ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{complete ? <Check className="h-3.5 w-3.5" /> : index + 1}</span>
              <span className="min-w-0"><span className="block truncate text-xs font-bold">{item.label}</span><span className={`block truncate text-[10px] ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{item.helper}</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IdentityStage(props: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  logoUrl: string; setLogoUrl: (v: string) => void;
  coverUrl: string; setCoverUrl: (v: string) => void;
  publicSlug: string; setPublicSlug: (v: string) => void;
  publicUrl: string; published: boolean;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Identidade do seu Bio Commerce</CardTitle><p className="text-sm text-muted-foreground">Comece com sua marca. O cliente verá essas informações primeiro.</p></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome / título"><Input value={props.title} onChange={(e) => props.setTitle(e.target.value)} maxLength={120} placeholder="Nome do estabelecimento" /></Field>
          <Field label="Logo (URL)"><Input value={props.logoUrl} onChange={(e) => props.setLogoUrl(e.target.value)} placeholder="https://..." /></Field>
        </div>
        <Field label="Descrição"><Textarea value={props.description} onChange={(e) => props.setDescription(e.target.value)} rows={3} maxLength={1000} placeholder="Explique em uma frase por que seu negócio é especial." /></Field>
        <Field label="Imagem de capa (opcional)"><Input value={props.coverUrl} onChange={(e) => props.setCoverUrl(e.target.value)} placeholder="https://..." /><p className="mt-1 text-[11px] text-muted-foreground">Uma boa capa transforma o topo da página em um hero premium.</p></Field>
        <div className="rounded-2xl border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between gap-2"><Label>Endereço público</Label><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${props.published ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{props.published ? "PUBLICADO" : "RASCUNHO"}</span></div>
          <div className="flex items-center rounded-xl border bg-background"><span className="pl-3 text-xs text-muted-foreground">afidelize.app/</span><Input value={props.publicSlug} onChange={(e) => props.setPublicSlug(e.target.value)} maxLength={60} className="border-0 pl-0 shadow-none focus-visible:ring-0" /></div>
          <code className="mt-2 block truncate text-[11px] text-muted-foreground">{props.publicUrl}</code>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeStage({ presetId, onPremium, onClassic, logoUrl, onPalette }: { presetId: string; onPremium: (id: string) => void; onClassic: (id: string) => void; logoUrl: string; onPalette: (palette: any) => void }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" /> Temas Premium</CardTitle><p className="text-sm text-muted-foreground">Escolha uma experiência pronta. Depois você pode personalizar todos os detalhes.</p></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BIO_COMMERCE_PRESETS.map((preset) => <ThemeCard key={preset.preset_id} active={presetId === preset.preset_id} label={preset.label} niche={preset.niche} description={preset.description} primary={preset.primary} accent={preset.accent} background={preset.background} text={preset.text} onClick={() => onPremium(preset.preset_id)} />)}
          </div>
        </CardContent>
      </Card>
      <LogoPaletteSync logoUrl={logoUrl || null} onApply={onPalette} hint="Adaptamos as cores do tema escolhido à identidade da sua marca. Você pode ajustar tudo depois." />
      <Card>
        <CardHeader><CardTitle className="text-base">Temas clássicos</CardTitle><p className="text-xs text-muted-foreground">Os modelos anteriores continuam disponíveis, agora dentro do novo motor visual do Bio Commerce.</p></CardHeader>
        <CardContent><div className="grid gap-3 sm:grid-cols-3">{CLASSIC_PRESETS.map((preset) => <ThemeCard key={preset.id} active={presetId === preset.id} label={preset.label} niche={preset.niche} primary={preset.primary} accent={preset.accent} background={preset.background} text={preset.text} onClick={() => onClassic(preset.id)} />)}</div></CardContent>
      </Card>
    </div>
  );
}

function ThemeCard({ active, label, niche, description, primary, accent, background, text, onClick }: { active: boolean; label: string; niche: string; description?: string; primary: string; accent: string; background: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`relative overflow-hidden rounded-2xl border-2 p-3 text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${active ? "border-primary ring-2 ring-primary/15" : "border-border"}`} style={{ background, color: text }}>
      <div className="h-20 overflow-hidden rounded-xl" style={{ background: `radial-gradient(circle at 20% 0%, ${primary}88, transparent 55%), radial-gradient(circle at 90% 90%, ${accent}66, transparent 52%), ${background}` }}><div className="mx-auto mt-4 h-7 w-7 rounded-lg border border-white/20" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }} /><div className="mx-auto mt-2 h-2 w-2/3 rounded-full bg-white/15" /></div>
      <div className="mt-3"><p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{niche}</p><p className="mt-0.5 text-sm font-black">{label}</p>{description && <p className="mt-1 line-clamp-2 text-[10px] opacity-65">{description}</p>}</div>
      {active && <span className="absolute right-2 top-2 rounded-full px-2 py-1 text-[9px] font-bold" style={{ background: primary, color: "white" }}>EM USO</span>}
    </button>
  );
}

function ContentStage({ links, editingIndex, setEditingIndex, addLink, updateLink, removeLink, moveLink }: {
  links: LinkRow[];
  editingIndex: number | null;
  setEditingIndex: (index: number | null) => void;
  addLink: (kind: LinkKind) => void;
  updateLink: (index: number, patch: Partial<LinkRow>) => void;
  removeLink: (index: number) => void;
  moveLink: (index: number, direction: -1 | 1) => void;
}) {
  const groups: Array<{ id: "essenciais" | "vendas" | "social" | "midia"; label: string }> = [
    { id: "essenciais", label: "Essenciais" },
    { id: "vendas", label: "Vendas" },
    { id: "social", label: "Social" },
    { id: "midia", label: "Mídia" },
  ];
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Adicionar conteúdo</CardTitle><p className="text-sm text-muted-foreground">Misture links, produtos, avaliações, mídia e informações. O Bio Commerce organiza tudo visualmente.</p></CardHeader>
        <CardContent className="space-y-4">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {(Object.keys(KIND_META) as LinkKind[]).filter((kind) => KIND_META[kind].group === group.id).map((kind) => {
                  const meta = KIND_META[kind]; const Icon = meta.icon;
                  return <button key={kind} type="button" onClick={() => addLink(kind)} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-3 text-left text-xs font-semibold transition hover:border-primary/40 hover:bg-primary/5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><span className="line-clamp-2">{meta.label}</span></button>;
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Conteúdo da página</CardTitle><p className="mt-1 text-xs text-muted-foreground">{links.length}/50 blocos · organize a prioridade usando as setas.</p></div></div></CardHeader>
        <CardContent className="space-y-2">
          {links.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground"><Sparkles className="mx-auto mb-2 h-5 w-5" />Adicione o primeiro conteúdo acima.</div>}
          {links.map((link, index) => {
            const meta = KIND_META[link.kind]; const Icon = meta.icon; const open = editingIndex === index;
            return (
              <div key={link._uid ?? link.id ?? index} className={`overflow-hidden rounded-2xl border transition ${open ? "border-primary/40 bg-primary/[0.025]" : "bg-card"}`}>
                <div className="flex items-center gap-2 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <button type="button" onClick={() => setEditingIndex(open ? null : index)} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-bold">{link.label?.trim() || meta.label}</span><span className="block truncate text-[10px] text-muted-foreground">{meta.isBlock ? "Bloco premium" : presentationLabel((link.data?.presentation as BioCommercePresentation) || defaultPresentationForKind(link.kind, index))}</span></button>
                  <Switch checked={link.enabled} onCheckedChange={(value) => updateLink(index, { enabled: !!value })} />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveLink(index, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => moveLink(index, 1)} disabled={index === links.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingIndex(open ? null : index)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeLink(index)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
                <AnimatePresence initial={false}>
                  {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="border-t p-4"><LinkEditorFields link={link} index={index} onChange={(patch) => updateLink(index, patch)} /></div></motion.div>}
                </AnimatePresence>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function LinkEditorFields({ link, index, onChange }: { link: LinkRow; index: number; onChange: (patch: Partial<LinkRow>) => void }) {
  const meta = KIND_META[link.kind];
  const data = link.data ?? {};
  const setData = (patch: Record<string, any>) => onChange({ data: { ...data, ...patch } });

  if (link.kind === "wifi") return <WifiFields url={link.url} onChange={(ssid, password) => onChange({ label: ssid ? `Wi-Fi · ${ssid}` : "Wi-Fi", url: encodeWifi(ssid, password) })} />;
  if (link.kind === "pix") return <PixFields url={link.url} onChange={(type, key, name) => onChange({ label: name ? `Pix · ${name}` : "Pix", url: encodePix(type, key, name) })} />;

  if (meta.isBlock) {
    if (link.kind === "video") return <div className="space-y-3"><Field label="Título"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="URL do vídeo"><Input value={data.url ?? ""} onChange={(e) => setData({ url: e.target.value })} placeholder="YouTube, Vimeo, TikTok ou MP4" /></Field></div>;
    if (link.kind === "spotify") return <div className="space-y-3"><Field label="Título"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="URL do Spotify"><Input value={data.url ?? ""} onChange={(e) => setData({ url: e.target.value })} /></Field></div>;
    if (link.kind === "header_image") return <div className="space-y-3"><Field label="Nome do banner"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="Imagem"><Input value={data.image_url ?? ""} onChange={(e) => setData({ image_url: e.target.value })} placeholder="https://..." /></Field><Field label="Link ao clicar (opcional)"><Input value={data.link_url ?? ""} onChange={(e) => setData({ link_url: e.target.value })} placeholder="https://..." /></Field></div>;
    if (link.kind === "gallery") {
      const images: string[] = Array.isArray(data.images) ? data.images : [];
      return <div className="space-y-3"><Field label="Título"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field>{images.map((src, idx) => <div key={idx} className="flex gap-2"><Input value={src} onChange={(e) => { const next = images.slice(); next[idx] = e.target.value; setData({ images: next }); }} placeholder={`URL da imagem ${idx + 1}`} /><Button size="icon" variant="ghost" onClick={() => setData({ images: images.filter((_, i) => i !== idx) })}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}<Button size="sm" variant="outline" onClick={() => setData({ images: [...images, ""] })}><Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar imagem</Button></div>;
    }
    if (link.kind === "menu_carousel") return <div className="grid gap-3 md:grid-cols-2"><Field label="Título"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="Fonte"><Select value={data.source ?? "menu"} onValueChange={(value) => setData({ source: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="menu">Cardápio</SelectItem><SelectItem value="catalog">Catálogo</SelectItem></SelectContent></Select></Field><Field label="Quantidade"><Input type="number" min={3} max={12} value={data.limit ?? 8} onChange={(e) => setData({ limit: Math.max(3, Math.min(12, Number(e.target.value) || 8)) })} /></Field></div>;
    if (link.kind === "reviews") return <div className="grid gap-3 md:grid-cols-2"><Field label="Título"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="Quantidade"><Input type="number" min={1} max={10} value={data.limit ?? 3} onChange={(e) => setData({ limit: Math.max(1, Math.min(10, Number(e.target.value) || 3)) })} /></Field><Field label="Nota mínima"><Select value={String(data.min_rating ?? 4)} onValueChange={(value) => setData({ min_rating: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n}+ estrelas</SelectItem>)}</SelectContent></Select></Field></div>;
  }

  const presentation = (data.presentation as BioCommercePresentation) || defaultPresentationForKind(link.kind, index);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Nome"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} /></Field>
      <Field label="Destino"><Input value={link.url} onChange={(e) => onChange({ url: e.target.value })} maxLength={500} placeholder={meta.placeholder} /></Field>
      <Field label="Como mostrar"><Select value={presentation} onValueChange={(value) => setData({ presentation: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="destaque">Destaque principal</SelectItem><SelectItem value="botao">Botão</SelectItem><SelectItem value="atalho">Atalho com ícone</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent></Select><p className="mt-1 text-[11px] text-muted-foreground">Ajuda a manter a página organizada mesmo com muitos links.</p></Field>
      <Field label="Descrição opcional"><Input value={data.description ?? ""} onChange={(e) => setData({ description: e.target.value })} maxLength={120} placeholder="Uma frase curta para este conteúdo" /></Field>
    </div>
  );
}

function AppearanceStage(props: {
  primary: string; setPrimary: (v: string) => void; accent: string; setAccent: (v: string) => void; background: string; setBackground: (v: string) => void; text: string; setText: (v: string) => void;
  buttonStyle: "solid" | "outline" | "glass"; setButtonStyle: (v: any) => void; rounded: "sm" | "md" | "lg" | "xl" | "full"; setRounded: (v: any) => void;
  layout: BioCommerceLayout; setLayout: (v: BioCommerceLayout) => void; heroStyle: BioCommerceHeroStyle; setHeroStyle: (v: BioCommerceHeroStyle) => void; cardStyle: BioCommerceCardStyle; setCardStyle: (v: BioCommerceCardStyle) => void; backgroundEffect: BioCommerceBackgroundEffect; setBackgroundEffect: (v: BioCommerceBackgroundEffect) => void;
  fontStyle: BioCommerceFontStyle; setFontStyle: (v: BioCommerceFontStyle) => void; contentWidth: BioCommerceContentWidth; setContentWidth: (v: BioCommerceContentWidth) => void; motionStyle: BioCommerceMotion; setMotionStyle: (v: BioCommerceMotion) => void; motionIntensity: BioCommerceMotionIntensity; setMotionIntensity: (v: BioCommerceMotionIntensity) => void; productStyle: BioCommerceProductStyle; setProductStyle: (v: BioCommerceProductStyle) => void; socialStyle: BioCommerceSocialStyle; setSocialStyle: (v: BioCommerceSocialStyle) => void;
}) {
  return (
    <div className="space-y-5">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Cores e superfícies</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><ColorField label="Cor principal" value={props.primary} onChange={props.setPrimary} /><ColorField label="Cor secundária" value={props.accent} onChange={props.setAccent} /><ColorField label="Fundo" value={props.background} onChange={props.setBackground} /><ColorField label="Texto" value={props.text} onChange={props.setText} /><SelectField label="Botões" value={props.buttonStyle} onChange={props.setButtonStyle} options={[['solid','Sólido / gradiente'],['outline','Contorno'],['glass','Glass']]} /><SelectField label="Cantos" value={props.rounded} onChange={props.setRounded} options={[['sm','Discretos'],['md','Médios'],['lg','Grandes'],['xl','Premium'],['full','Pílula']]} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Composição</CardTitle><p className="text-sm text-muted-foreground">Essas escolhas mudam a personalidade do Bio Commerce no mobile e no desktop.</p></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><SelectField label="Layout" value={props.layout} onChange={(v) => props.setLayout(v as BioCommerceLayout)} options={[['commerce','Commerce'],['editorial','Editorial'],['bento','Bento'],['classic','Clássico']]} /><SelectField label="Hero" value={props.heroStyle} onChange={(v) => props.setHeroStyle(v as BioCommerceHeroStyle)} options={[['brand','Marca'],['immersive','Imersivo'],['minimal','Minimalista'],['split','Dividido']]} /><SelectField label="Cards" value={props.cardStyle} onChange={(v) => props.setCardStyle(v as BioCommerceCardStyle)} options={[['glass','Glass'],['elevated','Elevado'],['outline','Contorno'],['soft','Suave']]} /><SelectField label="Fundo" value={props.backgroundEffect} onChange={(v) => props.setBackgroundEffect(v as BioCommerceBackgroundEffect)} options={[['ambient','Luz ambiente'],['aurora','Aurora'],['mesh','Mesh'],['soft-glow','Glow suave'],['solid','Sólido']]} /><SelectField label="Tipografia" value={props.fontStyle} onChange={(v) => props.setFontStyle(v as BioCommerceFontStyle)} options={[['modern','Moderna'],['editorial','Editorial'],['bold','Impacto'],['clean','Clean']]} /><SelectField label="Largura no desktop" value={props.contentWidth} onChange={(v) => props.setContentWidth(v as BioCommerceContentWidth)} options={[['compact','Compacta'],['comfortable','Confortável'],['wide','Ampla']]} /><SelectField label="Vitrine" value={props.productStyle} onChange={(v) => props.setProductStyle(v as BioCommerceProductStyle)} options={[['carousel','Carrossel'],['grid','Grade'],['editorial','Editorial']]} /><SelectField label="Redes sociais" value={props.socialStyle} onChange={(v) => props.setSocialStyle(v as BioCommerceSocialStyle)} options={[['icons','Ícones'],['buttons','Botões'],['compact','Compacto']]} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Movimento</CardTitle><p className="text-sm text-muted-foreground">Transições suaves dão sensação premium sem comprometer desempenho. Preferências de acessibilidade do aparelho são respeitadas.</p></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><SelectField label="Animações" value={props.motionStyle} onChange={(v) => props.setMotionStyle(v as BioCommerceMotion)} options={[['smooth','Ativadas'],['none','Desativadas']]} /><SelectField label="Intensidade" value={props.motionIntensity} onChange={(v) => props.setMotionIntensity(v as BioCommerceMotionIntensity)} options={[['low','Suave'],['medium','Equilibrada'],['high','Expressiva']]} /></CardContent></Card>
    </div>
  );
}

function ReviewStage({ title, publicUrl, published, links, presetId, saving, onSave, onPublish, onUnpublish }: { title: string; publicUrl: string; published: boolean; links: LinkRow[]; presetId: string; saving: boolean; onSave: () => void; onPublish: () => void; onUnpublish: () => void }) {
  const enabled = links.filter((link) => link.enabled).length;
  return (
    <Card><CardHeader><CardTitle>Pronto para publicar?</CardTitle><p className="text-sm text-muted-foreground">Revise os principais dados antes de colocar sua vitrine no ar.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><SummaryCard label="Marca" value={title} /><SummaryCard label="Conteúdos ativos" value={String(enabled)} /><SummaryCard label="Tema" value={BIO_COMMERCE_PRESETS.find((p) => p.preset_id === presetId)?.label ?? CLASSIC_PRESETS.find((p) => p.id === presetId)?.label ?? "Bio Adaptativo"} /></div><div className="rounded-2xl border bg-muted/30 p-4"><p className="text-xs font-bold">Endereço público</p><code className="mt-1 block truncate text-xs text-muted-foreground">{publicUrl}</code><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); }}><Copy className="mr-2 h-4 w-4" />Copiar link</Button>{published && <Button variant="outline" asChild><a href={publicUrl} target="_blank" rel="noreferrer"><Eye className="mr-2 h-4 w-4" />Abrir página</a></Button>}</div></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={onSave} disabled={saving}><Save className="mr-2 h-4 w-4" />Salvar rascunho</Button>{published ? <Button variant="destructive" onClick={onUnpublish} disabled={saving}>Despublicar</Button> : <Button onClick={onPublish} disabled={saving}><Sparkles className="mr-2 h-4 w-4" />Publicar Bio Commerce</Button>}{published && <Button onClick={onPublish} disabled={saving}>Atualizar publicação</Button>}</div></CardContent></Card>
  );
}

function PreviewPanel({ mode, setMode, title, description, logoUrl, coverUrl, links, theme }: { mode: PreviewMode; setMode: (mode: PreviewMode) => void; title: string; description: string; logoUrl: string; coverUrl: string; links: LinkRow[]; theme: any }) {
  const visible = links.filter((link) => link.enabled);
  const shortcuts = visible.filter((link, index) => !KIND_META[link.kind].isBlock && ((link.data?.presentation as BioCommercePresentation) || defaultPresentationForKind(link.kind, index)) === "atalho").slice(0, 8);
  const actions = visible.filter((link, index) => !KIND_META[link.kind].isBlock && !["wifi","pix"].includes(link.kind) && ((link.data?.presentation as BioCommercePresentation) || defaultPresentationForKind(link.kind, index)) !== "atalho").slice(0, 6);
  const radius = theme.rounded === "full" ? "rounded-[1.5rem]" : theme.rounded === "sm" ? "rounded-lg" : "rounded-2xl";
  const desktop = mode === "desktop";
  return (
    <Card className="overflow-hidden"><CardHeader className="border-b"><div className="flex items-center justify-between gap-2"><div><CardTitle className="text-base">Pré-visualização</CardTitle><p className="mt-1 text-[11px] text-muted-foreground">Atualiza em tempo real</p></div><div className="flex rounded-lg border p-1"><button className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${mode === "mobile" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setMode("mobile")}><Smartphone className="h-3 w-3" />Mobile</button><button className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${mode === "desktop" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setMode("desktop")}><Monitor className="h-3 w-3" />Desktop</button></div></div></CardHeader><CardContent className="bg-muted/25 p-3"><motion.div layout className={`mx-auto overflow-hidden border shadow-2xl transition-all duration-300 ${desktop ? "w-full" : "w-[280px] max-w-full"} ${desktop ? "rounded-2xl" : "rounded-[2rem]"}`} style={{ background: theme.background, color: theme.text }}><div className={`relative overflow-hidden ${desktop ? "min-h-[180px]" : "min-h-[210px]"}`} style={{ background: coverUrl ? undefined : `radial-gradient(circle at 20% 10%, ${theme.primary}66, transparent 52%), ${theme.background}` }}>{coverUrl && <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" /><div className="relative z-10 flex min-h-[inherit] flex-col items-center justify-end p-4 text-center">{logoUrl ? <img src={logoUrl} alt="" className="h-14 w-14 rounded-xl border border-white/20 object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-xl text-lg font-black text-white" style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` }}>{title[0] || "F"}</div>}<h3 className="mt-2 text-base font-black">{title}</h3>{description && <p className="mt-1 line-clamp-2 max-w-lg text-[10px] opacity-75">{description}</p>}</div></div><div className={`p-3 ${desktop ? "mx-auto max-w-3xl" : ""}`}><div className={`grid gap-2 ${desktop ? "grid-cols-2" : ""}`}>{actions.map((link, index) => { const meta = KIND_META[link.kind]; const Icon = meta.icon; return <div key={index} className={`flex items-center justify-center gap-2 px-3 py-2.5 text-[10px] font-bold ${radius}`} style={{ background: index < 2 ? `linear-gradient(135deg, ${theme.primary}, ${theme.accent})` : "rgba(255,255,255,.08)", color: index < 2 ? "white" : theme.text, border: index < 2 ? undefined : "1px solid rgba(255,255,255,.12)" }}><Icon className="h-3.5 w-3.5" /><span className="truncate">{link.label}</span></div>; })}</div>{shortcuts.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2">{shortcuts.map((link, index) => { const Icon = KIND_META[link.kind].icon; return <div key={index} className={`grid aspect-square place-items-center ${radius}`} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)" }}><Icon className="h-4 w-4" style={{ color: theme.primary }} /></div>; })}</div>}<div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.08)" }}><div className="flex items-center gap-2"><div className="h-2 w-20 rounded-full" style={{ background: theme.primary }} /><div className="h-2 flex-1 rounded-full bg-white/10" /></div><div className={`mt-3 grid gap-2 ${desktop ? "grid-cols-3" : "grid-cols-2"}`}>{[1,2,3].slice(0, desktop ? 3 : 2).map((n) => <div key={n} className="overflow-hidden rounded-lg bg-white/5"><div className="h-16" style={{ background: `linear-gradient(135deg, ${theme.primary}33, ${theme.accent}22)` }} /><div className="space-y-1 p-2"><div className="h-2 w-3/4 rounded bg-white/20" /><div className="h-2 w-1/2 rounded" style={{ background: theme.primary }} /></div></div>)}</div></div></div></motion.div></CardContent></Card>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><div className="flex gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border bg-transparent" /><Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={20} /></div></Field>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: any) => void; options: Array<[string, string]> }) {
  return <Field label={label}><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></Field>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-muted/25 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-bold">{value}</p></div>;
}

function presentationLabel(value: BioCommercePresentation) {
  return value === "destaque" ? "Destaque principal" : value === "atalho" ? "Atalho" : value === "card" ? "Card" : value === "bloco" ? "Bloco" : "Botão";
}

function WifiFields({ url, onChange }: { url: string; onChange: (ssid: string, password: string) => void }) {
  const parsed = decodeWifi(url);
  return <div className="grid gap-3 md:grid-cols-2"><Field label="Nome da rede (SSID)"><Input value={parsed.ssid} onChange={(e) => onChange(e.target.value, parsed.password)} placeholder="Minha_Rede_WiFi" maxLength={64} /></Field><Field label="Senha"><Input value={parsed.password} onChange={(e) => onChange(parsed.ssid, e.target.value)} placeholder="Senha da rede" maxLength={128} /></Field></div>;
}

function PixFields({ url, onChange }: { url: string; onChange: (type: PixKeyType, key: string, name: string) => void }) {
  const parsed = decodePix(url);
  const validation = validatePixKey(parsed.type, parsed.key);
  return <div className="grid gap-3 md:grid-cols-3"><Field label="Tipo"><Select value={parsed.type} onValueChange={(value) => onChange(value as PixKeyType, parsed.key, parsed.name)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="cnpj">CNPJ</SelectItem><SelectItem value="email">E-mail</SelectItem><SelectItem value="telefone">Telefone</SelectItem><SelectItem value="aleatoria">Aleatória</SelectItem></SelectContent></Select></Field><Field label="Chave"><Input value={parsed.key} onChange={(e) => onChange(parsed.type, e.target.value, parsed.name)} /><p className={`text-[10px] ${parsed.key && !validation.ok ? "text-destructive" : "text-muted-foreground"}`}>{parsed.key ? (validation.ok ? "Chave válida" : validation.message) : `Formato: ${PIX_TYPE_LABEL[parsed.type]}`}</p></Field><Field label="Beneficiário"><Input value={parsed.name} onChange={(e) => onChange(parsed.type, parsed.key, e.target.value)} placeholder="Nome exibido" /></Field></div>;
}
