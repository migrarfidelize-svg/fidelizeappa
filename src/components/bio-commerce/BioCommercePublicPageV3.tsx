import { useQuery } from "@tanstack/react-query";
import { BioCommerceLanding, type BioCommerceBlockData, type BioCommerceLandingData } from "@/components/bio-commerce/BioCommerceLanding";
import { getBioCommerceRuntimeData } from "@/lib/bio-commerce-runtime.functions";
import { useChannelPageView } from "@/lib/tracking";
import { GoogleMapsReviewsSection } from "@/components/bio-commerce/GoogleMapsReviewsSection";
import { GynRaceExclusivePage } from "@/components/bio-commerce/GynRaceExclusivePage";

const EMPTY_BLOCK_DATA: BioCommerceBlockData = { menu: [], catalog: [], reviews: [], stats: null };

export function BioCommercePublicPageV3({ data, slug }: { data: BioCommerceLandingData; slug: string }) {
  useChannelPageView(slug, "linktree");

  // A rota GYNRACE usa apenas o renderer exclusivo. Nao dispare as consultas
  // de catalogo/cardapio/reviews da landing generica para esta pagina.
  // Alem de economizar dados no celular, isso elimina layout generico e
  // requisicoes desnecessarias em navegadores internos do Instagram.
  const commerceSlug = String(data.establishment?.slug || slug);
  if (slug.toLowerCase() === "gynrace" && commerceSlug.toLowerCase() === "gynrace") {
    return <GynRaceExclusivePage data={data} />;
  }

  return <GenericPublicPage data={data} slug={slug} commerceSlug={commerceSlug} />;
}

function GenericPublicPage({
  data, slug, commerceSlug,
}: {
  data: BioCommerceLandingData;
  slug: string;
  commerceSlug: string;
}) {
  // Hook isolado no renderer generico para cumprir as regras dos hooks.
  const blockDataQuery = useQuery({
    queryKey: ["public-bio-commerce-runtime-v4", slug],
    queryFn: () => getBioCommerceRuntimeData({ data: { slug } }),
    staleTime: 60_000,
    retry: 1,
  });

  const googleReviews = (data.page?.theme as any)?.google_reviews as
    | { place_id: string; maps_url: string; rating?: number; total?: number; verified_at?: string }
    | undefined;

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#03060d]">
      <BioCommerceLanding
        data={data}
        slug={commerceSlug}
        blockData={(blockDataQuery.data ?? EMPTY_BLOCK_DATA) as BioCommerceBlockData}
        interactive
      />
      {googleReviews?.place_id && googleReviews?.maps_url ? (
        <GoogleMapsReviewsSection slug={slug} config={googleReviews} />
      ) : null}
    </div>
  );
}
