#!/usr/bin/env bash
# RC unificada Fidelize: builds/testes isolados na 3190.
# Nao altera Nginx, 3150, 3180, registros de clientes nem banco.
set -Eeuo pipefail
umask 077
BASE="/var/www/fidelize-plans-feature-20261108"
PUBLIC="/var/www/fidelize-smart-wallet-20261107-3150"
BRANCH="release/fidelize-v4-unificada-midnight-20261108"
APP="fidelize-v4-rc-3190"
PORT=3190
STAMP="$(date +%Y%m%d-%H%M%S)"
DIR="/var/www/fidelize-v4-rc-$STAMP"
LOG="/root/fidelize-v4-rc-$STAMP.log"
DONE=0

abort() { echo "[BLOQUEADO] $*" >&2; exit 1; }
cleanup() {
  code=$?
  trap - EXIT
  if [[ "$DONE" != 1 ]]; then
    echo "[PARADO] A producao 3150 e o WhatsApp 3180 nao foram alterados."
    echo "[LOG] $LOG"
  fi
  exit "$code"
}
trap cleanup EXIT

echo "=== PRE-FLIGHT UNIFICACAO FIDELIZE ==="
test "$(id -u)" -eq 0 || abort "Execute como root."
git -C "$BASE" rev-parse --is-inside-work-tree >/dev/null || abort "Base 3180 nao encontrada"
git -C "$PUBLIC" rev-parse --is-inside-work-tree >/dev/null || abort "Base 3150 nao encontrada"
test -f "$BASE/.env" || abort "3180/.env ausente."
test -f "$PUBLIC/.env" || abort "3150/.env ausente."
test -d "$BASE/node_modules" || abort "Dependencias 3180 ausentes."
test -f "$BASE/bun.lock" || test -f "$BASE/bun.lockb" || abort "Lockfile do Bun ausente."
command -v pm2 >/dev/null && command -v node >/dev/null && command -v git >/dev/null || abort "Ferramentas ausentes."
BUN="$(command -v bun || true)"
if [[ -z "$BUN" ]]; then BUN="/root/.bun/bin/bun"; fi
test -x "$BUN" || abort "Bun ausente."
pm2 describe fidelize-smart-wallet-3150 >/dev/null || abort "3150 PM2 ausente."
pm2 describe fidelize-planos-3180 >/dev/null || abort "3180 PM2 ausente."
if pm2 describe "$APP" >/dev/null 2>&1 || ss -H -ltn "( sport = :$PORT )" | grep -q .; then
  abort "Porta 3190/processo ocupado. Nao substituir sem revisar."
fi

for p in 3150 3180; do
  code="$(curl --noproxy '*' -s --max-time 10 -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:$p/auth?mode=signin" || true)"
  [[ "$code" =~ ^(200|301|302|303|307|308)$ ]] || abort "Porta $p indisponivel: HTTP $code"
  echo "Versao $p: HTTP $code"
done

# Nao exibe segredos. Alerta quando chaves criticas diferem entre ambientes.
python3 - "$PUBLIC/.env" "$BASE/.env" <<'PY'
import sys
def read_keys(p):
    d={}
    for line in open(p,encoding="utf-8"):
        if line.strip().startswith("#") or "=" not in line: continue
        k,v=line.strip().split("=",1)
        d[k.strip()] = v.strip()
    return d
a,b=map(read_keys,sys.argv[1:])
critical=("SUPABASE","UAZAPI","HMAC","ASAAS","STRIPE","PAYMENT","WEBHOOK","VAPID","OTP","WALLET")
differences=sorted(k for k in a.keys()&b.keys() if any(x in k.upper() for x in critical) and a[k]!=b[k])
missing=sorted(k for k in a if any(x in k.upper() for x in critical) and k not in b)
if differences: print("ATENCAO - variaveis criticas com valores diferentes:",", ".join(differences))
if missing: print("ATENCAO - variaveis da 3150 ausentes na 3180:",", ".join(missing))
if not differences and not missing: print("Ambientes: nenhuma divergencia critica identificada entre variaveis compartilhadas")
PY

AVAIL="$(free -m | awk '/^Mem:/ {print $7}')"
DISK="$(df -Pm /var/www | awk 'NR==2 {print $4}')"
echo "Memoria disponivel: $AVAIL MB; disco livre: $DISK MB"
test "$AVAIL" -ge 1200 || abort "Memoria insuficiente para build isolado."
test "$DISK" -ge 4500 || abort "Disco insuficiente para release."

echo "=== OBTENDO RELEASE INTEGRADA ==="
git -C "$BASE" fetch origin "$BRANCH"
SHA="$(git -C "$BASE" rev-parse FETCH_HEAD)"
git -C "$BASE" merge-base --is-ancestor b04d8e6310972a23197fa34e267594957a403665 "$SHA" ||
  abort "Release nao contem correcoes testadas da 3180."
git -C "$BASE" worktree add --detach "$DIR" "$SHA"
cp -p "$BASE/.env" "$DIR/.env"
chmod 600 "$DIR/.env"
ln -s "$BASE/node_modules" "$DIR/node_modules"
echo "SHA: $SHA"
echo "Candidato: $DIR"

# SQL foi verificado por introspeccao em Supabase de producao.
test -f "$DIR/supabase/migrations/20261108053213_claim_verified_wallet_customers_20261108.sql" ||
  abort "Migration OTP ausente."
test -f "$DIR/src/lib/wallet-proximity.ts" || abort "Carteira de proximidade ausente."
test -f "$DIR/src/lib/crm/platform-support-bot.core.ts" || abort "Bot institucional ausente."
grep -q 'get("plano")' "$DIR/src/routes/index.tsx" || abort "Deep links dos planos ausentes."

echo "=== TESTES V4 (LOG PRIVADO) ==="
(
  cd "$DIR"
  env NODE_OPTIONS="--max-old-space-size=1536" "$BUN" run test > "$LOG" 2>&1
) || { tail -n 45 "$LOG"; abort "Testes falharam. Sem publicacao."; }
tail -n 9 "$LOG"

echo "=== BUILD V4 (LOG PRIVADO) ==="
(
  cd "$DIR"
  nice -n 10 env NODE_OPTIONS="--max-old-space-size=1536" "$BUN" run build:vps >>"$LOG" 2>&1
) || { tail -n 50 "$LOG"; abort "Build falhou. Sem publicacao."; }
for f in .output/server/index.mjs .output/public/sw.js .output/public/sw-push.js; do
  test -f "$DIR/$f" || abort "Artefato ausente: $f"
done

echo "=== TYPESCRIPT ==="
(
  cd "$DIR"
  env NODE_OPTIONS="--max-old-space-size=1536" "$BUN" x tsc --noEmit --pretty false >>"$LOG" 2>&1
) || { tail -n 50 "$LOG"; abort "TypeScript falhou. Sem publicacao."; }

echo "=== INICIANDO CANDIDATA ISOLADA ==="
(
  cd "$DIR"
  FIDELIZE_STAGING_NO_WORKERS=1 \
  NODE_ENV=production HOST=127.0.0.1 PORT="$PORT" \
  pm2 start .output/server/index.mjs --name "$APP" \
    --interpreter node --node-args='--env-file=.env'
) || abort "PM2 staging falhou."

READY=0
for i in $(seq 1 12); do
  if curl --noproxy '*' -fsS --max-time 10 \
    "http://127.0.0.1:3190/auth?mode=signin" -o /dev/null &&
    curl --noproxy '*' -fsS --max-time 10 \
    "http://127.0.0.1:3190/?plano=essencial" -o /dev/null &&
    curl --noproxy '*' -fsS --max-time 10 \
    "http://127.0.0.1:3190/links/gynrace" -o /dev/null; then
    READY=1; break
  fi
  sleep 2
done
test "$READY" = 1 || { pm2 logs "$APP" --lines 25 --nostream || true; abort "Staging HTTP falhou."; }

echo "=== RESULTADO ==="
echo "VERSAO_UNIFICADA_PRONTA_PARA_HOMOLOGACAO"
echo "Branch: $BRANCH"
echo "SHA: $SHA"
echo "Diretorio: $DIR"
echo "Staging: http://127.0.0.1:3190"
echo "Log: $LOG"
echo "3150 preservada; 3180 preservada; banco intocado."
echo "ATENCAO: HTTP 200, testes e build NAO substituem teste funcional de OTP, carimbo e checkout."
DONE=1
