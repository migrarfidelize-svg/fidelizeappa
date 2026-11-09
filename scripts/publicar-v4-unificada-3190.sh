#!/usr/bin/env bash
# Troca controlada da producao Fidelize para RC 3190 (requer homologacao anterior).
# Tem rollback automatico em 15 minutos, e comando de confirmacao explicito.
set -Eeuo pipefail
umask 077
APP="fidelize-v4-rc-3190"
PORT="3190"
LIVE="/var/www/fidelize-smart-wallet-20261107-3150"
RC="/var/www/fidelize-v4-planfix-20261109-034745"
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
    systemctl stop "$UNIT.timer" >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap cleanup EXIT

test "$(id -u)" -eq 0
if [[ "${FIDELIZE_RELEASE_APPROVED:-}" != "SIM" ]]; then
  echo "BLOQUEADO: testes funcionais devem ser aprovados antes da troca."
  echo "Apos homologar, execute: FIDELIZE_RELEASE_APPROVED=SIM bash este-script.sh"
  exit 1
fi
test -f "$CONF"
test -f "$LIVE/.env" && test -f "$RC/.env"
# A verificacao deve usar o ambiente REAL carregado pelo processo 3190.
test "$(git -C "$RC" rev-parse HEAD)" = "078850d43387b31916102b1d4ea1a75fd4c66527" || {
  echo "BLOQUEADO: preview 3190 nao corresponde a release homologada"; exit 1;
}
nginx -t >/dev/null
pm2 describe "$APP" >/dev/null
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
must_have=("AUTH_OTP_HMAC_SECRET","SUPABASE_SERVICE_ROLE_KEY","REDEEM_HMAC_SECRET")
for name in must_have:
    if len(rc.get(name,"").encode("utf-8")) < 32:
        raise SystemExit("BLOQUEADO: variavel obrigatoria ausente ou curta na 3190: "+name)
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
echo "Fidelize: rollback automatico para 3150/3180."
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
touch "$MARK"
systemctl stop "$UNIT.timer" >/dev/null 2>&1 || true
pm2 save
echo "RELEASE V4 3190 CONFIRMADA SEM REVERSAO PROGRAMADA"
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
for path in '/auth?mode=signin' '/' '/links/gynrace' '/?plano=essencial'; do
  curl --noproxy '*' -kfsS --max-time 20 --http1.1 \
    --resolve afidelize.app:443:127.0.0.1 \
    "https://afidelize.app$path" -o /dev/null
done
DONE=1
echo "=== V4 ATIVADA TEMPORARIAMENTE ==="
echo "Producao web: 3190; webhook institucional: 3190"
echo "Backup: $BACKUP"
echo "Rollback automatico em 15 minutos: $UNIT.timer"
echo "TESTAR AGORA OTP, QR, CARIMBO, RECOMPENSA E MENU WHATSAPP."
echo "SE TUDO PASSAR: bash $CONFIRM"
echo "SE FALHAR: bash $ROLLBACK"
