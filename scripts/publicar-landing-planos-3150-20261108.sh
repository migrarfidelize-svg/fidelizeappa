#!/usr/bin/env bash
# Fidelize 3150: atualiza apenas o card de precos selecionado por ?plano=...
# Compila em worktree separado, valida e preserva o build anterior para rollback.
set -Eeuo pipefail
umask 077

BASE="/var/www/fidelize-smart-wallet-20261107-3150"
BRANCH="fix/3150-whatsapp-plan-links-20261108"
SHA="657d02c822dd482680dcd6a14498b61ca29b11f3"
APP="fidelize-smart-wallet-3150"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="/var/www/fidelize-landing-build-$STAMP"
BACKUP="/var/www/fidelize-3150-output-backup-$STAMP"
FAILED="/var/www/fidelize-3150-failed-output-$STAMP"
LOG="/tmp/fidelize-3150-links-$STAMP.log"
OLD_SHA=""
SOURCE_SWITCHED=0
SWAPPED=0
SUCCESS=0

cleanup() {
  code=$?
  trap - EXIT
  if [[ "$SUCCESS" != 1 ]]; then
    if [[ "$SWAPPED" == 1 ]]; then
      echo "=== ROLLBACK 3150 ==="
      if [[ -d "$BASE/.output" ]]; then mv "$BASE/.output" "$FAILED"; fi
      if [[ -d "$BACKUP" ]]; then mv "$BACKUP" "$BASE/.output"; fi
      pm2 restart "$APP" >/dev/null || true
    fi
    if [[ "$SOURCE_SWITCHED" == 1 && -n "$OLD_SHA" ]]; then
      git -C "$BASE" switch --detach "$OLD_SHA" >/dev/null || true
    fi
    echo "Erro detectado. Conferir log: $LOG"
  fi
  if [[ -d "$STAGE" ]]; then
    git -C "$BASE" worktree remove --force "$STAGE" >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap cleanup EXIT

echo "=== FIDELIZE | CORRECAO DOS LINKS DOS PLANOS ==="
git -C "$BASE" rev-parse --is-inside-work-tree >/dev/null
test -d "$BASE/node_modules"
test -f "$BASE/.env"
test -f "$BASE/.output/server/index.mjs"
test -f "$BASE/src/routes/index.tsx"
pm2 describe "$APP" >/dev/null
curl --noproxy '*' -fsS --max-time 15 \
  "http://127.0.0.1:3150/auth?mode=signin" -o /dev/null

OLD_SHA="$(git -C "$BASE" rev-parse HEAD)"
test "$OLD_SHA" = "$(git -C "$BASE" rev-parse 364ab1f1)"
if ! git -C "$BASE" diff --quiet -- src/routes/index.tsx; then
  echo "ERRO: index.tsx tem alteracoes locais. Nada alterado."; exit 2
fi

echo "=== 1. REVISANDO COMMIT E ESCOPO ==="
git -C "$BASE" fetch origin "$BRANCH"
test "$(git -C "$BASE" rev-parse FETCH_HEAD)" = "$SHA"
CHANGED="$(git -C "$BASE" diff --name-only "$OLD_SHA" "$SHA")"
if [[ "$CHANGED" != "src/routes/index.tsx" ]]; then
  echo "ERRO: alteracoes inesperadas: $CHANGED"; exit 3
fi

echo "=== 2. BUILD ISOLADO (SEM PARAR 3150) ==="
git -C "$BASE" worktree add --detach "$STAGE" "$SHA"
ln -s "$BASE/node_modules" "$STAGE/node_modules"
(
  cd "$STAGE"
  nice -n 10 env NODE_OPTIONS="--max-old-space-size=1536" \
    node --env-file="$BASE/.env" scripts/build-vps.mjs >"$LOG" 2>&1
) || {
  tail -n 55 "$LOG"
  exit 4
}
test -f "$STAGE/.output/server/index.mjs"
test -f "$STAGE/.output/public/sw.js"
test -f "$STAGE/.output/public/sw-push.js"
grep -q 'const requested = new URLSearchParams(window.location.search).get("plano")' \
  "$STAGE/src/routes/index.tsx"
echo "BUILD E ARQUIVOS PWA APROVADOS"

echo "=== 3. PROMOVENDO SOMENTE O BUILD 3150 ==="
mv "$BASE/.output" "$BACKUP"
SWAPPED=1
mv "$STAGE/.output" "$BASE/.output"

# Mantem o checkout sincronizado com os artefatos servidos.
git -C "$BASE" switch --detach "$SHA"
SOURCE_SWITCHED=1

pm2 restart "$APP" >/dev/null

READY=0
for attempt in $(seq 1 15); do
  if curl --noproxy '*' -fsS --max-time 10 \
       "http://127.0.0.1:3150/auth?mode=signin" -o /dev/null \
     && curl --noproxy '*' -fsS --max-time 10 \
       "http://127.0.0.1:3150/?plano=essencial&ver=$STAMP" -o /dev/null \
     && curl --noproxy '*' -fsS --max-time 10 \
       "http://127.0.0.1:3150/?plano=empresarial&ver=$STAMP" -o /dev/null; then
    READY=1
    break
  fi
  sleep 2
done

if [[ "$READY" != 1 ]]; then
  echo "ERRO: 3150 nao passou no smoke test. Revertendo."
  exit 5
fi

SUCCESS=1
echo "=== LANDING 3150 ATUALIZADA COM SUCESSO ==="
echo "Commit: $SHA"
echo "Site: 3150"
echo "WhatsApp: NENHUMA ALTERACAO"
echo "Backup do build anterior: $BACKUP"
echo "Log: $LOG"
