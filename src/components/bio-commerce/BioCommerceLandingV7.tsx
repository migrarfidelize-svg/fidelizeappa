import { useMemo } from "react";
import {
  BioCommerceLanding as BioCommerceLandingV6,
  type BioCommerceBlockData,
  type BioCommerceLandingData,
  type BioCommerceProduct,
  type BioCommerceReview,
} from "./BioCommerceLandingV6";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

function normalizeFallback(kind: string, rawValue: unknown) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("mailto:") || raw.startsWith("tel:")) return raw;
  if (kind === "instagram") return `https://instagram.com/${raw.replace(/^@/, "")}`;
  if (kind === "tiktok") return `https://tiktok.com/@${raw.replace(/^@/, "")}`;
  if (kind === "facebook") return raw.includes(".") ? `https://${raw}` : `https://facebook.com/${raw.replace(/^@/, "")}`;
  if (kind === "whatsapp") return raw;
  if (kind === "phone") return raw;
  return raw.includes(".") ? `https://${raw}` : raw;
}

/**
 * Camada de integração da Bio Commerce com os dados já cadastrados do lojista.
 *
 * Se uma rede/contato já existe como módulo manual, ela sempre vence. Quando
 * não existe, aproveitamos os dados reais do cadastro da loja para que a
 * landing já nasça completa, sem criar links falsos ou duplicados.
 */
export function BioCommerceLanding(props: {
  data: BioCommerceLandingData;
  slug: string;
  blockData?: BioCommerceBlockData;
  embedded?: boolean;
  interactive?: boolean;
}) {
  const augmentedData = useMemo(() => {
    const establishment = props.data.establishment ?? {};
    const currentLinks = [...(props.data.links ?? [])];
    const existingKinds = new Set(currentLinks.map((link: any) => String(link?.kind ?? "")));
    const synthetic: any[] = [];

    const add = (kind: string, label: string, value: unknown) => {
      if (existingKinds.has(kind)) return;
      const url = normalizeFallback(kind, value);
      if (!url) return;
      synthetic.push({
        id: `merchant-${kind}`,
        kind,
        label,
        url,
        enabled: true,
        sort_order: currentLinks.length + synthetic.length,
        data: { presentation: kind === "whatsapp" || kind === "maps" ? "atalho" : "botao", inherited_from: "establishment" },
      });
      existingKinds.add(kind);
    };

    add("whatsapp", "WhatsApp", establishment.whatsapp);
    add("phone", "Telefone", establishment.phone);
    add("instagram", "Instagram", establishment.instagram);
    add("facebook", "Facebook", establishment.facebook);
    add("tiktok", "TikTok", establishment.tiktok);
    add("site", "Site", establishment.website);
    add("maps", "Como chegar", establishment.google_maps_url);

    return { ...props.data, links: [...currentLinks, ...synthetic] };
  }, [props.data]);

  return <BioCommerceLandingV6 {...props} data={augmentedData} />;
}
