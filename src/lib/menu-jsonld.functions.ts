import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildMenuJsonLd } from "@/lib/menu-jsonld";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito.");
}

/**
 * Lista todos os cardápios (publicados, rascunho ou pausados) para o painel
 * de validação de JSON-LD.
 */
export const adminListMenusForJsonLd = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: menus, error } = await supabaseAdmin
      .from("restaurant_menus")
      .select("id, establishment_id, status, display_name, updated_at")
      .eq("kind", "menu")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    if (!menus?.length) return [];

    const ids = menus.map((m: any) => m.establishment_id);
    const { data: ests } = await supabaseAdmin
      .from("establishments")
      .select("id, name, slug, active")
      .in("id", ids);
    const map = new Map<string, any>();
    (ests ?? []).forEach((e: any) => map.set(e.id, e));

    const [{ data: catCounts }, { data: itemCounts }] = await Promise.all([
      supabaseAdmin.from("menu_categories").select("menu_id").in("menu_id", menus.map((m: any) => m.id)),
      supabaseAdmin.from("menu_items").select("menu_id").in("menu_id", menus.map((m: any) => m.id)),
    ]);
    const cc = new Map<string, number>();
    (catCounts ?? []).forEach((r: any) => cc.set(r.menu_id, (cc.get(r.menu_id) ?? 0) + 1));
    const ic = new Map<string, number>();
    (itemCounts ?? []).forEach((r: any) => ic.set(r.menu_id, (ic.get(r.menu_id) ?? 0) + 1));

    return menus
      .map((m: any) => {
        const est = map.get(m.establishment_id);
        if (!est) return null;
        return {
          menu_id: m.id,
          slug: est.slug as string,
          establishment_name: est.name as string,
          establishment_active: !!est.active,
          status: m.status as string,
          display_name: m.display_name as string | null,
          updated_at: m.updated_at as string,
          categories: cc.get(m.id) ?? 0,
          items: ic.get(m.id) ?? 0,
        };
      })
      .filter(Boolean);
  });

/**
 * Retorna o JSON-LD renderizado hoje para /cardapio/$slug, independente do
 * status de publicação — assim o admin pode auditar rascunhos e pausados.
 */
export const adminGetMenuJsonLd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: est } = await supabaseAdmin
      .from("establishments")
      .select("id, name, slug, logo_url, cover_url, description, phone, whatsapp, instagram, address, active")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!est) throw new Error("Estabelecimento não encontrado.");

    const { data: menu } = await supabaseAdmin
      .from("restaurant_menus")
      .select("*")
      .eq("establishment_id", est.id)
      .eq("kind", "menu")
      .maybeSingle();

    let categories: any[] = [];
    let items: any[] = [];
    if (menu) {
      const [{ data: cats }, { data: its }] = await Promise.all([
        supabaseAdmin.from("menu_categories").select("*").eq("menu_id", menu.id).order("position", { ascending: true }),
        supabaseAdmin.from("menu_items").select("*").eq("menu_id", menu.id).order("position", { ascending: true }),
      ]);
      categories = cats ?? [];
      items = its ?? [];
    }

    const url = `https://afidelize.app/cardapio/${data.slug}`;
    const name = est.name;
    const description =
      (menu as any)?.tagline ||
      est.description ||
      `Confira o cardápio digital de ${name}: pratos, bebidas, fotos e preços atualizados em tempo real.`;
    const image = est.cover_url || est.logo_url || null;
    const absImage = image
      ? image.startsWith("http")
        ? image
        : `https://afidelize.app${image}`
      : null;

    const jsonLd = buildMenuJsonLd({
      loaderData: { establishment: est, menu, categories, items },
      url,
      name,
      description,
      absImage,
    });

    return {
      jsonLd,
      meta: {
        slug: est.slug,
        establishment_name: est.name,
        establishment_active: !!est.active,
        status: menu?.status ?? "no_menu",
        categories_count: categories.length,
        items_count: items.length,
        public_url: url,
      },
    };
  });
