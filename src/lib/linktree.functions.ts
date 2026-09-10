import { assertActiveSubscription } from "@/lib/subscription-guard";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { hasFeature } from "@/lib/plans.functions";

const RESERVED_PUBLIC_SLUGS = new Set(["app", "admin", "api", "auth", "hash", "links", "ajuda", "acesso", "onboarding", "carteira", "cardapio", "cartao", "catalogo", "checkout", "q", "qr", "review", "reviews", "avaliacao", "avaliacoes", "login", "logout", "planos", "termos", "privacidade", "suporte", "webhooks", "assets", "favicon", "robots", "sitemap", "manifest", "preview-crm"]);

function normalizePublicSlug(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function validatePublicSlug(value: string) {
  const slug = normalizePublicSlug(value);
  if (slug.length < 3 || slug.length > 60) {
    throw new Error("O link personalizado deve ter entre 3 e 60 caracteres.");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Use apenas letras, números e hífen no link personalizado.");
  }
  if (RESERVED_PUBLIC_SLUGS.has(slug)) {
    throw new Error("Este endereço é reservado pela Fidelize. Escolha outro.");
  }
  return slug;
}

const LinkKind = z.enum([
  "whatsapp", "instagram", "facebook", "tiktok", "youtube",
  "site", "google", "maps", "email", "phone", "wifi", "pix", "cardapio", "cartao", "custom",
  // Blocos ricos
  "video", "spotify", "gallery", "menu_carousel", "reviews", "header_image",
]);


const LinkInput = z.object({
  id: z.string().uuid().optional(),
  kind: LinkKind,
  label: z.string().trim().min(1).max(80),
  // Blocos ricos podem ter url vazia (a config vive em `data`).
  url: z.string().trim().max(500).default(""),
  icon: z.string().trim().max(40).nullable().optional(),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().nonnegative(),
  data: z.record(z.string(), z.any()).optional().default({}),
});

const ThemeInput = z.object({
  primary: z.string().max(20).optional(),
  accent: z.string().max(20).optional(),
  background: z.string().max(20).optional(),
  text: z.string().max(20).optional(),
  button_style: z.enum(["solid", "outline", "glass"]).optional(),
  rounded: z.enum(["sm", "md", "lg", "xl", "full"]).optional(),
}).partial();

const SocialInput = z.object({
  instagram: z.string().max(120).optional().nullable(),
  facebook: z.string().max(200).optional().nullable(),
  tiktok: z.string().max(120).optional().nullable(),
  youtube: z.string().max(200).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  site: z.string().max(200).optional().nullable(),
  google: z.string().max(300).optional().nullable(),
  maps: z.string().max(300).optional().nullable(),
}).partial();

// ---------- Merchant: get my linktree page ----------
export const getMyLinkTree = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishment_id: string }) =>
    z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: page } = await context.supabase
      .from("link_tree_pages")
      .select("*")
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (!page) return { page: null, links: [] as any[] };
    const { data: links } = await context.supabase
      .from("link_tree_links")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order", { ascending: true });
    return { page, links: links ?? [] };
  });

// ---------- Merchant: upsert page + replace links ----------
export const upsertLinkTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    public_slug: z.string().trim().min(3).max(60).optional(),
    title: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    // Aceita URLs longas e data-URLs base64 do recorte de logo.
    logo_url: z.string().trim().max(2_500_000).nullable().optional(),
    cover_url: z.string().trim().max(2_500_000).nullable().optional(),
    theme: ThemeInput.default({}),
    social: SocialInput.default({}),
    links: z.array(LinkInput).max(50),
    published: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertActiveSubscription(context.supabase, (data as any).establishment_id);

    const publicSlug = validatePublicSlug(
      data.public_slug || String((data as any).establishment_id),
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: slugOwner, error: slugCheckError } = await (supabaseAdmin as any)
      .from("link_tree_pages")
      .select("id, establishment_id")
      .eq("public_slug", publicSlug)
      .neq("establishment_id", data.establishment_id)
      .maybeSingle();

    if (slugCheckError) throw new Error(slugCheckError.message);
    if (slugOwner) {
      throw new Error("Este link personalizado já está em uso. Escolha outro.");
    }

    const patch: Database["public"]["Tables"]["link_tree_pages"]["Insert"] = {
      establishment_id: data.establishment_id,
      title: data.title ?? null,
      description: data.description ?? null,
      logo_url: data.logo_url ?? null,
      cover_url: data.cover_url ?? null,
      theme: data.theme,
      social: data.social,
    };
    (patch as any).public_slug = publicSlug;

    if (typeof data.published === "boolean") {
      patch.published = data.published;
      if (data.published) patch.published_at = new Date().toISOString();
    }
    const { data: page, error } = await context.supabase
      .from("link_tree_pages")
      .upsert(patch, { onConflict: "establishment_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);


    // Replace links: delete all then insert
    await context.supabase.from("link_tree_links").delete().eq("page_id", page.id);
    if (data.links.length > 0) {
      const rows = data.links.map((l, i) => ({
        page_id: page.id,
        kind: l.kind,
        label: l.label,
        url: l.url,
        icon: l.icon ?? null,
        enabled: l.enabled,
        sort_order: l.sort_order ?? i,
        data: (l.data ?? {}) as any,
      }));
      const { error: e2 } = await context.supabase.from("link_tree_links").insert(rows);
      if (e2) throw new Error(e2.message);
    }
    return {
      ok: true,
      page_id: page.id,
      published: page.published,
      public_slug: (page as any).public_slug ?? publicSlug,
    };
  });

// ---------- Merchant: set QR destination on the establishment ----------
export const setQrDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    destination: z.enum(["reviews", "linktree", "landing", "menu", "catalog"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Cardápio digital é um recurso do plano: só pode virar destino do QR
    // quando estiver habilitado e com uma vitrine publicada.
    if (data.destination === "menu" || data.destination === "catalog") {
      const isCatalog = data.destination === "catalog";
      const label = isCatalog ? "Catálogo digital" : "Cardápio digital";
      const allowed = await hasFeature(
        context.supabase,
        data.establishment_id,
        isCatalog ? "digital_catalog" : "digital_menu",
      );
      if (!allowed) {
        throw new Error(`O ${label} não está incluído no seu plano atual.`);
      }
      const { data: menu } = await context.supabase
        .from("restaurant_menus")
        .select("status")
        .eq("establishment_id", data.establishment_id)
        .eq("kind", isCatalog ? "catalog" : "menu")
        .maybeSingle();
      if (menu?.status !== "published") {
        throw new Error(
          `Publique seu ${isCatalog ? "catálogo" : "cardápio"} antes de apontar o QR para ele.`,
        );
      }
    }
    const { error } = await context.supabase
      .from("establishments")
      .update({ qr_destination: data.destination })
      .eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getQrDestinationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishment_id: string }) =>
    z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: est } = await context.supabase
      .from("establishments")
      .select("qr_destination, slug")
      .eq("id", data.establishment_id)
      .maybeSingle();
    const { data: page } = await context.supabase
      .from("link_tree_pages")
      .select("published")
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    const { data: menu } = await context.supabase
      .from("restaurant_menus")
      .select("status")
      .eq("establishment_id", data.establishment_id)
      .eq("kind", "menu")
      .maybeSingle();
    const { data: catalog } = await context.supabase
      .from("restaurant_menus")
      .select("status")
      .eq("establishment_id", data.establishment_id)
      .eq("kind", "catalog")
      .maybeSingle();
    const menuAllowed = await hasFeature(context.supabase, data.establishment_id, "digital_menu");
    const catalogAllowed = await hasFeature(context.supabase, data.establishment_id, "digital_catalog");
    const { data: form } = await context.supabase
      .from("review_forms")
      .select("id")
      .eq("establishment_id", data.establishment_id)
      .eq("active", true)
      .maybeSingle();
    return {
      destination: (est?.qr_destination ?? "reviews") as
        | "reviews" | "linktree" | "landing" | "menu" | "catalog",
      linktree_published: !!page?.published,
      review_form_active: !!form,
      menu_allowed: menuAllowed,
      menu_published: menu?.status === "published",
      catalog_allowed: catalogAllowed,
      catalog_published: catalog?.status === "published",
      slug: est?.slug ?? null,
    };
  });

// ---------- Public: get by slug (only if published) ----------
export const getPublicLinkTreeBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    try {
      const { getPublicLandingBySlug } = await import("./linktree.server");
      return await getPublicLandingBySlug(data.slug);
    } catch (err: any) {
      if (err instanceof Error && err.message === "NOT_FOUND") return null;
      if (err instanceof Error && err.message === "INACTIVE") throw new Error("INACTIVE");
      if (err instanceof Error && err.message === "UNPUBLISHED") throw new Error("UNPUBLISHED");
      console.error("[getPublicLinkTreeBySlug] handler error:", err);
      throw new Error("DATABASE_ERROR");
    }
  });

// ---------- Public: data for rich blocks (menu preview + reviews) ----------
export const getLinkTreeBlockData = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedSlug = String(data.slug ?? "").trim().toLowerCase();

    const { data: customPage } = await (supabaseAdmin as any)
      .from("link_tree_pages")
      .select("establishment_id")
      .eq("public_slug", normalizedSlug)
      .maybeSingle();

    let establishmentId = customPage?.establishment_id ?? null;

    if (!establishmentId) {
      const { data: legacyEst } = await supabaseAdmin
        .from("establishments")
        .select("id")
        .eq("slug", normalizedSlug)
        .eq("active", true)
        .maybeSingle();
      establishmentId = legacyEst?.id ?? null;
    }

    if (!establishmentId) {
      return { menu: [], catalog: [], reviews: [], stats: null };
    }

    // Cardápio publicado
    const { data: menuRow } = await supabaseAdmin
      .from("restaurant_menus")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("kind", "menu")
      .eq("status", "published")
      .maybeSingle();
    const { data: catalogRow } = await supabaseAdmin
      .from("restaurant_menus")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("kind", "catalog")
      .eq("status", "published")
      .maybeSingle();

    const fetchItems = async (menu_id: string) => {
      const { data } = await supabaseAdmin
        .from("menu_items")
        .select("id, name, short_desc, price, promo_price, image_url")
        .eq("menu_id", menu_id)
        .limit(12);
      return data ?? [];
    };
    const menu = menuRow ? await fetchItems(menuRow.id) : [];
    const catalog = catalogRow ? await fetchItems(catalogRow.id) : [];

    // Avaliações públicas (não ocultas) — apenas campos seguros
    const { data: reviewsRaw } = await supabaseAdmin
      .from("customer_reviews")
      .select("id, rating, comment, customer_name, merchant_reply, submitted_at, anonymous")
      .eq("establishment_id", establishmentId)
      .eq("public_hidden", false)
      .order("submitted_at", { ascending: false })
      .limit(20);
    const reviews = (reviewsRaw ?? []).map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      merchant_reply: r.merchant_reply,
      submitted_at: r.submitted_at,
      customer_name: r.anonymous ? "Anônimo" : (r.customer_name ?? "Cliente"),
    }));

    const rated = (reviewsRaw ?? []).filter((r) => typeof r.rating === "number");
    const stats = rated.length
      ? {
          count: rated.length,
          avg: rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length,
        }
      : null;

    return { menu, catalog, reviews, stats };
  });
