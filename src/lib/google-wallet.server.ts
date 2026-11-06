// Google Wallet (Loyalty) — assinatura RS256 + REST API.
// Server-only (usa credenciais de service account). Worker-safe: node-forge + fetch.
import forge from "node-forge";
import { getProximityLocations } from "@/lib/wallet-proximity";
import {
  type WalletPassModel, tierLabel,
} from "@/lib/wallet-pass.server";

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

export type GoogleCreds = { issuerId: string; clientEmail: string; privateKey: string };

export function readGoogleCreds(): GoogleCreds | null {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const clientEmail = process.env.GOOGLE_WALLET_SA_EMAIL;
  const raw = process.env.GOOGLE_WALLET_SA_PRIVATE_KEY;
  if (!issuerId || !clientEmail || !raw) return null;
  // Aceita chave com \n escapado (formato comum ao colar em secret).
  const privateKey = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  return { issuerId, clientEmail, privateKey };
}

function b64url(bytes: string): string {
  return forge.util.encode64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signRs256(payload: Record<string, unknown>, creds: GoogleCreds): string {
  const header = { alg: "RS256", typ: "JWT" };
  const encode = (o: unknown) => b64url(forge.util.encodeUtf8(JSON.stringify(o)));
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const key = forge.pki.privateKeyFromPem(creds.privateKey);
  const md = forge.md.sha256.create();
  md.update(signingInput, "utf8");
  return `${signingInput}.${b64url(key.sign(md))}`;
}

async function getAccessToken(creds: GoogleCreds): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signRs256({
    iss: creds.clientEmail,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }, creds);

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!r.ok) throw new Error(`Google OAuth falhou (${r.status})`);
  const j = (await r.json()) as { access_token: string };
  return j.access_token;
}

export function googleIds(creds: GoogleCreds, model: WalletPassModel) {
  const clean = (s: string) => s.replace(/-/g, "");
  return {
    classId: `${creds.issuerId}.fid_${clean(model.establishment.id)}`,
    objectId: `${creds.issuerId}.cus_${clean(model.customer.id)}`,
  };
}

function hexToArgb(hex: string | null | undefined, fallback = "#5B21B6"): string {
  const h = (hex || fallback).trim();
  return /^#[0-9a-f]{6}$/i.test(h) ? h : fallback;
}

function buildClass(creds: GoogleCreds, model: WalletPassModel) {
  const { classId } = googleIds(creds, model);
  const s = model.settings;
  return {
    id: classId,
    issuerName: model.establishment.name,
    programName: s.front_text || `Cartão fidelidade ${model.establishment.name}`,
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: hexToArgb(s.background_color, model.establishment.primary_color || "#5B21B6"),
    ...(s.logo_url || model.establishment.logo_url
      ? { programLogo: { sourceUri: { uri: s.logo_url || model.establishment.logo_url } } }
      : {}),
    ...(s.hero_image_url ? { heroImage: { sourceUri: { uri: s.hero_image_url } } } : {}),
    ...(model.establishment.phone || model.establishment.address
      ? {
          textModulesData: [
            ...(model.establishment.phone ? [{ header: "Contato", body: model.establishment.phone, id: "contact" }] : []),
            ...(model.establishment.address ? [{ header: "Endereço", body: model.establishment.address, id: "address" }] : []),
          ],
        }
      : {}),
  };
}

export function buildObject(creds: GoogleCreds, model: WalletPassModel, origin: string) {
  const { classId, objectId } = googleIds(creds, model);
  const s = model.settings;
  const f = s.fields;
  const cardUrl = `${origin}/c/${model.customer.access_token}`;

  const textModules: Array<{ header: string; body: string; id: string }> = [];
  if (f.tier) textModules.push({ header: "Nível", body: tierLabel(model.customer.tier), id: "tier" });
  if (f.reward && model.card) textModules.push({ header: "Recompensa", body: model.card.reward_title, id: "reward" });
  if (s.custom_message) textModules.push({ header: "Mensagem", body: s.custom_message, id: "message" });
  if (s.back_text) textModules.push({ header: "Informações", body: s.back_text, id: "back" });
  if (f.contact && (model.establishment.phone || model.establishment.whatsapp)) {
    textModules.push({
      header: "Contato",
      body: [model.establishment.phone, model.establishment.whatsapp].filter(Boolean).join(" · "),
      id: "contact",
    });
  }

  return {
    id: objectId,
    classId,
    state: "ACTIVE",
    // merchantLocations (locations[] é obsoleto); [] remove ao desativar.
    merchantLocations: getProximityLocations(s),
    accountId: model.customer.code,
    accountName: model.customer.name,
    ...(f.points ? { loyaltyPoints: { label: "Pontos", balance: { int: model.points } } } : {}),
    ...(f.stamps && model.card
      ? {
          secondaryLoyaltyPoints: {
            label: "Carimbos",
            balance: { string: `${model.card.stamps}/${model.card.stamps_required}` },
          },
        }
      : {}),
    ...(textModules.length ? { textModulesData: textModules } : {}),
    linksModuleData: { uris: [{ uri: cardUrl, description: "Abrir meu cartão", id: "card" }] },
    ...(s.show_qr
      ? { barcode: { type: "QR_CODE", value: cardUrl, alternateText: model.customer.code } }
      : s.show_barcode
        ? { barcode: { type: s.barcode_format || "CODE_128", value: model.customer.code, alternateText: model.customer.code } }
        : {}),
    ...(model.expiresAt ? { validTimeInterval: { end: { date: model.expiresAt } } } : {}),
    hexBackgroundColor: hexToArgb(s.background_color, model.establishment.primary_color || "#5B21B6"),
  };
}

async function apiCall(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`${WALLET_API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r;
}

/** Cria (ou atualiza) a classe do estabelecimento e o objeto do cliente. */
export async function upsertGooglePass(model: WalletPassModel, origin: string) {
  const creds = readGoogleCreds();
  if (!creds) throw new Error("Google Wallet não configurado no servidor.");
  const token = await getAccessToken(creds);
  const cls = buildClass(creds, model);
  const obj = buildObject(creds, model, origin);

  const clsGet = await apiCall(token, "GET", `/loyaltyClass/${encodeURIComponent(cls.id)}`);
  if (clsGet.status === 404) {
    const c = await apiCall(token, "POST", "/loyaltyClass", cls);
    if (!c.ok) throw new Error(`Falha ao criar classe Google (${c.status})`);
  } else if (clsGet.ok) {
    await apiCall(token, "PATCH", `/loyaltyClass/${encodeURIComponent(cls.id)}`, cls);
  }

  const objGet = await apiCall(token, "GET", `/loyaltyObject/${encodeURIComponent(obj.id)}`);
  if (objGet.status === 404) {
    const o = await apiCall(token, "POST", "/loyaltyObject", obj);
    if (!o.ok) throw new Error(`Falha ao criar cartão Google (${o.status})`);
  } else if (objGet.ok) {
    const p = await apiCall(token, "PATCH", `/loyaltyObject/${encodeURIComponent(obj.id)}`, obj);
    if (!p.ok) throw new Error(`Falha ao atualizar cartão Google (${p.status})`);
  }

  return { classId: cls.id, objectId: obj.id, creds };
}

/** Link "Salvar no Google Wallet" (JWT assinado com referência ao objeto). */
export function buildSaveUrl(creds: GoogleCreds, objectId: string, origin: string): string {
  const now = Math.floor(Date.now() / 1000);
  const jwt = signRs256({
    iss: creds.clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: now,
    origins: [origin],
    payload: { loyaltyObjects: [{ id: objectId }] },
  }, creds);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

/** Atualiza apenas os dados dinâmicos do objeto já salvo na carteira. */
export async function patchGoogleObject(model: WalletPassModel, origin: string) {
  const creds = readGoogleCreds();
  if (!creds) return { ok: false as const, reason: "unconfigured" as const };
  const token = await getAccessToken(creds);
  const obj = buildObject(creds, model, origin);
  const r = await apiCall(token, "PATCH", `/loyaltyObject/${encodeURIComponent(obj.id)}`, obj);
  return { ok: r.ok, status: r.status, objectId: obj.id };
}
