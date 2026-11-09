#!/usr/bin/env bash
# Troca controlada BETA da Fidelize para 3190. Usuarios e dados sao de testes.
# O bug PGRST303 persiste no Supabase; a beta nao representa release GA.
# Tem rollback automatico em 15 minutos e confirmacao explicita.
set -Eeuo pipefail
umask 077
APP="fidelize-v4-rc-3190"
PORT="3190"
WORKER="fidelize-crm-worker-3192"
WORKER_PORT="3192"
LIVE="/var/www/fidelize-smart-wallet-20261107-3150"
RC="/var/www/fidelize-v4-jwtfix-20261109-055123"
ID="f406351f-487b-47db-b0d3-bd5cb918b6c3"
CONF="$(readlink -f /etc/nginx/sites-enabled/afidelize)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/root/afidelize-before-unified-$STAMP.conf"
MARK="/root/fidelize-v4-approved-$STAMP"
ROLLBACK="/root/fidelize-v4-rollback-$STAMP.sh"
CONFIRM="/root/fidelize-v4-confirm-$STAMP.sh"
UNIT="fidelize-v4-rollback-$(date +%s)"
PENDING=0
DONE=0
cleanup() {
  code=$?
  trap - EXIT
  if [[ "$DONE" != 1 && "$PENDING" == 1 ]]; then
    echo "=== PUBLICACAO NAO VALIDADA: ROLLBACK IMEDIATO ==="
    cp -a "$BACKUP" "$CONF"
    nginx -t && systemctl reload nginx || true
    pm2 delete "$WORKER" >/dev/null 2>&1 || true
    systemctl stop "$UNIT.timer" >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap cleanup EXIT

test "$(id -u)" -eq 0
if [[ "${FIDELIZE_BETA_RISK_ACK:-}" != "SIM" ]]; then
  echo "BLOQUEADO: homologacao beta com funcionalidades incompletas requer aceite explicito."
  echo "JWT PGRST303 ainda bloqueia carimbo, resgate e outras operacoes autenticadas."
  echo "Para iniciar a beta, defina FIDELIZE_BETA_RISK_ACK=SIM."
  exit 1
fi
echo "=== BETA AUTORIZADA: JWT AINDA NAO CORRIGIDO ==="
echo "Rollback automatico se o cutover falhar ou nao for confirmado em 15 min."
test -f "$CONF"
test -f "$LIVE/.env" && test -f "$RC/.env"
test -f "$RC/.output/server/index.mjs"
command -v systemd-run >/dev/null
if pm2 describe "$WORKER" >/dev/null 2>&1; then echo "BLOQUEADO: worker 3192 ja existe."; exit 1; fi
if ss -H -ltn "( sport = :$WORKER_PORT )" | grep -q .; then echo "BLOQUEADO: porta 3192 ocupada."; exit 1; fi
# A verificacao deve usar o ambiente REAL carregado pelo processo 3190.
test "$(git -C "$RC" rev-parse HEAD)" = "552b79ed0c406219c5bb1169abfdb8ca3cb91d88" || {
  echo "BLOQUEADO: preview 3190 nao corresponde a release homologada"; exit 1;
}
nginx -t >/dev/null
pm2 describe "$APP" >/dev/null
# Confirma que 3190 realmente executa o candidato homologado.
pm2 jlist | node -e '
  let src = "";
  process.stdin.on("data", chunk => src += chunk);
  process.stdin.on("end", () => {
    const app = JSON.parse(src).find(x => x.name === "fidelize-v4-rc-3190");
    if (!app || app.pm2_env?.pm_cwd !== process.argv[1] ||
        app.pm2_env?.status !== "online") {
      process.stderr.write("BLOQUEADO: PM2 3190 nao executa a release esperada.\n");
      process.exit(1);
    }
  });
' "$RC"
curl --noproxy '*' -fsS --max-time 15 "http://127.0.0.1:$PORT/auth?mode=signin" -o /dev/null
curl --noproxy '*' -fsS --max-time 15 "http://127.0.0.1:$PORT/?plano=essencial" -o /dev/null
curl --noproxy '*' -fsS --max-time 15 "http://127.0.0.1:$PORT/links/gynrace" -o /dev/null

# Interrompe se a candidata apontar para um projeto/banco diferente.
python3 - "$LIVE/.env" "$RC/.env" <<'PY'
import sys
def parse(path):
    result={}
    for line in open(path,encoding="utf-8"):
        if "=" in line and not line.lstrip().startswith("#"):
            key,value=line.strip().split("=",1)
            result[key.strip()]=value.strip().strip('"').strip("'")
    return result
live,rc=map(parse,sys.argv[1:])
# A implementacao OTP exige a chave existente, mas nao impõe 32 bytes;
# nao rotacionar durante a troca porque codigos OTP pendentes usam esta chave.
for name in ("AUTH_OTP_HMAC_SECRET","SUPABASE_SERVICE_ROLE_KEY"):
    if not rc.get(name):
        raise SystemExit("BLOQUEADO: variavel obrigatoria ausente na 3190: "+name)
# O novo fluxo de QR RDM1 exige explicitamente no minimo 32 bytes.
if len(rc.get("REDEEM_HMAC_SECRET","").encode("utf-8")) < 32:
    raise SystemExit("BLOQUEADO: REDEEM_HMAC_SECRET ausente ou com menos de 32 bytes na 3190")
for name in ("SUPABASE_URL","VITE_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY",
             "VITE_SUPABASE_ANON_KEY","VITE_SUPABASE_PUBLISHABLE_KEY",
             "AUTH_OTP_HMAC_SECRET","REDEEM_HMAC_SECRET"):
    if name in live and live[name] and live[name]!=rc.get(name):
        raise SystemExit("BLOQUEADO: divergencia/ausencia de configuracao na 3190: "+name)
print("Configuracao critica da 3190 validada sem expor segredos.")
PY

test "$(grep -Fc 'proxy_pass http://127.0.0.1:3150;' "$CONF")" -eq 2 || {
 echo "BLOQUEADO: topologia Nginx mudou"; exit 1;
}

cp -a "$CONF" "$BACKUP"
cat > "$ROLLBACK" <<EOF
#!/bin/bash
set -Eeuo pipefail
if test -f "$MARK"; then
  exit 0
fi
cp -a "$BACKUP" "$CONF"
nginx -t
systemctl reload nginx
pm2 delete "$WORKER" >/dev/null 2>&1 || true
echo "Fidelize: rollback automatico para 3150/3180, worker desativado."
EOF
chmod 700 "$ROLLBACK"

cat > "$CONFIRM" <<EOF
#!/bin/bash
set -Eeuo pipefail
if ! grep -qF 'proxy_pass http://127.0.0.1:3190;' "$CONF"; then
  echo "BLOQUEADO: producao nao aponta para 3190"; exit 1
fi
if ! curl --noproxy '*' -fsS --max-time 15 \
  --resolve afidelize.app:443:127.0.0.1 \
  'https://afidelize.app/auth?mode=signin' -o /dev/null; then
  echo "BLOQUEADO: HTTPS nao saudavel"; exit 1
fi
pm2 describe "$WORKER" >/dev/null
curl --noproxy '*' -fsS --max-time 15 "http://127.0.0.1:$WORKER_PORT/auth?mode=signin" -o /dev/null
touch "$MARK"
systemctl stop "$UNIT.timer" >/dev/null 2>&1 || true
pm2 save
echo "FIDELIZE V4 BETA 3190 CONFIRMADA — PGRST303 AINDA PENDENTE"
echo "Backup Nginx: $BACKUP"
EOF
chmod 700 "$CONFIRM"

# Agendar rollback ANTES da troca de backend.
systemd-run --unit="$UNIT" --on-active=900s /bin/bash "$ROLLBACK"
PENDING=1

python3 - "$CONF" "$ID" <<'PY'
import pathlib,re,sys
p=pathlib.Path(sys.argv[1]); institution=sys.argv[2]; s=p.read_text()
m=re.search(r'map\s+\$arg_establishment_id\s+\$fidelize_wa_canary_backend\s*\{[^}]*\}',s,re.S)
if not m: raise SystemExit("BLOQUEADO: mapa WhatsApp ausente")
b=m.group(0)
old_default="default http://127.0.0.1:3150;"
old_whatsapp=institution+" http://127.0.0.1:3180;"
if b.count(old_default)!=1 or b.count(old_whatsapp)!=1: raise SystemExit("BLOQUEADO: mapa inesperado")
b=b.replace(old_default,"default http://127.0.0.1:3190;")
b=b.replace(old_whatsapp,institution+" http://127.0.0.1:3190;")
s=s[:m.start()]+b+s[m.end():]
old_main="proxy_pass http://127.0.0.1:3150;"
if s.count(old_main)!=2: raise SystemExit("BLOQUEADO: proxies 3150 inesperados")
s=s.replace(old_main,"proxy_pass http://127.0.0.1:3190;")
p.write_text(s)
PY

nginx -t
systemctl reload nginx
# O frontend 3190 segue sem timers. Iniciamos apenas UM worker isolado,
# nunca em staging, e o rollback sempre o desliga.
(
  cd "$RC"
  FIDELIZE_VPS_BUILD=1 FIDELIZE_STAGING_NO_WORKERS=0 HOST=127.0.0.1 PORT="$WORKER_PORT" NODE_ENV=production \
    pm2 start .output/server/index.mjs --name "$WORKER" \
    --interpreter node --node-args='--env-file=.env'
)
READY=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl --noproxy '*' -fsS --max-time 10 "http://127.0.0.1:$WORKER_PORT/auth?mode=signin" -o /dev/null; then
    READY=1; break
  fi
  sleep 2
done
test "$READY" = 1 || { echo "BLOQUEADO: worker CRM nao respondeu."; exit 1; }
for path in '/auth?mode=signin' '/' '/links/gynrace' '/?plano=essencial'; do
  curl --noproxy '*' -kfsS --max-time 20 --http1.1 \
    --resolve afidelize.app:443:127.0.0.1 \
    "https://afidelize.app$path" -o /dev/null
done
DONE=1
echo "=== FIDELIZE V4 BETA ATIVADA TEMPORARIAMENTE ==="
echo "Producao web: 3190; webhook institucional: 3190; worker CRM unico: 3192"
echo "Backup: $BACKUP"
echo "Rollback automatico em 15 minutos: $UNIT.timer"
echo "TESTAR AGORA HOME, OTP, CATALOGO, CARTEIRA E MENU WHATSAPP."
echo "CARIMBO/RECOMPENSA PERMANECEM BLOQUEADOS PELO POSTGREST: NAO RECONTAR COMO APROVADOS."
echo "SE HOME/LOGIN/WHATSAPP FUNCIONAREM E QUISER MANTER A BETA: bash $CONFIRM"
echo "SE FALHAR: bash $ROLLBACK"
