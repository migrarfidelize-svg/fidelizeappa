import { RouteLoading } from "@/components/RouteLoading";
import { createFileRoute } from "@tanstack/react-router";
import { LogoPaletteSync } from "@/components/LogoPaletteSync";
import { ConfigureQrButton } from "@/components/merchant/ConfigureQrButton";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage as friendlyError } from "@/lib/error-messages";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { getMyLinkTree, upsertLinkTree } from "@/lib/linktree.functions";
import { getPublicLinkTreeUrl } from "@/lib/public-link-url";
import { validatePixKey, PIX_TYPE_LABEL } from "@/lib/pix-validation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose } from "@/components/ui/sheet";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExternalLink, Instagram, MessageCircle, Globe, MapPin, Youtube, Facebook,
  Music2, Mail, Phone, Star, Trash2, ArrowUp, ArrowDown, Plus, Eye, Copy, QrCode, Wifi, KeyRound,
  UtensilsCrossed, CreditCard, PlayCircle, Music, Images, MessageSquareQuote, ImageIcon, Pencil, Check, GripVertical,
} from "lucide-react";



export const Route = createFileRoute("/_authenticated/app/linktree")({
  ssr: false,
  component: LinkTreeEditor,
});

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

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

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

const KIND_META: Record<LinkKind, { label: string; icon: any; placeholder: string; isBlock?: boolean }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, placeholder: "5511999999999" },
  instagram: { label: "Instagram", icon: Instagram, placeholder: "@seuperfil" },
  facebook: { label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/…" },
  tiktok: { label: "TikTok", icon: Music2, placeholder: "https://tiktok.com/@…" },
  youtube: { label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@…" },
  site: { label: "Site", icon: Globe, placeholder: "https://seusite.com" },
  google: { label: "Google Reviews", icon: Star, placeholder: "https://g.page/…/review" },
  maps: { label: "Endereço / Maps", icon: MapPin, placeholder: "https://maps.google.com/…" },
  email: { label: "E-mail", icon: Mail, placeholder: "contato@seudominio.com" },
  phone: { label: "Telefone", icon: Phone, placeholder: "1130000000" },
  wifi: { label: "Wi-Fi", icon: Wifi, placeholder: "WIFI:S:Rede;T:WPA;P:senha;;" },
  pix: { label: "Chave Pix", icon: KeyRound, placeholder: "PIX:T:email;K:chave;;" },
  cardapio: { label: "Cardápio Digital", icon: UtensilsCrossed, placeholder: "/cardapio/seu-slug" },
  cartao: { label: "Cartão Fidelidade", icon: CreditCard, placeholder: "/cartao/seu-slug" },
  custom: { label: "Link personalizado", icon: ExternalLink, placeholder: "https://…" },
  // Blocos ricos
  video: { label: "Vídeo (YouTube/Reels/TikTok)", icon: PlayCircle, placeholder: "https://youtube.com/…", isBlock: true },
  spotify: { label: "Música (Spotify)", icon: Music, placeholder: "https://open.spotify.com/…", isBlock: true },
  gallery: { label: "Galeria de imagens", icon: Images, placeholder: "", isBlock: true },
  menu_carousel: { label: "Vitrine do Cardápio/Catálogo", icon: UtensilsCrossed, placeholder: "", isBlock: true },
  reviews: { label: "Depoimentos & Avaliações", icon: MessageSquareQuote, placeholder: "", isBlock: true },
  header_image: { label: "Banner de destaque", icon: ImageIcon, placeholder: "https://…", isBlock: true },
};

// Encode/decode helpers for Wi-Fi credentials stored in the `url` field
function encodeWifi(ssid: string, password: string, security: "WPA" | "nopass" = "WPA") {
  const esc = (s: string) => s.replace(/([\\;,":])/g, "\\$1");
  return `WIFI:S:${esc(ssid)};T:${password ? security : "nopass"};P:${esc(password)};;`;
}
function decodeWifi(url: string): { ssid: string; password: string } {
  const s = /WIFI:.*?S:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const p = /WIFI:.*?P:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (v: string) => v.replace(/\\(.)/g, "$1");
  return { ssid: unesc(s), password: unesc(p) };
}

// Encode/decode helpers for Pix keys stored in the `url` field
type PixKeyType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
function encodePix(type: PixKeyType, key: string, name: string) {
  const esc = (s: string) => s.replace(/([\\;,":])/g, "\\$1");
  return `PIX:T:${type};K:${esc(key)};N:${esc(name)};;`;
}
function decodePix(url: string): { type: PixKeyType; key: string; name: string } {
  const t = (/PIX:.*?T:([^;]+);/i.exec(url)?.[1] ?? "email") as PixKeyType;
  const k = /PIX:.*?K:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const n = /PIX:.*?N:((?:\\.|[^;\\])*);/i.exec(url)?.[1] ?? "";
  const unesc = (v: string) => v.replace(/\\(.)/g, "$1");
  const validTypes: PixKeyType[] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];
  return {
    type: validTypes.includes(t) ? t : "email",
    key: unesc(k),
    name: unesc(n),
  };
}



type ThemePreset = {
  id: string;
  label: string;
  primary: string;
  accent: string;
  background: string;
  text: string;
  button_style: "solid" | "outline" | "glass";
  rounded: "sm" | "md" | "lg" | "xl" | "full";
};

const THEME_PRESETS: ThemePreset[] = [
  {
    id: "cyan-circuit",
    label: "Cyan Circuit",
    primary: "#a78bfa",
    accent: "#ff2fd0",
    background: "#0b1220",
    text: "#ffffff",
    button_style: "glass",
    rounded: "xl",
  },
  {
    id: "porcelain",
    label: "Porcelain",
    primary: "#0284c7",
    accent: "#e11d8a",
    background: "#f8fafc",
    text: "#0f172a",
    button_style: "solid",
    rounded: "full",
  },
  {
    id: "sunset-neon",
    label: "Sunset Neon",
    primary: "#f59e0b",
    accent: "#ef4444",
    background: "#1a0b2e",
    text: "#fff7ed",
    button_style: "outline",
    rounded: "lg",
  },
];

function LinkTreeEditor() {
  const queryClient = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as
    | { id: string; slug: string; name: string; logo_url: string | null; primary_color: string; accent_color: string }
    | undefined;

  const getFn = useServerFn(getMyLinkTree);
  const saveFn = useServerFn(upsertLinkTree);
  const q = useQuery({
    queryKey: ["my-linktree", est?.id],
    queryFn: () => getFn({ data: { establishment_id: est!.id } }),
    enabled: !!est?.id,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [primary, setPrimary] = useState("#0ea5e9");
  const [accent, setAccent] = useState("#8b5cf6");
  const [background, setBackground] = useState("#0b0f19");
  const [text, setText] = useState("#ffffff");
  const [buttonStyle, setButtonStyle] = useState<"solid" | "outline" | "glass">("solid");
  const [rounded, setRounded] = useState<"sm" | "md" | "lg" | "xl" | "full">("xl");
  const [published, setPublished] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [mobileEditIdx, setMobileEditIdx] = useState<number | null>(null);

  // Load once
  useEffect(() => {
    const p = q.data?.page;
    if (!p) {
      if (est) {
        setTitle(est.name);
        setLogoUrl(est.logo_url ?? "");
        setPrimary(est.primary_color);
        setAccent(est.accent_color);
        setPublicSlug(sanitizePublicSlug(est.slug));
      }
      return;
    }
    setTitle(p.title ?? est?.name ?? "");
    setDescription(p.description ?? "");
    setLogoUrl(p.logo_url ?? "");
    setCoverUrl(p.cover_url ?? "");
    const t = (p.theme as Record<string, string>) ?? {};
    setPrimary(t.primary ?? est?.primary_color ?? "#0ea5e9");
    setAccent(t.accent ?? est?.accent_color ?? "#8b5cf6");
    setBackground(t.background ?? "#0b0f19");
    setText(t.text ?? "#ffffff");
    setButtonStyle((t.button_style as any) ?? "solid");
    setRounded((t.rounded as any) ?? "xl");
    setPublished(!!p.published);
    setPublicSlug(
      sanitizePublicSlug((p as any).public_slug ?? est?.slug ?? ""),
    );
    setLinks(
      (q.data?.links ?? []).map((l: any) => ({
        id: l.id, _uid: l.id ?? uid(), kind: l.kind, label: l.label, url: l.url,
        icon: l.icon, enabled: l.enabled, sort_order: l.sort_order,
        data: (l.data ?? {}) as Record<string, any>,
      })),
    );
  }, [q.data, est]);

  const publicUrl = est
    ? getPublicLinkTreeUrl(
        publicSlug || sanitizePublicSlug(est.slug),
        typeof window !== "undefined" ? window.location.origin : undefined,
      )
    : "";

  function addLink(kind: LinkKind) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const slug = est?.slug ?? "";
    const prefill =
      kind === "cardapio" && slug ? `${origin}/cardapio/${slug}` :
      kind === "cartao" && slug ? `${origin}/cartao/${slug}` : "";
    const defaults: Record<LinkKind, Record<string, any>> = {
      whatsapp: {}, instagram: {}, facebook: {}, tiktok: {}, youtube: {},
      site: {}, google: {}, maps: {}, email: {}, phone: {}, wifi: {}, pix: {},
      cardapio: {}, cartao: {}, custom: {},
      video: { url: "", autoplay: false },
      spotify: { url: "" },
      gallery: { images: [] as string[] },
      menu_carousel: { source: "menu", limit: 8 },
      reviews: { limit: 3, min_rating: 4 },
      header_image: { image_url: "", link_url: "" },
    };
    setLinks((prev) => [...prev, {
      _uid: uid(),
      kind,
      label: KIND_META[kind].label,
      url: prefill,
      enabled: true,
      sort_order: prev.length,
      data: defaults[kind] ?? {},
    }]);
  }
  function updateLink(i: number, patch: Partial<LinkRow>) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, sort_order: idx })));
  }
  function move(i: number, dir: -1 | 1) {
    setLinks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((l, idx) => ({ ...l, sort_order: idx }));
    });
  }
  function reorderByUid(fromUid: string, toUid: string) {
    setLinks((prev) => {
      const from = prev.findIndex((l) => (l._uid ?? l.id) === fromUid);
      const to = prev.findIndex((l) => (l._uid ?? l.id) === toUid);
      if (from < 0 || to < 0 || from === to) return prev;
      return arrayMove(prev, from, to).map((l, idx) => ({ ...l, sort_order: idx }));
    });
  }
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    reorderByUid(String(e.active.id), String(e.over.id));
  }

  async function save(publish?: boolean) {
    if (!est) return;

    const normalizedPublicSlug = sanitizePublicSlug(publicSlug);
    if (normalizedPublicSlug.length < 3) {
      toast.error("Escolha um link personalizado com pelo menos 3 caracteres.");
      return;
    }
    setPublicSlug(normalizedPublicSlug);

    // basic validation
    for (const [i, l] of links.entries()) {
      const meta = KIND_META[l.kind];
      if (meta.isBlock) {
        // Blocos ricos têm validação própria (opcional).
        if (l.kind === "video" && !String(l.data?.url ?? "").trim()) {
          toast.error(`Bloco #${i + 1} (Vídeo): informe a URL do vídeo.`); return;
        }
        if (l.kind === "spotify" && !String(l.data?.url ?? "").trim()) {
          toast.error(`Bloco #${i + 1} (Spotify): informe a URL.`); return;
        }
        if (l.kind === "header_image" && !String(l.data?.image_url ?? "").trim()) {
          toast.error(`Bloco #${i + 1} (Banner): informe a imagem.`); return;
        }
        if (l.kind === "gallery" && !(Array.isArray(l.data?.images) && l.data!.images.length > 0)) {
          toast.error(`Bloco #${i + 1} (Galeria): adicione ao menos uma imagem.`); return;
        }
        continue;
      }
      if (l.kind === "wifi") {
        const { ssid } = decodeWifi(l.url);
        if (!ssid.trim()) {
          toast.error(`Link #${i + 1} (Wi-Fi): informe o nome da rede (SSID).`);
          return;
        }
      } else if (l.kind === "pix") {
        const { type, key } = decodePix(l.url);
        const check = validatePixKey(type, key);
        if (!check.ok) {
          toast.error(`Link #${i + 1} (Pix · ${PIX_TYPE_LABEL[type]}): ${check.message}`);
          return;
        }
      } else if (!l.label.trim() || !l.url.trim()) {
        toast.error(`Link #${i + 1}: rótulo e URL são obrigatórios.`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await saveFn({
        data: {
          establishment_id: est.id,
          public_slug: normalizedPublicSlug,
          title: title.trim() || null,
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
          cover_url: coverUrl.trim() || null,
          theme: { primary, accent, background, text, button_style: buttonStyle, rounded },
          social: {},
          links: links.map((l, i) => ({ ...l, sort_order: i, data: l.data ?? {} })),
          published: typeof publish === "boolean" ? publish : undefined,
        },
      });
      if (typeof publish === "boolean") setPublished(!!res.published);
      if ((res as any).public_slug) {
        setPublicSlug((res as any).public_slug);
      }
      await queryClient.invalidateQueries({ queryKey: ["public-linktree", est.slug] });
      await queryClient.invalidateQueries({ queryKey: ["public-linktree", normalizedPublicSlug] });
      toast.success(publish === true ? "Página publicada!" : publish === false ? "Página despublicada." : "Alterações salvas.");
      q.refetch();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const previewLinks = useMemo(() => links.filter((l) => l.enabled && l.url.trim()), [links]);

  if (!est) return <RouteLoading label="Carregando…" fullscreen={false} className="min-h-[40vh]" />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-clip p-3 sm:p-4 md:p-8">
      <header className="sticky top-0 z-20 -mx-3 sm:-mx-4 md:-mx-8 px-3 sm:px-4 md:px-8 py-3 bg-background/85 backdrop-blur-md border-b">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold truncate">Árvore de Links</h1>
            <p className="hidden sm:block text-sm text-muted-foreground mt-1">
              Sua página pública com todos os links em um só lugar.
            </p>
          </div>
          <div className="shrink-0">
            <ConfigureQrButton dest="linktree" />
          </div>
          <div className="col-span-2 -mx-3 sm:mx-0 flex items-center gap-2 overflow-x-auto px-3 sm:overflow-visible sm:px-0 sm:flex-wrap">
            {published && (
              <>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); }}>
                  <Copy className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Copiar link</span>
                </Button>
                <Button variant="outline" size="sm" className="shrink-0" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer"><Eye className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Ver pública</span></a>
                </Button>
              </>
            )}
            <Button variant="secondary" size="sm" className="shrink-0" onClick={() => save()} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            {published ? (
              <Button variant="destructive" size="sm" className="shrink-0" onClick={() => save(false)} disabled={saving}>Despublicar</Button>
            ) : (
              <Button size="sm" className="shrink-0" onClick={() => save(true)} disabled={saving}>Publicar</Button>
            )}
          </div>
        </div>
      </header>


      {/* URL pública sempre visível */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border bg-card p-3 text-sm">
        <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${published ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
        <span className="font-medium shrink-0 text-xs sm:text-sm">{published ? "Publicada em:" : "Endereço público:"}</span>

        <div className="basis-full space-y-1.5 sm:basis-auto sm:flex-1">
          <Label htmlFor="public-link-slug" className="text-xs text-muted-foreground">
            Personalize seu link
          </Label>
          <div className="flex min-w-0 items-center rounded-md border bg-background">
            <span className="shrink-0 pl-3 text-xs text-muted-foreground">afidelize.app/</span>
            <Input
              id="public-link-slug"
              value={publicSlug}
              onChange={(e) => setPublicSlug(sanitizePublicSlug(e.target.value))}
              placeholder="minha-marca"
              maxLength={60}
              className="border-0 pl-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use letras, números e hífen. O endereço precisa ser único na Fidelize.
          </p>
        </div>

        <code className="basis-full truncate rounded bg-muted px-2 py-1 text-xs">{publicUrl}</code>
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); }}>
            <Copy className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Copiar</span>
          </Button>
          {published && (
            <Button variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer"><Eye className="h-4 w-4 sm:mr-1.5" /> <span className="hidden sm:inline">Abrir</span></a>
            </Button>
          )}
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">

          {/* Identidade */}
          <Card>
            <CardHeader><CardTitle className="text-base">Identidade</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
                </div>
                <div>
                  <Label>Logo (URL)</Label>
                  <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* Tema */}
          <Card>
            <CardHeader><CardTitle className="text-base">Tema</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="mb-2 block">Modelos prontos</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {THEME_PRESETS.map((p) => {
                    const active =
                      primary.toLowerCase() === p.primary.toLowerCase() &&
                      background.toLowerCase() === p.background.toLowerCase() &&
                      text.toLowerCase() === p.text.toLowerCase();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPrimary(p.primary);
                          setAccent(p.accent);
                          setBackground(p.background);
                          setText(p.text);
                          setButtonStyle(p.button_style);
                          setRounded(p.rounded);
                        }}
                        className={`group relative overflow-hidden rounded-2xl border-2 p-3 text-left transition ${
                          active ? "border-primary shadow-lg" : "border-border hover:border-primary/40"
                        }`}
                        style={{ background: p.background, color: p.text }}
                      >
                        <div
                          className="mx-auto grid h-10 w-10 place-items-center rounded-xl text-xs font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
                        >
                          Aa
                        </div>
                        <div className="mt-2 space-y-1.5">
                          <div
                            className="h-5 rounded-md text-[9px] font-semibold flex items-center justify-center text-white"
                            style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
                          >
                            Link
                          </div>
                          <div
                            className="h-5 rounded-md text-[9px] font-semibold flex items-center justify-center"
                            style={{
                              background: p.button_style === "glass" ? "rgba(255,255,255,.1)" : "transparent",
                              border: `1.5px solid ${p.primary}`,
                              color: p.text,
                            }}
                          >
                            Link
                          </div>
                        </div>
                        <p className="mt-2 text-center text-[10px] font-semibold" style={{ color: p.text }}>
                          {p.label}
                        </p>
                        {active && (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground">
                            EM USO
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Escolha um modelo e ajuste as cores abaixo — as alterações aparecem no preview em tempo real.
                </p>
              </div>

              <LogoPaletteSync
                logoUrl={logoUrl || null}
                onApply={(p) => {
                  setPrimary(p.primary);
                  setAccent(p.accent);
                  setBackground(p.background);
                  setText(p.text);
                }}
                className="md:col-span-2"
                hint="Analisamos a sua logo e aplicamos automaticamente as 4 cores da árvore de links."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <ColorField label="Cor primária" value={primary} onChange={setPrimary} />
                <ColorField label="Cor de destaque" value={accent} onChange={setAccent} />
                <ColorField label="Fundo" value={background} onChange={setBackground} />
                <ColorField label="Texto" value={text} onChange={setText} />
                <div>
                  <Label>Estilo do botão</Label>
                  <Select value={buttonStyle} onValueChange={(v) => setButtonStyle(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Sólido (gradiente)</SelectItem>
                      <SelectItem value="outline">Contorno</SelectItem>
                      <SelectItem value="glass">Glass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Borda</Label>
                  <Select value={rounded} onValueChange={(v) => setRounded(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Pequena</SelectItem>
                      <SelectItem value="md">Média</SelectItem>
                      <SelectItem value="lg">Grande</SelectItem>
                      <SelectItem value="xl">Extra</SelectItem>
                      <SelectItem value="full">Pílula</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* Links + Blocos */}
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Blocos ({links.length})</CardTitle>
              <div className="space-y-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Links rápidos</p>
                  <div className="flex flex-wrap gap-1">
                    {(["cardapio","cartao","whatsapp","instagram","site","google","maps","wifi","pix","custom"] as LinkKind[]).map((k) => {
                      const M = KIND_META[k];
                      return (
                        <Button key={k} size="sm" variant="outline" onClick={() => addLink(k)}>
                          <M.icon className="h-3.5 w-3.5 mr-1" /> {M.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Blocos ricos</p>
                  <div className="flex flex-wrap gap-1">
                    {(["menu_carousel","video","spotify","gallery","reviews","header_image"] as LinkKind[]).map((k) => {
                      const M = KIND_META[k];
                      return (
                        <Button key={k} size="sm" variant="secondary" onClick={() => addLink(k)}>
                          <M.icon className="h-3.5 w-3.5 mr-1" /> {M.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {links.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Adicione seu primeiro bloco acima. <Plus className="inline h-3.5 w-3.5" />
                </p>
              )}
              <DndContext
                sensors={dndSensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={links.map((l, i) => l._uid ?? l.id ?? `row-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {links.map((l, i) => (
                    <SortableLinkRow
                      key={l._uid ?? l.id ?? `row-${i}`}
                      id={l._uid ?? l.id ?? `row-${i}`}
                      link={l}
                      index={i}
                      total={links.length}
                      onUpdate={(patch) => updateLink(i, patch)}
                      onRemove={() => removeLink(i)}
                      onMove={(dir) => move(i, dir)}
                      onOpenMobileEdit={() => setMobileEditIdx(i)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        </div>



        {/* Preview */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Preview</CardTitle>
              <QrCode className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className="mx-auto max-w-[320px] rounded-3xl overflow-hidden border shadow-lg"
                style={{ background, color: text }}
              >
                {coverUrl && <div className="h-20"><img src={coverUrl} alt="" className="h-full w-full object-cover opacity-60" /></div>}
                <div className="p-5 text-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
                  ) : (
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-xl font-bold text-white"
                         style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
                      {(title || est.name)[0]}
                    </div>
                  )}
                  <h3 className="mt-3 font-bold">{title || est.name}</h3>
                  {description && <p className="mt-1 text-xs opacity-80">{description}</p>}
                  <div className="mt-4 space-y-2">
                    {previewLinks.length === 0 && (
                      <p className="text-xs opacity-60">Adicione links para visualizar</p>
                    )}
                    {previewLinks.slice(0, 8).map((l, i) => {
                      const Icon = KIND_META[l.kind].icon;
                      const style: React.CSSProperties =
                        buttonStyle === "outline"
                          ? { border: `2px solid ${primary}`, color: text, background: "transparent" }
                          : buttonStyle === "glass"
                          ? { background: "rgba(255,255,255,0.1)", color: text }
                          : { background: `linear-gradient(135deg, ${primary}, ${accent})`, color: "#fff" };
                      const rClass =
                        rounded === "sm" ? "rounded-md" :
                        rounded === "md" ? "rounded-lg" :
                        rounded === "lg" ? "rounded-xl" :
                        rounded === "full" ? "rounded-full" : "rounded-2xl";
                      return (
                        <div key={i} className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold ${rClass}`} style={style}>
                          <Icon className="h-3.5 w-3.5" />
                          <span className="truncate">{l.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile-focused edit sheet */}
      <Sheet open={mobileEditIdx !== null} onOpenChange={(o) => !o && setMobileEditIdx(null)}>
        <SheetContent side="bottom" className="h-[92vh] max-h-[92vh] w-full overflow-y-auto p-0 sm:max-w-lg sm:mx-auto sm:rounded-t-2xl">
          {mobileEditIdx !== null && links[mobileEditIdx] && (() => {
            const idx = mobileEditIdx;
            const l = links[idx];
            const M = KIND_META[l.kind];
            return (
              <>
                <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3 text-left">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <M.icon className="h-4 w-4 text-primary" />
                    <span className="truncate">Editar · {M.label}</span>
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-4 px-4 py-4 pb-28">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={l.kind} onValueChange={(v) => updateLink(idx, { kind: v as LinkKind })}>
                      <SelectTrigger className="h-10 w-full mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(KIND_META) as LinkKind[]).map((k) => (
                          <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="text-sm font-medium">Visível na página</div>
                      <div className="text-xs text-muted-foreground">Desative para ocultar sem apagar.</div>
                    </div>
                    <Switch checked={l.enabled} onCheckedChange={(v) => updateLink(idx, { enabled: !!v })} />
                  </div>
                  <LinkFields link={l} onChange={(patch) => updateLink(idx, patch)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => { move(idx, -1); }} disabled={idx === 0}>
                      <ArrowUp className="h-4 w-4 mr-1" /> Mover acima
                    </Button>
                    <Button variant="outline" onClick={() => { move(idx, 1); }} disabled={idx === links.length - 1}>
                      <ArrowDown className="h-4 w-4 mr-1" /> Mover abaixo
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => { removeLink(idx); setMobileEditIdx(null); }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Remover este link
                  </Button>
                </div>
                <SheetFooter className="sticky bottom-0 z-10 flex-row gap-2 border-t bg-background/95 backdrop-blur px-4 py-3">
                  <SheetClose asChild>
                    <Button variant="outline" className="flex-1">Fechar</Button>
                  </SheetClose>
                  <Button className="flex-1" onClick={() => { setMobileEditIdx(null); toast.success("Alterações mantidas. Toque em Salvar para persistir."); }}>
                    <Check className="h-4 w-4 mr-2" /> Concluir
                  </Button>
                </SheetFooter>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SortableLinkRow({
  id, link: l, index: i, total, onUpdate, onRemove, onMove, onOpenMobileEdit,
}: {
  id: string;
  link: LinkRow;
  index: number;
  total: number;
  onUpdate: (patch: Partial<LinkRow>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onOpenMobileEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const M = KIND_META[l.kind];
  const isBlock = !!M.isBlock;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
    opacity: isDragging ? 0.9 : 1,
    boxShadow: isDragging ? "0 12px 32px -8px rgba(0,0,0,0.35)" : undefined,
    touchAction: "manipulation",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border p-3 space-y-2 ${isBlock ? "bg-secondary/30 border-primary/20" : "bg-card"} ${isDragging ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Arrastar para reordenar"
          className="shrink-0 -ml-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <M.icon className="h-4 w-4 text-primary shrink-0" />
        {/* Desktop: inline kind selector */}
        <div className="hidden sm:block">
          <Select value={l.kind} onValueChange={(v) => onUpdate({ kind: v as LinkKind })}>
            <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_META) as LinkKind[]).map((k) => (
                <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Mobile: summary text */}
        <div className="sm:hidden min-w-0 flex-1 truncate text-sm font-medium">
          {l.label?.trim() || M.label}
        </div>
        {isBlock && (
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">Bloco</span>
        )}
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1 shrink-0">
          <Switch checked={l.enabled} onCheckedChange={(v) => onUpdate({ enabled: !!v })} />
          <Button size="icon" variant="ghost" className="h-8 w-8 sm:hidden" onClick={onOpenMobileEdit} aria-label="Editar link">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="hidden sm:inline-flex h-8 w-8" onClick={() => onMove(-1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="hidden sm:inline-flex h-8 w-8" onClick={() => onMove(1)} disabled={i === total - 1}><ArrowDown className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>
      {/* Fields — inline on desktop, hidden on mobile (edited via Sheet) */}
      <div className="hidden sm:block space-y-2">
        <LinkFields link={l} onChange={onUpdate} />
      </div>
    </div>
  );
}

function LinkFields({ link: l, onChange }: { link: LinkRow; onChange: (patch: Partial<LinkRow>) => void }) {
  const M = KIND_META[l.kind];
  const isBlock = !!M.isBlock;
  if (l.kind === "wifi") {
    return (
      <WifiFields
        url={l.url}
        onChange={(ssid, password) =>
          onChange({
            label: ssid ? `Wi-Fi · ${ssid}` : "Wi-Fi",
            url: encodeWifi(ssid, password),
          })
        }
      />
    );
  }
  if (l.kind === "pix") {
    return (
      <PixFields
        url={l.url}
        onChange={(type, key, name) =>
          onChange({
            label: name ? `Pix · ${name}` : "Chave Pix",
            url: encodePix(type, key, name),
          })
        }
      />
    );
  }
  if (isBlock) {
    return <BlockFields row={l} onChange={onChange} />;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <Label className="text-xs">Rótulo</Label>
        <Input className="mt-1" placeholder="Rótulo" value={l.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} />
      </div>
      <div>
        <Label className="text-xs">Destino</Label>
        <Input className="mt-1" placeholder={M.placeholder} value={l.url} onChange={(e) => onChange({ url: e.target.value })} maxLength={500} />
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded border bg-transparent"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={20} />
      </div>
    </div>
  );
}

function WifiFields({ url, onChange }: { url: string; onChange: (ssid: string, password: string) => void }) {
  const parsed = decodeWifi(url);
  const [show, setShow] = useState(false);
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <div>
        <Label className="text-xs">Nome da rede (SSID)</Label>
        <Input
          placeholder="Minha_Rede_WiFi"
          value={parsed.ssid}
          onChange={(e) => onChange(e.target.value, parsed.password)}
          maxLength={64}
        />
      </div>
      <div>
        <Label className="text-xs">Senha</Label>
        <div className="flex gap-1">
          <Input
            type={show ? "text" : "password"}
            placeholder="••••••••"
            value={parsed.password}
            onChange={(e) => onChange(parsed.ssid, e.target.value)}
            maxLength={128}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setShow((s) => !s)}>
            {show ? "Ocultar" : "Ver"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PixFields({ url, onChange }: { url: string; onChange: (type: PixKeyType, key: string, name: string) => void }) {
  const parsed = decodePix(url);
  const [touched, setTouched] = useState(false);
  const check = validatePixKey(parsed.type, parsed.key);
  const showError = touched && !check.ok;
  const placeholders: Record<PixKeyType, string> = {
    cpf: "000.000.000-00",
    cnpj: "00.000.000/0000-00",
    email: "pix@dominio.com",
    telefone: "+5511999999999",
    aleatoria: "123e4567-e89b-12d3-a456-426614174000",
  };
  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-3">
        <div>
          <Label className="text-xs">Tipo de chave</Label>
          <Select value={parsed.type} onValueChange={(v) => { setTouched(true); onChange(v as PixKeyType, parsed.key, parsed.name); }}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cpf">CPF</SelectItem>
              <SelectItem value="cnpj">CNPJ</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="telefone">Telefone</SelectItem>
              <SelectItem value="aleatoria">Aleatória</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Chave Pix</Label>
          <Input
            placeholder={placeholders[parsed.type]}
            value={parsed.key}
            onChange={(e) => onChange(parsed.type, e.target.value, parsed.name)}
            onBlur={() => setTouched(true)}
            maxLength={140}
            aria-invalid={showError}
            className={showError ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </div>
        <div>
          <Label className="text-xs">Beneficiário (opcional)</Label>
          <Input
            placeholder="Nome exibido"
            value={parsed.name}
            onChange={(e) => onChange(parsed.type, parsed.key, e.target.value)}
            maxLength={80}
          />
        </div>
      </div>
      {showError ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {check.message}
        </p>
      ) : parsed.key.trim() ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">Chave {PIX_TYPE_LABEL[parsed.type]} válida.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Preencha a chave no formato de {PIX_TYPE_LABEL[parsed.type]}.</p>
      )}
    </div>
  );
}

// ============================================================================
// BlockFields — editor per rich block type
// ============================================================================
function BlockFields({ row, onChange }: { row: LinkRow; onChange: (patch: Partial<LinkRow>) => void }) {
  const data = row.data ?? {};
  const setData = (patch: Record<string, any>) => onChange({ data: { ...data, ...patch } });

  if (row.kind === "video") {
    return (
      <div className="space-y-2">
        <Input placeholder="Rótulo (aparece acima do vídeo)" value={row.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} />
        <Input placeholder="URL do YouTube, Vimeo, TikTok ou MP4" value={data.url ?? ""} onChange={(e) => setData({ url: e.target.value })} maxLength={500} />
        <p className="text-[11px] text-muted-foreground">Suportamos YouTube, Vimeo, TikTok, Reels e arquivos MP4/WebM diretos.</p>
      </div>
    );
  }
  if (row.kind === "spotify") {
    return (
      <div className="space-y-2">
        <Input placeholder="Rótulo" value={row.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} />
        <Input placeholder="https://open.spotify.com/track|album|playlist/..." value={data.url ?? ""} onChange={(e) => setData({ url: e.target.value })} maxLength={500} />
      </div>
    );
  }
  if (row.kind === "header_image") {
    return (
      <div className="space-y-2">
        <Input placeholder="Rótulo (para acessibilidade)" value={row.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} />
        <Input placeholder="URL da imagem (JPG/PNG/WebP)" value={data.image_url ?? ""} onChange={(e) => setData({ image_url: e.target.value })} maxLength={500} />
        <Input placeholder="Link ao clicar (opcional)" value={data.link_url ?? ""} onChange={(e) => setData({ link_url: e.target.value })} maxLength={500} />
      </div>
    );
  }
  if (row.kind === "gallery") {
    const images: string[] = Array.isArray(data.images) ? data.images : [];
    return (
      <div className="space-y-2">
        <Input placeholder="Título da galeria" value={row.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} />
        {images.map((src, idx) => (
          <div key={idx} className="flex gap-2">
            <Input placeholder={`Imagem #${idx + 1} (URL)`} value={src} onChange={(e) => {
              const next = images.slice(); next[idx] = e.target.value; setData({ images: next });
            }} maxLength={500} />
            <Button size="icon" variant="ghost" onClick={() => setData({ images: images.filter((_, i) => i !== idx) })}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setData({ images: [...images, ""] })}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar imagem
        </Button>
      </div>
    );
  }
  if (row.kind === "menu_carousel") {
    return (
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Fonte</Label>
          <Select value={data.source ?? "menu"} onValueChange={(v) => setData({ source: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="menu">Cardápio publicado</SelectItem>
              <SelectItem value="catalog">Catálogo publicado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quantidade de itens</Label>
          <Input type="number" min={3} max={12} value={data.limit ?? 8} onChange={(e) => setData({ limit: Math.max(3, Math.min(12, Number(e.target.value) || 8)) })} />
        </div>
        <div className="md:col-span-2">
          <Input placeholder="Título do bloco" value={row.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} />
        </div>
        <p className="md:col-span-2 text-[11px] text-muted-foreground">Os itens são carregados automaticamente do seu cardápio/catálogo publicado.</p>
      </div>
    );
  }
  if (row.kind === "reviews") {
    return (
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Quantas mostrar</Label>
          <Input type="number" min={1} max={10} value={data.limit ?? 3} onChange={(e) => setData({ limit: Math.max(1, Math.min(10, Number(e.target.value) || 3)) })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nota mínima</Label>
          <Select value={String(data.min_rating ?? 4)} onValueChange={(v) => setData({ min_rating: Number(v) })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n} estrela{n > 1 ? "s" : ""}+</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Input placeholder="Título do bloco" value={row.label} onChange={(e) => onChange({ label: e.target.value })} maxLength={80} />
        </div>
      </div>
    );
  }
  return null;
}

