import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Dados públicos ricos usados pela Bio Commerce.
 *
 * Além dos produtos, entregamos as categorias publicadas de Cardápio/Catálogo.
 * Isso permite que a landing ofereça navegação real por "Lanches", "Bebidas",
 * coleções etc., sem inventar conteúdo e sem alterar o cadastro do lojista.
 */
export const getBioCommerceRuntimeData = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().trim().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalized = data.slug.toLowerCase();

    const { data: page } = await (supabaseAdmin as any)
      .from("link_tree_pages")
      .select("establishment_id")
      .eq("public_slug", normalized)
      .maybeSingle();

    let establishmentId = page?.establishment_id as string | null | undefined;

    if (!establishmentId) {
      const { data: est } = await supabaseAdmin
        .from("establishments")
        .select("id")
        .eq("slug", normalized)
        .eq("active", true)
        .maybeSingle();
      establishmentId = est?.id ?? null;
    }

    if (!establishmentId) {
      return {
        menu: [],
        catalog: [],
        menu_categories: [],
        catalog_categories: [],
        reviews: [],
        stats: null,
      };
    }

    const { data: menus } = await supabaseAdmin
      .from("restaurant_menus")
      .select("id, kind")
      .eq("establishment_id", establishmentId)
      .eq("status", "published")
      .in("kind", ["menu", "catalog"] as any);

    const rows = menus ?? [];
    const menuId = (rows as any[]).find((row) => row.kind === "menu")?.id ?? null;
    const catalogId = (rows as any[]).find((row) => row.kind === "catalog")?.id ?? null;

    const select = "id, menu_id, category_id, name, short_desc, long_desc, price, promo_price, currency, image_url, video_url, video_poster_url, variants, stock_status, gallery, brand, sku, position";

    const fetchItems = async (id: string | null) => {
      if (!id) return [];
      const { data: items, error } = await supabaseAdmin
        .from("menu_items")
        .select(select)
        .eq("menu_id", id)
        .eq("active", true)
        .order("position", { ascending: true })
        .limit(60);
      if (error) throw new Error(error.message);
      return (items ?? []).map((item: any) => ({
        ...item,
        price: item.price == null ? null : Number(item.price),
        promo_price: item.promo_price == null ? null : Number(item.promo_price),
        variants: Array.isArray(item.variants) ? item.variants : [],
        gallery: Array.isArray(item.gallery) ? item.gallery : [],
      }));
    };

    const fetchCategories = async (id: string | null) => {
      if (!id) return [];
      const { data: categories, error } = await supabaseAdmin
        .from("menu_categories")
        .select("id, name, description, image_url, position")
        .eq("menu_id", id)
        .eq("active", true)
        .order("position", { ascending: true })
        .limit(40);
      if (error) throw new Error(error.message);
      return categories ?? [];
    };

    const [menu, catalog, menuCategories, catalogCategories, reviewsRaw] = await Promise.all([
      fetchItems(menuId),
      fetchItems(catalogId),
      fetchCategories(menuId),
      fetchCategories(catalogId),
      supabaseAdmin
        .from("customer_reviews")
        .select("id, rating, comment, customer_name, merchant_reply, submitted_at, anonymous")
        .eq("establishment_id", establishmentId)
        .eq("public_hidden", false)
        .order("submitted_at", { ascending: false })
        .limit(20)
        .then(({ data: reviews, error }) => {
          if (error) throw new Error(error.message);
          return reviews ?? [];
        }),
    ]);

    const reviews = (reviewsRaw as any[]).map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      merchant_reply: review.merchant_reply,
      submitted_at: review.submitted_at,
      customer_name: review.anonymous ? "Anônimo" : (review.customer_name ?? "Cliente"),
    }));

    const rated = (reviewsRaw as any[]).filter((review) => typeof review.rating === "number");
    const stats = rated.length
      ? {
          count: rated.length,
          avg: rated.reduce((sum, review) => sum + Number(review.rating ?? 0), 0) / rated.length,
        }
      : null;

    return {
      menu,
      catalog,
      menu_categories: menuCategories,
      catalog_categories: catalogCategories,
      reviews,
      stats,
    };
  });
