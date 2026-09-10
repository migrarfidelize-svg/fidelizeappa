import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

export type PublicLandingErrorCode = "NOT_FOUND" | "INACTIVE" | "UNPUBLISHED" | "DATABASE_ERROR";

export class PublicLandingError extends Error {
  constructor(public readonly code: PublicLandingErrorCode) {
    super(code);
    this.name = "PublicLandingError";
  }
}

export type PublicLandingDTO = {
  establishment: {
    name: string;
    slug: string;
    logo_url: string | null;
    cover_url: string | null;
    primary_color: string;
    accent_color: string;
    description: string | null;
    updated_at: string;
  };
  page: {
    id: string;
    title: string | null;
    description: string | null;
    theme: Json;
    logo_url: string | null;
    cover_url: string | null;
    updated_at: string;
  };
  links: Array<{
    id: string;
    label: string;
    url: string;
    kind: string;
    sort_order: number;
    data: Json;
  }>;
};

export const getPublicLandingBySlug = async (slug: string): Promise<PublicLandingDTO> => {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    throw new PublicLandingError("NOT_FOUND");
  }

  // Primeiro tenta o slug público específico da Árvore.
  const { data: customPage, error: customPageError } = await (supabaseAdmin as any)
    .from("link_tree_pages")
    .select("id, establishment_id, title, description, theme, logo_url, cover_url, updated_at, published")
    .eq("public_slug", normalizedSlug)
    .maybeSingle();

  if (customPageError) {
    console.error("[getPublicLandingBySlug] public_slug lookup error:", customPageError);
    throw new PublicLandingError("DATABASE_ERROR");
  }

  let establishment: any = null;
  let page: any = customPage ?? null;

  if (customPage?.establishment_id) {
    const { data, error } = await supabaseAdmin
      .from("establishments")
      .select(
        "id, slug, name, logo_url, cover_url, primary_color, accent_color, active, description, updated_at",
      )
      .eq("id", customPage.establishment_id)
      .maybeSingle();

    if (error) {
      console.error("[getPublicLandingBySlug] establishment lookup error:", error);
      throw new PublicLandingError("DATABASE_ERROR");
    }
    establishment = data;
  } else {
    // Compatibilidade: mantém /links/{slug-antigo-do-estabelecimento}.
    const { data, error } = await supabaseAdmin
      .from("establishments")
      .select(
        "id, slug, name, logo_url, cover_url, primary_color, accent_color, active, description, updated_at",
      )
      .eq("slug", normalizedSlug)
      .maybeSingle();

    if (error) {
      console.error("[getPublicLandingBySlug] legacy establishment lookup error:", error);
      throw new PublicLandingError("DATABASE_ERROR");
    }
    establishment = data;

    if (establishment) {
      const { data: legacyPage, error: legacyPageError } = await (supabaseAdmin as any)
        .from("link_tree_pages")
        .select("id, establishment_id, title, description, theme, logo_url, cover_url, updated_at, published")
        .eq("establishment_id", establishment.id)
        .maybeSingle();

      if (legacyPageError) {
        console.error("[getPublicLandingBySlug] legacy page lookup error:", legacyPageError);
        throw new PublicLandingError("DATABASE_ERROR");
      }
      page = legacyPage;
    }
  }

  if (!establishment) throw new PublicLandingError("NOT_FOUND");
  if (establishment.active !== true) throw new PublicLandingError("INACTIVE");
  if (!page || page.published !== true) throw new PublicLandingError("UNPUBLISHED");

  // 3. Buscar links ativos
  const { data: links, error: linksError } = await supabaseAdmin
    .from("link_tree_links")
    .select("id, label, url, kind, sort_order, enabled, data")
    .eq("page_id", page.id)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });

  if (linksError) {
    console.error("[getPublicLandingBySlug] links lookup error:", linksError);
    throw new PublicLandingError("DATABASE_ERROR");
  }

  // 4. DTO Seguro
  return {
    establishment: {
      name: establishment.name,
      slug: establishment.slug,
      logo_url: establishment.logo_url,
      cover_url: establishment.cover_url,
      primary_color: establishment.primary_color || "#0ea5e9",
      accent_color: establishment.accent_color || "#8b5cf6",
      description: establishment.description,
      updated_at: establishment.updated_at,
    },
    page: {
      id: page.id,
      title: page.title,
      description: page.description,
      theme: page.theme,
      logo_url: page.logo_url,
      cover_url: page.cover_url,
      updated_at: page.updated_at,
    },
    links: (links || []).map((l) => ({
      id: l.id,
      label: l.label,
      url: l.url,
      kind: l.kind,
      sort_order: l.sort_order,
      data: l.data,
    })),
  };
};
