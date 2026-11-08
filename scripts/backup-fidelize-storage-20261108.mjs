#!/usr/bin/env node
// BACKUP READ-ONLY: baixa os objetos do Supabase Storage da Fidelize.
// Execute de um diretorio contendo node_modules/@supabase/supabase-js e
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no ambiente do processo.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

process.umask(0o077);
const PROJECT = "tuobkmexsfplqoydpaxn";
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROOT = path.resolve(process.argv[2] || "");
if (URL !== "https://" + PROJECT + ".supabase.co") {
  throw new Error("SUPABASE_URL inesperada. Backup cancelado.");
}
if (!KEY || KEY.length < 25) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY nao foi carregada.");
}
const parent = "/root/fidelize-release-backups/";
if (!ROOT.startsWith(parent) || !path.basename(ROOT).startsWith("storage-")) {
  throw new Error("Destino fora de /root/fidelize-release-backups/storage-...");
}

function safe(name) {
  if (typeof name !== "string" || !name || name === "." || name === ".." ||
      /[\/\\\x00-\x1f]/.test(name)) {
    throw new Error("Nome de arquivo/pasta inseguro no Storage.");
  }
  return name;
}
const privilegedFetch = (input, init) => {
  const headers = new Headers(
    typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
  );
  if (init?.headers) {
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
  }
  if ((KEY.startsWith("sb_secret_") || KEY.startsWith("sb_publishable_")) &&
      headers.get("Authorization") === "Bearer " + KEY) {
    headers.delete("Authorization");
  }
  headers.set("apikey", KEY);
  return fetch(input, { ...init, headers });
};
const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: privilegedFetch },
});
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const manifest = [];
let totalBytes = 0;
let totalFiles = 0;

async function retry(fn, operation) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fn();
      if (response.error) throw response.error;
      return response.data;
    } catch (err) {
      error = err;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw new Error(operation + " falhou apos tres tentativas: " + String(error?.message || "erro remoto"));
}

async function backupFolder(bucket, prefix = "", depth = 0) {
  if (depth > 30) throw new Error("Profundidade de pasta anormal: " + bucket);
  const pageSize = 100;
  let offset = 0;
  while (true) {
    const entries = await retry(
      () => supabase.storage.from(bucket).list(prefix, {
        limit: pageSize, offset, sortBy: { column: "name", order: "asc" },
      }),
      "Listagem do bucket " + bucket,
    );
    if (!Array.isArray(entries)) throw new Error("Resposta de listagem inesperada.");
    for (const entry of entries) {
      const name = safe(entry.name);
      const remotePath = prefix ? prefix + "/" + name : name;
      // Diretorios aparecem sem ID e sem metadata na API de listagem.
      if (!entry.id && !entry.metadata) {
        await backupFolder(bucket, remotePath, depth + 1);
        continue;
      }
      const blob = await retry(
        () => supabase.storage.from(bucket).download(remotePath),
        "Download do bucket " + bucket,
      );
      const bytes = Buffer.from(await blob.arrayBuffer());
      const size = Number(entry.metadata?.size);
      if (Number.isFinite(size) && size >= 0 && size !== bytes.length) {
        throw new Error("Tamanho divergente em " + bucket + " (backup interrompido).");
      }
      const destination = path.join(ROOT, "objects", safe(bucket),
        ...remotePath.split("/").map(safe));
      await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await fs.writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
      manifest.push({ bucket, path: remotePath, bytes: bytes.length, sha256: sha256(bytes) });
      totalBytes += bytes.length;
      totalFiles += 1;
    }
    if (entries.length < pageSize) break;
    offset += pageSize;
  }
}

await fs.mkdir(ROOT, { mode: 0o700, recursive: false });
console.log("===== BACKUP SUPABASE STORAGE (SOMENTE LEITURA) =====");
const buckets = await retry(() => supabase.storage.listBuckets(), "Listagem dos buckets");
if (!Array.isArray(buckets)) throw new Error("Lista de buckets invalida.");
console.log("Buckets encontrados: " + buckets.length);
for (const bucket of buckets) {
  const before = totalFiles;
  await backupFolder(safe(bucket.id));
  console.log("Bucket " + bucket.id + ": " + (totalFiles - before) + " arquivo(s)");
}
if (totalFiles < 98) {
  throw new Error("Apenas " + totalFiles + " arquivos: menos do que os 98 observados em producao. Revisar antes de concluir.");
}
await fs.writeFile(path.join(ROOT, "manifest.json"), JSON.stringify({
  project: PROJECT,
  generatedAt: new Date().toISOString(),
  totalFiles,
  totalBytes,
  objects: manifest,
}, null, 2), { flag: "wx", mode: 0o600 });
await fs.writeFile(path.join(ROOT, "BACKUP_COMPLETO.txt"),
  "Supabase Storage Fidelize: " + totalFiles + " arquivos, " + totalBytes + " bytes.\n",
  { flag: "wx", mode: 0o600 });
console.log("===== STORAGE BACKUP CONCLUIDO =====");
console.log("Arquivos: " + totalFiles);
console.log("Bytes: " + totalBytes);
console.log("Destino: " + ROOT);
console.log("Os arquivos foram baixados, sem modificacoes no Supabase.");
