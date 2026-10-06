import { useMemo } from "react";
import {
  BioCommerceLanding as BioCommerceLandingV8,
  type BioCommerceBlockData,
  type BioCommerceLandingData,
  type BioCommerceProduct,
  type BioCommerceReview,
} from "./BioCommerceLandingV8";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

function normalizeFallback(kind: string, rawValue: unknown) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("mailto:") || raw.startsWith("tel:")) return raw;
  if (kind === "instagram") return `https://instagram.com/${raw.replace(/^@/, "")}`;
  if (kind === "tiktok") return `https://tiktok.com/@${raw.replace(/^@/, "")}`;
  if (kind === "facebook") return raw.includes(".") ? `https://${raw}` : `https://facebook.com/${raw.replace(/^@/, "")}`;
  if (kind === "youtube") return raw.includes(".") ? `https://${raw}` : raw;
  if (kind === "whatsapp" || kind === "phone") return raw;
  return raw.includes(".") ? `https://${raw}` : raw;
}

/**
 * Adapta dados legados para o renderer V8 sem alterar o que o lojista cadastrou.
 * Links manuais sempre vencem. Dados do perfil só entram quando aquele canal
 * ainda não existe na Bio Commerce.
 */
export function BioCommerceLanding(props: {
  data: BioCommerceLandingData;
  slug: string;
  blockData?: BioCommerceBlockData;
  embedded?: boolean;
  interactive?: boolean;
}) {
  const adapted = useMemo(() => {
    const establishment = props.data.establishment ?? {};
    const current = [...(props.data.links ?? [])];
    const existingKinds = new Set(current.map((link: any) => String(link?.kind ?? "")));
    const inherited: any[] = [];

    const add = (kind: string, label: string, value: unknown) => {
      if (existingKinds.has(kind)) return;
      const url = normalizeFallback(kind, value);
      if (!url) return;
      inherited.push({
        kind,
        label,
        url,
        enabled: true,
        sort_order: current.length + inherited.length,
        data: { presentation: "atalho", inherited_from: "establishment" },
      });
      existingKinds.add(kind);
    };

    add("whatsapp", "WhatsApp", establishment.whatsapp);
    add("phone", "Telefone", establishment.phone);
    add("instagram", "Instagram", establishment.instagram);
    add("facebook", "Facebook", establishment.facebook);
    add("tiktok", "TikTok", establishment.tiktok);
    add("youtube", "YouTube", establishment.youtube);
    add("site", "Site", establishment.website);
    add("maps", "Como chegar", establishment.google_maps_url);

    return { ...props.data, links: [...current, ...inherited] };
  }, [props.data]);

  return <BioCommerceLandingV8 {...props} data={adapted} />;
}
