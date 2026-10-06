import { useQuery } from "@tanstack/react-query";
import { BioCommerceLanding, type BioCommerceBlockData, type BioCommerceLandingData } from "@/components/bio-commerce/BioCommerceLanding";
import { getLinkTreeBlockData } from "@/lib/linktree.functions";
import { useChannelPageView } from "@/lib/tracking";

const EMPTY_BLOCK_DATA: BioCommerceBlockData = { menu: [], catalog: [], reviews: [], stats: null };

export function BioCommercePublicPageV3({ data, slug }: { data: BioCommerceLandingData; slug: string }) {
  useChannelPageView(slug, "linktree");

  const blockDataQuery = useQuery({
    queryKey: ["public-linktree-blocks-v3", slug],
    queryFn: () => getLinkTreeBlockData({ data: { slug } }),
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <BioCommerceLanding
      data={data}
      slug={slug}
      blockData={(blockDataQuery.data ?? EMPTY_BLOCK_DATA) as BioCommerceBlockData}
      interactive
    />
  );
}
