import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Coffee,
  Dumbbell,
  ExternalLink,
  HeartHandshake,
  MapPin,
  MessageCircle,
  PawPrint,
  Plus,
  Scissors,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";
import {
  BioCommerceLanding as BioCommerceLandingV8,
  type BioCommerceBlockData,
  type BioCommerceLandingData,
  type BioCommerceProduct,
  type BioCommerceReview,
} from "./BioCommerceLandingV8";
import {
  getBioCommerceNiche,
  resolveBioCommerceLandingTheme,
  type BioCommerceTheme,
} from "@/lib/bio-commerce-theme";
import { useCart } from "@/lib/cart";
import { trackChannelEvent } from "@/lib/tracking";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

type ChannelKind = "menu" | "catalog";
type ChannelState = { kind: ChannelKind; categoryId?: string | null } | null;
type RuntimeCategory = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  position?: number | null;
};
type ExtendedBlockData = BioCommerceBlockData & {
  menu_categories?: RuntimeCategory[];
  catalog_categories?: RuntimeCategory[];
};

type ExperienceMode = "commerce" | "booking" | "links";

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

function normalizeUrl(kind: string, value: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "#";
  if (raw.startsWith("/")) return raw;
  if (kind === "whatsapp") {
    const digits = raw.replace(/\D/g, "");
    if (digits && !/^https?:/i.test(raw)) return `https://wa.me/${digits}`;
  }
  if (kind === "instagram" && !/^https?:/i.test(raw)) return `https://instagram.com/${raw.replace(/^@/, "")}`;
  if (kind === "facebook" && !/^https?:/i.test(raw)) return `https://facebook.com/${raw.replace(/^@/, "")}`;
  if (kind === "tiktok" && !/^https?:/i.test(raw)) return `https://tiktok.com/@${raw.replace(/^@/, "")}`;
  if (kind === "email" && !raw.startsWith("mailto:") && raw.includes("@")) return `mailto:${raw}`;
  if (kind === "phone" && !raw.startsWith("tel:")) return `tel:${raw.replace(/\s/g, "")}`;
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith("mailto:") && !raw.startsWith("tel:")) return `https://${raw}`;
  return raw;
}

function inferExperienceMode(nicheId: string, links: any[], blockData: ExtendedBlockData): ExperienceMode {
  const explicit = String((links as any)?.page?.theme?.experience_mode ?? "");
  if (explicit === "commerce" || explicit === "booking" || explicit === "links") return explicit;
  const hasShowcase = links.some((link: any) => link.kind === "menu_carousel" || link.kind === "cardapio");
  const hasProducts = (blockData.menu?.length ?? 0) + (blockData.catalog?.length ?? 0) > 0;
  if (["beauty", "health", "fitness"].includes(nicheId) && hasProducts && hasShowcase) return "booking";
  if (hasProducts && hasShowcase) return "commerce";
  return "links";
}

export function BioCommerceLanding(props: {
  data: BioCommerceLandingData;
  slug: string;
  blockData?: BioCommerceBlockData;
  embedded?: boolean;
  interactive?: boolean;
}) {
  const blockData = (props.blockData ?? { menu: [], catalog: [], reviews: [], stats: null }) as ExtendedBlockData;
  const establishment = props.data.establishment ?? {};
  const page = props.data.page ?? {};
  const links = (props.data.links ?? []).filter((link: any) => link?.enabled !== false);
  const cover = page.cover_url ?? establishment.cover_url ?? null;

  const theme = resolveBioCommerceLandingTheme((page.theme ?? {}) as BioCommerceTheme, {
    links,
    establishment,
    cover,
  }) as any;
  const niche = getBioCommerceNiche(theme.niche_id);
  const mode = inferExperienceMode(niche.id, links, blockData);
  const [channel, setChannel] = useState<ChannelState>(null);

  // O movimento dos destaques passa a ser uma característica estrutural da landing.
  // O V8 continua respeitando prefers-reduced-motion do sistema operacional.
  const animatedData = useMemo(() => ({
    ...props.data,
    page: {
      ...props.data.page,
      theme: {
        ...((props.data.page?.theme ?? {}) as any),
        motion: "smooth",
        motion_intensity: ((props.data.page?.theme as any)?.motion_intensity ?? "medium"),
      },
    },
  }), [props.data]);

  const menuLabels = links.filter((link: any) => link.kind === "cardapio").map((link: any) => String(link.label ?? "").toLowerCase()).filter(Boolean);

  function interceptChannelNavigation(event: ReactMouseEvent<HTMLDivElement>) {
    if (props.embedded || props.interactive === false) return;
    const target = event.target as HTMLElement | null;
    const button = target?.closest("button");
    if (!button) return;
    const text = String(button.textContent ?? "").trim().toLowerCase();

    const asksMenu = text.includes("cardápio") || menuLabels.some((label) => label && text.includes(label));
    const asksCatalog = text.includes("catálogo");
    if (!asksMenu && !asksCatalog) return;

    event.preventDefault();
    event.stopPropagation();
    setChannel({ kind: asksCatalog ? "catalog" : "menu" });
    trackChannelEvent({
      slug: props.slug,
      channel: "linktree",
      event_type: "link_click",
      ref_label: asksCatalog ? "v9:catalog" : "v9:menu",
    });
  }

  const wrapperStyle = { background: theme.background, color: theme.text };

  return (
    <div
      className={`bc-v9-shell ${props.embedded ? "bc-v9-embedded" : "bc-v9-public"} min-h-dvh overflow-x-hidden`}
      style={wrapperStyle}
      onClickCapture={interceptChannelNavigation}
    >
      <style>{`
        .bc-v9-public > div > .relative.z-10 {
          max-width: none !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 2rem !important;
        }
        .bc-v9-public > div > .relative.z-10 > section:first-of-type > div {
          border-radius: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          border-top: 0 !important;
          box-shadow: none !important;
          min-height: clamp(590px, 82dvh, 880px) !important;
        }
        .bc-v9-public > div > .relative.z-10 > section:first-of-type > div > div.relative.z-10 {
          min-height: clamp(590px, 82dvh, 880px) !important;
          padding-left: max(1.25rem, calc((100vw - 1080px) / 2)) !important;
          padding-right: max(1.25rem, calc((100vw - 1080px) / 2)) !important;
        }
        .bc-v9-public > div > .relative.z-10 > section:not(:first-of-type) {
          width: min(calc(100% - 24px), 1080px) !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .bc-v9-public > div > .relative.z-10 > footer {
          display: none !important;
        }
        .bc-v9-public > div > .relative.z-10 > section:first-of-type + section {
          margin-top: 1rem !important;
        }
        @media (max-width: 640px) {
          .bc-v9-public > div > .relative.z-10 > section:first-of-type > div,
          .bc-v9-public > div > .relative.z-10 > section:first-of-type > div > div.relative.z-10 {
            min-height: 72dvh !important;
          }
        }
      `}</style>

      <BioCommerceLandingV8 {...props} data={animatedData as BioCommerceLandingData} blockData={blockData} />

      <LandingTail
        blockData={blockData}
        links={links}
        nicheId={niche.id}
        mode={mode}
        theme={theme}
        stats={blockData.stats}
        embedded={!!props.embedded}
        onOpenChannel={(kind, categoryId) => setChannel({ kind, categoryId })}
      />

      <footer className="mx-auto flex w-full max-w-5xl items-center justify-center gap-2 px-4 pb-10 pt-10 text-[9px] font-black uppercase tracking-[0.26em] opacity-45">
        <Sparkles className="h-3 w-3" /> Bio Commerce by Fidelize
      </footer>

      <AnimatePresence>
        {channel && !props.embedded && (
          <ChannelNavigator
            key={`${channel.kind}-${channel.categoryId ?? "all"}`}
            kind={channel.kind}
            initialCategoryId={channel.categoryId ?? null}
            products={(channel.kind === "menu" ? blockData.menu : blockData.catalog) ?? []}
            categories={(channel.kind === "menu" ? blockData.menu_categories : blockData.catalog_categories) ?? []}
            theme={theme}
            slug={String(establishment.slug || props.slug)}
            onClose={() => setChannel(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LandingTail({ blockData, links, nicheId, mode, theme, stats, embedded, onOpenChannel }: {
  blockData: ExtendedBlockData;
  links: any[];
  nicheId: string;
  mode: ExperienceMode;
  theme: any;
  stats: any;
  embedded: boolean;
  onOpenChannel: (kind: ChannelKind, categoryId?: string | null) => void;
}) {
  const menuCategories = blockData.menu_categories ?? [];
  const catalogCategories = blockData.catalog_categories ?? [];
  const contactLinks = links.filter((link: any) => ["whatsapp", "maps", "site", "phone"].includes(link.kind)).slice(0, 2);
  const config = nicheTailConfig(nicheId, mode);

  return (
    <div className={`relative z-10 mx-auto w-full max-w-5xl ${embedded ? "px-3" : "px-3 sm:px-6 lg:px-8"}`}>
      {menuCategories.length > 0 && (
        <CategoryRail
          title="Explore o cardápio"
          subtitle="Escolha uma categoria e vá direto ao que procura."
          categories={menuCategories}
          theme={theme}
          onSelect={(categoryId) => onOpenChannel("menu", categoryId)}
        />
      )}

      {catalogCategories.length > 0 && (
        <CategoryRail
          title="Explore a loja"
          subtitle="Produtos e coleções publicados pelo estabelecimento."
          categories={catalogCategories}
          theme={theme}
          onSelect={(categoryId) => onOpenChannel("catalog", categoryId)}
        />
      )}

      <section className="mt-10 overflow-hidden rounded-[2.2rem] border p-5 sm:p-8" style={{ borderColor: rgba(theme.text, .11), background: `linear-gradient(145deg,${rgba(theme.primary,.16)},${rgba(theme.text,.045)} 45%,${rgba(theme.accent,.09)})` }}>
        <div className="grid gap-7 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em]" style={{ color: theme.primary }}>{config.eyebrow}</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-[-.04em] sm:text-4xl">{config.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-68">{config.description}</p>
          </div>
          {stats?.count > 0 && (
            <div className="justify-self-start rounded-3xl border px-5 py-4 lg:justify-self-end" style={{ borderColor: rgba(theme.text,.12), background: rgba(theme.background,.42) }}>
              <div className="flex items-center gap-2"><Star className="h-4 w-4" style={{ color: theme.primary, fill: theme.primary }} /><strong className="text-2xl">{Number(stats.avg).toFixed(1)}</strong></div>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[.15em] opacity-48">{stats.count} avaliações</p>
            </div>
          )}
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {config.features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-[1.7rem] border p-4 sm:p-5" style={{ borderColor: rgba(theme.text,.1), background: rgba(theme.background,.42) }}>
                <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ color: theme.primary, background: rgba(theme.primary,.14) }}><Icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-sm font-black">{feature.title}</h3>
                <p className="mt-2 text-xs leading-relaxed opacity-58">{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {contactLinks.length > 0 && (
        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          {contactLinks.map((link: any) => (
            <a
              key={link.id ?? `${link.kind}-${link.label}`}
              href={normalizeUrl(link.kind, link.url)}
              target={normalizeUrl(link.kind, link.url).startsWith("/") ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-[1.7rem] border p-4 transition hover:-translate-y-.5"
              style={{ borderColor: rgba(theme.text,.11), background: rgba(theme.text,.055) }}
            >
              <span>
                <span className="block text-[9px] font-black uppercase tracking-[.2em] opacity-42">Contato rápido</span>
                <strong className="mt-1 block text-sm">{link.label || (link.kind === "whatsapp" ? "Falar no WhatsApp" : "Acessar")}</strong>
              </span>
              <ArrowRight className="h-4 w-4 opacity-45 transition group-hover:translate-x-1" />
            </a>
          ))}
        </section>
      )}
    </div>
  );
}

function CategoryRail({ title, subtitle, categories, theme, onSelect }: {
  title: string;
  subtitle: string;
  categories: RuntimeCategory[];
  theme: any;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.22em]" style={{ color: theme.primary }}>Categorias</p><h2 className="mt-1 text-2xl font-black tracking-[-.03em]">{title}</h2><p className="mt-1 text-xs opacity-55">{subtitle}</p></div>
      </div>
      <div className="bc-v9-scroll flex gap-3 overflow-x-auto pb-1">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className="group relative h-32 w-[58vw] max-w-[220px] shrink-0 overflow-hidden rounded-[1.7rem] border text-left transition hover:-translate-y-.5"
            style={{ borderColor: rgba(theme.text,.12), background: rgba(theme.text,.06) }}
          >
            {category.image_url ? <img src={category.image_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : <div className="absolute inset-0" style={{ background: `linear-gradient(135deg,${rgba(theme.primary,.34)},${rgba(theme.accent,.14)},${theme.background})` }} />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white"><strong className="block text-base leading-tight">{category.name}</strong>{category.description && <span className="mt-1 line-clamp-1 block text-[10px] text-white/55">{category.description}</span>}</div>
          </button>
        ))}
      </div>
      <style>{`.bc-v9-scroll::-webkit-scrollbar{display:none}.bc-v9-scroll{scrollbar-width:none}`}</style>
    </section>
  );
}

function nicheTailConfig(nicheId: string, mode: ExperienceMode) {
  if (mode === "links") return {
    eyebrow: "Landing de links premium",
    title: "Todos os caminhos da marca, sem poluição visual.",
    description: "Quando o negócio quer apenas direcionar pessoas para seus canais, a Bio Commerce organiza os links como uma landing completa — sem obrigar produtos, cardápio ou venda.",
    features: [
      { icon: ExternalLink, title: "Links organizados", text: "Os canais importantes ganham hierarquia, espaço e navegação confortável mesmo quando são muitos." },
      { icon: Sparkles, title: "Conteúdo vivo", text: "YouTube, redes, vídeos, galeria e outros blocos podem enriquecer a página sem perder o foco." },
      { icon: MessageCircle, title: "Contato rápido", text: "WhatsApp, site, telefone e localização continuam acessíveis em poucos toques." },
    ],
  };

  if (nicheId === "food") return {
    eyebrow: "Experiência gastronômica",
    title: "Do desejo ao pedido, tudo acontece na mesma jornada.",
    description: "Destaques, categorias, ofertas, detalhes e sacola trabalham juntos para o cliente encontrar o que quer sem sair da Bio Commerce.",
    features: [
      { icon: UtensilsCrossed, title: "Cardápio por categorias", text: "Lanches, bebidas e outras categorias aparecem exatamente como o estabelecimento cadastrou." },
      { icon: ShoppingBag, title: "Compra em poucos toques", text: "O cliente abre o item, escolhe opções e adiciona à sacola sem perder a navegação." },
      { icon: Coffee, title: "Mais espaço para vender", text: "Ofertas, novidades e produtos complementares continuam visíveis ao longo da landing." },
    ],
  };

  if (nicheId === "beauty") return {
    eyebrow: "Beleza & cuidado",
    title: "Uma vitrine feita para transformar interesse em agendamento.",
    description: "Serviços, provas sociais, canais de contato e conteúdos visuais entram em uma experiência mais leve para salão, barbearia, manicure e estética.",
    features: [
      { icon: Scissors, title: "Serviços em destaque", text: "Cortes, unhas, tratamentos e outros serviços podem ganhar imagem, descrição e chamada própria." },
      { icon: CalendarDays, title: "Caminho para agendar", text: "O CTA pode direcionar ao canal de agendamento ou ao WhatsApp do negócio." },
      { icon: Star, title: "Confiança visível", text: "Avaliações reais ajudam a completar a decisão sem inventar depoimentos." },
    ],
  };

  if (nicheId === "fitness") return {
    eyebrow: "Fitness & performance",
    title: "Planos, experiências e contato em uma landing com energia.",
    description: "A estrutura prioriza aulas, planos, avaliações e o próximo passo do visitante, sem forçar uma lógica de restaurante.",
    features: [
      { icon: Dumbbell, title: "Planos e experiências", text: "Apresente modalidades, planos ou serviços com visual forte e navegação rápida." },
      { icon: CalendarDays, title: "Aula ou visita", text: "O CTA pode levar direto para o canal que o estabelecimento usa para receber novos alunos." },
      { icon: HeartHandshake, title: "Relacionamento", text: "Links, avaliações e redes sociais reforçam o vínculo com a comunidade." },
    ],
  };

  if (nicheId === "health") return {
    eyebrow: "Saúde & atendimento",
    title: "Clareza, confiança e acesso rápido ao próximo passo.",
    description: "A landing organiza serviços, localização, contato e avaliação de forma mais sóbria para clínicas e profissionais de saúde.",
    features: [
      { icon: Stethoscope, title: "Serviços claros", text: "Cada atendimento pode ser apresentado com descrição objetiva e CTA apropriado." },
      { icon: MapPin, title: "Localização fácil", text: "Como chegar e canais de contato podem ficar sempre ao alcance do visitante." },
      { icon: CalendarDays, title: "Agendamento direto", text: "A pessoa segue para o canal de agenda definido pelo próprio estabelecimento." },
    ],
  };

  if (nicheId === "pet") return {
    eyebrow: "Pet & cuidado",
    title: "Serviços, produtos e contato pensados para quem cuida de perto.",
    description: "Banho, tosa, atendimento, produtos e redes sociais podem coexistir numa página mais acolhedora e visual.",
    features: [
      { icon: PawPrint, title: "Serviços e cuidados", text: "O visitante encontra rapidamente o que o pet precisa." },
      { icon: ShoppingBag, title: "Produtos quando houver", text: "O catálogo pode vender qualquer produto publicado pelo estabelecimento." },
      { icon: MessageCircle, title: "Contato simples", text: "WhatsApp e outros canais ficam integrados à jornada." },
    ],
  };

  return {
    eyebrow: "Experiência da marca",
    title: "Uma landing que se adapta ao negócio, não o contrário.",
    description: "Conteúdo, serviços, produtos e links entram conforme o que o estabelecimento realmente usa. O visual continua premium sem obrigar módulos desnecessários.",
    features: [
      { icon: BriefcaseBusiness, title: "Estrutura adaptativa", text: "A Bio Commerce prioriza os conteúdos que fazem sentido para o perfil escolhido." },
      { icon: ShoppingBag, title: "Venda quando houver", text: "O Catálogo pode receber e vender os produtos que o lojista decidir publicar." },
      { icon: ExternalLink, title: "Links quando bastarem", text: "Se a intenção for apenas direcionar o público, a landing funciona perfeitamente só com links." },
    ],
  };
}

function ChannelNavigator({ kind, initialCategoryId, products, categories, theme, slug, onClose }: {
  kind: ChannelKind;
  initialCategoryId: string | null;
  products: any[];
  categories: RuntimeCategory[];
  theme: any;
  slug: string;
  onClose: () => void;
}) {
  const cart = useCart(slug);
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [selected, setSelected] = useState<any | null>(null);
  const [variant, setVariant] = useState<string | null>(null);

  const filtered = categoryId ? products.filter((product: any) => String(product.category_id ?? "") === categoryId) : products;
  const title = kind === "menu" ? "Cardápio" : "Catálogo";

  function addProduct(product: any, selectedVariant?: string | null) {
    if (product.stock_status === "out_of_stock") return toast.info("Este item está indisponível no momento.");
    const variants = Array.isArray(product.variants) ? product.variants.filter((item: any) => item?.label) : [];
    if (variants.length > 0 && !selectedVariant) {
      setSelected(product);
      setVariant(null);
      return;
    }
    cart.add(product.id, 1, selectedVariant ?? undefined);
    toast.success(`${product.name} adicionado à sacola.`);
    trackChannelEvent({ slug, channel: "linktree", event_type: "link_click", ref_id: product.id, ref_label: `v9:add:${product.name}` });
    if (selected) setSelected(null);
  }

  return (
    <motion.div className="fixed inset-0 z-[230] overflow-y-auto bg-black/94 text-white backdrop-blur-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="mx-auto min-h-dvh w-full max-w-6xl px-3 pb-28 pt-3 sm:px-6 sm:pt-5">
        <header className="sticky top-3 z-30 rounded-[1.8rem] border border-white/10 bg-black/65 p-3 backdrop-blur-2xl sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[9px] font-black uppercase tracking-[.22em]" style={{ color: theme.primary }}>Bio Commerce</p><h2 className="mt-1 text-2xl font-black">{title}</h2></div>
            <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border border-white/15"><X className="h-5 w-5" /></button>
          </div>
          {categories.length > 0 && (
            <div className="bc-v9-scroll mt-4 flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setCategoryId(null)} className="shrink-0 rounded-full border px-4 py-2 text-xs font-black" style={{ borderColor: categoryId === null ? theme.primary : "rgba(255,255,255,.16)", background: categoryId === null ? rgba(theme.primary,.22) : "transparent" }}>Todos</button>
              {categories.map((category) => <button key={category.id} onClick={() => setCategoryId(category.id)} className="shrink-0 rounded-full border px-4 py-2 text-xs font-black" style={{ borderColor: categoryId === category.id ? theme.primary : "rgba(255,255,255,.16)", background: categoryId === category.id ? rgba(theme.primary,.22) : "transparent" }}>{category.name}</button>)}
            </div>
          )}
        </header>

        <div className="mt-5 flex items-center justify-between gap-4">
          <div><p className="text-xs text-white/45">{categoryId ? categories.find((category) => category.id === categoryId)?.name : `Todos os itens de ${title.toLowerCase()}`}</p><strong className="text-sm">{filtered.length} {filtered.length === 1 ? "item" : "itens"}</strong></div>
          {cart.count > 0 && <div className="rounded-full px-4 py-2 text-xs font-black text-white" style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})` }}>{cart.count} na sacola</div>}
        </div>

        {filtered.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((product: any) => {
              const promo = product.promo_price != null && product.price != null && Number(product.promo_price) < Number(product.price);
              const variants = Array.isArray(product.variants) ? product.variants.filter((item: any) => item?.label) : [];
              const qty = cart.qtyOf(product.id);
              return (
                <article key={product.id} className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[.055]">
                  <button type="button" onClick={() => { setSelected(product); setVariant(null); }} className="block w-full text-left">
                    <div className="relative aspect-[4/5] overflow-hidden bg-white/5">
                      {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center"><ShoppingBag className="h-8 w-8 text-white/25" /></div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-transparent" />
                      {promo && <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-black" style={{ background: theme.primary }}>OFERTA</span>}
                      <div className="absolute inset-x-3 bottom-3"><h3 className="line-clamp-2 text-sm font-black">{product.name}</h3><strong className="mt-1 block text-sm" style={{ color: theme.primary }}>{money(promo ? product.promo_price : product.price, product.currency ?? "BRL")}</strong></div>
                    </div>
                  </button>
                  <div className="p-3">
                    <p className="line-clamp-2 min-h-8 text-[11px] leading-relaxed text-white/55">{product.short_desc || "Toque para ver detalhes."}</p>
                    <button type="button" onClick={() => addProduct(product)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full px-3 py-2.5 text-xs font-black" style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})` }}>{variants.length ? "Escolher opções" : qty > 0 ? `${qty} na sacola` : <><Plus className="h-4 w-4" />Adicionar</>}</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-12 rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center text-sm text-white/55">Nenhum item publicado nesta categoria.</div>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div className="fixed inset-0 z-[240] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}>
            <motion.div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0c0c0c] p-5 sm:rounded-[2rem] sm:p-6" initial={{ y: 70 }} animate={{ y: 0 }} exit={{ y: 70 }} onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4"><div><h3 className="text-2xl font-black">{selected.name}</h3><p className="mt-1 text-sm text-white/55">{selected.long_desc || selected.short_desc || "Confira os detalhes deste item."}</p></div><button onClick={() => setSelected(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15"><X className="h-4 w-4" /></button></div>
              {Array.isArray(selected.variants) && selected.variants.filter((item: any) => item?.label).length > 0 && <div className="mt-5"><p className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-white/45">Escolha uma opção</p><div className="flex flex-wrap gap-2">{selected.variants.filter((item: any) => item?.label).map((item: any) => { const label = String(item.label); return <button key={label} onClick={() => setVariant(label)} className="rounded-full border px-3 py-2 text-xs font-black" style={{ borderColor: variant === label ? theme.primary : "rgba(255,255,255,.16)", background: variant === label ? rgba(theme.primary,.22) : "transparent" }}>{label}{item.price != null ? ` · ${money(Number(item.price), selected.currency ?? "BRL")}` : ""}</button>; })}</div></div>}
              <button onClick={() => addProduct(selected, variant)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-black" style={{ background: `linear-gradient(135deg,${theme.primary},${theme.accent})` }}><ShoppingBag className="h-5 w-5" />Adicionar à sacola</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
