#!/usr/bin/env bash
# Correção cirúrgica do OTP da Fidelize V4: apenas a configuração da 3190.
# Lê a integração ativa pelo Supabase, prova qual chave existente descriptografa
# token + webhook_secret, corrige a .env e reinicia SOMENTE o preview.
# Nunca imprime credenciais, nunca altera banco, nunca cria chave nova.
set -Eeuo pipefail
umask 077

node --input-type=module <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { createDecipheriv, scryptSync } from "node:crypto";
import { execFileSync } from "node:child_process";

const environments = {
  "3150": "/var/www/fidelize-smart-wallet-20261107-3150/.env",
  "3180": "/var/www/fidelize-plans-feature-20261108/.env",
  "3190": "/var/www/fidelize-v4-planfix-20261109-034745/.env",
};
const projectHost = "tuobkmexsfplqoydpaxn.supabase.co";
const variable = "INTEGRATIONS_ENCRYPTION_KEY";
const targetPath = environments["3190"];
let changed = false;

function abort(message) {
  console.error("BLOQUEADO_SEM_ALTERACAO: " + message);
  process.exit(1);
}

function readValues(filePath) {
  if (!fs.existsSync(filePath) || fs.lstatSync(filePath).isSymbolicLink()) {
    abort("Arquivo .env ausente ou link simbólico.");
  }
  const src = fs.readFileSync(filePath, "utf8");
  const values = {};
  for (const line of src.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      abort("Variável duplicada em " + path.dirname(filePath) + ": " + key);
    }
    values[key] = value;
  }
  return { values, src };
}

function decrypt(jsonString, masterKey) {
  const data = JSON.parse(jsonString);
  if (data.v !== 1 || data.alg !== "aes-256-gcm" ||
      typeof data.iv !== "string" || typeof data.ciphertext !== "string" ||
      typeof data.tag !== "string") {
    throw new Error("Formato cifrado diferente da versão esperada.");
  }
  const derived = scryptSync(masterKey, "salt", 32);
  const decipher = createDecipheriv("aes-256-gcm", derived, Buffer.from(data.iv, "hex"));
  decipher.setAuthTag(Buffer.from(data.tag, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(data.ciphertext, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

const files = {};
for (const [name, filePath] of Object.entries(environments)) {
  files[name] = readValues(filePath);
}
const { values: rc } = files["3190"];
const supabaseURL = rc.SUPABASE_URL || rc.VITE_SUPABASE_URL;
const serviceKey = rc.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseURL || !serviceKey) abort("Supabase URL/service role ausentes na 3190.");

let endpoint;
try {
  endpoint = new URL(supabaseURL);
} catch {
  abort("URL Supabase inválida.");
}
if (endpoint.protocol !== "https:" || endpoint.hostname !== projectHost) {
  abort("Projeto Supabase diferente do projeto Fidelize validado.");
}
endpoint.pathname = "/rest/v1/integrations";
endpoint.search = new URLSearchParams({
  select: "provider,establishment_id,config,credentials",
  category: "eq.otp",
  enabled: "eq.true",
  limit: "20",
}).toString();

const headers = { apikey: serviceKey, Accept: "application/json" };
if (serviceKey.split(".").length === 3) headers.Authorization = "Bearer " + serviceKey;
let response;
try {
  response = await fetch(endpoint, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
} catch {
  abort("Supabase indisponível na consulta da integração OTP.");
}
if (!response.ok) abort("Falha ao consultar integração OTP (HTTP " + response.status + ").");
let rows;
try { rows = await response.json(); } catch { abort("Resposta Supabase inválida."); }
if (!Array.isArray(rows)) abort("Formato inesperado na resposta Supabase.");
const globals = rows.filter(row =>
  row.establishment_id === null ||
  row.config?.auth_scope === "global" ||
  row.config?.use_for_auth === true
);
if (globals.length !== 1) abort("Deve existir exatamente uma integração OTP global.");
const integration = globals[0];
if (integration.provider !== "uazapi") abort("Integração global não é UAZAPI.");
const encryptedToken = integration.credentials?.token;
const encryptedWebhook = integration.credentials?.webhook_secret;
if (typeof encryptedToken !== "string" || typeof encryptedWebhook !== "string") {
  abort("Credenciais OTP ausentes no cofre do Supabase.");
}

const candidates = [];
for (const [name, item] of Object.entries(files)) {
  const value = item.values[variable];
  if (value) candidates.push({ origin: name + "/.env", value });
}
try {
  const pm2Apps = JSON.parse(execFileSync("pm2", ["jlist"], {
    encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
  }));
const currentApp = pm2Apps.find(p => p.name === "fidelize-v4-rc-3190");
  if (!currentApp || currentApp.pm2_env?.pm_cwd !== path.dirname(targetPath) ||
      currentApp.pm2_env?.status !== "online") {
    abort("PM2 3190 não está no diretório de preview esperado.");
  }
  for (const name of ["fidelize-smart-wallet-3150", "fidelize-planos-3180", "fidelize-v4-rc-3190"]) {
    const app = pm2Apps.find(p => p.name === name);
    const value = app?.pm2_env?.[variable] || app?.pm2_env?.env?.[variable];
    if (typeof value === "string" && value) candidates.push({ origin: name + "/PM2", value });
  }
} catch {
  console.log("PM2: variáveis do processo não acessíveis; verificando .env.");
}
const unique = [...new Map(candidates.map(c => [c.value, c])).values()];
console.log("Integração global: UAZAPI, credenciais criptografadas.");
console.log("Chaves de integração distintas encontradas: " + unique.length);
if (unique.length === 0) abort("Chave original de criptografia não localizada.");

const matches = unique.filter(candidate => {
  try {
    const token = decrypt(encryptedToken, candidate.value);
    const webhook = decrypt(encryptedWebhook, candidate.value);
    return token.length > 0 && webhook.length > 0;
  } catch {
    return false;
  }
});
if (matches.length !== 1) {
  abort(matches.length === 0
    ? "Nenhuma chave disponível descriptografa o token e o webhook da UAZAPI."
    : "Mais de uma chave distinta validou; intervenção manual necessária.");
}
const correctKey = matches[0];
console.log("Correspondência criptográfica: CONFIRMADA (" + correctKey.origin + ").");
if (rc[variable] === correctKey.value) {
  console.log("CONFIGURACAO_3190_JA_CORRETA.");
  console.log("Se o OTP falhar, investigaremos a resposta HTTP da UAZAPI, sem trocar chaves.");
  process.exit(0);
}

const original = files["3190"].src;
const occurrence = original.split(/\r?\n/).filter(line =>
  /^\s*(?:export\s+)?INTEGRATIONS_ENCRYPTION_KEY=/.test(line)
);
if (occurrence.length > 1) abort("Chave duplicada na configuração da 3190.");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = "/root/fidelize-otp-3190-env-" + stamp + ".bak";
const temporary = targetPath + ".otp-fix-" + process.pid;
const newLine = variable + "=" + JSON.stringify(correctKey.value);
const lines = original.split(/\r?\n/);
let replaced = false;
for (let i = 0; i < lines.length; i++) {
  if (/^\s*(?:export\s+)?INTEGRATIONS_ENCRYPTION_KEY=/.test(lines[i])) {
    lines[i] = newLine;
    replaced = true;
  }
}
if (!replaced) lines.push(newLine);
const finalContent = lines.join("\n").replace(/\n+$/, "\n");
try {
  fs.copyFileSync(targetPath, backup, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(backup, 0o600);
  fs.writeFileSync(temporary, finalContent, { mode: 0o600, flag: "wx" });
  fs.renameSync(temporary, targetPath);
  fs.chmodSync(targetPath, 0o600);
  changed = true;
} catch {
  try { fs.unlinkSync(temporary); } catch {}
  abort("Não foi possível salvar a .env com backup seguro.");
}
console.log("CHAVE DE INTEGRACAO RECUPERADA COM SUCESSO.");
console.log("Backup privado: " + backup);
console.log("Nenhuma credencial foi exibida, e nenhuma foi alterada no banco.");
try {
  execFileSync("pm2", ["restart", "fidelize-v4-rc-3190", "--update-env"], {
    stdio: "ignore",
    timeout: 30000,
    env: { ...process.env, INTEGRATIONS_ENCRYPTION_KEY: correctKey.value },
  });
} catch {
  console.error("RESTART_FALHOU: configuração corrigida, mas PM2 precisa de verificação.");
  process.exit(2);
}
let online = false;
for (let i = 0; i < 10; i++) {
  try {
    const r = await fetch("http://127.0.0.1:3190/auth?mode=signin", {
      signal: AbortSignal.timeout(5000),
    });
    if (r.status === 200) { online = true; break; }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 1200));
}
console.log(online ? "PREVIEW_3190_ONLINE_HTTP_200" : "PREVIEW_SEM_HTTP_200_VERIFICAR_PM2");
if (!online) process.exit(3);
NODE
