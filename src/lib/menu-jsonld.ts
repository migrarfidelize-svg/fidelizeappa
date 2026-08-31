// Builder puro de JSON-LD do cardápio. Client + server safe.
// Reutilizado em `/cardapio/$slug` e no painel admin de validação.

const ABS_HOST = "https://afidelize.app";

export type MenuJsonLdInput = {
  loaderData: any;
  url: string;
  name: string;
  description: string;
  absImage: string | null;
};

export function buildMenuJsonLd({ loaderData, url, name, description, absImage }: MenuJsonLdInput) {
  const est = loaderData.establishment ?? {};
  const menu = loaderData.menu;
  const cats: any[] = loaderData.categories ?? [];
  const items: any[] = loaderData.items ?? [];

  const abs = (u: string | null | undefined) =>
    !u ? undefined : u.startsWith("http") ? u : `${ABS_HOST}${u}`;

  const itemToNode = (it: any) => {
    const price = it.promo_price ?? it.price;
    return {
      "@type": "MenuItem",
      name: it.name,
      ...(it.short_desc || it.long_desc ? { description: it.short_desc || it.long_desc } : {}),
      ...(abs(it.image_url) ? { image: abs(it.image_url) } : {}),
      ...(price != null
        ? {
            offers: {
              "@type": "Offer",
              price: Number(price).toFixed(2),
              priceCurrency: it.currency || "BRL",
              availability:
                it.active === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
              url,
            },
          }
        : {}),
      ...(Array.isArray(it.allergens) && it.allergens.length
        ? { suitableForDiet: it.allergens }
        : {}),
    };
  };

  const sections = cats.map((c) => ({
    "@type": "MenuSection",
    name: c.name,
    ...(c.description ? { description: c.description } : {}),
    hasMenuItem: items.filter((i) => i.category_id === c.id).map(itemToNode),
  }));
  const uncategorized = items.filter((i) => !i.category_id).map(itemToNode);
  if (uncategorized.length) {
    sections.push({ "@type": "MenuSection", name: "Outros", hasMenuItem: uncategorized } as any);
  }

  const menuNode = {
    "@type": "Menu",
    name: menu?.display_name || `Cardápio de ${name}`,
    ...(sections.length ? { hasMenuSection: sections } : {}),
  };

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name,
    description,
    url,
    ...(abs(est.cover_url || est.logo_url) ? { image: abs(est.cover_url || est.logo_url) } : {}),
    ...(est.phone ? { telephone: est.phone } : {}),
    ...(est.address
      ? { address: { "@type": "PostalAddress", streetAddress: est.address } }
      : {}),
    ...(est.instagram ? { sameAs: [est.instagram].filter(Boolean) } : {}),
    servesCuisine: est.cuisine || undefined,
    hasMenu: menuNode,
  };
}
