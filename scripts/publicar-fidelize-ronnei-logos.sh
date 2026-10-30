#!/usr/bin/env bash
# Fidelize: publica Ronnei Creator Ember + carrossel de logos com rollback.
set -Eeuo pipefail
umask 077
BASE="/var/www/fidelize-gynrace-release-20261029"
ENV_FILE="/var/www/fidelize-release-20261030-191934/.env"
BRANCH="fix/ronnei-creator-ember-brand-logos-20261030"
APP="fidelize-ronnei-logos-3100"
SITE=""
BACKUP=""
NEW=""
OLD_PORT=""
STAGED=0
WORKTREE=0
SWITCHED=0
SUCCESS=0

finish() {
  code=$?
  trap - EXIT
  if [[ "$SWITCHED" == 1 && "$SUCCESS" != 1 && -f "$BACKUP" ]]; then
    echo "[ROLLBACK] Restaurando Nginx anterior..."
    cp -p "$BACKUP" "$SITE"
    nginx -t && systemctl reload nginx
  fi
  if [[ "$SUCCESS" != 1 && "$STAGED" == 1 ]]; then pm2 delete "$APP" >/dev/null || true; fi
  if [[ "$SUCCESS" != 1 && "$WORKTREE" == 1 && -n "$NEW" ]]; then
    git -C "$BASE" worktree remove --force "$NEW" || true
  fi
  exit "$code"
}
trap finish EXIT

echo "===== FIDELIZE | RONNEI E LOGOS ====="
test -f "$ENV_FILE"
test -d "$BASE/.git"
if pm2 describe "$APP" >/dev/null 2>&1; then
  echo "Porta de staging já possui PM2 com esse nome. Abortando."; exit 1
fi
if ss -H -ltn '( sport = :3100 )' | grep -q .; then
  echo "Porta 3100 ocupada. Abortando."; exit 1
fi

echo "[1/6] Descobrindo upstream Nginx atual..."
SITE="$(grep -RlE 'server_name[[:space:]]+afidelize[.]app' \
  /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null |
  while IFS= read -r file; do readlink -f "$file"; done | sort -u)"
if [[ -z "$SITE" || "$SITE" == *$'\n'* ]]; then echo "Configuração Nginx ambígua"; exit 2; fi
count3080=$(grep -cF 'proxy_pass http://127.0.0.1:3080;' "$SITE" || true)
count3090=$(grep -cF 'proxy_pass http://127.0.0.1:3090;' "$SITE" || true)
if [[ "$count3080" == 2 && "$count3090" == 0 ]]; then
  OLD_PORT=3080
elif [[ "$count3090" == 2 && "$count3080" == 0 ]]; then
  OLD_PORT=3090
else
  echo "Configuração atual inesperada; exigidas duas rotas em 3080 ou 3090."; exit 2
fi
for path in / /auth /links/gynrace /ronneinaveia /ronnei-na-veia; do
  curl --noproxy '*' -fsS --compressed --max-time 20 \
    -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
    "http://127.0.0.1:$OLD_PORT$path" -o /dev/null
done
echo "[OK] Producao continua em $OLD_PORT"

echo "[2/6] Baixando atualização sem mexer no código publicado..."
git -C "$BASE" fetch origin "$BRANCH"
SHA="$(git -C "$BASE" rev-parse FETCH_HEAD)"
NEW="/var/www/fidelize-ronnei-logos-$(date +%Y%m%d-%H%M%S)"
git -C "$BASE" worktree add --detach "$NEW" "$SHA"
WORKTREE=1
cp -p "$ENV_FILE" "$NEW/.env"
grep -Fq 'filter:none;mix-blend-mode:normal;' "$NEW/src/components/landing/BrandMarquee.tsx"
grep -Fq 'creator-ember' "$NEW/src/lib/bio-commerce-theme.ts"

echo "[3/6] Build VPS isolado..."
BUN="$(command -v bun || true)"
if [[ -z "$BUN" ]]; then BUN="/root/.bun/bin/bun"; fi
test -x "$BUN"
(
  cd "$NEW"
  "$BUN" install --frozen-lockfile
  "$BUN" run build:vps
  test -f .output/server/index.mjs
)

echo "[4/6] Testes no staging 3100..."
(
  cd "$NEW"
  PORT=3100 HOST=127.0.0.1 NODE_ENV=production \
    pm2 start .output/server/index.mjs --name "$APP" --interpreter node \
      --node-args='--env-file=.env'
)
STAGED=1
ready=0
for i in $(seq 1 12); do
  if curl --noproxy '*' -fsS --compressed --max-time 20 \
    -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
    'http://127.0.0.1:3100/ronneinaveia' -o /tmp/ronnei-premium-stage.html 2>/dev/null &&
    grep -aqi 'Ronnei' /tmp/ronnei-premium-stage.html; then ready=1; break; fi
  sleep 2
done
if [[ "$ready" != 1 ]]; then
  echo "Falha na renderizacao do Ronnei em staging."
  pm2 logs "$APP" --lines 25 --nostream || true
  exit 3
fi
for path in / /auth /links/gynrace /ronnei-na-veia; do
  curl --noproxy '*' -fsS --compressed --max-time 20 \
    -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
    "http://127.0.0.1:3100$path" -o /dev/null
done
# Inclui a correção anterior do link do afiliado, se ainda não publicada.
curl --noproxy '*' -fsS --compressed --max-time 20 \
  'http://127.0.0.1:3100/indicar/gynrace-96cc0b' -o /tmp/ronnei-affiliate-og.html
grep -aqF '<meta property="og:image" content="' /tmp/ronnei-affiliate-og.html
echo "[OK] Home, login, Ronnei, GYNRACE e afiliados."

echo "[5/6] Backup Nginx e troca segura..."
BACKUP="/root/nginx-fidelize-before-ronnei-logos-$(date +%Y%m%d-%H%M%S).conf"
cp -p "$SITE" "$BACKUP"
echo "$BACKUP" > /root/fidelize-ronnei-logos-last-backup.txt
SWITCHED=1
sed -i "s|proxy_pass http://127\.0\.0\.1:$OLD_PORT;|proxy_pass http://127.0.0.1:3100;|g" "$SITE"
nginx -t
systemctl reload nginx

echo "[6/6] HTTPS e rollback automatico..."
passed=0
for i in $(seq 1 10); do
  if curl --noproxy '*' -fsSkS --compressed --http1.1 --max-time 25 \
      --resolve 'afidelize.app:443:127.0.0.1' \
      "https://afidelize.app/ronneinaveia?release=$SHA-$i" -o /tmp/ronnei-premium-live.html &&
    grep -aqi 'Ronnei' /tmp/ronnei-premium-live.html &&
    curl --noproxy '*' -fsSkS --compressed --max-time 20 \
      --resolve 'afidelize.app:443:127.0.0.1' \
      'https://afidelize.app/' -o /tmp/fidelize-logos-live.html &&
    grep -aqF 'fidelize-brand-marquee' /tmp/fidelize-logos-live.html; then
    passed=1; break
  fi
  sleep 2
done
if [[ "$passed" != 1 ]]; then echo "HTTPS falhou, restaurando versão anterior."; exit 4; fi
pm2 save
SUCCESS=1
echo "===== RONNEI E LOGOS PUBLICADOS ====="
echo "Commit: $SHA"
echo "Novo upstream: 127.0.0.1:3100"
echo "Anterior preservado: 127.0.0.1:$OLD_PORT"
echo "Backup: $BACKUP"
echo "Release: $NEW"
echo "Verifique visualmente a faixa de logos no navegador."
