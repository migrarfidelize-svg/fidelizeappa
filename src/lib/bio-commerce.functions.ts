import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertActiveSubscription } from "@/lib/subscription-guard";

const AdvancedThemeInput = z.object({
  preset_id: z.string().trim().max(60).optional(),
  layout: z.enum(["classic", "commerce", "editorial", "bento"]).optional(),
  hero_style: z.enum(["brand", "immersive", "minimal", "split"]).optional(),
  card_style: z.enum(["elevated", "glass", "outline", "soft"]).optional(),
  background_effect: z.enum(["solid", "ambient", "aurora", "mesh", "soft-glow"]).optional(),
  font_style: z.enum(["modern", "editorial", "bold", "clean"]).optional(),
  content_width: z.enum(["compact", "comfortable", "wide"]).optional(),
  motion: z.enum(["none", "smooth"]).optional(),
  motion_intensity: z.enum(["low", "medium", "high"]).optional(),
  product_style: z.enum(["carousel", "grid", "editorial"]).optional(),
  social_style: z.enum(["icons", "buttons", "compact"]).optional(),
}).partial();

export const saveBioCommerceTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      establishment_id: z.string().uuid(),
      theme: AdvancedThemeInput,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertActiveSubscription(context.supabase, data.establishment_id);

    const { data: page, error: readError } = await context.supabase
      .from("link_tree_pages")
      .select("id, theme")
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!page) throw new Error("BIO_COMMERCE_PAGE_NOT_FOUND");

    const current = ((page.theme ?? {}) as Record<string, unknown>);
    const nextTheme = { ...current, ...data.theme };

    const { error: updateError } = await context.supabase
      .from("link_tree_pages")
      .update({ theme: nextTheme as any })
      .eq("id", page.id);

    if (updateError) throw new Error(updateError.message);
    return { ok: true, theme: nextTheme };
  });
