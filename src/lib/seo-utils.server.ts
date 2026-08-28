import { getSeoConfig, type SeoConfig } from "./seo.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type RouteSeo = SeoConfig["routes"][string];

type ResolvedRoute = {
  data: RouteSeo;
  pattern: string | null;
  exact: boolean;
};

type DynamicSeo = {
  title?: string;
  description?: string;
  image?: string;
  noindex?: boolean;
};

function resolveRouteSeo(
  routes: SeoConfig["routes"],
  pathname: string
): ResolvedRoute {
  if (routes[pathname]) {
    return {
      data: routes[pathname],
      pattern: pathname,
      exact: true,
    };
  }

  let bestMatch: RouteSeo | null = null;
  let bestPattern: string | null = null;
  let bestLength = -1;

  for (const [pattern, value] of Object.entries(routes)) {
    if (!pattern.endsWith("/*")) continue;

    const prefix = pattern.slice(0, -2);

    if (
      (pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
      prefix.length > bestLength
    ) {
      bestMatch = value;
      bestPattern = pattern;
      bestLength = prefix.length;
    }
  }

  return {
    data: bestMatch || {},
    pattern: bestPattern,
    exact: false,
  };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeBaseUrl(siteUrl: string) {
  return siteUrl.replace(/\/+$/, "");
}

function absoluteUrl(baseUrl: string, value?: string | null) {
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${baseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
}

async function getDynamicSeo(
  pathname: string,
  config: SeoConfig
): Promise<DynamicSeo | null> {
  try {
    return await getDynamicSeoUnsafe(pathname, config);
  } catch (e) {
    console.error("[getDynamicSeo] Error:", e);
    return null;
  }
}

async function getDynamicSeoUnsafe(
  pathname: string,
  config: SeoConfig
): Promise<DynamicSeo | null> {
  const platform = config.platformName || "Afidelize";

  // ==================================================
  // /cardapio/$slug
  // ==================================================

  const menuMatch = pathname.match(/^\/cardapio\/([^/]+)\/?$/);

  if (menuMatch) {
    const slug = safeDecode(menuMatch[1]);

    if (!supabaseAdmin) return { noindex: true };

    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "get_public_catalogo_v2",
      {
        p_slug: slug,
        p_kind: "menu",
      }
    );

    if (error || !result?.establishment || !result?.menu) {
      return {
        noindex: true,
      };
    }

    const est = result.establishment;
    const menu = result.menu;

    const establishmentName =
      typeof est.name === "string" && est.name.trim()
        ? est.name.trim()
        : platform;

    const menuName =
      typeof menu.display_name === "string"
        ? menu.display_name.trim()
        : "";

    const title =
      menuName &&
      menuName.toLocaleLowerCase("pt-BR") !==
        establishmentName.toLocaleLowerCase("pt-BR")
        ? `${menuName} | ${establishmentName} | Cardápio | ${platform}`
        : `${establishmentName} | Cardápio | ${platform}`;

    const description =
      (typeof menu.tagline === "string" && menu.tagline.trim()) ||
      (typeof est.description === "string" &&
        est.description.trim()) ||
      `Veja o cardápio digital de ${establishmentName}.`;

    return {
      title,
      description,
      image: est.cover_url || est.logo_url || undefined,
    };
  }

  // ==================================================
  // /catalogo/$slug
  // ==================================================

  const catalogMatch = pathname.match(/^\/catalogo\/([^/]+)\/?$/);

  if (catalogMatch) {
    const slug = safeDecode(catalogMatch[1]);

    const { data: result, error } = await (supabaseAdmin as any).rpc(
      "get_public_catalogo_v2",
      {
        p_slug: slug,
        p_kind: "catalog",
      }
    );

    if (error || !result?.establishment || !result?.menu) {
      return {
        noindex: true,
      };
    }

    const est = result.establishment;

    const establishmentName =
      typeof est.name === "string" && est.name.trim()
        ? est.name.trim()
        : platform;

    const description =
      (typeof est.description === "string" &&
        est.description.trim()) ||
      `Confira o catálogo de ${establishmentName}.`;

    return {
      title: `${establishmentName} | Catálogo | ${platform}`,
      description,
      image: est.cover_url || est.logo_url || undefined,
    };
  }

  // ==================================================
  // /e/$slug
  // ==================================================

  const establishmentMatch = pathname.match(/^\/e\/([^/]+)\/?$/);

  if (establishmentMatch) {
    const slug = safeDecode(establishmentMatch[1]);

    if (!supabaseAdmin) return { noindex: true };

    const { data: est, error } = await (supabaseAdmin as any)
      .from("establishments")
      .select(
        "id,name,slug,description,logo_url,cover_url,active"
      )
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();

    if (error || !est) {
      return {
        noindex: true,
      };
    }

    const establishmentName =
      typeof est.name === "string" && est.name.trim()
        ? est.name.trim()
        : platform;

    const description =
      (typeof est.description === "string" &&
        est.description.trim()) ||
      `Conheça ${establishmentName} no ${platform}.`;

    return {
      title: `${establishmentName} | Descobrir | ${platform}`,
      description,
      image: est.cover_url || est.logo_url || undefined,
    };
  }

  // ==================================================
  // /avaliar/$slug
  // ==================================================

  const reviewMatch = pathname.match(/^\/avaliar\/([^/]+)\/?$/);

  if (reviewMatch) {
    const slug = safeDecode(reviewMatch[1]);

    if (!supabaseAdmin) return { noindex: true };

    const { data: est, error } = await (supabaseAdmin as any)
      .from("establishments")
      .select(
        "id,name,slug,description,logo_url,active"
      )
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();

    if (error || !est) {
      return {
        noindex: true,
      };
    }

    // Só considera a página de avaliação realmente disponível
    // quando existe formulário ativo.
    if (!supabaseAdmin) return { noindex: true };

    const { data: form } = await (supabaseAdmin as any)
      .from("review_forms")
      .select("id")
      .eq("establishment_id", est.id)
      .eq("active", true)
      .maybeSingle();

    if (!form) {
      return {
        noindex: true,
      };
    }

    const establishmentName =
      typeof est.name === "string" && est.name.trim()
        ? est.name.trim()
        : platform;

    return {
      title: `${establishmentName} | Avaliar | ${platform}`,
      description:
        `Dê sua opinião sobre ${establishmentName}. ` +
        "Sua avaliação é muito importante para nós.",
      image: est.logo_url || undefined,
    };
  }

  return null;
}

export async function getSeoMetadata(pathname: string) {
  const config = await getSeoConfig();

  const resolved = resolveRouteSeo(
    config.routes,
    pathname
  );

  const routeData = resolved.data;

  const dynamicSeo = await getDynamicSeo(
    pathname,
    config
  );

  // Uma configuração EXATA criada pelo Super Admin
  // pode sobrescrever o título/description.
  //
  // Wildcard funciona como fallback.
  const title =
    (resolved.exact && routeData.title) ||
    dynamicSeo?.title ||
    routeData.title ||
    config.defaultTitle;

  const description =
    (resolved.exact && routeData.description) ||
    dynamicSeo?.description ||
    routeData.description ||
    config.defaultDescription;

  const isSensitivePrefix =
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/hash" ||
    pathname.startsWith("/hash/") ||
    pathname === "/carteira" ||
    pathname.startsWith("/carteira/");

  const noindex = Boolean(
    routeData.noindex ||
    dynamicSeo?.noindex ||
    isSensitivePrefix
  );

  const baseUrl = normalizeBaseUrl(config.siteUrl);

  // Canonical configurado só é usado diretamente para match exato.
  //
  // Não utilizar "/cardapio/*" como canonical real.
  const canonical =
    resolved.exact && routeData.canonical
      ? routeData.canonical
      : `${baseUrl}${pathname === "/" ? "/" : pathname}`;

  const faviconUrl =
    config.faviconUrl || "/favicon.ico";

  const appleTouchIconUrl =
    config.appleTouchIconUrl ||
    config.faviconUrl ||
    "/apple-touch-icon.png";

  const socialImage =
    absoluteUrl(
      baseUrl,
      dynamicSeo?.image || config.socialImageUrl
    );

  const meta: any[] = [
    {
      name: "description",
      content: description,
    },
    {
      name: "robots",
      content: noindex
        ? "noindex, nofollow, noarchive, nosnippet"
        : "index, follow",
    },
    {
      property: "og:title",
      content: title,
    },
    {
      property: "og:description",
      content: description,
    },
    {
      property: "og:url",
      content: canonical,
    },
    {
      property: "og:type",
      content: "website",
    },
    {
      property: "og:site_name",
      content: config.platformName,
    },
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: title,
    },
    {
      name: "twitter:description",
      content: description,
    },
    {
      name: "theme-color",
      content: config.themeColor,
    },
    {
      name: "apple-mobile-web-app-title",
      content: config.shortName,
    },
  ];

  if (socialImage) {
    meta.push(
      {
        property: "og:image",
        content: socialImage,
      },
      {
        name: "twitter:image",
        content: socialImage,
      }
    );
  }

  return {
    title,
    meta,
    links: [
      {
        rel: "canonical",
        href: canonical,
      },
      {
        rel: "icon",
        href: faviconUrl,
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: appleTouchIconUrl,
      },
      {
        rel: "manifest",
        href: "/api/public/manifest",
      },
    ],
  };
}
