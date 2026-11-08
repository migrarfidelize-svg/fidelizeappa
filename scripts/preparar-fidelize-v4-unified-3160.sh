#!/usr/bin/env bash
# Fidelize V4 + Smart Wallet: prepara staging, SEM trocar Nginx nem migrar banco.
# Executar como root na VPS, apos baixar a versao deste arquivo do GitHub.
set -Eeuo pipefail
umask 077

BASE="/var/www/fidelize-gynrace-release-20261029"
LIVE="/var/www/fidelize-smart-wallet-20261107-3150"
BRANCH="release/fidelize-v4-candidate-20261108"
SMART_BRANCH="feature/fidelize-smart-wallet-proximity-20261106"
SMART_SHA="fba7c3365526eaee5bc06366c61bb1513202c029"
PORT="3160"
NAME="fidelize-v4-unified-3160"
SITE="/etc/nginx/sites-enabled/afidelize"

die() { echo "[BLOQUEADO] $*" >&2; exit 1; }
echo "===== FIDELIZE | PREPARACAO ISOLADA V4 ====="
test "$(id -u)" -eq 0 || die "Execute como root."
test -d "$BASE/.git" || test -f "$BASE/.git" || die "Repositorio base nao encontrado."
test -f "$LIVE/.env" || die "Configuracao privada da versao 3150 ausente."
test -f "$SITE" || die "Nginx nao localizado."
command -v pm2 >/dev/null || die "PM2 ausente."
command -v node >/dev/null || die "Node ausente."
command -v git >/dev/null || die "Git ausente."
command -v openssl >/dev/null || die "OpenSSL ausente."
nginx -t >/dev/null || die "Nginx invalido antes da preparacao."
pm2 describe fidelize-smart-wallet-3150 >/dev/null 2>&1 || die "PM2 da producao 3150 ausente."
COUNT="$(grep -cF 'proxy_pass http://127.0.0.1:3150;' "$SITE" || true)"
test "$COUNT" -eq 2 || die "Nginx nao aponta exatamente duas vezes para 3150; interrompendo."
if pm2 describe "$NAME" >/dev/null 2>&1; then
  die "Processo staging 3160 ja existe; nao vamos substitui-lo."
fi
if ss -H -ltn "( sport = :$PORT )" | grep -q .; then
  die "Porta 3160 ocupada."
fi
FREE_KB="$(df -Pk /var/www | awk 'NR==2 {print $4}')"
test "$FREE_KB" -gt 6291456 || die "Menos de 6 GB livres: nao criar staging."
AVAILABLE_MB="$(free -m | awk '/^Mem:/ {print $7}')"
echo "Memoria disponivel: $AVAILABLE_MB MB"
test "$AVAILABLE_MB" -ge 1700 || die "Memoria disponivel muito baixa para build; producao preservada."

BUN="$(command -v bun || true)"
if test -z "$BUN" && test -x /root/.bun/bin/bun; then BUN="/root/.bun/bin/bun"; fi
test -n "$BUN" && test -x "$BUN" || die "Bun nao instalado."

echo "[1/6] Conciliando Smart Wallet em producao com a Fidelize V4..."
git -C "$LIVE" fetch origin "$SMART_BRANCH" >/dev/null
FOUND_SHA="$(git -C "$LIVE" rev-parse FETCH_HEAD)"
test "$FOUND_SHA" = "$SMART_SHA" || die "Branch Smart Wallet mudou: nova comparacao obrigatoria."
LIVE_HEAD="$(git -C "$LIVE" rev-parse HEAD)"
test "$LIVE_HEAD" = "364ab1f16fce603d724aaf09379f77a51c9c0bb0" || die "Commit base mudou: nova auditoria obrigatoria."

# A leitura PGRST303 foi adicionada pelo GitHub depois do HEAD desta
# instalacao: o arquivo local de producao precisa permanecer sem edicoes.
test -z "$(git -C "$LIVE" status --porcelain -- src/lib/my-wallet.functions.ts)" || die "Arquivo da carteira alterado localmente."
git -C "$BASE" fetch origin "$BRANCH" >/dev/null
SHA="$(git -C "$BASE" rev-parse FETCH_HEAD)"
echo "Release V4 + Smart Wallet: $SHA"

# Nao permitir codigo desconhecido nao rastreado na instalacao atual.
EXTRAS="$(git -C "$LIVE" ls-files --others --exclude-standard -- src scripts supabase public)"
test -z "$EXTRAS" || { printf '%s\n' "$EXTRAS"; die "Existem fontes nao rastreadas; revisar."; }

DIFFERENCES="$(git -C "$LIVE" diff --name-only "$SMART_SHA" -- . ':(exclude).env' ':(exclude)src/routeTree.gen.ts' ':(exclude)src/lib/my-wallet.functions.ts')"
found_admin=0
found_linktree=0
found_hash=0
found_indicar=0
while IFS= read -r file; do
  test -n "$file" || continue
  test -f "$LIVE/$file" || die "Arquivo local ausente: $file"
  git -C "$BASE" cat-file -e "$SHA:$file" 2>/dev/null || die "Arquivo ausente na V4: $file"
  local_blob="$(git -C "$LIVE" hash-object "$LIVE/$file")"
  v4_blob="$(git -C "$BASE" rev-parse "$SHA:$file")"
  if test "$local_blob" = "$v4_blob"; then
    echo "[PRESERVADO] $file"
    continue
  fi
  case "$file" in
    "src/lib/admin.functions.ts") found_admin=1 ;;
    "src/lib/linktree.functions.ts") found_linktree=1 ;;
    "src/routes/_authenticated/hash.tsx") found_hash=1 ;;
    'src/routes/indicar.$code.ts') found_indicar=1 ;;
    *) die "Diferenca desconhecida: $file" ;;
  esac
  # Impedir alteracoes manuais nos quatro arquivos: devem ser a versao
  # intacta do HEAD da instalacao anterior, atualizada apenas no V4.
  head_blob="$(git -C "$LIVE" rev-parse "HEAD:$file")"
  test "$local_blob" = "$head_blob" || die "Modificacao local nao conciliada: $file"
  echo "[MELHORIA V4 CONFERIDA] $file"
done <<< "$DIFFERENCES"
test "$found_admin" -eq 1 && test "$found_linktree" -eq 1 && \
  test "$found_hash" -eq 1 && test "$found_indicar" -eq 1 || \
  die "O conjunto das quatro melhorias V4 mudou; nao prosseguir."
echo "[OK] 14 arquivos preservados e quatro melhorias V4 reconhecidas."

echo "[2/6] Criando backup privado de configuracao e snapshot PM2..."
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/root/fidelize-release-backups/$STAMP"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
cp -L -p "$SITE" "$BACKUP/nginx-afidelize.conf"
cp -p "$LIVE/.env" "$BACKUP/live.env"
pm2 jlist > "$BACKUP/pm2.json"
git -C "$LIVE" status --short > "$BACKUP/live-git-status.txt"
echo "$SMART_SHA" > "$BACKUP/live-smart-wallet-sha.txt"
# Backups contem credenciais privadas; somente root tem acesso.
chmod 600 "$BACKUP"/*

echo "[3/6] Preparando release consolidada V4 + Smart Wallet..."
RELEASE="/var/www/fidelize-v4-unified-$STAMP"
test ! -e "$RELEASE" || die "Diretorio staging ja existe."
git -C "$BASE" worktree add --detach "$RELEASE" "$SHA"
cp -p "$LIVE/.env" "$RELEASE/.env"
chmod 600 "$RELEASE/.env"

# QR de resgate passa a exigir chave HMAC privada. Preserva a chave existente;
# caso nao haja, gera nova chave apenas na configuracao do staging.
if grep -q '^REDEEM_HMAC_SECRET=' "$RELEASE/.env"; then
  SECRET_LENGTH="$(grep '^REDEEM_HMAC_SECRET=' "$RELEASE/.env" | head -n1 | cut -d= -f2- | wc -c)"
  test "$SECRET_LENGTH" -ge 34 || die "REDEEM_HMAC_SECRET presente mas curta."
else
  printf '\nREDEEM_HMAC_SECRET=%s\n' "$(openssl rand -hex 48)" >> "$RELEASE/.env"
fi
test -f "$RELEASE/src/lib/wallet-proximity.ts" || die "Smart Wallet proximidade ausente."
test -f "$RELEASE/src/lib/crm/platform-support-bot.core.ts" || die "Bot 3 botoes ausente."
test -f "$RELEASE/supabase/migrations/20261108053213_claim_verified_wallet_customers_20261108.sql" || die "Migration de carteira ausente."

echo "[4/6] Instalando dependencias e compilando isoladamente..."
(
 cd "$RELEASE"
 "$BUN" install --frozen-lockfile
 "$BUN" run build:vps
 test -f .output/server/index.mjs
 test -f .output/public/sw.js
 test -f .output/public/sw-push.js
) || die "Build falhou; a producao nao foi alterada."

echo "[5/6] Subindo somente staging local na porta 3160..."
(
 cd "$RELEASE"
 HOST=127.0.0.1 PORT="$PORT" NODE_ENV=production FIDELIZE_STAGING_NO_WORKERS=1 \
  pm2 start .output/server/index.mjs --name "$NAME" \
  --interpreter node --node-args='--env-file=.env'
) || die "PM2 staging falhou; producao 3150 intacta."

echo "[6/6] Verificando rotas HTTP locais, sem mexer no Nginx..."
SUCCESS=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  CODE="$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' \
    -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
    --max-time 15 "http://127.0.0.1:$PORT/auth" || true)"
  if [[ "$CODE" =~ ^(200|301|302|303|307|308)$ ]]; then SUCCESS=1; break; fi
  sleep 2
done
if test "$SUCCESS" -ne 1; then
  pm2 logs "$NAME" --lines 40 --nostream || true
  die "Staging nao responde /auth em 3160. Producao 3150 mantida."
fi
for route in "/" "/links/gynrace"; do
  CODE="$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' \
    -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
    --max-time 15 "http://127.0.0.1:$PORT$route" || true)"
  echo "ROTA $route => HTTP $CODE"
  [[ "$CODE" =~ ^(200|301|302|303|307|308)$ ]] || die "Rota $route falhou no staging."
done

echo "===== STAGING V4 PRONTO PARA HOMOLOGACAO ====="
echo "Commit consolidado: $SHA"
echo "Diretorio de staging: $RELEASE"
echo "Processo: $NAME (127.0.0.1:$PORT)"
echo "Backup privado: $BACKUP"
echo "PRODUCAO MANTIDA: 127.0.0.1:3150"
echo "ATENCAO: Nao houve migracao de banco, troca Nginx ou deploy publico."
echo "ATENCAO: Cartoes, OTP, CRM, Wallet e paginas exclusivas requerem teste funcional antes do cutover."
