/**
 * Resgate de recompensa por QR temporário assinado.
 *
 * Fluxo:
 *  1. Cliente autenticado chama `issueRedeemToken({ reward_id })` a partir da /carteira.
 *  2. O servidor confirma a posse da recompensa e emite um token HMAC (60s).
 *  3. O funcionário do estabelecimento escaneia o QR na tela /carimbar.
 *  4. O servidor valida HMAC + validade + posse do estabelecimento pelo staff
 *     e marca `rewards.redeemed_at`. O `rewards.redeemed_at` atua como
 *     nonce/idempotência natural (não é possível resgatar duas vezes).
 *
 * Segurança: a chave HMAC deve ser aleatória e configurada em REDEEM_HMAC_SECRET
 * somente no runtime do servidor. Falha fechada na ausência dessa chave.
 * O token contém `{ rid, uid, eid, exp, n }` + assinatura HMAC-SHA256.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signRedeemPayload, verifyRedeemSignature } from "@/lib/redeem-token.server";

const TOKEN_TTL_MS = 60_000; // 60s
const PREFIX = "RDM1";

function b64urlEncode(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}


interface RedeemPayload { rid: string; uid: string; eid: string; exp: number; n: string; }

/** Emite um token de resgate assinado, válido por 60s. */
export const issueRedeemToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reward_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // A RLS já garante que o cliente só vê recompensas dos seus cartões.
    const { data: reward, error } = await supabase
      .from("rewards")
      .select("id, card_id, establishment_id, redeemed_at, expires_at, campaign_id, loyalty_cards:card_id(customer_id, customers:customer_id(user_id))")
      .eq("id", data.reward_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!reward) throw new Error("Recompensa não encontrada");
    if (reward.redeemed_at) throw new Error("Esta recompensa já foi resgatada.");
    if (reward.expires_at && new Date(reward.expires_at) < new Date()) throw new Error("Esta recompensa expirou.");

    // Confirma posse via chain customer.user_id
    const ownerUid =
      // deno-lint-ignore no-explicit-any
      (reward as any).loyalty_cards?.customers?.user_id as string | undefined;
    // Sem vínculo verificado, não é possível afirmar que o usuário é o dono.
    if (!ownerUid || ownerUid !== userId) throw new Error("Sem permissão para esta recompensa.");

    const { randomBytes } = await import("crypto");
    const exp = Date.now() + TOKEN_TTL_MS;
    const payload: RedeemPayload = {
      rid: reward.id,
      uid: userId,
      eid: reward.establishment_id,
      exp,
      n: b64urlEncode(randomBytes(9)),
    };
    const body = b64urlEncode(Buffer.from(JSON.stringify(payload)));
    const sig = signRedeemPayload(body);
    const token = `${PREFIX}.${body}.${sig}`;
    return { token, expiresAt: exp };
  });

/**
 * Valida e consome um token de resgate (chamado pelo estabelecimento em /carimbar).
 * O caller precisa ser membro ativo do estabelecimento — a UPDATE em `rewards` já
 * é protegida por RLS que exige `is_establishment_member`.
 */
export const consumeRedeemToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(20).max(600) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const parts = data.token.split(".");
    if (parts.length !== 3 || parts[0] !== PREFIX) throw new Error("QR de resgate inválido.");
    const [, body, sig] = parts;
    const ok = verifyRedeemSignature(body, sig);
    if (!ok) throw new Error("Assinatura inválida — QR alterado ou de outro projeto.");

    let payload: RedeemPayload;
    try {
      payload = JSON.parse(b64urlDecode(body).toString("utf-8")) as RedeemPayload;
    } catch { throw new Error("QR corrompido."); }

    if (!z.string().uuid().safeParse(payload.rid).success ||
        !z.string().uuid().safeParse(payload.uid).success ||
        !z.string().uuid().safeParse(payload.eid).success ||
        !Number.isFinite(payload.exp) || payload.exp <= Date.now() ||
        payload.exp > Date.now() + TOKEN_TTL_MS ||
        typeof payload.n !== "string" || payload.n.length < 8) {
      throw new Error("QR inválido ou expirado. Peça ao cliente para gerar novamente.");
    }

    const { data: reward, error } = await supabase
      .from("rewards")
      .select("id, establishment_id, redeemed_at, campaign_id, card_id")
      .eq("id", payload.rid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!reward) throw new Error("Recompensa não encontrada.");
    if (reward.redeemed_at) throw new Error("Esta recompensa já foi entregue.");
    if (reward.establishment_id !== payload.eid) throw new Error("QR de outro estabelecimento.");

    // Atualização segura por RLS: só um membro ativo daquele estabelecimento consegue.
    const { data: upd, error: uErr } = await supabase
      .from("rewards")
      .update({ redeemed_at: new Date().toISOString(), redeemed_by: userId })
      .eq("id", reward.id)
      .is("redeemed_at", null)
      .select("id, campaign_id")
      .maybeSingle();
    if (uErr) throw new Error(uErr.message);
    if (!upd) throw new Error("Sem permissão para resgatar nesta empresa, ou já foi resgatada.");

    // Busca meta para exibir no toast do funcionário.
    const [{ data: camp }, { data: card }] = await Promise.all([
      supabase.from("campaigns").select("reward_title, name").eq("id", reward.campaign_id).maybeSingle(),
      supabase.from("loyalty_cards").select("customer_id, customers:customer_id(name)").eq("id", reward.card_id).maybeSingle(),
    ]);

    // Auditoria (best-effort).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_logs").insert({
        establishment_id: reward.establishment_id,
        user_id: userId,
        action: "reward_redeemed_qr",
        entity_type: "reward",
        entity_id: reward.id,
        metadata: { via: "temp_qr", nonce: payload.n, customer_uid: payload.uid } as never,
      });
    } catch { /* ignore audit failures */ }

    return {
      ok: true as const,
      reward: camp?.reward_title ?? "Recompensa",
      campaign: camp?.name ?? null,
      // deno-lint-ignore no-explicit-any
      customerName: ((card as any)?.customers?.name as string | undefined) ?? null,
    };
  });
