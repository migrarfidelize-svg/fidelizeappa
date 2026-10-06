import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Check,
  Copy,
  CreditCard,
  Eye,
  Facebook,
  Globe,
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RouteLoading } from "@/components/RouteLoading";
import { ConfigureQrButton } from "@/components/merchant/ConfigureQrButton";
import { LogoPaletteSync } from "@/components/LogoPaletteSync";
import { BioCommerceLanding, type BioCommerceBlockData } from "@/components/bio-commerce/BioCommerceLanding";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getLinkTreeBlockData, getMyLinkTree, upsertLinkTree } from "@/lib/linktree.functions";
import { saveBioCommerceTheme } from "@/lib/bio-commerce.functions";
import { getPublicLinkTreeUrl } from "@/lib/public-link-url";
import { getErrorMessage as friendlyError } from "@/lib/error-messages";
import {
  BIO_COMMERCE_NICHES,
  BIO_COMMERCE_PRESETS,
  defaultPresentationForKind,
  defaultPresetForNiche,
  getBioCommercePreset,
  inferBioCommerceNiche,
  resolveBioCommerceLandingTheme,
  type BioCommerceNicheId,
  type BioCommercePresentation,
  type BioCommerceTheme,
} from "@/lib/bio-commerce-theme";

type LinkKind = "whatsapp" | "instagram" | "facebook" | "tiktok" | "youtube" | "site" | "google" | "maps" | "email" | "phone" | "wifi" | "pix" | "cardapio" | "cartao" | "custom" | "video" | "spotify" | "gallery" | "menu_carousel" | "reviews" | "header_image";
type LinkRow = { id?: string; _uid?: string; kind: LinkKind; label: string; url: string; icon?: string | null; enabled: boolean; sort_order: number; data?: Record<string, any> };
type Stage = "negocio" | "tema" | "conteudo" | "aparencia" | "publicar";
type PreviewMode = "mobile" | "desktop";

type ThemeState = {
  preset_id: string;
  niche_id: BioCommerceNicheId;
  primary: string;
  accent: string;
  background: string;
  text: string;
  button_style: "solid" | "outline" | "glass";
  rounded: "sm" | "md" | "lg" | "xl" | "full";
  layout: "classic" | "commerce" | "editorial" | "bento";
  hero_style: "brand" | "immersive" | "minimal" | "split";
  card_style: "elevated" | "glass" | "outline" | "soft";
  background_effect: "solid" | "ambient" | "aurora" | "mesh" | "soft-glow";
  font_style: "modern" | "editorial" | "bold" | "clean";
  content_width: "compact" | "comfortable" | "wide";
  motion: "none" | "smooth";
  motion_intensity: "low" | "medium" | "high";
  product_style: "carousel" | "grid" | "editorial";
  social_style: "icons" | "buttons" | "compact";
};

const STAGES: Array<{ id: Stage; label: string; helper: string }> = [
  { id: "negocio", label: "Negócio", helper: "Identidade e nicho" },
  { id: "tema", label: "Tema", helper: "Landing por segmento" },
  { id: "conteudo", label: "Conteúdo", helper: "Módulos e ações" },
  { id: "aparencia", label: "Aparência", helper: "Cores e movimento" },
  { id: "publicar", label: "Publicar", helper: "Link e QR Code" },
];

const META: Record<LinkKind, { label: string; icon: any; group: "acoes" | "vendas" | "social" | "midia"; block?: boolean }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, group: "acoes" },
  maps: { label: "Localização", icon: MapPin, group: "acoes" },
  phone: { label: "Telefone", icon: Phone, group: "acoes" },
  email: { label: "E-mail", icon: Mail, group: "acoes" },
  site: { label: "Site", icon: Globe, group: "acoes" },
  custom: { label: "Link personalizado", icon: Globe, group: "acoes" },
  cardapio: { label: "Cardápio Digital", icon: UtensilsCrossed, group: "vendas" },
  cartao: { label: "Fidelidade", icon: CreditCard, group: "vendas" },
  pix: { label: "Pix", icon: KeyRound, group: "vendas" },
  wifi: { label: "Wi-Fi", icon: Wifi, group: "vendas" },
  menu_carousel: { label: "Vitrine automática", icon: LayoutGrid, group: "vendas", block: true },
  reviews: { label: "Avaliações", icon: MessageSquareQuote, group: "vendas", block: true },
  header_image: { label: "Banner promocional", icon: Sparkles, group: "vendas", block: true },
  instagram: { label: "Instagram", icon: Instagram, group: "social" },
  facebook: { label: "Facebook", icon: Facebook, group: "social" },
  tiktok: { label: "TikTok", icon: Music2, group: "social" },
  youtube: { label: "YouTube", icon: Youtube, group: "social" },
  google: { label: "Google Reviews", icon: Star, group: "social" },
  video: { label: "Vídeo", icon: PlayCircle, group: "midia", block: true },
  spotify: { label: "Spotify", icon: Music, group: "midia", block: true },
  gallery: { label: "Galeria", icon: Images, group: "midia", block: true },
};

const EMPTY_BLOCKS: BioCommerceBlockData = { menu: [], catalog: [], reviews: [], stats: null };
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function sanitizeSlug(value: string) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}

function encodeWifi(ssid: string, password: string) {
  const esc = (value: string) => value.replace(/([\\;,":])/g, "\\$1");
  return `WIFI:S:${esc(ssid)};T:${password ? "WPA" : "nopass"};P:${esc(password)};;`;
}
function decodeWifi(url: string) {
  const s = /WIFI:.*?S:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const p = /WIFI:.*?P:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (value: string) => value.replace(/\\(.)/g, "$1");
  return { ssid: unesc(s), password: unesc(p) };
}
function encodePix(key: string, name: string) {
  const esc = (value: string) => value.replace(/([\\;,":])/g, "\\$1");
  return `PIX:T:aleatoria;K:${esc(key)};N:${esc(name)};;`;
}
function decodePix(url: string) {
  const key = /PIX:.*?K:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const name = /PIX:.*?N:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (value: string) => value.replace(/\\(.)/g, "$1");
  return { key: unesc(key), name: unesc(name) };
}

function themeFromResolved(resolved: ReturnType<typeof resolveBioCommerceLandingTheme>): ThemeState {
  return {
    preset_id: resolved.preset_id ?? "aurora-commerce",
    niche_id: resolved.niche_id,
    primary: resolved.primary,
    accent: resolved.accent,
    background: resolved.background,
    text: resolved.text,
    button_style: (resolved.button_style as ThemeState["button_style"]) ?? "solid",
    rounded: (resolved.rounded as ThemeState["rounded"]) ?? "xl",
    layout: (resolved.layout as ThemeState["layout"]) ?? "commerce",
    hero_style: (resolved.hero_style as ThemeState["hero_style"]) ?? "immersive",
    card_style: (resolved.card_style as ThemeState["card_style"]) ?? "glass",
    background_effect: (resolved.background_effect as ThemeState["background_effect"]) ?? "aurora",
    font_style: (resolved.font_style as ThemeState["font_style"]) ?? "modern",
    content_width: (resolved.content_width as ThemeState["content_width"]) ?? "comfortable",
    motion: (resolved.motion as ThemeState["motion"]) ?? "smooth",
    motion_intensity: (resolved.motion_intensity as ThemeState["motion_intensity"]) ?? "medium",
    product_style: (resolved.product_style as ThemeState["product_style"]) ?? "carousel",
    social_style: (resolved.social_style as ThemeState["social_style"]) ?? "icons",
  };
}

export function BioCommerceEditorV3() {
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  const getEstablishments = useServerFn(getMyEstablishments);
  const getTree = useServerFn(getMyLinkTree);
  const saveTree = useServerFn(upsertLinkTree);
  const saveAdvancedTheme = useServerFn(saveBioCommerceTheme);

  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEstablishments() });
  const est = memberships?.[0]?.establishment as any;
  const treeQuery = useQuery({ queryKey: ["my-linktree", est?.id], queryFn: () => getTree({ data: { establishment_id: est!.id } }), enabled: !!est?.id });

  const [stage, setStage] = useState<Stage>("negocio");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [published, setPublished] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<ThemeState>(() => themeFromResolved(resolveBioCommerceLandingTheme({}, { links: [], establishment: {} })));

  useEffect(() => {
    if (!est) return;
    const page = treeQuery.data?.page;
    const loadedLinks = (treeQuery.data?.links ?? []).map((link: any, index: number) => ({ ...link, _uid: link.id ?? uid(), sort_order: index, data: link.data ?? {} })) as LinkRow[];
    setLinks(loadedLinks);
    setTitle(page?.title ?? est.name ?? "");
    setDescription(page?.description ?? est.description ?? "");
    setLogoUrl(page?.logo_url ?? est.logo_url ?? "");
    setCoverUrl(page?.cover_url ?? est.cover_url ?? "");
    setPublicSlug(sanitizeSlug(page?.public_slug ?? est.slug ?? ""));
    setPublished(!!page?.published);
    const resolved = resolveBioCommerceLandingTheme((page?.theme ?? {}) as BioCommerceTheme, { links: loadedLinks, establishment: est, cover: page?.cover_url ?? est.cover_url });
    setTheme(themeFromResolved(resolved));
  }, [treeQuery.data, est]);

  const blockQuery = useQuery({
    queryKey: ["bio-commerce-editor-blocks", publicSlug],
    queryFn: () => getLinkTreeBlockData({ data: { slug: publicSlug } }),
    enabled: !!publicSlug && publicSlug.length >= 3,
    staleTime: 60_000,
    retry: false,
  });

  const publicUrl = est ? getPublicLinkTreeUrl(publicSlug || sanitizeSlug(est.slug), typeof window !== "undefined" ? window.location.origin : undefined) : "";
  const stageIndex = STAGES.findIndex((item) => item.id === stage);

  const previewData = useMemo(() => ({
    establishment: est ?? {},
    page: {
      title,
      description,
      logo_url: logoUrl || null,
      cover_url: coverUrl || null,
      theme,
      published,
      public_slug: publicSlug,
    },
    links,
  }), [est, title, description, logoUrl, coverUrl, theme, published, publicSlug, links]);

  function applyPreset(id: string) {
    const preset = getBioCommercePreset(id);
    if (!preset) return;
    setTheme((current) => ({ ...current, ...preset, preset_id: preset.preset_id, niche_id: preset.niche_id } as ThemeState));
  }

  function chooseNiche(id: BioCommerceNicheId) {
    const presetId = defaultPresetForNiche(id);
    const preset = getBioCommercePreset(presetId)!;
    setTheme((current) => ({ ...current, ...preset, niche_id: id, preset_id: presetId } as ThemeState));
  }

  function addLink(kind: LinkKind) {
    if (links.length >= 50) return toast.error("O Bio Commerce aceita até 50 módulos.");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const slug = est?.slug ?? publicSlug;
    const url = kind === "cardapio" ? `${origin}/cardapio/${slug}` : kind === "cartao" ? `${origin}/cartao/${slug}` : "";
    const blockDefaults: Record<string, any> = kind === "menu_carousel" ? { source: theme.niche_id === "food" ? "menu" : "catalog", limit: 8, presentation: "bloco" } : kind === "reviews" ? { limit: 4, min_rating: 4, presentation: "bloco" } : kind === "gallery" ? { images: [], presentation: "bloco" } : kind === "video" || kind === "spotify" ? { url: "", presentation: "bloco" } : kind === "header_image" ? { image_url: "", link_url: "", presentation: "bloco" } : { presentation: defaultPresentationForKind(kind, links.length) };
    const row: LinkRow = { _uid: uid(), kind, label: META[kind].label, url, enabled: true, sort_order: links.length, data: blockDefaults };
    setLinks((current) => [...current, row]);
    setEditing(links.length);
  }

  function updateLink(index: number, patch: Partial<LinkRow>) {
    setLinks((current) => current.map((link, idx) => idx === index ? { ...link, ...patch } : link));
  }
  function removeLink(index: number) {
    setLinks((current) => current.filter((_, idx) => idx !== index).map((link, idx) => ({ ...link, sort_order: idx })));
    setEditing(null);
  }
  function moveLink(index: number, direction: -1 | 1) {
    setLinks((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = current.slice();
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((link, idx) => ({ ...link, sort_order: idx }));
    });
  }

  async function save(publish?: boolean) {
    if (!est) return;
    const normalizedSlug = sanitizeSlug(publicSlug);
    if (normalizedSlug.length < 3) return toast.error("Escolha um endereço público com pelo menos 3 caracteres.");
    setSaving(true);
    try {
      const result = await saveTree({ data: {
        establishment_id: est.id,
        public_slug: normalizedSlug,
        title: title.trim() || null,
        description: description.trim() || null,
        logo_url: logoUrl.trim() || null,
        cover_url: coverUrl.trim() || null,
        theme: { primary: theme.primary, accent: theme.accent, background: theme.background, text: theme.text, button_style: theme.button_style, rounded: theme.rounded },
        social: {},
        links: links.map((link, index) => ({ ...link, sort_order: index, data: link.data ?? {} })),
        published: typeof publish === "boolean" ? publish : undefined,
      }});
      await saveAdvancedTheme({ data: { establishment_id: est.id, theme: {
        preset_id: theme.preset_id,
        niche_id: theme.niche_id,
        layout: theme.layout,
        hero_style: theme.hero_style,
        card_style: theme.card_style,
        background_effect: theme.background_effect,
        font_style: theme.font_style,
        content_width: theme.content_width,
        motion: theme.motion,
        motion_intensity: theme.motion_intensity,
        product_style: theme.product_style,
        social_style: theme.social_style,
      } } });
      if (typeof publish === "boolean") setPublished(!!result.published);
      setPublicSlug(normalizedSlug);
      await queryClient.invalidateQueries({ queryKey: ["my-linktree", est.id] });
      await queryClient.invalidateQueries({ queryKey: ["public-linktree", normalizedSlug] });
      toast.success(publish === true ? "Bio Commerce publicado!" : publish === false ? "Bio Commerce despublicado." : "Alterações salvas.");
      treeQuery.refetch();
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setSaving(false);
    }
  }

  if (!est || treeQuery.isLoading) return <RouteLoading label="Carregando Bio Commerce…" fullscreen={false} className="min-h-[50vh]" />;

  return <div className="mx-auto w-full max-w-[1600px] space-y-5 overflow-x-hidden p-3 sm:p-5 lg:p-7">
    <header className="sticky top-0 z-40 -mx-3 border-b bg-background/90 px-3 py-3 backdrop-blur-xl sm:-mx-5 sm:px-5 lg:-mx-7 lg:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></span><div><h1 className="font-display text-xl font-black sm:text-2xl">Bio Commerce</h1><p className="text-xs text-muted-foreground">Sua micro landing comercial premium.</p></div></div></div><div className="flex flex-wrap gap-2"><ConfigureQrButton dest="linktree" label="QR Code" />{published && <Button variant="outline" size="sm" asChild><a href={publicUrl} target="_blank" rel="noreferrer"><Eye className="mr-1.5 h-4 w-4" />Ver público</a></Button>}<Button size="sm" onClick={() => save()} disabled={saving}><Save className="mr-1.5 h-4 w-4" />{saving ? "Salvando…" : "Salvar"}</Button></div></div>
    </header>

    <StageNav stage={stage} onChange={setStage} />

    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_460px]">
      <main className="min-w-0"><AnimatePresence mode="wait" initial={false}><motion.div key={stage} initial={reduced ? false : { opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? { opacity: 1 } : { opacity: 0, x: -10 }} transition={{ duration: reduced ? 0 : .2 }}>
        {stage === "negocio" && <BusinessStage title={title} setTitle={setTitle} description={description} setDescription={setDescription} logoUrl={logoUrl} setLogoUrl={setLogoUrl} coverUrl={coverUrl} setCoverUrl={setCoverUrl} slug={publicSlug} setSlug={(value) => setPublicSlug(sanitizeSlug(value))} niche={theme.niche_id} chooseNiche={chooseNiche} />}
        {stage === "tema" && <ThemeStage niche={theme.niche_id} preset={theme.preset_id} applyPreset={applyPreset} logoUrl={logoUrl} onPalette={(palette) => setTheme((current) => ({ ...current, primary: palette.primary, accent: palette.accent, background: palette.background, text: palette.text }))} />}
        {stage === "conteudo" && <ContentStage links={links} editing={editing} setEditing={setEditing} addLink={addLink} updateLink={updateLink} removeLink={removeLink} moveLink={moveLink} />}
        {stage === "aparencia" && <AppearanceStage theme={theme} setTheme={setTheme} />}
        {stage === "publicar" && <PublishStage publicUrl={publicUrl} published={published} saving={saving} onSave={() => save()} onPublish={() => save(true)} onUnpublish={() => save(false)} />}
      </motion.div></AnimatePresence>
      <div className="mt-5 flex items-center justify-between"><Button variant="outline" disabled={stageIndex === 0} onClick={() => setStage(STAGES[Math.max(0, stageIndex - 1)].id)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>{stageIndex < STAGES.length - 1 ? <Button onClick={() => setStage(STAGES[stageIndex + 1].id)}>Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button onClick={() => save(true)} disabled={saving}>{published ? "Atualizar publicação" : "Publicar Bio Commerce"}</Button>}</div>
      </main>

      <aside className="2xl:sticky 2xl:top-28 2xl:self-start"><PreviewCard mode={previewMode} setMode={setPreviewMode} data={previewData} slug={publicSlug || est.slug} blockData={(blockQuery.data ?? EMPTY_BLOCKS) as BioCommerceBlockData} /></aside>
    </div>
  </div>;
}

function StageNav({ stage, onChange }: { stage: Stage; onChange: (stage: Stage) => void }) {
  const active = STAGES.findIndex((item) => item.id === stage);
  return <div className="overflow-x-auto rounded-2xl border bg-card/70 p-2 [scrollbar-width:none]"><div className="flex min-w-[660px] gap-1">{STAGES.map((item, index) => <button key={item.id} onClick={() => onChange(item.id)} className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left transition ${item.id === stage ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-black ${item.id === stage ? "bg-white/20" : index < active ? "bg-emerald-500/15 text-emerald-600" : "bg-muted"}`}>{index < active ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><span><strong className="block text-xs">{item.label}</strong><span className={`block text-[10px] ${item.id === stage ? "opacity-75" : "text-muted-foreground"}`}>{item.helper}</span></span></button>)}</div></div>;
}

function BusinessStage(props: any) {
  return <div className="space-y-5"><Card><CardHeader><CardTitle>Identidade da landing</CardTitle><p className="text-sm text-muted-foreground">Essas informações alimentam o hero principal da Bio Commerce.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Nome"><Input value={props.title} onChange={(e) => props.setTitle(e.target.value)} /></Field><Field label="Logo (URL)"><Input value={props.logoUrl} onChange={(e) => props.setLogoUrl(e.target.value)} /></Field></div><Field label="Descrição"><Textarea rows={3} value={props.description} onChange={(e) => props.setDescription(e.target.value)} placeholder="Uma frase curta e comercial sobre seu negócio." /></Field><Field label="Imagem de capa"><Input value={props.coverUrl} onChange={(e) => props.setCoverUrl(e.target.value)} placeholder="https://..." /></Field><Field label="Endereço público"><div className="flex items-center rounded-xl border"><span className="pl-3 text-xs text-muted-foreground">afidelize.app/</span><Input value={props.slug} onChange={(e) => props.setSlug(e.target.value)} className="border-0 pl-0 shadow-none focus-visible:ring-0" /></div></Field></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Qual é o seu nicho?</CardTitle><p className="text-sm text-muted-foreground">O nicho define a estrutura, o ritmo visual, a vitrine e o CTA da landing. Você pode trocar quando quiser.</p></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{BIO_COMMERCE_NICHES.map((item) => <button key={item.id} onClick={() => props.chooseNiche(item.id)} className={`rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${props.niche === item.id ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-border"}`}><p className="text-sm font-black">{item.label}</p><p className="mt-1 text-xs text-muted-foreground">{item.description}</p>{props.niche === item.id && <span className="mt-3 inline-flex rounded-full bg-primary px-2 py-1 text-[9px] font-black text-primary-foreground">SELECIONADO</span>}</button>)}</div></CardContent></Card></div>;
}

function ThemeStage({ niche, preset, applyPreset, logoUrl, onPalette }: any) {
  const themes = BIO_COMMERCE_PRESETS.filter((item) => item.niche_id === niche);
  return <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" />Temas do seu nicho</CardTitle><p className="text-sm text-muted-foreground">Cada tema é uma landing completa, não apenas uma paleta de cores.</p></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{themes.map((item) => <button key={item.preset_id} onClick={() => applyPreset(item.preset_id)} className={`relative overflow-hidden rounded-2xl border-2 p-3 text-left transition hover:-translate-y-0.5 ${preset === item.preset_id ? "border-primary ring-2 ring-primary/10" : "border-border"}`} style={{ background: item.background, color: item.text }}><div className="relative h-32 overflow-hidden rounded-xl" style={{ background: `radial-gradient(circle at 20% 0%,${item.primary}aa,transparent 52%),linear-gradient(160deg,${item.background},${item.accent}44)` }}><div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/15 bg-black/30 p-3 backdrop-blur"><div className="h-2 w-1/2 rounded bg-white/75" /><div className="mt-2 flex gap-1.5"><span className="h-7 flex-1 rounded-lg" style={{ background: item.primary }} /><span className="h-7 w-12 rounded-lg bg-white/10" /></div></div></div><p className="mt-3 text-[10px] font-bold uppercase tracking-wider opacity-60">{item.niche}</p><p className="text-sm font-black">{item.label}</p><p className="mt-1 line-clamp-2 text-[10px] opacity-65">{item.description}</p>{preset === item.preset_id && <span className="absolute right-2 top-2 rounded-full px-2 py-1 text-[9px] font-black text-white" style={{ background: item.primary }}>EM USO</span>}</button>)}</div></CardContent></Card><LogoPaletteSync logoUrl={logoUrl || null} onApply={onPalette} hint="Use as cores da sua marca sem perder a composição premium do tema." /></div>;
}

function ContentStage({ links, editing, setEditing, addLink, updateLink, removeLink, moveLink }: any) {
  const groups = [{ id: "acoes", label: "Ações" }, { id: "vendas", label: "Vendas e experiência" }, { id: "social", label: "Social" }, { id: "midia", label: "Mídia" }] as const;
  return <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" />Adicionar módulo</CardTitle><p className="text-sm text-muted-foreground">Cardápio e catálogo abastecem automaticamente a vitrine da landing. Os módulos abaixo complementam a experiência.</p></CardHeader><CardContent className="space-y-4">{groups.map((group) => <div key={group.id}><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">{group.label}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{(Object.keys(META) as LinkKind[]).filter((kind) => META[kind].group === group.id).map((kind) => { const Icon = META[kind].icon; return <button key={kind} onClick={() => addLink(kind)} className="flex items-center gap-2 rounded-xl border bg-card p-3 text-left text-xs font-bold transition hover:border-primary/40 hover:bg-primary/5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>{META[kind].label}</button>; })}</div></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Estrutura atual</CardTitle><p className="text-xs text-muted-foreground">{links.length}/50 módulos. Nenhum conteúdo é removido ao trocar de tema ou nicho.</p></CardHeader><CardContent className="space-y-2">{links.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">A landing já funciona com sua identidade. Adicione ações e módulos conforme necessário.</div>}{links.map((link: LinkRow, index: number) => { const Icon = META[link.kind].icon; const open = editing === index; return <div key={link._uid ?? link.id ?? index} className={`overflow-hidden rounded-2xl border ${open ? "border-primary/40" : ""}`}><div className="flex items-center gap-2 p-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><button className="min-w-0 flex-1 text-left" onClick={() => setEditing(open ? null : index)}><strong className="block truncate text-sm">{link.label || META[link.kind].label}</strong><span className="text-[10px] text-muted-foreground">{META[link.kind].block ? "Bloco de landing" : "Ação / atalho"}</span></button><Switch checked={link.enabled} onCheckedChange={(value) => updateLink(index, { enabled: !!value })} /><Button size="icon" variant="ghost" onClick={() => moveLink(index, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" onClick={() => moveLink(index, 1)} disabled={index === links.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" onClick={() => setEditing(open ? null : index)}><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" onClick={() => removeLink(index)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div><AnimatePresence initial={false}>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="border-t p-4"><LinkFields link={link} index={index} onChange={(patch) => updateLink(index, patch)} /></div></motion.div>}</AnimatePresence></div>; })}</CardContent></Card></div>;
}

function LinkFields({ link, index, onChange }: { link: LinkRow; index: number; onChange: (patch: Partial<LinkRow>) => void }) {
  const data = link.data ?? {};
  const setData = (patch: Record<string, any>) => onChange({ data: { ...data, ...patch } });
  if (link.kind === "wifi") { const parsed = decodeWifi(link.url); return <div className="grid gap-3 md:grid-cols-2"><Field label="Rede"><Input value={parsed.ssid} onChange={(e) => onChange({ label: e.target.value ? `Wi-Fi · ${e.target.value}` : "Wi-Fi", url: encodeWifi(e.target.value, parsed.password) })} /></Field><Field label="Senha"><Input value={parsed.password} onChange={(e) => onChange({ url: encodeWifi(parsed.ssid, e.target.value) })} /></Field></div>; }
  if (link.kind === "pix") { const parsed = decodePix(link.url); return <div className="grid gap-3 md:grid-cols-2"><Field label="Chave Pix"><Input value={parsed.key} onChange={(e) => onChange({ url: encodePix(e.target.value, parsed.name) })} /></Field><Field label="Beneficiário"><Input value={parsed.name} onChange={(e) => onChange({ label: e.target.value ? `Pix · ${e.target.value}` : "Pix", url: encodePix(parsed.key, e.target.value) })} /></Field></div>; }
  if (link.kind === "gallery") { const images = Array.isArray(data.images) ? data.images.join("\n") : ""; return <div className="space-y-3"><Field label="Título"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="URLs das imagens, uma por linha"><Textarea rows={6} value={images} onChange={(e) => setData({ images: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) })} /></Field></div>; }
  if (link.kind === "video" || link.kind === "spotify") return <div className="grid gap-3 md:grid-cols-2"><Field label="Título"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="URL"><Input value={data.url ?? ""} onChange={(e) => setData({ url: e.target.value })} /></Field></div>;
  if (link.kind === "header_image") return <div className="grid gap-3 md:grid-cols-2"><Field label="Título"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="Imagem"><Input value={data.image_url ?? ""} onChange={(e) => setData({ image_url: e.target.value })} /></Field><Field label="Link opcional"><Input value={data.link_url ?? ""} onChange={(e) => setData({ link_url: e.target.value })} /></Field></div>;
  if (link.kind === "menu_carousel") return <div className="grid gap-3 md:grid-cols-2"><Field label="Título"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="Fonte"><Select value={data.source ?? "menu"} onValueChange={(value) => setData({ source: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="menu">Cardápio</SelectItem><SelectItem value="catalog">Catálogo</SelectItem></SelectContent></Select></Field><Field label="Quantidade"><Input type="number" min={3} max={12} value={data.limit ?? 8} onChange={(e) => setData({ limit: Math.max(3, Math.min(12, Number(e.target.value) || 8)) })} /></Field></div>;
  if (link.kind === "reviews") return <div className="grid gap-3 md:grid-cols-2"><Field label="Título"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="Quantidade"><Input type="number" min={1} max={10} value={data.limit ?? 4} onChange={(e) => setData({ limit: Math.max(1, Math.min(10, Number(e.target.value) || 4)) })} /></Field></div>;
  const presentation = (data.presentation as BioCommercePresentation) || defaultPresentationForKind(link.kind, index);
  return <div className="grid gap-3 md:grid-cols-2"><Field label="Nome"><Input value={link.label} onChange={(e) => onChange({ label: e.target.value })} /></Field><Field label="Destino"><Input value={link.url} onChange={(e) => onChange({ url: e.target.value })} /></Field><Field label="Apresentação"><Select value={presentation} onValueChange={(value) => setData({ presentation: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="destaque">CTA principal</SelectItem><SelectItem value="botao">Botão</SelectItem><SelectItem value="atalho">Atalho</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent></Select></Field><Field label="Descrição curta"><Input value={data.description ?? ""} onChange={(e) => setData({ description: e.target.value })} /></Field></div>;
}

function AppearanceStage({ theme, setTheme }: { theme: ThemeState; setTheme: React.Dispatch<React.SetStateAction<ThemeState>> }) {
  const set = (key: keyof ThemeState, value: any) => setTheme((current) => ({ ...current, [key]: value }));
  return <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" />Identidade visual</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><ColorField label="Cor principal" value={theme.primary} onChange={(value) => set("primary", value)} /><ColorField label="Cor secundária" value={theme.accent} onChange={(value) => set("accent", value)} /><ColorField label="Fundo" value={theme.background} onChange={(value) => set("background", value)} /><ColorField label="Texto" value={theme.text} onChange={(value) => set("text", value)} /></CardContent></Card><Card><CardHeader><CardTitle>Composição premium</CardTitle><p className="text-sm text-muted-foreground">A preview ao lado usa o mesmo renderer da página pública.</p></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><SelectField label="Layout" value={theme.layout} onChange={(value) => set("layout", value)} options={[["commerce","Commerce"],["editorial","Editorial"],["bento","Bento"],["classic","Clássico"]]} /><SelectField label="Hero" value={theme.hero_style} onChange={(value) => set("hero_style", value)} options={[["immersive","Imersivo"],["brand","Marca"],["split","Dividido"],["minimal","Minimalista"]]} /><SelectField label="Cards" value={theme.card_style} onChange={(value) => set("card_style", value)} options={[["glass","Glass"],["elevated","Elevado"],["outline","Contorno"],["soft","Suave"]]} /><SelectField label="Fundo" value={theme.background_effect} onChange={(value) => set("background_effect", value)} options={[["aurora","Aurora"],["ambient","Ambiente"],["mesh","Mesh"],["soft-glow","Glow suave"],["solid","Sólido"]]} /><SelectField label="Vitrine" value={theme.product_style} onChange={(value) => set("product_style", value)} options={[["carousel","Carrossel em loop"],["grid","Grade"],["editorial","Editorial"]]} /><SelectField label="Movimento" value={theme.motion} onChange={(value) => set("motion", value)} options={[["smooth","Ativado"],["none","Desativado"]]} /></CardContent></Card></div>;
}

function PublishStage({ publicUrl, published, saving, onSave, onPublish, onUnpublish }: any) {
  return <Card><CardHeader><CardTitle>Publicar sua landing</CardTitle><p className="text-sm text-muted-foreground">A Bio Commerce reúne sua marca, vitrine, ações e módulos em um único link.</p></CardHeader><CardContent className="space-y-4"><div className="rounded-2xl border bg-muted/30 p-4"><p className="text-xs font-black">Endereço público</p><code className="mt-1 block truncate text-xs text-muted-foreground">{publicUrl}</code><Button variant="outline" className="mt-3" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); }}><Copy className="mr-2 h-4 w-4" />Copiar link</Button></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={onSave} disabled={saving}>Salvar rascunho</Button>{published ? <Button variant="destructive" onClick={onUnpublish} disabled={saving}>Despublicar</Button> : <Button onClick={onPublish} disabled={saving}>Publicar Bio Commerce</Button>}{published && <Button onClick={onPublish} disabled={saving}>Atualizar publicação</Button>}</div></CardContent></Card>;
}

function PreviewCard({ mode, setMode, data, slug, blockData }: any) {
  return <Card className="overflow-hidden"><CardHeader className="border-b"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base">Preview real</CardTitle><p className="mt-1 text-[11px] text-muted-foreground">Mesmo renderer da página pública.</p></div><div className="flex rounded-lg border p-1"><button onClick={() => setMode("mobile")} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black ${mode === "mobile" ? "bg-primary text-primary-foreground" : ""}`}><Smartphone className="h-3 w-3" />iPhone</button><button onClick={() => setMode("desktop")} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black ${mode === "desktop" ? "bg-primary text-primary-foreground" : ""}`}><Monitor className="h-3 w-3" />Desktop</button></div></div></CardHeader><CardContent className="bg-neutral-950 p-4">{mode === "mobile" ? <div className="relative mx-auto w-[356px] max-w-full rounded-[3.2rem] border-[7px] border-neutral-800 bg-neutral-900 p-[5px] shadow-[0_30px_90px_rgba(0,0,0,.55)]"><div className="pointer-events-none absolute left-1/2 top-[10px] z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-black" /><div className="pointer-events-none absolute left-[calc(50%+36px)] top-[17px] z-30 h-2 w-2 rounded-full bg-neutral-700" /><div className="h-[720px] overflow-y-auto rounded-[2.55rem] bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><BioCommerceLanding data={data} slug={slug} blockData={blockData} embedded interactive={false} /></div><div className="pointer-events-none absolute bottom-3 left-1/2 z-30 h-1.5 w-28 -translate-x-1/2 rounded-full bg-white/80" /></div> : <div className="h-[720px] overflow-y-auto rounded-2xl border border-white/10 bg-black [scrollbar-width:none]"><BioCommerceLanding data={data} slug={slug} blockData={blockData} embedded interactive={false} /></div>}</CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label}><div className="flex gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 rounded-lg border" /><Input value={value} onChange={(e) => onChange(e.target.value)} /></div></Field>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string,string]> }) { return <Field label={label}><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map(([key,name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></Field>; }
