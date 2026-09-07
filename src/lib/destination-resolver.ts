import { getAuthenticatedAccountAccess } from "./account-access.functions";

export type AccountAccess = {
  isSuperAdmin: boolean;
  accountType: "super_admin" | "establishment" | "customer";
  hasEstablishment?: boolean;
};

/**
 * Resolve o destino autoritativo de uma sessão autenticada.
 * Centraliza a lógica para evitar que clientes caiam no onboarding ou no /app.
 */
export async function resolveAuthenticatedDestination(providedAccess?: AccountAccess) {
  try {
    const access = providedAccess ?? (await getAuthenticatedAccountAccess());

    // 1. Super Admin -> Painel Administrativo
    if (access.isSuperAdmin || access.accountType === "super_admin") {
      return "/hash";
    }

    // 2. Cliente -> Carteira. A identidade principal prevalece sobre vínculos
    // residuais em establishment_members.
    if (access.accountType === "customer") {
      return "/carteira";
    }

    // 3. Estabelecimento -> onboarding somente enquanto não houver vínculo ativo.
    // O próprio servidor já resolveu hasEstablishment; não fazemos uma segunda
    // RPC no browser, evitando falso onboarding em falhas transitórias do JWT/gate.
    if (access.accountType === "establishment") {
      return access.hasEstablishment ? "/app" : "/onboarding";
    }

    return "/carteira";
  } catch (error) {
    console.error("[destination-resolver] Erro ao resolver destino:", error);
    return "/carteira";
  }
}
