import { createFileRoute, Link, notFound, useNavigate, useParams } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { attachEstablishmentBySlug, getMyEstablishmentCard } from "@/lib/my-wallet.functions";
import { toast } from "sonner";

import { listPublicPromotionsBySlug } from "@/lib/promotions.functions";
import {
  Megaphone,
  ChevronLeft,
  ExternalLink,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  MapPin,
  Phone,
  MessageCircle,
  Instagram,
  Globe,
  Clock,
  Gift,
  ChevronDown,
  Sparkles,
  CreditCard,
  LogIn,
  Wallet,
  UserCircle2,
  UtensilsCrossed,
  ShoppingBag,


} from "lucide-react";
import { getStampIcon } from "@/lib/stampIcons";

const opts = (slug: string) =>
  queryOptions({
    queryKey: ["public-promotions", slug],
    queryFn: () => listPublicPromotionsBySlug({ data: { slug } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/e/$slug")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    // 404 real (evita soft-404 para os buscadores) quando o slug não existe.
    if (!d?.establishment) throw notFound();
    return d;
  },
  component: DiscoveryProfilePage,
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
        <div className="font-display text-sm font-bold">Não foi possível carregar</div>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-semibold"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-6 text-center">
      <div className="font-display text-lg font-bold">Estabelecimento não encontrado</div>
      <Link to="/" className="mt-2 inline-block text-sm text-primary underline">
        Ir para o início
      </Link>
    </div>
  ),
});

type Media = { path: string; type: "image" | "video"; url?: string | null };

export { opts as discoveryProfileOpts };
export function DiscoveryProfilePage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const { data } = useSuspenseQuery(opts(slug));

  if (data.status === "NOT_FOUND") {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <div className="mx-auto max-w-2xl space-y-4 p-4 pt-6">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Início
          </Link>
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
            <div className="font-display text-sm font-bold text-destructive">Estabelecimento não encontrado</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Verifique o link ou peça um novo QR Code.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (data.status === "INACTIVE") {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <div className="mx-auto max-w-2xl space-y-4 p-4 pt-6">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Início
          </Link>
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
            <div className="font-display text-sm font-bold text-destructive">Estabelecimento indisponível</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Este estabelecimento não está mais ativo na Fidelize.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (data.status === "DATABASE_ERROR") {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <div className="mx-auto max-w-2xl space-y-4 p-4 pt-6">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Início
          </Link>
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
            <div className="font-display text-sm font-bold text-destructive">Erro de carregamento</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Não foi possível carregar o estabelecimento no momento.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data.establishment) return null;

  const est = data.establishment;
  const brand = est.primary_color || "hsl(var(--primary))";
  const globalLinks = est.external_links ?? [];

  const location = [est.address, est.city].filter(Boolean).join(" · ");
  const contactLinks: { icon: typeof Phone; label: string; url: string }[] = [];
  if (est.whatsapp) {
    const num = est.whatsapp.replace(/\D/g, "");
    contactLinks.push({ icon: MessageCircle, label: "WhatsApp", url: `https://wa.me/${num}` });
  }
  if (est.phone) contactLinks.push({ icon: Phone, label: est.phone, url: `tel:${est.phone}` });
  if (est.instagram) {
    const handle = est.instagram.replace(/^@/, "");
    contactLinks.push({ icon: Instagram, label: `@${handle}`, url: `https://instagram.com/${handle}` });
  }
  if (est.website) contactLinks.push({ icon: Globe, label: "Site", url: est.website });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-10">
      <header className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-5">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl"
          style={{ background: brand }}
        />
        <div className="relative flex items-start gap-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-background text-lg font-black uppercase"
            style={{ color: brand }}
          >
            {est.logo_url ? (
              <img src={est.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              est.name.slice(0, 2)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white"
                style={{ background: brand }}
              >
                <Sparkles className="h-3 w-3" /> Descobrir
              </span>
            </div>
            <h1 className="mt-1 truncate font-display text-2xl font-black tracking-tight">
              {est.name}
            </h1>
            {location && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> <span className="truncate">{location}</span>
              </div>
            )}
            {est.business_hours && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> <span className="truncate">{est.business_hours}</span>
              </div>
            )}
            {est.description && (
              <p className="mt-2 text-sm text-muted-foreground">{est.description}</p>
            )}
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap gap-2">
          <VisitorCta slug={slug} brand={brand} hasActiveCampaign={data.campaigns.length > 0} />
          {contactLinks.map((c, i) => {

            const Icon = c.icon;
            return (
              <a
                key={`${c.url}-${i}`}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
              >
                <Icon className="h-3.5 w-3.5" /> {c.label}
              </a>
            );
          })}
        </div>
      </header>

      <section className="space-y-3 rounded-3xl border border-border/60 bg-card/40 p-4">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4" style={{ color: brand }} />
          <h2 className="font-display text-sm font-bold uppercase tracking-widest">
            Campanhas ativas
          </h2>
        </div>
        {data.campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma campanha ativa no momento.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.campaigns.map((c) => {
              const Icon = getStampIcon(c.stamp_icon);
              const color = c.primary_color || brand;
              return (
                <li
                  key={c.id}
                  className="flex gap-3 rounded-2xl border border-border/60 bg-background/40 p-3"
                >
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{ background: `${color}22`, color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="truncate font-display text-sm font-bold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      A cada <strong>{c.stamps_required}</strong> carimbos:{" "}
                      <span style={{ color }}>{c.reward_title}</span>
                    </div>
                    {c.reward_description && (
                      <p className="text-[11px] text-muted-foreground">{c.reward_description}</p>
                    )}
                    {c.rules && (
                      <p className="text-[11px] text-muted-foreground/80">
                        <strong>Regras:</strong> {c.rules}
                      </p>
                    )}
                    {(c.stamp_validity_days || c.reward_validity_days) && (
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                        {c.stamp_validity_days ? `Carimbo vale ${c.stamp_validity_days}d` : ""}
                        {c.stamp_validity_days && c.reward_validity_days ? " · " : ""}
                        {c.reward_validity_days ? `Prêmio vale ${c.reward_validity_days}d` : ""}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-2 pt-1">
        <Megaphone className="h-4 w-4" style={{ color: brand }} />
        <h2 className="font-display text-sm font-bold uppercase tracking-widest">Promoções</h2>
      </div>

      {globalLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {globalLinks.map((l, i) => (
            <a
              key={`${l.url}-${i}`}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
              style={{ color: brand }}
            >
              <ExternalLink className="h-3 w-3" /> {l.label}
            </a>
          ))}
        </div>
      )}

      {data.promotions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
          <Megaphone className="mx-auto mb-2 h-6 w-6 text-primary" />
          <div className="font-display text-sm font-bold">Sem promoções ativas agora</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Fique de olho — novas ofertas aparecem aqui.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.promotions.map((p) => (
            <PromoRow key={p.id} promo={p} brand={brand} globalLinks={globalLinks} />
          ))}
        </ul>
      )}

      {data.has_menu && (
        <Link
          to="/cardapio/$slug"
          params={{ slug: est.slug }}
          className="group relative flex items-center gap-3 overflow-hidden rounded-3xl border border-border/60 bg-card/50 p-4 transition-all hover:border-primary/40 hover:bg-card/70"
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl"
            style={{ background: brand }}
          />
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-border/60 bg-background"
            style={{ color: brand }}
          >
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-bold">Ver cardápio digital</div>
            <p className="text-[11px] text-muted-foreground">
              Pratos, fotos e preços de {est.name} — atualizado em tempo real.
            </p>
          </div>
          <NextIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {data.has_catalog && (
        <Link
          to="/catalogo/$slug"
          params={{ slug: est.slug }}
          className="group relative flex items-center gap-3 overflow-hidden rounded-3xl border border-border/60 bg-card/50 p-4 transition-all hover:border-primary/40 hover:bg-card/70"
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl"
            style={{ background: brand }}
          />
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-border/60 bg-background"
            style={{ color: brand }}
          >
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-bold">Ver catálogo digital</div>
            <p className="text-[11px] text-muted-foreground">
              Produtos, fotos e preços de {est.name} — peça direto pelo WhatsApp.
            </p>
          </div>
          <NextIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}


      <div className="pt-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        Powered by Fidelize
      </div>
      </div>
    </div>
  );
}

function useSessionStatus() {
  const [state, setState] = useState<"loading" | "guest" | "authed">("loading");
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState(data.session ? "authed" : "guest");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setState(session ? "authed" : "guest");
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}

function VisitorCta({
  slug,
  brand,
  hasActiveCampaign,
}: {
  slug: string;
  brand: string;
  hasActiveCampaign: boolean;
}) {
  const status = useSessionStatus();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [joining, setJoining] = useState(false);
  // Login na Fidelize e inscricao em uma loja sao coisas distintas.
  // So mostrar "Abrir meu cartao" se existir vinculo desta conta com a loja.
  const membership = useQuery({
    queryKey: ["discovery-wallet-membership", slug],
    queryFn: () => getMyEstablishmentCard({ data: { slug } }),
    enabled: status === "authed",
    staleTime: 15_000,
    retry: 1,
  });

  async function joinProgram() {
    if (joining || status !== "authed" || !hasActiveCampaign || membership.data) return;
    setJoining(true);
    try {
      // Acao intencional do titular autenticado; nunca cria cartao na visita.
      await attachEstablishmentBySlug({ data: { slug } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["discovery-wallet-membership", slug] }),
      ]);
      await navigate({ to: "/carteira/$slug", params: { slug } });
    } catch (error) {
      console.error("[discovery] wallet enrollment failed", error);
      toast.error("Não foi possível ativar seu cartão. Tente novamente.");
    } finally {
      setJoining(false);
    }
  }

  if (status === "authed") {
    return (
      <>
        {membership.isPending ? (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-semibold"
          >
            <CreditCard className="h-3.5 w-3.5" /> Verificando seu cartão…
          </span>
        ) : membership.isError ? (
          <button
            type="button"
            onClick={() => void membership.refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-semibold"
          >
            <CreditCard className="h-3.5 w-3.5" /> Tentar verificar meu cartão
          </button>
        ) : membership.data ? (
          <Link
            to="/carteira/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
            style={{ background: brand }}
          >
            <CreditCard className="h-3.5 w-3.5" /> Abrir meu cartão aqui
          </Link>
        ) : hasActiveCampaign ? (
          <button
            type="button"
            onClick={() => void joinProgram()}
            disabled={joining}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60"
            style={{ background: brand }}
          >
            <CreditCard className="h-3.5 w-3.5" />
            {joining ? "Criando seu cartão…" : "Participar e criar meu cartão"}
          </button>
        ) : (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-semibold text-muted-foreground"
          >
            <CreditCard className="h-3.5 w-3.5" /> Programa de fidelidade ainda não disponível
          </span>
        )}
        <Link
          to="/carteira"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
        >
          <Wallet className="h-3.5 w-3.5" /> Minha carteira
        </Link>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
          <UserCircle2 className="h-3 w-3" /> Logado na Fidelize
        </span>
      </>
    );
  }

  return (
    <>
      <Link
        to="/auth"
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
        style={{ background: brand }}
      >
        <LogIn className="h-3.5 w-3.5" /> Entrar ou criar minha carteira
      </Link>
      {hasActiveCampaign ? (
        <Link
          to="/carteira/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
        >
          <CreditCard className="h-3.5 w-3.5" /> Já sou cliente
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5" /> Programa de fidelidade ainda não disponível
        </span>
      )}
      <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        Visitando como convidado
      </span>
    </>
  );
}

function PromoRow({
  promo,
  brand,
  globalLinks,
}: {
  promo: {
    id: string;
    title: string;
    body: string | null;
    media: Media[];
    external_links: { label: string; url: string }[];
    ends_at: string | null;
  };
  brand: string;
  globalLinks: { label: string; url: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const media = promo.media.filter((m) => !!m.url);
  const current = media[idx];
  const combinedLinks = [
    ...promo.external_links,
    ...globalLinks.filter((g) => !promo.external_links.some((p) => p.url === g.url)),
  ];

  return (
    <li className="overflow-hidden rounded-2xl border border-border/60 bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-card/40"
      >
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: `${brand}22`, color: brand }}
        >
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="truncate font-display text-sm font-bold">{promo.title}</div>
          {promo.body && (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{promo.body}</p>
          )}
          {promo.ends_at && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Até {new Date(promo.ends_at).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        {media.length > 0 && (
          <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {media.length} mídia{media.length > 1 ? "s" : ""}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-border/60 bg-card/30">
          {current && (
            <div className="relative aspect-video w-full bg-black">
              {current.type === "video" ? (
                <video src={current.url ?? undefined} className="h-full w-full object-contain" controls playsInline />
              ) : (
                <img src={current.url ?? undefined} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              )}
              {media.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIdx((idx - 1 + media.length) % media.length)}
                    className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                    aria-label="Anterior"
                  >
                    <PrevIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdx((idx + 1) % media.length)}
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                    aria-label="Próxima"
                  >
                    <NextIcon className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                    {media.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full transition ${i === idx ? "bg-white" : "bg-white/40"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="space-y-2 p-4">
            {promo.body && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{promo.body}</p>
            )}
            {combinedLinks.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {combinedLinks.map((l, i) => (
                  <a
                    key={`${l.url}-${i}`}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
                    style={{ background: brand }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
