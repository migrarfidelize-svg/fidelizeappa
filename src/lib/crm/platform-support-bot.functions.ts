import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeInbox } from "./inbox.functions";
import { platformSupportMode } from "./platform-support-bot.core";

/** Só o superadministrador pode mudar o atendimento institucional. */
export const setPlatformSupportMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    mode: z.enum(["bot", "ai"]),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const auth = await authorizeInbox(context.supabase, context.userId);
    if (!auth.isSuper) throw new Error("Somente o superadministrador pode alterar o modo de atendimento.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: previous, error: readError } = await supabaseAdmin
      .from("crm_agent_settings")
      .select("establishment_id, config")
      .eq("establishment_id", auth.establishmentId).maybeSingle();
    if (readError) throw new Error("Não foi possível consultar as configurações do suporte.");
    if (!previous) throw new Error("Configuração de atendimento não encontrada.");

    const old = (previous.config ?? {}) as Record<string, unknown>;
    const { error } = await supabaseAdmin.from("crm_agent_settings").update({
      enabled: true,
      config: { ...old, supportMode: data.mode },
      updated_at: new Date().toISOString(),
    }).eq("establishment_id", auth.establishmentId);
    if (error) throw new Error("Não foi possível atualizar o modo de atendimento.");
    return { ok: true, mode: platformSupportMode(data.mode) };
  });
