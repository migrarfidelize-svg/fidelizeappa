#!/usr/bin/env node
/**
 * Instala exclusivamente a foto da GYNRACE.
 * Execucao na VPS, sem alterar Nginx, PM2, builds, planos ou outras empresas.
 * node --env-file=.env scripts/instalar-foto-gynrace.mjs /root/gynrace_kawasaki_premium.webp
 */
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const filepath = process.argv[2];
if (!filepath || !filepath.endsWith(".webp")) {
  console.error("Uso: node --env-file=.env scripts/instalar-foto-gynrace.mjs /caminho/imagem.webp");
  process.exit(2);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
  console.error("Credenciais Supabase da VPS ausentes ou endereco invalido.");
  process.exit(3);
}
const fileStat = await stat(filepath);
if (fileStat.size < 40000 || fileStat.size > 5000000) {
  console.error("Imagem fora do intervalo seguro de 40 KB a 5 MB.");
  process.exit(4);
}
const bytes = await readFile(filepath);
if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
  console.error("O arquivo nao e uma imagem WebP valida.");
  process.exit(5);
}

const sha = createHash("sha256").update(bytes).digest("hex");
const objectPath = "gynrace/hero-kawasaki-" + sha.slice(0, 16) + ".webp";
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const bucket = client.storage.from("landing-media");

console.log("Foto: " + (fileStat.size / 1024).toFixed(1) + " KB | SHA256: " + sha.slice(0, 16));
console.log("Enviando imagem para Storage da Fidelize...");
const { error: uploadError } = await bucket.upload(objectPath, bytes, {
  contentType: "image/webp",
  cacheControl: "31536000",
  upsert: false,
});
if (uploadError && uploadError.statusCode !== "409" && uploadError.status !== 409) {
  throw new Error("Falha no envio: " + uploadError.message);
}

const publicUrl = bucket.getPublicUrl(objectPath).data.publicUrl;
const imageResponse = await fetch(publicUrl, { cache: "no-store" });
if (!imageResponse.ok) {
  throw new Error("Imagem nao acessivel publicamente: HTTP " + imageResponse.status);
}
const remoteBytes = Buffer.from(await imageResponse.arrayBuffer());
const remoteSha = createHash("sha256").update(remoteBytes).digest("hex");
if (remoteSha !== sha) {
  throw new Error("Imagem remota nao corresponde a imagem enviada; capa antiga preservada.");
}
console.log("Imagem publica validada. Atualizando apenas a Bio da GYNRACE...");

const { data: record, error: findError } = await client.from("link_tree_pages")
  .select("id,public_slug,cover_url")
  .eq("public_slug", "gynrace")
  .maybeSingle();
if (findError || !record?.id) {
  throw new Error("Pagina GYNRACE nao encontrada no banco; nenhuma capa alterada.");
}

const previous = record.cover_url ?? "(vazia)";
const { data: updated, error: updateError } = await client.from("link_tree_pages")
  .update({ cover_url: publicUrl, updated_at: new Date().toISOString() })
  .eq("id", record.id)
  .eq("public_slug", "gynrace")
  .select("cover_url")
  .single();
if (updateError || updated?.cover_url !== publicUrl) {
  throw new Error("Falha ao atualizar a capa GYNRACE: " + (updateError?.message ?? "resposta inesperada"));
}
console.log("==============================================");
console.log("GYNRACE: FOTO PREMIUM INSTALADA COM SUCESSO");
console.log("Nova foto: " + publicUrl);
console.log("Capa anterior (recuperavel): " + previous);
console.log("Nenhuma configuracao Nginx/PM2 modificada.");
console.log("==============================================");
