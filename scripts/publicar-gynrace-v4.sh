#!/usr/bin/env bash
# Fidelize / GYNRACE - publicar com rollback, sem download de arquivo no Windows.
set -Eeuo pipefail
OUT=$(mktemp -d /tmp/gynrace-release.XXXXXXXX)
SITE=""
BACKUP=""
ROLLBACK=0

finalizar() {
  if [[ "$ROLLBACK" == 1 && -n "$BACKUP" && -f "$BACKUP" ]]; then
    echo "[ROLLBACK] Restaurando o Nginx da porta 3050."
    cp -p "$BACKUP" "$SITE"
    nginx -t && systemctl reload nginx
  fi
  echo "[DIAGNOSTICO] Arquivos: $OUT"
}
trap finalizar EXIT

echo "[1/4] Validando 3060 com o Host publico antes de alterar Nginx"
curl --noproxy '*' -fsS --compressed --max-time 20 \
  -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
  'http://127.0.0.1:3060/links/gynrace' -o "$OUT/preflight.html"
if ! grep -aqF 'data-gynrace-edition=' "$OUT/preflight.html"; then
  echo "ERRO: porta 3060 com Host afidelize.app nao mostra Racing Edition."
  echo "NENHUMA CONFIGURACAO MODIFICADA."
  exit 2
fi
curl --noproxy '*' -fsS --max-time 15 \
  'http://127.0.0.1:3060/assets/gynrace/mt09-garage.svg' -o /dev/null
curl --noproxy '*' -fsS --max-time 15 \
  'http://127.0.0.1:3060/auth' -o /dev/null
echo "[OK] Racing, imagem e rota de login servidas na 3060."

echo "[2/4] Encontrando Nginx e criando backup"
SITE=$(grep -RlE 'server_name[[:space:]]+afidelize\.app' \
    /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null |
    while IFS= read -r f; do readlink -f "$f"; done | sort -u)
if [[ -z "$SITE" || "$SITE" == *$'\n'* ]]; then
  echo "ERRO: zero ou multiplos arquivos Nginx para o dominio."
  exit 3
fi
COUNT=$(grep -cF 'proxy_pass http://127.0.0.1:3050;' "$SITE" || true)
if [[ "$COUNT" != 2 ]]; then
  echo "ERRO: esperadas duas referencias 3050; encontradas $COUNT."
  exit 4
fi
BACKUP="/root/nginx-gynrace-v4-$(date +%Y%m%d-%H%M%S).conf"
cp -p "$SITE" "$BACKUP"

echo "[3/4] Nginx: 3050 -> 3060"
ROLLBACK=1
sed -i 's|proxy_pass http://127\.0\.0\.1:3050;|proxy_pass http://127.0.0.1:3060;|g' "$SITE"
nginx -t
systemctl reload nginx
sleep 3
nginx -T 2>/dev/null | grep -nE \
  'server_name afidelize.app|proxy_pass http://127.0.0.1:30' | head -24 || true

echo "[4/4] Testando HTTPS local sem proxy externo"
PASSED=0
for I in $(seq 1 10); do
  CODE=$(curl --noproxy '*' --http1.1 -skS --compressed --max-time 15 \
    --resolve 'afidelize.app:443:127.0.0.1' \
    -H 'Cache-Control: no-cache, no-store' \
    -H 'Connection: close' \
    -D "$OUT/headers.txt" -o "$OUT/https.html" \
    -w '%{http_code}' \
    "https://afidelize.app/links/gynrace?deployprobe=$(date +%s)-$I") || CODE="ERRO"
  if [[ "$CODE" == 200 ]] && grep -aqF 'data-gynrace-edition=' "$OUT/https.html"; then
    PASSED=1
    echo "[OK] HTTPS Racing Edition na tentativa $I"
    break
  fi
  echo "HTTPS tentativa $I: HTTP $CODE; layout exclusivo ausente."
  sleep 2
done
if [[ "$PASSED" != 1 ]]; then
  echo "ERRO: HTTPS continua com layout anterior. Diagnostico:"
  grep -aiE 'HTTP/|location:|cache-control:|server:|age:' "$OUT/headers.txt" || true
  grep -aoE 'data-gynrace-edition=|Todos os caminhos da marca|Bio Commerce by Fidelize' \
    "$OUT/https.html" | sort -u | head -8 || true
  exit 5
fi

curl --noproxy '*' -fsSk --compressed --max-time 20 \
  --resolve 'afidelize.app:443:127.0.0.1' \
  'https://afidelize.app/assets/gynrace/mt09-garage.svg' -o /dev/null
curl --noproxy '*' -fsSk --compressed --max-time 20 \
  --resolve 'afidelize.app:443:127.0.0.1' \
  'https://afidelize.app/auth' -o /dev/null

ROLLBACK=0
echo "=== PUBLICACAO VALIDADA: GYNRACE HTTPS OK ==="
echo "DOMINIO: porta 3060"
echo "BACKUP: $BACKUP"
echo "ATENCAO: HTTP /auth OK nao garante senha e login admin."
