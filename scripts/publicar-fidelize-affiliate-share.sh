#!/usr/bin/env bash
# Fidelize afiliados: build isolado, OG social testado e rollback automatico 3090 -> 3080.
set -Eeuo pipefail
umask 077
BASE="/var/www/fidelize-gynrace-release-20261029"
LIVE="/var/www/fidelize-release-20261030-191934"
BRANCH="fix/affiliate-creatives-link-preview-20261030"
NAME="fidelize-affiliates-preview-3090"
AFF_CODE="gynrace-96cc0b"
SITE=""
BACKUP=""
NEW=""
PROCESS_STARTED=0
WORKTREE_CREATED=0
SWITCHED=0
SUCCESS=0
cleanup() {
  code=$?
  trap - EXIT
  if [[ "$SWITCHED" == 1 && "$SUCCESS" != 1 && -f "$BACKUP" ]]; then
    echo "[ROLLBACK] Restaurando Nginx para porta 3080"
    cp -p "$BACKUP" "$SITE"
    nginx -t && systemctl reload nginx
  fi
  if [[ "$SUCCESS" != 1 && "$PROCESS_STARTED" == 1 ]]; then
    pm2 delete "$NAME" >/dev/null || true
  fi
  if [[ "$SUCCESS" != 1 && "$WORKTREE_CREATED" == 1 && -n "$NEW" ]]; then
    git -C "$BASE" worktree remove --force "$NEW" || true
  fi
  exit "$code"
}
trap cleanup EXIT
echo "=== FIDELIZE | CRIATIVOS E PREVIA SOCIAL ==="
test -f "$LIVE/.env"
test -d "$BASE/.git"
curl --noproxy '*' -fsS --max-time 20 http://127.0.0.1:3080/auth -o /dev/null
if pm2 describe "$NAME" >/dev/null 2>&1; then
  echo "ERRO: PM2 de staging ja existe."; exit 1
fi
if ss -H -ltn '( sport = :3090 )' | grep -q .; then
  echo "ERRO: porta 3090 ocupada."; exit 1
fi
echo "[1/6] GitHub..."
git -C "$BASE" fetch origin "$BRANCH"
SHA="$(git -C "$BASE" rev-parse FETCH_HEAD)"
NEW="/var/www/fidelize-affiliate-share-$(date +%Y%m%d-%H%M%S)"
git -C "$BASE" worktree add --detach "$NEW" "$SHA"
WORKTREE_CREATED=1
cp -p "$LIVE/.env" "$NEW/.env"
echo "[2/6] Build isolado..."
BUN="$(command -v bun || true)"
if [[ -z "$BUN" ]]; then BUN="/root/.bun/bin/bun"; fi
test -x "$BUN"
(
  cd "$NEW"
  "$BUN" install --frozen-lockfile
  "$BUN" run build:vps
  test -f .output/server/index.mjs
)
echo "[3/6] Staging 3090..."
(
  cd "$NEW"
  PORT=3090 HOST=127.0.0.1 NODE_ENV=production \
    pm2 start .output/server/index.mjs --name "$NAME" \
      --interpreter node --node-args='--env-file=.env'
)
PROCESS_STARTED=1
READY=0
for i in $(seq 1 15); do
  if curl --noproxy '*' -fsS --compressed --max-time 20 \
     -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
     "http://127.0.0.1:3090/indicar/$AFF_CODE?v=$SHA" \
     -o /tmp/fidelize-affiliate-og-staging.html 2>/dev/null \
     && grep -aqF '<meta property="og:image" content="' /tmp/fidelize-affiliate-og-staging.html \
     && grep -aqF 'afidelize.app/?ref=' /tmp/fidelize-affiliate-og-staging.html; then
    READY=1; break
  fi
  sleep 2
done
if [[ "$READY" != 1 ]]; then
  echo "ERRO: prévia OG de afiliados não retornou imagem e link."
  pm2 logs "$NAME" --lines 30 --nostream || true
  exit 2
fi
for route in /auth / /links/gynrace; do
  curl --noproxy '*' -fsS --compressed --max-time 20 \
     -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
     "http://127.0.0.1:3090$route" -o /dev/null
done
echo "[OK] OG:image, redirecionamento com indicacao, login e GYNRACE."
echo "[4/6] Localizando Nginx e salvando backup..."
SITE="$(grep -RlE 'server_name[[:space:]]+afidelize[.]app' \
  /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null \
  | while IFS= read -r f; do readlink -f "$f"; done | sort -u)"
if [[ -z "$SITE" || "$SITE" == *$'\n'* ]]; then
  echo "Nginx ambiguo. Producao mantida."; exit 3
fi
COUNT=$(grep -cF 'proxy_pass http://127.0.0.1:3080;' "$SITE" || true)
if [[ "$COUNT" != 2 ]]; then
  echo "Esperados dois proxys 3080. Encontrados: $COUNT. Sem alteracoes."; exit 3
fi
BACKUP="/root/nginx-fidelize-before-affiliate-preview-$(date +%Y%m%d-%H%M%S).conf"
cp -p "$SITE" "$BACKUP"
printf '%s\n' "$BACKUP" > /root/fidelize-affiliate-preview-last-backup.txt
echo "[5/6] Trocando 3080 para 3090..."
SWITCHED=1
sed -i 's|proxy_pass http://127\.0\.0\.1:3080;|proxy_pass http://127.0.0.1:3090;|g' "$SITE"
nginx -t
systemctl reload nginx
echo "[6/6] Confirmando HTTPS..."
OK=0
for i in $(seq 1 10); do
  if curl --noproxy '*' -fsSkS --compressed --http1.1 --max-time 25 \
     --resolve 'afidelize.app:443:127.0.0.1' \
     "https://afidelize.app/indicar/$AFF_CODE?v=$SHA-$i" \
     -o /tmp/fidelize-affiliate-og-live.html \
     && grep -aqF '<meta property="og:image" content="' /tmp/fidelize-affiliate-og-live.html \
     && curl --noproxy '*' -fsSkS --max-time 20 \
       --resolve 'afidelize.app:443:127.0.0.1' \
       'https://afidelize.app/links/gynrace' -o /dev/null; then
    OK=1; break
  fi
  sleep 2
done
if [[ "$OK" != 1 ]]; then echo "HTTPS falhou. Rollback automatico."; exit 4; fi
pm2 save
SUCCESS=1
echo "===== PREVIA DE CRIATIVOS PUBLICADA ====="
echo "Commit: $SHA"
echo "Novo Nginx: 127.0.0.1:3090"
echo "Versao anterior preservada: 127.0.0.1:3080"
echo "Backup: $BACKUP"
echo "Release: $NEW"
