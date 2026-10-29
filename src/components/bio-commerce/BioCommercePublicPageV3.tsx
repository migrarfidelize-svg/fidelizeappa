import { useQuery } from "@tanstack/react-query";
import { BioCommerceLanding, type BioCommerceBlockData, type BioCommerceLandingData } from "@/components/bio-commerce/BioCommerceLanding";
import { getBioCommerceRuntimeData } from "@/lib/bio-commerce-runtime.functions";
import { useChannelPageView } from "@/lib/tracking";
import { GoogleMapsReviewsSection } from "@/components/bio-commerce/GoogleMapsReviewsSection";

const EMPTY_BLOCK_DATA: BioCommerceBlockData = { menu: [], catalog: [], reviews: [], stats: null };

export function BioCommercePublicPageV3({ data, slug }: { data: BioCommerceLandingData; slug: string }) {
  useChannelPageView(slug, "linktree");

  const blockDataQuery = useQuery({
    queryKey: ["public-bio-commerce-runtime-v4", slug],
    queryFn: () => getBioCommerceRuntimeData({ data: { slug } }),
    staleTime: 60_000,
    retry: 1,
  });

  // O slug público da Bio pode ser personalizado (ex.: /tesalvei), enquanto
  // Cardápio/Catálogo continuam usando o slug técnico do estabelecimento
  // (ex.: /cardapio/cafe-aurora). O renderer recebe o slug técnico para que
  // compras e links internos nunca quebrem.
  const commerceSlug = String(data.establishment?.slug || slug);
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
