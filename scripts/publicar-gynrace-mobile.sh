#!/usr/bin/env bash
# GYNRACE Mobile Edition: build paralelo 3070, preflight e rollback automatico.
# Uso: bash scripts/publicar-gynrace-mobile.sh
set -Eeuo pipefail
umask 077
BASE=/var/www/fidelize-gynrace-release-20261029
BRANCH=feature/gynrace-google-reviews-20261029
PORT=3070
NAME=fidelize-gynrace-mobile-3070
MARKER=racing-photo-original-2026-10-29
CHANGED=0
BACKUP=""
SITE=""
NEW=""
WORKTREE_CREATED=0
PM2_STARTED=0
DEPLOY_SUCCESS=0

# SSH non-interativo nao carrega o PATH configurado no ~/.bashrc.
# Localizar Bun ANTES de criar um novo worktree, sem instalar pacotes globais.
BUN_BIN="$(command -v bun || true)"
if [[ -z "$BUN_BIN" ]]; then
  for candidate in "$HOME/.bun/bin/bun" /root/.bun/bin/bun /usr/local/bin/bun /usr/bin/bun /opt/bun/bin/bun; do
    if [[ -x "$candidate" ]]; then BUN_BIN="$candidate"; break; fi
  done
fi
if [[ -z "$BUN_BIN" ]]; then
  BUN_BIN="$(find /root/.bun /opt/bun /usr/local/bin -maxdepth 4 -type f -name bun -perm /111 -print -quit 2>/dev/null || true)"
fi
if [[ -z "$BUN_BIN" || ! -x "$BUN_BIN" ]]; then
  echo "ERRO: Bun nao localizado na VPS. Nginx e producao nao foram alterados."
  echo "Diagnostico seguro: ssh root@190.102.43.86 'ls -l /root/.bun/bin/bun; command -v bun'"
  exit 10
fi
export PATH="$(dirname "$BUN_BIN"):$PATH"
echo "[OK] Bun encontrado em: $BUN_BIN"

finish() {
  if [[ "$CHANGED" == 1 && -n "$BACKUP" && -f "$BACKUP" ]]; then
    echo "[ROLLBACK] Restaurando Nginx para 3060."
    cp -p "$BACKUP" "$SITE"
    nginx -t && systemctl reload nginx
  fi
  # Nunca eliminar a porta 3070 quando a publicacao realmente passar.
  # Em caso de falha, liberar apenas o PM2 criado nesta execucao.
  if [[ "$DEPLOY_SUCCESS" == 0 && "$PM2_STARTED" == 1 ]]; then
    echo "[LIMPEZA] Encerrando somente staging PM2 criado nesta execucao."
    pm2 delete "$NAME" || true
    PM2_STARTED=0
  fi
  if [[ "$WORKTREE_CREATED" == 1 && "$PM2_STARTED" == 0 && -n "$NEW" && "$DEPLOY_SUCCESS" == 0 ]]; then
    echo "[LIMPEZA] Removendo somente o worktree temporario criado nesta execucao."
    git -C "$BASE" worktree remove --force "$NEW" || true
  fi
}
trap finish EXIT

echo "== 1/5: Verificando producao e a porta 3070 =="
test -f "$BASE/.env"
curl --noproxy '*' -fsS --compressed --max-time 15 \
  http://127.0.0.1:3060/links/gynrace -o /tmp/gynrace-base-before.html
grep -aq 'data-gynrace-edition=' /tmp/gynrace-base-before.html
if ss -H -ltn '( sport = :3070 )' | grep -q .; then
  echo "ERRO: porta 3070 ja esta ocupada. Producao nao alterada."
  exit 2
fi
if pm2 describe "$NAME" >/dev/null 2>&1; then
  echo "ERRO: nome PM2 de staging ja existe. Producao nao alterada."
  exit 3
fi

echo "== 2/5: Build isolado do ultimo GitHub =="
git -C "$BASE" fetch origin "$BRANCH"
SHA=$(git -C "$BASE" rev-parse "origin/$BRANCH")
NEW="/var/www/fidelize-gynrace-mobile-$(date +%Y%m%d-%H%M%S)"
git -C "$BASE" worktree add --detach "$NEW" "$SHA"
WORKTREE_CREATED=1
cp -p "$BASE/.env" "$NEW/.env"
(
  cd "$NEW"
  "$BUN_BIN" --version
  "$BUN_BIN" install --frozen-lockfile
  "$BUN_BIN" run build:vps
  test -f .output/server/index.mjs
  test -f .output/public/assets/gynrace/gynrace-kawasaki-original-premium.webp
  echo 'b92f90af70220af534409ccc1802dde3f06b2486129ae4144ff0ee44a56f98da  .output/public/assets/gynrace/gynrace-kawasaki-original-premium.webp' | sha256sum -c -
  PORT=3070 HOST=127.0.0.1 NODE_ENV=production pm2 start \
    .output/server/index.mjs --name "$NAME" --interpreter node \
    --node-args='--env-file=.env'
)
PM2_STARTED=1

echo "== 3/5: Validacao do novo build sem tocar no site =="
READY=0
for i in $(seq 1 12); do
  if curl --noproxy '*' -fsS --compressed --max-time 15 \
      -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
      http://127.0.0.1:3070/links/gynrace -o /tmp/gynrace-mobile-preview.html \
      && grep -aqF "$MARKER" /tmp/gynrace-mobile-preview.html; then
    READY=1
    break
  fi
  sleep 2
done
if [[ "$READY" != 1 ]]; then
  echo "ERRO: versao mobile nao confirmada na 3070. Producao intocada."
  pm2 logs "$NAME" --lines 25 --nostream || true
  exit 4
fi
curl --noproxy '*' -fsS --max-time 15 \
  http://127.0.0.1:3070/assets/gynrace/gynrace-kawasaki-original-premium.webp -o /dev/null
curl --noproxy '*' -fsS --max-time 15 \
  http://127.0.0.1:3070/auth -o /dev/null
echo "[OK] Pagina mobile, imagem e rota de login no staging."

echo "== 4/5: Backup e troca segura do Nginx =="
SITE=$(grep -RlE 'server_name[[:space:]]+afidelize\.app' \
  /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null |
  while IFS= read -r f; do readlink -f "$f"; done | sort -u)
if [[ -z "$SITE" || "$SITE" == *$'\n'* ]]; then
  echo "ERRO: configuracao Nginx ambigua. Producao intocada."
  exit 5
fi
COUNT=$(grep -cF 'proxy_pass http://127.0.0.1:3060;' "$SITE" || true)
if [[ "$COUNT" != 2 ]]; then
  echo "ERRO: Nginx nao apresenta as duas rotas atuais para 3060."
  exit 6
fi
BACKUP="/root/nginx-gynrace-mobile-$(date +%Y%m%d-%H%M%S).conf"
cp -p "$SITE" "$BACKUP"
CHANGED=1
sed -i 's|proxy_pass http://127\.0\.0\.1:3060;|proxy_pass http://127.0.0.1:3070;|g' "$SITE"
nginx -t
systemctl reload nginx
sleep 3

echo "== 5/5: HTTPS final + rollback em qualquer falha =="
PASSED=0
for i in $(seq 1 10); do
  CODE=$(curl --noproxy '*' -skS --compressed --http1.1 --max-time 20 \
    --resolve 'afidelize.app:443:127.0.0.1' \
    -H 'Cache-Control: no-cache, no-store' -H 'Connection: close' \
    -o /tmp/gynrace-mobile-live.html -w '%{http_code}' \
    "https://afidelize.app/links/gynrace?release=$SHA-$i") || CODE=ERR
  if [[ "$CODE" == 200 ]] && grep -aqF "$MARKER" /tmp/gynrace-mobile-live.html; then
    PASSED=1
    echo "[OK] HTTPS entregando a GYNRACE Mobile Edition."
    break
  fi
  echo "Verificacao HTTPS $i: $CODE. Repetindo..."
  sleep 2
done
if [[ "$PASSED" != 1 ]]; then
  echo "ERRO: layout novo nao encontrado no HTTPS, realizando rollback."
  exit 7
fi
curl --noproxy '*' -fsSk --max-time 20 \
  --resolve 'afidelize.app:443:127.0.0.1' \
  'https://afidelize.app/assets/gynrace/gynrace-kawasaki-original-premium.webp' -o /dev/null
curl --noproxy '*' -fsSk --max-time 20 \
  --resolve 'afidelize.app:443:127.0.0.1' \
  'https://afidelize.app/auth' -o /dev/null
pm2 save
CHANGED=0
DEPLOY_SUCCESS=1

echo "=== GYNRACE FOTO ORIGINAL HD + HERO SEM SOBREPOSICAO PUBLICADOS ==="
echo "Commit: $SHA"
echo "Porta atual: 3070"
echo "Backup: $BACKUP"
echo "Release: $NEW"
echo "OBS: /auth HTTP 200 nao comprova funcionamento da senha administrativa."
