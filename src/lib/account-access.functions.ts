import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAuthenticatedAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { data: adminRole, error: adminRoleError },
      { data: profile, error: profileError },
      { data: membership, error: membershipError },
    ] = await Promise.all([
      supabaseAdmin
        .from("app_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("account_type")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("establishment_members")
        .select("id")
        .eq("user_id", userId)
        .eq("active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    if (adminRoleError || profileError || membershipError) {
      console.error("[account-access] falha ao resolver acesso autoritativo", {
        adminRoleError: adminRoleError?.message ?? null,
        profileError: profileError?.message ?? null,
        membershipError: membershipError?.message ?? null,
      });
      throw new Error("ACCOUNT_ACCESS_LOOKUP_FAILED");
    }

    const isSuperAdmin = adminRole?.role === "super_admin";
    const hasEstablishment = Boolean(membership);
    const declaredAccountType = profile?.account_type;

    // profiles.account_type é a identidade principal da conta e, portanto,
    // define a superfície padrão. establishment_members é autorização/vínculo
    // e não deve transformar silenciosamente um cliente em lojista.
    // Se o perfil estiver ausente (legado), o vínculo ativo é usado como fallback.
    const accountType: "super_admin" | "establishment" | "customer" = isSuperAdmin
      ? "super_admin"
      : declaredAccountType === "establishment"
        ? "establishment"
        : declaredAccountType === "customer"
          ? "customer"
          : hasEstablishment
            ? "establishment"
            : "customer";

    return {
      userId,
      isSuperAdmin,
      accountType,
      hasEstablishment,
    };
  });
