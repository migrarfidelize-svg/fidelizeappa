import { Facebook, Instagram, Music2, Pause, Play, Plus, ShoppingBag, X, Youtube } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BioCommerceLanding as BioCommerceLandingV4,
  type BioCommerceBlockData,
  type BioCommerceLandingData,
  type BioCommerceProduct,
  type BioCommerceReview,
} from "./BioCommerceLandingV4";
import { useCart } from "@/lib/cart";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

type CatalogMode = "menu" | "catalog" | null;

function money(value: number | null | undefined, currency = "BRL") {
  if (value == null || !Number.isFinite(Number(value))) return "Sob consulta";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value));
  } catch {
    return `R$ ${Number(value).toFixed(2)}`;
  }
}

export function BioCommerceLanding(props: {
  data: BioCommerceLandingData;
  slug: string;
  blockData?: BioCommerceBlockData;
  embedded?: boolean;
  interactive?: boolean;
}) {
  const { data, blockData, embedded = false, interactive = true, slug } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const [railPaused, setRailPaused] = useState(false);
  const [catalogMode, setCatalogMode] = useState<CatalogMode>(null);
  const cart = useCart(slug);

  const hasRail = ((blockData?.menu?.length ?? 0) + (blockData?.catalog?.length ?? 0)) >= 3;
  const configuredSocials = useMemo(() => {
    const links = (data.links ?? []).filter((link: any) => link?.enabled !== false);
    return links.filter((link: any) => ["instagram", "facebook", "tiktok", "youtube"].includes(link.kind));
  }, [data.links]);

  const fullProducts = catalogMode === "menu" ? blockData?.menu ?? [] : catalogMode === "catalog" ? blockData?.catalog ?? [] : [];

  useEffect(() => {
    if (!interactive) return;
    const root = rootRef.current;
    if (!root) return;

    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      const match = /^\/(cardapio|catalogo)\//.exec(href);
      if (!match) return;
      event.preventDefault();
      event.stopPropagation();
      setCatalogMode(match[1] === "cardapio" ? "menu" : "catalog");
    };

    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, [interactive]);

  useEffect(() => {
    if (!interactive || embedded || !hasRail) return;
    const root = rootRef.current;
    if (!root) return;
    const rails = Array.from(root.querySelectorAll<HTMLElement>(".bc-no-scrollbar"));

    if (railPaused) {
      const positions = rails.map((rail) => rail.scrollLeft);
      let freezeFrame = 0;
      const freeze = () => {
        rails.forEach((rail, index) => {
          rail.scrollLeft = positions[index] ?? rail.scrollLeft;
        });
        freezeFrame = requestAnimationFrame(freeze);
      };
      freezeFrame = requestAnimationFrame(freeze);
      return () => cancelAnimationFrame(freezeFrame);
    }

    let frame = 0;
    let last = performance.now();
    const run = (now: number) => {
      const dt = Math.min(34, now - last);
      last = now;
      rails.forEach((rail) => {
        if (rail.scrollWidth <= rail.clientWidth) return;
        rail.scrollLeft += dt * 0.042;
        if (rail.scrollLeft >= rail.scrollWidth / 2 && rail.scrollWidth > rail.clientWidth * 1.6) {
          rail.scrollLeft -= rail.scrollWidth / 2;
        }
      });
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [embedded, hasRail, interactive, railPaused]);

  useEffect(() => {
    if (!catalogMode) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [catalogMode]);

  return (
    <div ref={rootRef} className="bc-v5 relative">
      <style>{`
        @media (max-width:639px){
          .bc-v5 > div > .relative.z-10 > section:first-of-type > div{
            margin-left:-0.75rem!important;
            margin-right:-0.75rem!important;
            width:calc(100% + 1.5rem)!important;
            border-left:0!important;
            border-right:0!important;
            border-radius:0 0 2rem 2rem!important;
          }
          .bc-v5 > div > .relative.z-10 > section:first-of-type{margin-top:-0.75rem!important}
          .bc-v5 #bio-commerce-vitrine{padding-left:.75rem;padding-right:.75rem}
        }
        .bc-v5 .bc-no-scrollbar{scroll-behavior:auto}
      `}</style>

      <BioCommerceLandingV4 {...props} />

      {embedded && configuredSocials.length === 0 && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 text-white/75 backdrop-blur-xl">
          <Instagram className="h-4 w-4" />
          <Facebook className="h-4 w-4" />
          <Music2 className="h-4 w-4" />
          <Youtube className="h-4 w-4" />
        </div>
      )}

      {!embedded && interactive && hasRail && (
        <button
          type="button"
          onClick={() => setRailPaused((value) => !value)}
          className="fixed bottom-20 right-3 z-[88] inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-2 text-[11px] font-black text-white shadow-xl backdrop-blur-xl"
          aria-label={railPaused ? "Continuar destaques" : "Pausar destaques"}
        >
          {railPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {railPaused ? "Continuar" : "Pausar destaques"}
        </button>
      )}

      {catalogMode && !embedded && (
        <div className="fixed inset-0 z-[160] overflow-y-auto bg-[#080706]/95 text-white backdrop-blur-2xl">
          <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-24 pt-5 sm:px-6 sm:pt-8">
            <div className="sticky top-3 z-20 flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-2xl">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Bio Commerce</p>
                <h2 className="text-xl font-black">{catalogMode === "menu" ? "Cardápio completo" : "Catálogo completo"}</h2>
              </div>
              <button type="button" onClick={() => setCatalogMode(null)} className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            {fullProducts.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {fullProducts.map((product) => {
                  const promo = product.promo_price != null && product.price != null && Number(product.promo_price) < Number(product.price);
                  const qty = cart.qtyOf(product.id);
                  const variants = Array.isArray(product.variants) ? product.variants.filter((item) => item?.label) : [];
                  return (
                    <article key={product.id} className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.055] shadow-[0_18px_50px_rgba(0,0,0,.28)]">
                      <div className="relative aspect-[4/5] overflow-hidden bg-white/5">
                        {product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center"><ShoppingBag className="h-8 w-8 text-white/35" /></div>}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                        {promo && <span className="absolute left-3 top-3 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-black">OFERTA</span>}
                        <div className="absolute inset-x-3 bottom-3">
                          <h3 className="line-clamp-2 text-sm font-black leading-tight sm:text-base">{product.name}</h3>
                          <div className="mt-2 flex flex-wrap items-end gap-2">
                            <strong className="text-base">{money(promo ? product.promo_price : product.price, product.currency ?? "BRL")}</strong>
                            {promo && <span className="text-[10px] text-white/45 line-through">{money(product.price, product.currency ?? "BRL")}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-2 min-h-8 text-[11px] leading-relaxed text-white/55">{product.short_desc || "Selecione para adicionar ao pedido."}</p>
                        {variants.length ? (
                          <p className="mt-3 text-[10px] font-bold text-orange-300">Possui opções — abra nos destaques para escolher</p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => interactive && cart.add(product.id)}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-3 py-2.5 text-xs font-black shadow-lg active:scale-[.98]"
                          >
                            {qty > 0 ? <span>{qty} na sacola</span> : <><Plus className="h-4 w-4" />Adicionar</>}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-16 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/60">Nenhum item publicado nesta vitrine.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
