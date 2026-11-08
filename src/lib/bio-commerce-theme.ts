export type BioCommercePresetId =
  | "bio-adaptive"
  | "aurora-commerce"
  | "noir-gourmet"
  | "beauty-glass"
  | "urban-fashion"
  | "fitness-pro"
  | "pet-friendly"
  | "event-pulse"
  | "clean-health"
  | "executive-pro"
  | "creator-ember"  | "v4-food-table"
  | "v4-beauty-atelier"
  | "v4-beauty-serene"
  | "v4-fashion-couture"
  | "v4-fashion-capsule"
  | "v4-fitness-arena"
  | "v4-fitness-club"
  | "v4-pet-play"
  | "v4-pet-care"
  | "v4-events-spotlight"
  | "v4-events-festival"
  | "v4-health-clinic"
  | "v4-health-serene"
  | "v4-services-ledger"
  | "v4-services-studio"
  | "v4-education-masterclass"
  | "v4-education-studio";

export type BioCommerceNicheId =
  | "food"
  | "beauty"
  | "fashion"
  | "fitness"
  | "pet"
  | "events"
  | "health"
  | "services"
  | "education";

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
  niche_id?: BioCommerceNicheId;
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
  | "niche_id"
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

export type BioCommerceNiche = {
  id: BioCommerceNicheId;
  label: string;
  description: string;
  default_preset: BioCommercePresetId;
  eyebrow: string;
  showcase_title: string;
  primary_cta: string;
  preferred_source: "menu" | "catalog";
};

export const BIO_COMMERCE_NICHES: BioCommerceNiche[] = [
  { id: "food", label: "Restaurante / Food", description: "Hamburguerias, restaurantes, cafeterias, bares e delivery.", default_preset: "aurora-commerce", eyebrow: "Sabores que conquistam", showcase_title: "Destaques do cardápio", primary_cta: "Peça agora", preferred_source: "menu" },
  { id: "beauty", label: "Beleza / Estética", description: "Salões, clínicas, estética, unhas e profissionais de beleza.", default_preset: "beauty-glass", eyebrow: "Beleza que transforma", showcase_title: "Serviços em destaque", primary_cta: "Agende agora", preferred_source: "catalog" },
  { id: "fashion", label: "Moda / Varejo", description: "Lojas, boutiques, vestuário, acessórios e varejo visual.", default_preset: "urban-fashion", eyebrow: "Estilo que acompanha você", showcase_title: "Destaques da coleção", primary_cta: "Ver coleção", preferred_source: "catalog" },
  { id: "fitness", label: "Academia / Esporte", description: "Academias, studios, personal trainers e negócios fitness.", default_preset: "fitness-pro", eyebrow: "Sua evolução começa aqui", showcase_title: "Planos e destaques", primary_cta: "Quero começar", preferred_source: "catalog" },
  { id: "pet", label: "Pet Shop / Animais", description: "Pet shops, banho e tosa, veterinárias e serviços para pets.", default_preset: "pet-friendly", eyebrow: "Cuidado para quem faz parte da família", showcase_title: "Mais procurados", primary_cta: "Ver produtos", preferred_source: "catalog" },
  { id: "events", label: "Eventos / Entretenimento", description: "Eventos, casas de show, produtores, festas e experiências.", default_preset: "event-pulse", eyebrow: "Viva a experiência", showcase_title: "Próximos destaques", primary_cta: "Garantir acesso", preferred_source: "catalog" },
  { id: "health", label: "Saúde / Bem-estar", description: "Clínicas, consultórios e profissionais de saúde e bem-estar.", default_preset: "clean-health", eyebrow: "Cuidado com confiança", showcase_title: "Serviços e cuidados", primary_cta: "Agendar atendimento", preferred_source: "catalog" },
  { id: "services", label: "Serviços / Profissionais", description: "Consultorias, escritórios e prestadores de serviço.", default_preset: "executive-pro", eyebrow: "Presença profissional, resultado real", showcase_title: "Soluções em destaque", primary_cta: "Falar agora", preferred_source: "catalog" },
  { id: "education", label: "Criadores / Cursos", description: "Especialistas, mentores, conteúdos, e-books e comunidades.", default_preset: "creator-ember", eyebrow: "Conhecimento que transforma", showcase_title: "Conteúdos em destaque", primary_cta: "Conhecer meus conteúdos", preferred_source: "catalog" },
];

export const BIO_COMMERCE_PRESETS: BioCommercePreset[] = [
  {
    preset_id: "aurora-commerce", niche_id: "food", label: "Aurora Commerce", niche: "Restaurante / Food",
    description: "Hero cinematográfico, vitrine viva e CTAs comerciais para pedidos e delivery.",
    primary: "#ff6a00", accent: "#ff3d00", background: "#0a0706", text: "#fffaf4", button_style: "solid", rounded: "xl",
    layout: "commerce", hero_style: "immersive", card_style: "glass", background_effect: "aurora", font_style: "bold",
    content_width: "comfortable", motion: "smooth", motion_intensity: "medium", product_style: "carousel", social_style: "icons",
  },
  {
    preset_id: "noir-gourmet", niche_id: "food", label: "Noir Gourmet", niche: "Restaurante premium",
    description: "Visual editorial escuro e sofisticado para gastronomia e marcas autorais.",
    primary: "#d6a85f", accent: "#f4d79c", background: "#080706", text: "#fffaf0", button_style: "outline", rounded: "lg",
    layout: "editorial", hero_style: "immersive", card_style: "elevated", background_effect: "soft-glow", font_style: "editorial",
    content_width: "comfortable", motion: "smooth", motion_intensity: "low", product_style: "editorial", social_style: "icons",
  },
  {
    preset_id: "beauty-glass", niche_id: "beauty", label: "Beauty Glass", niche: "Beleza / Estética",
    description: "Glass suave, editorial e luminoso para serviços, agenda e prova social.",
    primary: "#ef4f9a", accent: "#ff91c2", background: "#2a1720", text: "#fff9fb", button_style: "glass", rounded: "full",
    layout: "commerce", hero_style: "immersive", card_style: "glass", background_effect: "mesh", font_style: "editorial",
    content_width: "comfortable", motion: "smooth", motion_intensity: "medium", product_style: "carousel", social_style: "icons",
  },
  {
    preset_id: "urban-fashion", niche_id: "fashion", label: "Urban Fashion", niche: "Moda / Varejo",
    description: "Editorial urbano com vitrine de coleção, lançamentos e chamadas de compra.",
    primary: "#58c8ff", accent: "#7b5cff", background: "#061018", text: "#f6fbff", button_style: "outline", rounded: "lg",
    layout: "editorial", hero_style: "immersive", card_style: "glass", background_effect: "ambient", font_style: "modern",
    content_width: "wide", motion: "smooth", motion_intensity: "medium", product_style: "carousel", social_style: "icons",
  },
  {
    preset_id: "fitness-pro", niche_id: "fitness", label: "Fitness Pro", niche: "Academia / Esporte",
    description: "Contraste forte, energia e CTAs de conversão para planos e matrículas.",
    primary: "#b9ff18", accent: "#55e900", background: "#050807", text: "#f7fff1", button_style: "solid", rounded: "lg",
    layout: "bento", hero_style: "immersive", card_style: "outline", background_effect: "ambient", font_style: "bold",
    content_width: "wide", motion: "smooth", motion_intensity: "medium", product_style: "grid", social_style: "icons",
  },
  {
    preset_id: "pet-friendly", niche_id: "pet", label: "Pet Friendly", niche: "Pet Shop / Animais",
    description: "Experiência calorosa com produtos, serviços, agenda e fidelidade em destaque.",
    primary: "#ff8a22", accent: "#ffd166", background: "#2b170d", text: "#fffaf2", button_style: "solid", rounded: "full",
    layout: "commerce", hero_style: "immersive", card_style: "soft", background_effect: "mesh", font_style: "modern",
    content_width: "comfortable", motion: "smooth", motion_intensity: "medium", product_style: "carousel", social_style: "icons",
  },
  {
    preset_id: "event-pulse", niche_id: "events", label: "Event Pulse", niche: "Eventos / Entretenimento",
    description: "Neon elegante, agenda de atrações e chamadas fortes para ingressos e presença.",
    primary: "#ff00c8", accent: "#8b5cff", background: "#10051a", text: "#fff8ff", button_style: "solid", rounded: "xl",
    layout: "bento", hero_style: "immersive", card_style: "glass", background_effect: "aurora", font_style: "bold",
    content_width: "wide", motion: "smooth", motion_intensity: "high", product_style: "carousel", social_style: "icons",
  },
  {
    preset_id: "clean-health", niche_id: "health", label: "Clean Health", niche: "Saúde / Bem-estar",
    description: "Interface clara, confiável e calma para clínicas e profissionais de saúde.",
    primary: "#0d9ea5", accent: "#6fd7d4", background: "#effafa", text: "#123338", button_style: "solid", rounded: "xl",
    layout: "commerce", hero_style: "brand", card_style: "soft", background_effect: "soft-glow", font_style: "clean",
    content_width: "comfortable", motion: "smooth", motion_intensity: "low", product_style: "grid", social_style: "icons",
  },
  {
    preset_id: "executive-pro", niche_id: "services", label: "Executive Pro", niche: "Serviços / Profissionais",
    description: "Presença sóbria e premium para consultorias, escritórios e prestadores de serviço.",
    primary: "#79bcd7", accent: "#d2b56f", background: "#07131a", text: "#f5fbff", button_style: "outline", rounded: "lg",
    layout: "editorial", hero_style: "split", card_style: "glass", background_effect: "ambient", font_style: "modern",
    content_width: "wide", motion: "smooth", motion_intensity: "low", product_style: "editorial", social_style: "compact",
  },
  {
    preset_id: "creator-ember", niche_id: "education", label: "Creator Ember", niche: "Criadores / Cursos",
    description: "Editorial preto e laranja para especialistas, conteúdos, materiais, vídeos e mentorias.",
    primary: "#ff6500", accent: "#f04424", background: "#100a08", text: "#fff8f3", button_style: "solid", rounded: "lg",
    layout: "editorial", hero_style: "immersive", card_style: "elevated", background_effect: "ambient", font_style: "bold",
    content_width: "comfortable", motion: "smooth", motion_intensity: "low", product_style: "editorial", social_style: "icons",
  },,
  // V4: opt-in. Presets antigos e paginas exclusivas nao sofrem migracao automatica.
  {
    preset_id: "v4-food-table", niche_id: "food", label: "Mesa de Autor", niche: "food",
    description: "Gastronomia editorial com hero lateral e vitrine de pratos em composição assimétrica.",
    primary: "#d7ad72", accent: "#86523d", background: "#17110f", text: "#faf3e8", button_style: "outline", rounded: "md",
    layout: "editorial", hero_style: "split", card_style: "elevated", background_effect: "ambient", font_style: "editorial",
    content_width: "wide", motion: "smooth", motion_intensity: "low", product_style: "editorial", social_style: "compact",
  },
  {
    preset_id: "v4-beauty-atelier", niche_id: "beauty", label: "Atelier Vinho", niche: "beauty",
    description: "Direção editorial de beleza: serviços em destaque, portfólio visual e agendamento.",
    primary: "#e1a8ad", accent: "#a66586", background: "#22121d", text: "#fff3f4", button_style: "outline", rounded: "lg",
    layout: "editorial", hero_style: "split", card_style: "elevated", background_effect: "soft-glow", font_style: "editorial",
    content_width: "wide", motion: "smooth", motion_intensity: "low", product_style: "editorial", social_style: "icons",
  },
  {
    preset_id: "v4-beauty-serene", niche_id: "beauty", label: "Serene Studio", niche: "beauty",
    description: "Minimalismo claro de spa e bem-estar com hierarquia limpa, espaços generosos e agendamento.",
    primary: "#7e8a6e", accent: "#d8bcac", background: "#f5f0ea", text: "#282e29", button_style: "solid", rounded: "xl",
    layout: "classic", hero_style: "minimal", card_style: "soft", background_effect: "solid", font_style: "clean",
    content_width: "comfortable", motion: "smooth", motion_intensity: "low", product_style: "grid", social_style: "compact",
  },
  {
    preset_id: "v4-fashion-couture", niche_id: "fashion", label: "Couture Editorial", niche: "fashion",
    description: "Lookbook sofisticado com hero lateral, tipografia editorial e vitrines de coleção.",
    primary: "#dcccb3", accent: "#9c7057", background: "#191919", text: "#fcf8f1", button_style: "outline", rounded: "sm",
    layout: "editorial", hero_style: "split", card_style: "elevated", background_effect: "solid", font_style: "editorial",
    content_width: "wide", motion: "smooth", motion_intensity: "low", product_style: "editorial", social_style: "compact",
  },
  {
    preset_id: "v4-fashion-capsule", niche_id: "fashion", label: "Capsule Gallery", niche: "fashion",
    description: "Varejo minimalista e catálogo em grade, com foco nas fotografias de produto.",
    primary: "#1f1f1f", accent: "#92775f", background: "#f4f2ed", text: "#212121", button_style: "solid", rounded: "sm",
    layout: "commerce", hero_style: "minimal", card_style: "outline", background_effect: "solid", font_style: "clean",
    content_width: "wide", motion: "smooth", motion_intensity: "low", product_style: "grid", social_style: "icons",
  },
  {
    preset_id: "v4-fitness-arena", niche_id: "fitness", label: "Arena Performance", niche: "fitness",
    description: "Identidade atlética com hero lateral e grade de planos de treino.",
    primary: "#ff672e", accent: "#f4d164", background: "#100c0d", text: "#fff8f3", button_style: "solid", rounded: "sm",
    layout: "bento", hero_style: "split", card_style: "outline", background_effect: "ambient", font_style: "bold",
    content_width: "wide", motion: "smooth", motion_intensity: "high", product_style: "grid", social_style: "buttons",
  },
  {
    preset_id: "v4-fitness-club", niche_id: "fitness", label: "Motion Club", niche: "fitness",
    description: "Esporte premium em preto e prata, foco em programas e apresentação editorial.",
    primary: "#e6efec", accent: "#51c1b5", background: "#101516", text: "#f7faf8", button_style: "outline", rounded: "md",
    layout: "editorial", hero_style: "minimal", card_style: "elevated", background_effect: "ambient", font_style: "bold",
    content_width: "wide", motion: "smooth", motion_intensity: "medium", product_style: "editorial", social_style: "compact",
  },
  {
    preset_id: "v4-pet-play", niche_id: "pet", label: "Pet Play", niche: "pet",
    description: "Comunicação alegre, serviços em grade e navegação de fácil leitura.",
    primary: "#f2a442", accent: "#74b7aa", background: "#fff8ec", text: "#332b24", button_style: "solid", rounded: "full",
    layout: "bento", hero_style: "brand", card_style: "soft", background_effect: "mesh", font_style: "modern",
    content_width: "comfortable", motion: "smooth", motion_intensity: "medium", product_style: "grid", social_style: "buttons",
  },
  {
    preset_id: "v4-pet-care", niche_id: "pet", label: "Pet Care Studio", niche: "pet",
    description: "Veterinária e cuidados premium com apresentação lateral e serviços editoriais.",
    primary: "#a2c2b9", accent: "#d4bea2", background: "#172522", text: "#f1f8f5", button_style: "outline", rounded: "lg",
    layout: "editorial", hero_style: "split", card_style: "elevated", background_effect: "soft-glow", font_style: "clean",
    content_width: "wide", motion: "smooth", motion_intensity: "low", product_style: "editorial", social_style: "icons",
  },
  {
    preset_id: "v4-events-spotlight", niche_id: "events", label: "Spotlight Night", niche: "events",
    description: "Eventos noturnos com composição lateral, atrações e cartões editoriais.",
    primary: "#f0b45a", accent: "#ce518a", background: "#110d1a", text: "#fff7ee", button_style: "solid", rounded: "md",
    layout: "editorial", hero_style: "split", card_style: "elevated", background_effect: "aurora", font_style: "bold",
    content_width: "wide", motion: "smooth", motion_intensity: "high", product_style: "editorial", social_style: "buttons",
  },
  {
    preset_id: "v4-events-festival", niche_id: "events", label: "Festival Grid", niche: "events",
    description: "Agenda em destaque, quadros organizados e identidade digital de alto contraste.",
    primary: "#a8fc61", accent: "#8e74f8", background: "#0f1117", text: "#f7fff1", button_style: "solid", rounded: "lg",
    layout: "bento", hero_style: "minimal", card_style: "outline", background_effect: "ambient", font_style: "modern",
    content_width: "wide", motion: "smooth", motion_intensity: "medium", product_style: "grid", social_style: "icons",
  },
  {
    preset_id: "v4-health-clinic", niche_id: "health", label: "Clínica Editorial", niche: "health",
    description: "Clínicas com tipografia séria, hero dividido e apresentação clara dos serviços.",
    primary: "#347e7a", accent: "#b0c8bb", background: "#f5faf7", text: "#193732", button_style: "solid", rounded: "md",
    layout: "editorial", hero_style: "split", card_style: "soft", background_effect: "solid", font_style: "editorial",
    content_width: "wide", motion: "smooth", motion_intensity: "low", product_style: "editorial", social_style: "compact",
  },
  {
    preset_id: "v4-health-serene", niche_id: "health", label: "Serene Care", niche: "health",
    description: "Bem-estar com hero minimalista e serviços facilmente acessíveis em grade.",
    primary: "#5d9e9f", accent: "#9fbfae", background: "#ecf5f3", text: "#253e42", button_style: "outline", rounded: "xl",
    layout: "classic", hero_style: "minimal", card_style: "soft", background_effect: "soft-glow", font_style: "clean",
    content_width: "comfortable", motion: "smooth", motion_intensity: "low", product_style: "grid", social_style: "icons",
  },
  {
    preset_id: "v4-services-ledger", niche_id: "services", label: "Ledger & Partners", niche: "services",
    description: "Consultoria com página institucional minimalista e serviços editoriais.",
    primary: "#d2bd93", accent: "#9caabc", background: "#111720", text: "#f5f4f1", button_style: "outline", rounded: "sm",
    layout: "editorial", hero_style: "minimal", card_style: "elevated", background_effect: "solid", font_style: "editorial",
    content_width: "wide", motion: "smooth", motion_intensity: "low", product_style: "editorial", social_style: "compact",
  },
  {
    preset_id: "v4-services-studio", niche_id: "services", label: "Studio Profissional", niche: "services",
    description: "Prestação de serviços com marca protagonista, portfólio e módulos em grade.",
    primary: "#5f93e9", accent: "#8abfb8", background: "#111825", text: "#f6faff", button_style: "solid", rounded: "lg",
    layout: "bento", hero_style: "brand", card_style: "glass", background_effect: "ambient", font_style: "modern",
    content_width: "wide", motion: "smooth", motion_intensity: "medium", product_style: "grid", social_style: "buttons",
  },
  {
    preset_id: "v4-education-masterclass", niche_id: "education", label: "Masterclass Edition", niche: "education",
    description: "Mentorias e cursos com apresentação lateral, módulos editoriais e CTA de inscrição.",
    primary: "#edb36a", accent: "#d18175", background: "#211815", text: "#fff5ed", button_style: "solid", rounded: "sm",
    layout: "editorial", hero_style: "split", card_style: "elevated", background_effect: "ambient", font_style: "editorial",
    content_width: "wide", motion: "smooth", motion_intensity: "low", product_style: "editorial", social_style: "compact",
  },
  {
    preset_id: "v4-education-studio", niche_id: "education", label: "Creator Studio", niche: "education",
    description: "Produtos digitais e materiais de criadores em grade, com marca em primeiro plano.",
    primary: "#c6ee8c", accent: "#86bee3", background: "#111719", text: "#f4fbf1", button_style: "solid", rounded: "lg",
    layout: "bento", hero_style: "brand", card_style: "outline", background_effect: "mesh", font_style: "modern",
    content_width: "wide", motion: "smooth", motion_intensity: "medium", product_style: "grid", social_style: "buttons",
  }
];

const ADAPTIVE_DEFAULTS: Required<Pick<
  BioCommerceTheme,
  | "preset_id" | "niche_id" | "button_style" | "rounded" | "layout" | "hero_style" | "card_style"
  | "background_effect" | "font_style" | "content_width" | "motion" | "motion_intensity" | "product_style" | "social_style"
>> = {
  preset_id: "bio-adaptive", niche_id: "services", button_style: "glass", rounded: "xl", layout: "commerce", hero_style: "brand",
  card_style: "glass", background_effect: "ambient", font_style: "modern", content_width: "comfortable", motion: "smooth",
  motion_intensity: "medium", product_style: "carousel", social_style: "icons",
};

export function getBioCommercePreset(id?: string | null) {
  if (!id) return null;
  return BIO_COMMERCE_PRESETS.find((preset) => preset.preset_id === id) ?? null;
}

export function getBioCommerceNiche(id?: string | null) {
  if (!id) return BIO_COMMERCE_NICHES.find((item) => item.id === "services")!;
  return BIO_COMMERCE_NICHES.find((item) => item.id === id) ?? BIO_COMMERCE_NICHES.find((item) => item.id === "services")!;
}

export function inferBioCommerceNiche(input: { theme?: BioCommerceTheme | null; links?: Array<{ kind?: string; data?: Record<string, any> | null }>; establishment?: Record<string, any> | null }): BioCommerceNicheId {
  const explicit = input.theme?.niche_id;
  if (explicit && BIO_COMMERCE_NICHES.some((item) => item.id === explicit)) return explicit;
  const preset = getBioCommercePreset(input.theme?.preset_id);
  if (preset?.niche_id) return preset.niche_id;
  const kinds = new Set((input.links ?? []).map((link) => link.kind));
  if (kinds.has("cardapio") || (input.links ?? []).some((link) => link.kind === "menu_carousel" && (link.data as any)?.source !== "catalog")) return "food";
  const haystack = [input.establishment?.name, input.establishment?.description, input.establishment?.category, input.establishment?.segment, input.establishment?.business_type].filter(Boolean).join(" ").toLowerCase();
  if (/beleza|est[eé]tica|sal[aã]o|barbear|unha|spa/.test(haystack)) return "beauty";
  if (/academia|fitness|cross|pilates|personal|esporte/.test(haystack)) return "fitness";
  if (/pet|veterin|banho|tosa/.test(haystack)) return "pet";
  if (/evento|show|festa|ingresso|entretenimento/.test(haystack)) return "events";
  if (/sa[uú]de|cl[ií]nica|m[eé]dic|odonto|fisi|terapia|nutri/.test(haystack)) return "health";
  if (/moda|roupa|boutique|vestu[aá]rio|cal[cç]ado|acess[oó]rio/.test(haystack)) return "fashion";
  if (/curso|mentoria|consultoria|e.book|conte[uú]do|educa[çc]|treinamento|aprend/.test(haystack)) return "education";
  return "services";
}

export function defaultPresetForNiche(nicheId: BioCommerceNicheId) {
  return getBioCommerceNiche(nicheId).default_preset;
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
    card_style: current.card_style || preset?.card_style || (buttonStyle === "glass" ? "glass" : buttonStyle === "outline" ? "outline" : "elevated"),
  };
}

export function resolveBioCommerceLandingTheme(
  theme: BioCommerceTheme | null | undefined,
  input: { links?: Array<{ kind?: string; data?: Record<string, any> | null }>; establishment?: Record<string, any> | null; cover?: string | null } = {},
): ReturnType<typeof resolveBioCommerceTheme> & { niche_id: BioCommerceNicheId } {
  const current = theme ?? {};
  const nicheId = inferBioCommerceNiche({ theme: current, links: input.links, establishment: input.establishment });
  const explicitPreset = getBioCommercePreset(current.preset_id);
  const isClassic = String(current.preset_id ?? "").startsWith("classic-");
  if (explicitPreset || isClassic) {
    const resolved = resolveBioCommerceTheme({ ...current, niche_id: nicheId }, { primary: input.establishment?.primary_color, accent: input.establishment?.accent_color, cover: input.cover });
    return { ...resolved, niche_id: nicheId };
  }
  const automaticPreset = getBioCommercePreset(defaultPresetForNiche(nicheId))!;
  const resolved = resolveBioCommerceTheme({
    ...automaticPreset,
    niche_id: nicheId,
    primary: current.primary || input.establishment?.primary_color || automaticPreset.primary,
    accent: current.accent || input.establishment?.accent_color || automaticPreset.accent,
  }, { cover: input.cover });
  return { ...resolved, niche_id: nicheId };
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
