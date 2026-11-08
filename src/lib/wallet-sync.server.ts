// Sincronização automática dos passes já salvos nas carteiras dos clientes.
// Server-only. Chamado após carimbo, resgate, mudança de nível, etc.
import { loadPassModelByCustomer } from "@/lib/wallet-pass.server";

export type WalletSyncResult = {
  customer_id: string;
  google: "updated" | "skipped" | "error" | "unconfigured";
  apple: "notified" | "flagged" | "skipped";
  message?: string;
};

/**
 * Atualiza o passe do cliente nas carteiras:
 * - Google Wallet: PATCH direto no objeto (reflete no aparelho em segundos).
 * - Apple Wallet: marca o passe como alterado e tenta o push silencioso APNs.
 *   O iOS busca a versão nova em `/api/public/wallet/v1/passes/...`.
 *   Quando APNs não estiver disponível, o passe continua marcado para refresh.
 */
export async function syncCustomerWallet(customerId: string, origin: string): Promise<WalletSyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result: WalletSyncResult = { customer_id: customerId, google: "skipped", apple: "skipped" };

  const { data: passes } = await supabaseAdmin
    .from("wallet_passes")
    .select("id, platform, status")
    .eq("customer_id", customerId)
    .eq("status", "active");

  if (!passes || passes.length === 0) return result;

  const model = await loadPassModelByCustomer(customerId);
  if (!model) return result;

  const now = new Date().toISOString();

  for (const p of passes) {
    if (p.platform === "google") {
      try {
        const { patchGoogleObject, readGoogleCreds } = await import("@/lib/google-wallet.server");
        if (!readGoogleCreds()) { result.google = "unconfigured"; continue; }
        const r = await patchGoogleObject(model, origin);
        result.google = r.ok ? "updated" : "error";
      } catch (e) {
        result.google = "error";
        result.message = e instanceof Error ? e.message : String(e);
      }
    } else {
      // Atualizar versão ANTES de enviar APNs: o iOS pode consultar imediatamente.
      const { error: updateError } = await supabaseAdmin
        .from("wallet_passes")
        .update({ last_synced_at: now, updated_at: now })
        .eq("id", p.id);
      if (updateError) {
        result.apple = "flagged";
        result.message = "Não foi possível registrar a atualização do passe Apple.";
        continue;
      }
      result.apple = "flagged";
      try {
        const { notifyAppleWalletPass } = await import("@/lib/apple-wallet-push.server");
        const pushed = await notifyAppleWalletPass(p.id);
        if (pushed.sent > 0) result.apple = "notified";
      } catch {
        // A indisponibilidade da APNs não deve bloquear carimbos ou resgates.
      }
      continue;
    }
    await supabaseAdmin.from("wallet_passes").update({ last_synced_at: now }).eq("id", p.id);
  }

  return result;
}

/** Sincroniza todos os passes ativos de um estabelecimento (uso administrativo). */
export async function syncEstablishmentWallets(establishmentId: string, origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: passes } = await supabaseAdmin
    .from("wallet_passes")
    .select("customer_id")
    .eq("establishment_id", establishmentId)
    .eq("status", "active");

  const ids = Array.from(new Set((passes ?? []).map((p) => p.customer_id)));
  const results: WalletSyncResult[] = [];
  for (const id of ids) results.push(await syncCustomerWallet(id, origin));
  return results;
}

/** Origem pública padrão para links/QR dentro dos passes. */
export function defaultWalletOrigin(): string {
  return (
    process.env.PUBLISHED_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    "https://afidelize.app"
  ).replace(/\/+$/, "");
}

/** Versão "fire-and-forget": nunca lança, usada dentro de fluxos de negócio. */
export async function syncCustomerWalletSafe(customerId: string) {
  try {
    return await syncCustomerWallet(customerId, defaultWalletOrigin());
  } catch (e) {
    console.warn("[wallet-sync] falhou", e instanceof Error ? e.message : String(e));
    return null;
  }
}
