import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAuthenticatedAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve o tipo de conta no servidor, sem depender de uma segunda RPC
    // autenticada no browser. Isso evita que uma falha transitória do JWT/gate
    // seja interpretada como "não possui estabelecimento" e mande o usuário
    // indevidamente para o onboarding.
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

    // Um lojista novo pode ainda não possuir establishment_members porque o
    // vínculo só nasce ao concluir o onboarding. Nesse caso profiles.account_type
    // preserva a intenção de conta do cadastro.
    const accountType: "super_admin" | "establishment" | "customer" = isSuperAdmin
      ? "super_admin"
      : hasEstablishment || declaredAccountType === "establishment"
        ? "establishment"
        : "customer";

    return {
      userId,
      isSuperAdmin,
      accountType,
      hasEstablishment,
    };
  });
