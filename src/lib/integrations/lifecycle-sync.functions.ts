import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Informa se a assinatura da empresa veio de um parceiro (ex.: Ronnei) e, portanto,
 * se a alteração de plano dentro da Fidelize encerra a assinatura original.
 */
export const getSubscriptionOriginNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("establishment_members")
      .select("role")
      .eq("establishment_id", data.establishment_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) return { source: null, migrated: false, partner_label: null, notice: null };

    const { getProvisionOrigin } = await import("./lifecycle-sync.server");
    const info = await getProvisionOrigin(data.establishment_id);
    const label = info.source?.toLowerCase() === "ronnei" ? "Ronnei" : null;

    return {
      source: info.source,
      migrated: info.migrated,
      partner_label: label,
      notice: label
        ? `Sua assinatura foi contratada pelo ${label}. Ao alterar ou cancelar o plano aqui, a assinatura original no ${label} será encerrada automaticamente e a cobrança recorrente de lá deixa de existir — a partir daí a Fidelize passa a ser responsável pela sua assinatura.`
        : null,
    };
  });
