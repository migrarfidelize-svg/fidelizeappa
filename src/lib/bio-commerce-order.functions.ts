import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const lineSchema = z.object({
  item_id: z.string().uuid(),
  qty: z.number().int().min(1).max(99),
  variant_label: z.string().trim().max(80).optional().nullable(),
});

const orderSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z.string().trim().max(30).optional().nullable(),
  fulfillment: z.enum(["pickup", "delivery"]).default("pickup"),
  address: z.string().trim().max(240).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  items: z.array(lineSchema).min(1).max(60),
});

async function resolveEstablishmentId(slug: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalized = slug.trim().toLowerCase();

  const { data: page } = await (supabaseAdmin as any)
    .from("link_tree_pages")
    .select("establishment_id")
    .eq("public_slug", normalized)
    .maybeSingle();

  if (page?.establishment_id) return String(page.establishment_id);

  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("id")
    .eq("slug", normalized)
    .eq("active", true)
    .maybeSingle();

  return est?.id ?? null;
}

/**
 * Checkout público do Bio Commerce.
 *
 * Aceita itens vindos do Cardápio Digital e/ou do Catálogo Digital no mesmo
 * carrinho. Preço, disponibilidade e variações são recalculados no servidor;
 * o navegador nunca decide o valor final do pedido.
 */
export const createBioCommerceOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => orderSchema.parse(input))
  .handler(async ({ data }) => {
    const establishmentId = await resolveEstablishmentId(data.slug);
    if (!establishmentId) throw new Error("Loja não encontrada");

    const s = publicClient();
    const { data: establishment } = await s
      .from("establishments")
      .select("id, name, whatsapp, phone, active")
      .eq("id", establishmentId)
      .eq("active", true)
      .maybeSingle();

    if (!establishment) throw new Error("Loja indisponível");

    const { data: menus } = await s
      .from("restaurant_menus")
      .select("id, kind")
      .eq("establishment_id", establishmentId)
      .eq("status", "published")
      .in("kind", ["menu", "catalog"] as any);

    const menuRows = menus ?? [];
    const menuIds = menuRows.map((row: any) => row.id);
    if (!menuIds.length) throw new Error("A loja ainda não publicou produtos para pedido");

    const requestedIds = [...new Set(data.items.map((line) => line.item_id))];
    const { data: dbItems, error: itemsError } = await s
      .from("menu_items")
      .select("id, menu_id, name, sku, price, promo_price, currency, variants, active, stock_status, track_stock, stock_qty")
      .eq("establishment_id", establishmentId)
      .eq("active", true)
      .in("menu_id", menuIds)
      .in("id", requestedIds);

    if (itemsError) throw new Error("Não foi possível validar os produtos");

    const menuKind = new Map(menuRows.map((row: any) => [String(row.id), row.kind as "menu" | "catalog"]));
    const byId = new Map((dbItems ?? []).map((item: any) => [String(item.id), item]));

    const lines = data.items.map((requested) => {
      const item: any = byId.get(requested.item_id);
      if (!item) throw new Error("Um dos produtos não está mais disponível");
      if (item.stock_status === "out_of_stock") throw new Error(`${item.name} está esgotado`);
      if (item.track_stock && item.stock_qty != null && Number(item.stock_qty) < requested.qty) {
        throw new Error(`Quantidade indisponível para ${item.name}`);
      }

      const variants = Array.isArray(item.variants) ? item.variants : [];
      let variantLabel = requested.variant_label ?? null;
      let unit = Number(item.promo_price ?? item.price ?? 0);

      if (variants.length > 0) {
        if (!variantLabel) throw new Error(`Escolha uma variação para ${item.name}`);
        const variant = variants.find((candidate: any) => String(candidate?.label ?? "") === variantLabel);
        if (!variant) throw new Error(`Variação indisponível para ${item.name}`);
        if (variant?.price != null) unit = Number(variant.price);
      } else {
        variantLabel = null;
      }

      if (!Number.isFinite(unit) || unit < 0) throw new Error(`Preço inválido para ${item.name}`);

      return {
        item_id: item.id as string,
        menu_id: item.menu_id as string,
        source_kind: menuKind.get(String(item.menu_id)) ?? "catalog",
        name: item.name as string,
        sku: (item.sku as string | null) ?? null,
        variant_label: variantLabel,
        unit_price: Number(unit.toFixed(2)),
        qty: requested.qty,
        line_total: Number((unit * requested.qty).toFixed(2)),
        currency: (item.currency as string | null) ?? "BRL",
      };
    });

    const total = Number(lines.reduce((sum, line) => sum + line.line_total, 0).toFixed(2));
    const currency = lines[0]?.currency ?? "BRL";
    const usedMenuIds = [...new Set(lines.map((line) => line.menu_id))];
    const kinds = [...new Set(lines.map((line) => line.source_kind))];
    const orderKind: "menu" | "catalog" = kinds.includes("menu") ? "menu" : "catalog";
    const menuId = usedMenuIds.length === 1 ? usedMenuIds[0] : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error: orderError } = await (supabaseAdmin as any)
      .from("orders")
      .insert({
        establishment_id: establishmentId,
        menu_id: menuId,
        kind: orderKind,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone || null,
        fulfillment: data.fulfillment,
        address: data.fulfillment === "delivery" ? data.address || null : null,
        note: data.note || null,
        items_total: total,
        total,
        currency,
        source: "bio_commerce",
      })
      .select("id, order_number, total, currency")
      .single();

    if (orderError || !order) throw new Error(orderError?.message ?? "Não foi possível registrar o pedido");

    const { error: lineError } = await (supabaseAdmin as any)
      .from("order_items")
      .insert(
        lines.map((line) => ({
          order_id: order.id,
          item_id: line.item_id,
          name: line.name,
          sku: line.sku,
          variant_label: line.variant_label,
          unit_price: line.unit_price,
          qty: line.qty,
          line_total: line.line_total,
        })),
      );

    if (lineError) {
      await (supabaseAdmin as any).from("orders").delete().eq("id", order.id);
      throw new Error(lineError.message);
    }

    return {
      order_id: order.id as string,
      order_number: Number(order.order_number),
      total,
      currency,
      lines: lines.map(({ menu_id: _menuId, source_kind: _sourceKind, currency: _currency, ...line }) => line),
      establishment: {
        name: establishment.name,
        whatsapp: establishment.whatsapp,
        phone: establishment.phone,
      },
    };
  });
