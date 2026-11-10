#!/usr/bin/env bash
# Fidelize V4: atualizar o frontend/Inbox na porta existente 3190 e publicar WEB com rollback.
# Preserva o roteamento de webhooks institucional 3180 e padrao 3150, sem novo worker/porta.
# Nao executa SQL, nao modifica contas, campanhas, GYNRACE ou Kariny.
set -Eeuo pipefail
umask 077
APP="fidelize-v4-rc-3190"
BASE="/var/www/fidelize-plans-feature-20261108"
OLD="/var/www/fidelize-v4-jwtfix-20261109-055123"
BRANCH="release/fidelize-v4-unificada-midnight-20261108"
PORT=3190
CONF="$(readlink -f /etc/nginx/sites-enabled/afidelize)"
STAMP="$(date +%Y%m%d-%H%M%S)"
NEW="/var/www/fidelize-v4-inboxfix-$STAMP"
LOG="/root/fidelize-v4-inboxfix-$STAMP.log"
BACKUP="/root/afidelize-pre-inboxfix-$STAMP.conf"
MARK="/root/fidelize-v4-inboxfix-confirmed-$STAMP"
ROLLBACK="/root/fidelize-v4-inboxfix-rollback-$STAMP.sh"
CONFIRM="/root/fidelize-v4-inboxfix-confirm-$STAMP.sh"
UNIT="fidelize-v4-inboxfix-rollback-$(date +%s)"
SWAPPED=0
NGINX_CHANGED=0
TIMER_SCHEDULED=0
DONE=0
restore_old_app() {
  pm2 delete "$APP" >/dev/null 2>&1 || true
  (
    cd "$OLD"
    FIDELIZE_STAGING_NO_WORKERS=1 HOST=127.0.0.1 PORT=3190 NODE_ENV=production \
      pm2 start .output/server/index.mjs --name "$APP" \
      --interpreter node --node-args='--env-file=.env'
  ) || true
}
on_exit() {
  code=$?
  trap - EXIT
  if [[ "$DONE" != 1 ]]; then
    echo "=== PUBLICACAO INTERROMPIDA: RETORNANDO AO ESTADO ANTERIOR ==="
    if [[ "$NGINX_CHANGED" == 1 ]]; then
      cp -a "$BACKUP" "$CONF"
      nginx -t && systemctl reload nginx || true
    fi
    if [[ "$SWAPPED" == 1 ]]; then restore_old_app; fi
    if [[ "$TIMER_SCHEDULED" == 1 ]]; then
      systemctl stop "$UNIT.timer" >/dev/null 2>&1 || true
    fi
  fi
  echo "Log privado: $LOG"
  exit "$code"
}
trap on_exit EXIT

test "$(id -u)" -eq 0
if [[ "$(printenv FIDELIZE_WEB_BETA_APPROVED || true)" != "SIM" ]]; then
  echo "BLOQUEADO: publicar beta requer FIDELIZE_WEB_BETA_APPROVED=SIM."
  exit 1
fi
test -f "$CONF" && test -f "$OLD/.env" && test -f "$OLD/.output/server/index.mjs"
test -d "$OLD/node_modules" && test -e "$BASE/.git"
nginx -t >/dev/null
test "$(grep -Fc 'proxy_pass http://127.0.0.1:3150;' "$CONF")" -eq 1 || {
  echo "BLOQUEADO: dominio nao esta na producao anterior 3150."; exit 1;
}
grep -qF 'default http://127.0.0.1:3150;' "$CONF" || {
  echo "BLOQUEADO: backend padrao de webhooks alterado."; exit 1;
}
grep -qF 'f406351f-487b-47db-b0d3-bd5cb918b6c3 http://127.0.0.1:3180;' "$CONF" || {
  echo "BLOQUEADO: webhook institucional nao aponta para 3180."; exit 1;
}
pm2 describe "$APP" >/dev/null
CURRENT="$(pm2 jlist | node -e '
let s="";process.stdin.on("data",x=>s+=x);
process.stdin.on("end",()=>{
  const a=JSON.parse(s).find(x=>x.name==="fidelize-v4-rc-3190");
  if(!a||a.pm2_env?.status!=="online")process.exit(2);
  process.stdout.write(a.pm2_env.pm_cwd||"");
});')"
test "$CURRENT" = "$OLD" || {
  echo "BLOQUEADO: 3190 mudou de versao desde o diagnostico: $CURRENT"; exit 1;
}
curl --noproxy '*' -fsS --max-time 12 http://127.0.0.1:3150/auth?mode=signin -o /dev/null
curl --noproxy '*' -fsS --max-time 12 http://127.0.0.1:3180/auth?mode=signin -o /dev/null
curl --noproxy '*' -fsS --max-time 12 http://127.0.0.1:3190/auth?mode=signin -o /dev/null

BUN="$(command -v bun || true)"
if [[ -z "$BUN" ]]; then BUN="/root/.bun/bin/bun"; fi
test -x "$BUN"
FREE="$(df -Pm /var/www | awk 'NR==2{print $4}')"
MEM="$(free -m | awk '/^Mem:/{print $7}')"
echo "Disco livre: $FREE MB, RAM disponivel: $MEM MB"
test "$FREE" -ge 3000 && test "$MEM" -ge 1000 || {
  echo "BLOQUEADO: recursos insuficientes para compilar."; exit 1;
}

git -C "$BASE" fetch origin "$BRANCH"
SHA="$(git -C "$BASE" rev-parse FETCH_HEAD)"
git -C "$BASE" worktree add --detach "$NEW" "$SHA"
test -f "$NEW/src/routes/_authenticated/hash/atendimento/index.tsx"
grep -q "refetchInterval: 8_000" "$NEW/src/routes/_authenticated/hash/atendimento/index.tsx"
grep -q 'status === "all" && recent' "$NEW/src/lib/crm/inbox.functions.ts"
cp -p "$OLD/.env" "$NEW/.env"
chmod 600 "$NEW/.env"
ln -s "$OLD/node_modules" "$NEW/node_modules"

echo "=== BUILD UNICO PARA ATUALIZAR A 3190 ==="
(
  cd "$NEW"
  nice -n 10 env NODE_OPTIONS="--max-old-space-size=1536" "$BUN" run build:vps >"$LOG" 2>&1
) || { tail -n 45 "$LOG"; exit 1; }
for FILE in .output/server/index.mjs .output/public/sw.js .output/public/sw-push.js; do
  test -f "$NEW/$FILE"
done

echo "=== TROCA DO PROCESSO EXISTENTE 3190, SEM NOVA PORTA ==="
SWAPPED=1
pm2 delete "$APP"
(
  cd "$NEW"
  FIDELIZE_STAGING_NO_WORKERS=1 HOST=127.0.0.1 PORT=3190 NODE_ENV=production \
    pm2 start .output/server/index.mjs --name "$APP" \
    --interpreter node --node-args='--env-file=.env'
)
OK=0
for N in 1 2 3 4 5 6 7 8 9 10; do
  if curl --noproxy '*' -fsS --max-time 12 "http://127.0.0.1:3190/auth?mode=signin" -o /dev/null &&
     curl --noproxy '*' -fsS --max-time 12 "http://127.0.0.1:3190/links/gynrace" -o /dev/null; then
    OK=1; break
  fi
  sleep 2
done
test "$OK" = 1 || { echo "3190 nao ficou saudavel"; exit 1; }

cp -a "$CONF" "$BACKUP"
cat > "$ROLLBACK" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
if test -f "$MARK"; then exit 0; fi
cp -a "$BACKUP" "$CONF"
nginx -t
systemctl reload nginx
systemctl stop "$UNIT.timer" >/dev/null 2>&1 || true
echo "Rollback do site para 3150. Webhooks 3150/3180 inalterados."
EOF
chmod 700 "$ROLLBACK"

cat > "$CONFIRM" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
grep -qF 'proxy_pass http://127.0.0.1:3190;' "$CONF"
grep -qF 'default http://127.0.0.1:3150;' "$CONF"
grep -qF 'f406351f-487b-47db-b0d3-bd5cb918b6c3 http://127.0.0.1:3180;' "$CONF"
curl --noproxy '*' -fsS --max-time 15 --resolve afidelize.app:443:127.0.0.1 https://afidelize.app/auth?mode=signin -o /dev/null
touch "$MARK"
systemctl stop "$UNIT.timer" >/dev/null 2>&1 || true
pm2 save
echo "FIDELIZE V4 WEB BETA CONFIRMADA. Carimbo, Atendimento e Bio Commerce dependem de homologacao funcional."
EOF
chmod 700 "$CONFIRM"

# Armamos o rollback ANTES de mudar o Nginx.
systemd-run --unit="$UNIT" --on-active=1800s /bin/bash "$ROLLBACK"
TIMER_SCHEDULED=1
NGINX_CHANGED=1
python3 - "$CONF" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); s=p.read_text()
m=re.search(r'map\s+\$arg_establishment_id\s+\$fidelize_wa_canary_backend\s*\{[^}]*\}',s,re.S)
if m is None: raise SystemExit("BLOQUEADO: mapa de webhooks ausente")
webhook_map=m.group(0)
old="proxy_pass http://127.0.0.1:3150;"
if s.count(old)!=1: raise SystemExit("BLOQUEADO: proxy web nao e unico")
s=s.replace(old,"proxy_pass http://127.0.0.1:3190;")
if webhook_map not in s: raise SystemExit("BLOQUEADO: webhooks sofreriam alteracao")
p.write_text(s)
PY
nginx -t
systemctl reload nginx
for PATH_TEST in '/auth?mode=signin' '/' '/links/gynrace' '/?plano=essencial'; do
  curl --noproxy '*' -fsS --max-time 20 --http1.1 \
    --resolve afidelize.app:443:127.0.0.1 \
    "https://afidelize.app$PATH_TEST" -o /dev/null
done
DONE=1
echo "=== FIDELIZE V4 WEB BETA ATIVA EM afidelize.app ==="
echo "Commit publicado: $SHA"
echo "3190: frontend + Atendimento atualizado"
echo "Webhooks preservados: padrao 3150, Fidelize 3180"
echo "Nenhum worker/porta nova. Sem alteracao no banco."
echo "ROLLBACK EM 30 MINUTOS: $UNIT.timer"
echo "Se site + Atendimento + WhatsApp funcionarem, CONFIRMAR: bash $CONFIRM"
echo "Se falhar, REVERTER: bash $ROLLBACK"
