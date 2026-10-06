import { useMemo } from "react";
import {
  BioCommerceLanding as BioCommerceLandingV9,
  type BioCommerceBlockData,
  type BioCommerceLandingData,
  type BioCommerceProduct,
  type BioCommerceReview,
} from "./BioCommerceLandingV9";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

function runtimeKind(link: any) {
  const url = String(link?.url ?? "").toLowerCase();
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/tiktok\.com/.test(url)) return "tiktok";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/facebook\.com|fb\.com/.test(url)) return "facebook";
  if (/wa\.me|whatsapp\.com/.test(url)) return "whatsapp";
  return link?.kind;
}

/**
 * Compatibilidade sem migração: reconhece o destino real pelo URL apenas na
 * renderização. Assim árvores antigas (como Ronnei) ganham ícones, vídeo do
 * YouTube e tratamento social corretos sem alterar label, URL, ordem ou o
 * registro salvo pelo cliente no banco.
 */
export function BioCommerceLanding(props: {
  data: BioCommerceLandingData;
  slug: string;
  blockData?: BioCommerceBlockData;
  embedded?: boolean;
  interactive?: boolean;
}) {
  const data = useMemo(() => ({
    ...props.data,
    links: (props.data.links ?? []).map((link: any) => {
      const kind = runtimeKind(link);
      return kind && kind !== link.kind ? { ...link, kind } : link;
    }),
  }), [props.data]);

  return <BioCommerceLandingV9 {...props} data={data as BioCommerceLandingData} />;
}
