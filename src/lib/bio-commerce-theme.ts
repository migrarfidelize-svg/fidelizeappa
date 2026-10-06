export type BioCommercePresetId =
  | "bio-adaptive"
  | "aurora-commerce"
  | "noir-gourmet"
  | "beauty-glass"
  | "fitness-pro"
  | "clean-health"
  | "executive-pro";

export type BioCommerceLayout = "classic" | "commerce" | "editorial" | "bento";
export type BioCommerceHeroStyle = "brand" | "immersive" | "minimal" | "split";
export type BioCommerceCardStyle = "elevated" | "glass" | "outline" | "soft";
export type BioCommerceBackgroundEffect = "solid" | "ambient" | "aurora" | "mesh" | "soft-glow";
export type BioCommerceFontStyle = "modern" | "editorial" | "bold" | "clean";
export type BioCommerceContentWidth = "compact" | "comfortable" | "wide";
export type BioCommerceMotion = "none" | "smooth";
export type BioCommerceMotionIntensity = "low" | "medium" | "high";
export type BioCommerceProductStyle = "carousel" | "grid" | "editorial";
export type BioCommerceSocialStyle = "icons" | "buttons" | "compact";
export type BioCommercePresentation = "destaque" | "botao" | "atalho" | "card" | "bloco";

export type BioCommerceTheme = {
  preset_id?: string;
  primary?: string;
  accent?: string;
  background?: string;
  text?: string;
  button_style?: "solid" | "outline" | "glass";
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
  layout?: BioCommerceLayout;
  hero_style?: BioCommerceHeroStyle;
  card_style?: BioCommerceCardStyle;
  background_effect?: BioCommerceBackgroundEffect;
  font_style?: BioCommerceFontStyle;
  content_width?: BioCommerceContentWidth;
  motion?: BioCommerceMotion;
  motion_intensity?: BioCommerceMotionIntensity;
  product_style?: BioCommerceProductStyle;
  social_style?: BioCommerceSocialStyle;
};

export type BioCommercePreset = Required<Pick<
  BioCommerceTheme,
  | "preset_id"
  | "primary"
  | "accent"
  | "background"
  | "text"
  | "button_style"
  | "rounded"
  | "layout"
  | "hero_style"
  | "card_style"
  | "background_effect"
  | "font_style"
  | "content_width"
  | "motion"
  | "motion_intensity"
  | "product_style"
  | "social_style"
>> & {
  label: string;
  niche: string;
  description: string;
  legacy?: boolean;
};

export const BIO_COMMERCE_PRESETS: BioCommercePreset[] = [
  {
    preset_id: "aurora-commerce",
    label: "Aurora Commerce",
    niche: "Gastronomia & Varejo",
    description: "Vitrine de alto impacto com luz ambiente, ofertas e CTAs comerciais.",
    primary: "#ff7a00",
    accent: "#ffb000",
    background: "#090705",
    text: "#fffaf4",
    button_style: "solid",
    rounded: "xl",
    layout: "commerce",
    hero_style: "immersive",
    card_style: "glass",
    background_effect: "aurora",
    font_style: "bold",
    content_width: "comfortable",
    motion: "smooth",
    motion_intensity: "medium",
    product_style: "carousel",
    social_style: "icons",
  },
  {
    preset_id: "noir-gourmet",
    label: "Noir Gourmet",
    niche: "Premium & Gastronomia",
    description: "Visual editorial escuro, sofisticado e elegante para marcas premium.",
    primary: "#d6a85f",
    accent: "#f4d79c",
    background: "#080706",
    text: "#fffaf0",
    button_style: "outline",
    rounded: "lg",
    layout: "editorial",
    hero_style: "immersive",
    card_style: "elevated",
    background_effect: "soft-glow",
    font_style: "editorial",
    content_width: "comfortable",
    motion: "smooth",
    motion_intensity: "low",
    product_style: "editorial",
    social_style: "icons",
  },
  {
    preset_id: "beauty-glass",
    label: "Beauty Glass",
    niche: "Beleza & Estética",
    description: "Vidro suave, tons luminosos e experiência delicada para serviços e agendamentos.",
    primary: "#d86b86",
    accent: "#f2a9b9",
    background: "#261719",
    text: "#fff9fa",
    button_style: "glass",
    rounded: "full",
    layout: "commerce",
    hero_style: "immersive",
    card_style: "glass",
    background_effect: "mesh",
    font_style: "editorial",
    content_width: "comfortable",
    motion: "smooth",
    motion_intensity: "medium",
    product_style: "carousel",
    social_style: "icons",
  },
  {
    preset_id: "fitness-pro",
    label: "Fitness Pro",
    niche: "Academia & Esporte",
    description: "Contraste forte, energia e CTAs de conversão para planos e matrículas.",
    primary: "#b9ff18",
    accent: "#55e900",
    background: "#050807",
    text: "#f7fff1",
    button_style: "solid",
    rounded: "lg",
    layout: "bento",
    hero_style: "immersive",
    card_style: "outline",
    background_effect: "ambient",
    font_style: "bold",
    content_width: "wide",
    motion: "smooth",
    motion_intensity: "medium",
    product_style: "grid",
    social_style: "icons",
  },
  {
    preset_id: "clean-health",
    label: "Clean Health",
    niche: "Saúde & Bem-estar",
    description: "Interface clara, confiável e calma para clínicas e profissionais de saúde.",
    primary: "#0d9ea5",
    accent: "#6fd7d4",
    background: "#effafa",
    text: "#123338",
    button_style: "solid",
    rounded: "xl",
    layout: "commerce",
    hero_style: "brand",
    card_style: "soft",
    background_effect: "soft-glow",
    font_style: "clean",
    content_width: "comfortable",
    motion: "smooth",
    motion_intensity: "low",
    product_style: "grid",
    social_style: "icons",
  },
  {
    preset_id: "executive-pro",
    label: "Executive Pro",
    niche: "Serviços & Profissionais",
    description: "Presença sóbria e premium para consultorias, escritórios e prestadores de serviço.",
    primary: "#79bcd7",
    accent: "#b6ddea",
    background: "#07131a",
    text: "#f5fbff",
    button_style: "outline",
    rounded: "lg",
    layout: "editorial",
    hero_style: "split",
    card_style: "glass",
    background_effect: "ambient",
    font_style: "modern",
    content_width: "wide",
    motion: "smooth",
    motion_intensity: "low",
    product_style: "editorial",
    social_style: "compact",
  },
];

const ADAPTIVE_DEFAULTS: Required<Pick<
  BioCommerceTheme,
  | "preset_id"
  | "button_style"
  | "rounded"
  | "layout"
  | "hero_style"
  | "card_style"
  | "background_effect"
  | "font_style"
  | "content_width"
  | "motion"
  | "motion_intensity"
  | "product_style"
  | "social_style"
>> = {
  preset_id: "bio-adaptive",
  button_style: "glass",
  rounded: "xl",
  layout: "commerce",
  hero_style: "brand",
  card_style: "glass",
  background_effect: "ambient",
  font_style: "modern",
  content_width: "comfortable",
  motion: "smooth",
  motion_intensity: "medium",
  product_style: "carousel",
  social_style: "icons",
};

export function getBioCommercePreset(id?: string | null) {
  if (!id) return null;
  return BIO_COMMERCE_PRESETS.find((preset) => preset.preset_id === id) ?? null;
}

export function resolveBioCommerceTheme(
  theme: BioCommerceTheme | null | undefined,
  fallback: { primary?: string | null; accent?: string | null; cover?: string | null } = {},
): BioCommerceTheme & { primary: string; accent: string; background: string; text: string } {
  const current = theme ?? {};
  const preset = getBioCommercePreset(current.preset_id);

  const primary = current.primary || preset?.primary || fallback.primary || "#7c3aed";
  const accent = current.accent || preset?.accent || fallback.accent || "#ec4899";
  const background = current.background || preset?.background || "#080b12";
  const text = current.text || preset?.text || "#ffffff";
  const buttonStyle = current.button_style || preset?.button_style || ADAPTIVE_DEFAULTS.button_style;

  return {
    ...ADAPTIVE_DEFAULTS,
    ...(preset ?? {}),
    ...current,
    primary,
    accent,
    background,
    text,
    button_style: buttonStyle,
    hero_style: current.hero_style || preset?.hero_style || (fallback.cover ? "immersive" : "brand"),
    card_style:
      current.card_style ||
      preset?.card_style ||
      (buttonStyle === "glass" ? "glass" : buttonStyle === "outline" ? "outline" : "elevated"),
  };
}

export function defaultPresentationForKind(kind: string, index: number): BioCommercePresentation {
  if (["video", "spotify", "gallery", "menu_carousel", "reviews", "header_image"].includes(kind)) return "bloco";
  if (["instagram", "facebook", "tiktok", "youtube", "google", "maps", "email", "phone"].includes(kind)) return "atalho";
  if (["whatsapp", "cardapio", "cartao"].includes(kind) && index < 4) return "destaque";
  return "botao";
}

export function isLightHex(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return false;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}
