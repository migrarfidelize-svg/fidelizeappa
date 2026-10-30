#!/usr/bin/env bash
# Fidelize: atualiza logos do carrossel em staging com rollback.
set -Eeuo pipefail
umask 077
BASE=/var/www/fidelize-gynrace-release-20261029
BRANCH=feature/gynrace-google-reviews-20261029
RELEASE=""
APP=""
PORT=""
SITE=""
BACKUP=""
CHANGED=0
STARTED=0
SUCCESS=0

finish() {
  if [[ "$CHANGED" == 1 && -f "$BACKUP" ]]; then
    echo "[ROLLBACK] Restaurando Nginx anterior."
    cp -p "$BACKUP" "$SITE"
    nginx -t && systemctl reload nginx
  fi
  if [[ "$SUCCESS" == 0 && "$STARTED" == 1 ]]; then pm2 delete "$APP" || true; fi
  if [[ "$SUCCESS" == 0 && -n "$RELEASE" && -d "$RELEASE" ]]; then
    git -C "$BASE" worktree remove --force "$RELEASE" || true
  fi
}
trap finish EXIT

echo "== 1/5 Identificando porta ativa da Fidelize =="
test -f "$BASE/.env"
SITE=$(grep -RlE 'server_name[[:space:]]+afidelize\.app' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null |
  while IFS= read -r f; do readlink -f "$f"; done | sort -u)
if [[ -z "$SITE" || "$SITE" == *$'\n'* ]]; then echo "NGINX AMBIGUO, abortando."; exit 2; fi
PORTS=$(grep -oE 'proxy_pass http://127\.0\.0\.1:30[0-9][0-9];' "$SITE" |
  sed -E 's/.*:([0-9]+);/\1/' | sort -u || true)
if [[ -z "$PORTS" || "$PORTS" == *$'\n'* ]]; then echo "PORTAS AMBIGUAS, abortando."; exit 3; fi
OLD="$PORTS"
COUNT=$(grep -cF "proxy_pass http://127.0.0.1:$OLD;" "$SITE" || true)
if [[ "$COUNT" != 2 ]]; then echo "PROXIES $COUNT, esperados 2, abortando."; exit 4; fi
echo "Producao: $OLD"
BUN=$(command -v bun || true)
if [[ -z "$BUN" ]]; then
  for candidate in /root/.bun/bin/bun /usr/local/bin/bun /usr/bin/bun /opt/bun/bin/bun; do
    if [[ -x "$candidate" ]]; then BUN="$candidate"; break; fi
  done
fi
if [[ -z "$BUN" || ! -x "$BUN" ]]; then echo "Bun nao localizado. Producao preservada."; exit 5; fi
export PATH="$(dirname "$BUN"):$PATH"
for candidate in 3071 3072 3073 3074 3075 3076 3077; do
  if ! ss -H -ltn "( sport = :$candidate )" | grep -q . &&
     ! pm2 describe "fidelize-marcas-$candidate" >/dev/null 2>&1; then
    PORT="$candidate"
    APP="fidelize-marcas-$candidate"
    break
  fi
done
if [[ -z "$PORT" ]]; then echo "Sem porta de staging livre. Producao preservada."; exit 6; fi

echo "== 2/5 Compilando em staging isolado =="
git -C "$BASE" fetch origin "$BRANCH"
SHA=$(git -C "$BASE" rev-parse "origin/$BRANCH")
SHORT_SHA=$(git -C "$BASE" rev-parse --short "origin/$BRANCH")
RELEASE="/var/www/fidelize-marcas-$(date +%Y%m%d-%H%M%S)-$SHORT_SHA"
git -C "$BASE" worktree add --detach "$RELEASE" "$SHA"
cp -p "$BASE/.env" "$RELEASE/.env"
(
  cd "$RELEASE"
  "$BUN" install --frozen-lockfile
  "$BUN" run build:vps
  test -f .output/server/index.mjs
  PORT="$PORT" HOST=127.0.0.1 NODE_ENV=production pm2 start \
    .output/server/index.mjs --name "$APP" --interpreter node \
    --node-args='--env-file=.env'
)
STARTED=1

echo "== 3/5 Checando logos e rota de login em staging =="
READY=0
for attempt in $(seq 1 12); do
  CODE=$(curl --noproxy '*' -sS --compressed --max-time 20 \
    -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
    -o /tmp/fidelize-marcas-staging.html -w '%{http_code}' \
    "http://127.0.0.1:$PORT/?marcas=$SHA-$attempt") || CODE=ERR
  if [[ "$CODE" == 200 ]] &&
     grep -aqF 'class="fidelize-brand-marquee"' /tmp/fidelize-marcas-staging.html &&
     grep -aqF 'fidelize-brand-logo-image' /tmp/fidelize-marcas-staging.html; then
    READY=1; break
  fi
  sleep 2
done
if [[ "$READY" != 1 ]]; then
  echo "ERRO: carrossel nao confirmado; producao intocada."
  pm2 logs "$APP" --lines 25 --nostream || true
  exit 7
fi
curl --noproxy '*' -fsS --max-time 15 "http://127.0.0.1:$PORT/auth" -o /dev/null

echo "== 4/5 Backup e troca Nginx controlada =="
BACKUP="/root/nginx-fidelize-marcas-$(date +%Y%m%d-%H%M%S).conf"
cp -p "$SITE" "$BACKUP"
CHANGED=1
sed -i "s|proxy_pass http://127\.0\.0\.1:$OLD;|proxy_pass http://127.0.0.1:$PORT;|g" "$SITE"
nginx -t
systemctl reload nginx
sleep 3

echo "== 5/5 Validando HTTPS oficial =="
PASSED=0
for attempt in $(seq 1 10); do
  CODE=$(curl --noproxy '*' -sSk --compressed --max-time 20 \
    --resolve 'afidelize.app:443:127.0.0.1' \
    -H 'Cache-Control: no-cache, no-store' -H 'Connection: close' \
    -o /tmp/fidelize-marcas-https.html -w '%{http_code}' \
    "https://afidelize.app/?fidelize-marcas=$SHA-$attempt") || CODE=ERR
  if [[ "$CODE" == 200 ]] &&
     grep -aqF 'class="fidelize-brand-marquee"' /tmp/fidelize-marcas-https.html; then
    PASSED=1; break
  fi
  echo "HTTPS $attempt: HTTP $CODE"
  sleep 2
done
if [[ "$PASSED" != 1 ]]; then echo "Falha HTTPS; rollback automatico."; exit 8; fi
curl --noproxy '*' -fsSk --compressed --max-time 20 \
  --resolve 'afidelize.app:443:127.0.0.1' https://afidelize.app/auth -o /dev/null
pm2 save
CHANGED=0
SUCCESS=1
echo "=== FIDELIZE: LOGOS PRETAS PADRONIZADAS PUBLICADAS ==="
echo "Commit: $SHA"
echo "Porta: $PORT"
echo "Backup: $BACKUP"
echo "ATENCAO: /auth HTTP 200 nao testa credenciais do administrador."
