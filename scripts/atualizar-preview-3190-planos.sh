#!/usr/bin/env bash
# Fidelize V4: patch de deep links no preview privado 3190.
# Compila em novo worktree e porta 3191; troca 3190 so apos smoke checks.
# Producao/Nginx/3150/3180/Supabase intocados.
set -Eeuo pipefail
umask 077
OLD="/var/www/fidelize-v4-rc-20261109-024409"
BASE="/var/www/fidelize-plans-feature-20261108"
BRANCH="release/fidelize-v4-unificada-midnight-20261108"
APP="fidelize-v4-rc-3190"
TEMPAPP="fidelize-v4-planfix-3191"
STAMP="$(date +%Y%m%d-%H%M%S)"
NEW="/var/www/fidelize-v4-planfix-$STAMP"
LOG="/root/fidelize-v4-planfix-$STAMP.log"
SWAPPING=0
COMPLETE=0
rollback() {
  code=$?
  trap - EXIT
  if [[ "$COMPLETE" != 1 ]]; then
    echo "=== FALHA: PREVIEW ANTERIOR PRESERVADO/RESTAURADO ==="
    if [[ "$SWAPPING" == 1 ]]; then
      pm2 delete "$APP" >/dev/null 2>&1 || true
      (
        cd "$OLD"
        FIDELIZE_STAGING_NO_WORKERS=1 HOST=127.0.0.1 PORT=3190 NODE_ENV=production \
          pm2 start .output/server/index.mjs --name "$APP" \
          --interpreter node --node-args='--env-file=.env'
      ) || true
    fi
  fi
  pm2 delete "$TEMPAPP" >/dev/null 2>&1 || true
  echo "Log: $LOG"
  exit "$code"
}
trap rollback EXIT

echo "=== PREPARANDO HOTFIX DO PREVIEW 3190 ==="
test "$(id -u)" -eq 0
test -f "$OLD/.env" && test -f "$OLD/.output/server/index.mjs"
test -d "$OLD/node_modules"
pm2 describe "$APP" >/dev/null
if pm2 describe "$TEMPAPP" >/dev/null 2>&1; then
  echo "Processo temporario 3191 ja existe: abortando"; exit 1
fi
if ss -H -ltn '( sport = :3191 )' | grep -q .; then
  echo "Porta 3191 ocupada: abortando"; exit 1
fi
AVAILABLE="$(free -m | awk '/^Mem:/ {print $7}')"
DISK="$(df -Pm /var/www | awk 'NR==2 {print $4}')"
echo "Memoria disponivel: $AVAILABLE MB | Disco: $DISK MB"
test "$AVAILABLE" -gt 1300 && test "$DISK" -gt 3000

BUN="$(command -v bun || true)"
[[ -n "$BUN" ]] || BUN="/root/.bun/bin/bun"
test -x "$BUN"
git -C "$BASE" fetch origin "$BRANCH"
SHA="$(git -C "$BASE" rev-parse FETCH_HEAD)"
git -C "$BASE" merge-base --is-ancestor 6270ee622ce7ba786443f47540f35a6833764de7 "$SHA" || {
  echo "Versao sem o hotfix"; exit 1;
}
git -C "$BASE" worktree add --detach "$NEW" "$SHA"
cp -p "$OLD/.env" "$NEW/.env"
chmod 600 "$NEW/.env"
ln -s "$OLD/node_modules" "$NEW/node_modules"
grep -q 'scrollIntoView' "$NEW/src/routes/index.tsx"

echo "=== BUILD ISOLADO (SEM REPETIR TSC DA VPS) ==="
(
  cd "$NEW"
  nice -n 10 env NODE_OPTIONS="--max-old-space-size=1536" "$BUN" run build:vps >"$LOG" 2>&1
) || { tail -40 "$LOG"; exit 1; }
for file in .output/server/index.mjs .output/public/sw.js .output/public/sw-push.js; do
  test -f "$NEW/$file"
done
grep -R -l 'scrollIntoView' "$NEW/.output/public/assets/"*.js >/dev/null || {
  echo "Novo bundle nao contem correcao de rolagem"; exit 1;
}

echo "=== TESTANDO NOVO BUILD SEM TOCAR NA 3190 ==="
(
  cd "$NEW"
  FIDELIZE_STAGING_NO_WORKERS=1 HOST=127.0.0.1 PORT=3191 NODE_ENV=production \
    pm2 start .output/server/index.mjs --name "$TEMPAPP" \
    --interpreter node --node-args='--env-file=.env'
)
OK=0
for i in $(seq 1 12); do
  if curl --noproxy '*' -fsS --max-time 10 "http://127.0.0.1:3191/?plano=essencial" -o /dev/null &&
     curl --noproxy '*' -fsS --max-time 10 "http://127.0.0.1:3191/auth?mode=signin" -o /dev/null &&
     curl --noproxy '*' -fsS --max-time 10 "http://127.0.0.1:3191/links/gynrace" -o /dev/null; then
    OK=1; break
  fi
  sleep 2
done
test "$OK" == 1 || { pm2 logs "$TEMPAPP" --lines 30 --nostream || true; exit 1; }

echo "=== ATUALIZANDO SOMENTE PREVIEW 3190 ==="
SWAPPING=1
pm2 delete "$APP"
(
  cd "$NEW"
  FIDELIZE_STAGING_NO_WORKERS=1 HOST=127.0.0.1 PORT=3190 NODE_ENV=production \
    pm2 start .output/server/index.mjs --name "$APP" \
    --interpreter node --node-args='--env-file=.env'
)
OK=0
for i in $(seq 1 10); do
  if curl --noproxy '*' -fsS --max-time 10 "http://127.0.0.1:3190/?plano=essencial" -o /dev/null &&
     curl --noproxy '*' -fsS --max-time 10 "http://127.0.0.1:3190/auth?mode=signin" -o /dev/null; then
    OK=1; break
  fi
  sleep 2
done
test "$OK" == 1
COMPLETE=1
echo "=== PREVIEW ATUALIZADO COM SUCESSO ==="
echo "SHA: $SHA"
echo "Diretorio: $NEW"
echo "http://localhost:4190/?plano=essencial"
echo "Nginx, portas 3150 e 3180 nao foram alterados."
