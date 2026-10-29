import { useQuery } from "@tanstack/react-query";
import { getGooglePlaceReviews } from "@/lib/google-place-reviews.functions";
import { ArrowUpRight, ExternalLink, MapPin, MessageCircle, ShieldCheck, Star } from "lucide-react";

type GoogleReviewConfig = {
  place_id: string;
  maps_url: string;
  rating?: number;
  total?: number;
  verified_at?: string;
  title?: string;
};

const safeMapsUrl = (value: string): string | null => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      (u.hostname === "google.com" || u.hostname.endsWith(".google.com") ||
       u.hostname === "maps.app.goo.gl") ? u.toString() : null;
  } catch { return null; }
};

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Nota ${rating.toFixed(1)} de 5`}>
      {Array.from({length: 5}, (_, i) => (
        <Star key={i} className={(size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5") +
          " " + (i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-slate-600 text-slate-600")} />
      ))}
    </div>
  );
}

/** Visible only for pages with a business-associated Google Places ID. */
export function GoogleMapsReviewsSection({ slug, config }: { slug: string; config: GoogleReviewConfig }) {
  const mapsUrl = safeMapsUrl(config.maps_url || "");
  const getReviews = getGooglePlaceReviews;

  const { data } = useQuery({
    queryKey: ["google-map-reviews", slug],
    queryFn: () => getReviews({ data: { slug } }),
    staleTime: 0,
    retry: false,
  });

  if (!mapsUrl || !/^ChIJ[a-zA-Z0-9_-]{12,80}$/.test(config.place_id)) return null;
  const rating = data?.available && data.rating != null ? data.rating : config.rating;
  const count = data?.available && data.total != null ? data.total : config.total;
  const reviews = data?.available ? (data.reviews ?? []).filter((r) => !!r.text.trim()) : [];

  return (
    <section className="relative isolate mx-auto w-full min-w-0 max-w-[1280px] overflow-hidden px-0 pb-10 pt-10 text-white sm:px-6 sm:pt-12 md:pb-16"
      aria-labelledby="google-race-reviews-title">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 rounded-full bg-blue-500/10 blur-[100px]" aria-hidden="true" />
      <div className="relative min-w-0 rounded-[22px] border border-blue-500/25 bg-[#080d17]/90 p-4 shadow-[0_0_44px_rgba(16,96,255,0.11)] sm:rounded-[26px] sm:p-8">
        <div className="mb-5 flex min-w-0 flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap">
          <div className="min-w-0 space-y-2">
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.27em] text-[#66bfff]">
              <span className="h-[2px] w-7 bg-[#2585ff]"/> Opiniões reais
            </span>
            <h2 id="google-race-reviews-title" className="max-w-full text-[clamp(20px,6vw,30px)] font-black leading-tight tracking-tight [overflow-wrap:break-word] sm:text-3xl">
              Quem acelera com a GYNRACE
            </h2>
            <p className="max-w-lg text-sm text-[#aebcd5]">
              Avaliações públicas de clientes no Google Maps. Confira a reputação e leia os relatos na fonte original.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3 py-2 text-xs font-medium text-[#c5d9f4]">
            <MapPin className="h-3.5 w-3.5 text-[#64b8ff]" /> Google Maps
          </div>
        </div>

        <div className="mb-5 flex min-w-0 flex-col items-start gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:px-5">
          {typeof rating === "number" && (
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-5xl font-black tracking-tight text-white">{rating.toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1})}</span>
              <div><Stars rating={rating} size="lg"/>
                <span className="mt-1 block text-xs text-[#9eb0ce]">{typeof count === "number" ? `${count} avaliações` : "Avaliações públicas"}</span>
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1 text-xs leading-5 text-[#aab9d0] [overflow-wrap:break-word]">
            <ShieldCheck className="mr-1 inline h-4 w-4 text-[#72bbff]" />
            {data?.available ? "Nota consultada no Google Maps." :
              `Referência pública consultada em ${config.verified_at || "29/10/2026"}. A nota pode mudar.`}
            <span className="mt-1 block text-[#8e9eb8]">O Google verifica e remove conteúdo falso quando identifica violações; as avaliações não são verificadas individualmente.</span>
          </div>
        </div>

        {reviews.length > 0 ? (
          <div className="-mx-1 mb-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 [scrollbar-width:thin]">
            {reviews.map((review, i) => (
              <article key={review.reviewUri || i} className="w-[min(260px,67vw)] min-w-0 shrink-0 snap-start space-y-3 rounded-2xl border border-white/10 bg-gradient-to-b from-[#121e34] to-[#0b111c] p-4 sm:w-[310px]">
                <div className="flex items-center gap-2">
                  {review.authorPhoto ? (
                    <img src={review.authorPhoto} referrerPolicy="no-referrer" alt="" className="h-10 w-10 rounded-full border border-white/10 object-cover" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-500/20 text-sm font-semibold text-[#8fc4ff]">{review.author.charAt(0).toUpperCase()}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    {review.authorUri ? <a href={review.authorUri} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold text-white hover:text-[#78baff]">{review.author}</a> : <span className="block truncate text-sm font-semibold text-white">{review.author}</span>}
                    <span className="block text-[11px] text-[#8fa3c3]">{review.relativeTime || "Avaliação no Google"}</span>
                  </div>
                </div>
                <Stars rating={review.rating}/>
                <p className="line-clamp-5 min-h-[85px] text-[13px] leading-[1.65] text-[#d6e2f3]">{review.text}</p>
                {review.reviewUri ? <a href={review.reviewUri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-[#75bbff] hover:text-white">Ler no Google Maps <ArrowUpRight className="h-3 w-3" /></a> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border border-dashed border-blue-500/20 bg-blue-500/[.045] px-5 py-4 text-sm text-[#c8d8ee]">
            <MessageCircle className="mr-2 inline h-4 w-4 text-[#60adff]" />
            Os depoimentos individuais ficam disponíveis no Google Maps. A exibição dos comentários aqui será habilitada com a conexão oficial do Google.
          </div>
        )}

        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="group flex min-h-[52px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-[#3aa3ff]/60 bg-gradient-to-r from-[#0a6aff] to-[#1045b7] px-4 py-3 text-center text-[13px] font-bold leading-5 text-white shadow-[0_9px_32px_rgba(13,91,231,.27)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_13px_36px_rgba(12,112,255,.43)] sm:px-5 sm:text-sm">
          Ver todas as avaliações no Google
          <ExternalLink className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </a>
        <p className="mt-3 text-center text-[11px] text-[#8194b1]">
          {reviews.length > 0 ? "Destaques exibidos por relevância, conforme retornados pelo Google Maps." : "Opiniões fornecidas por terceiros. Consulte o histórico completo no Google Maps."}
        </p>
      </div>
    </section>
  );
}
