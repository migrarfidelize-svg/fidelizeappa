#!/usr/bin/env bash
# Fidelize: cutover reversivel da versao validada (3080 -> site publico).
# Requer staging ativo, banco migrado e Nginx atualmente apontando para 3070.
set -Eeuo pipefail
umask 077
STAGING="fidelize-release-staging-3080"
PORT_OLD=3070
PORT_NEW=3080
BACKUP=""
SITE=""
SUCCESS=0
SWITCHED=0

rollback() {
  local exit_code=$?
  trap - EXIT
  if [[ "$SUCCESS" != 1 && "$SWITCHED" == 1 && -n "$BACKUP" && -f "$BACKUP" ]]; then
    echo "[ROLLBACK] Falha detectada (codigo $exit_code); voltando site para 3070..."
    cp -p "$BACKUP" "$SITE"
    nginx -t && systemctl reload nginx
    echo "[ROLLBACK] Producao anterior restaurada. A versao de staging segue acessivel em 3080."
  fi
  exit "$exit_code"
}
trap rollback EXIT

echo "===== FIDELIZE | PUBLICACAO CONTROLADA ====="
echo "[1/5] Verificando PM2, staging, producao e assets..."
pm2 jlist | node -e '
  let data = "";
  process.stdin.on("data", chunk => data += chunk);
  process.stdin.on("end", () => {
    const apps = JSON.parse(data);
    const staging = apps.find(p => p.name === "fidelize-release-staging-3080");
    const live = apps.find(p => p.name === "fidelize-gynrace-mobile-3070");
    if (staging?.pm2_env?.status !== "online" || live?.pm2_env?.status !== "online") {
      console.error("Staging 3080 ou producao 3070 offline. Cancelando.");
      process.exit(1);
    }
    console.log("PM2 3070 e 3080 online.");
  });
'

for port in "$PORT_OLD" "$PORT_NEW"; do
  curl --noproxy '*' -fsS --compressed --max-time 20 \
     -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
     "http://127.0.0.1:$port/auth" -o /dev/null
  curl --noproxy '*' -fsS --compressed --max-time 20 \
     -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
     "http://127.0.0.1:$port/links/gynrace" -o "/tmp/fidelize-gynrace-$port.html"
  grep -aq 'data-gynrace-edition=' "/tmp/fidelize-gynrace-$port.html"
done
curl --noproxy '*' -fsS --compressed --max-time 20 \
  "http://127.0.0.1:$PORT_NEW/assets/gynrace/gynrace-kawasaki-original-premium.webp" -o /dev/null
curl --noproxy '*' -fsS --compressed --max-time 20 \
  -H 'Host: afidelize.app' -H 'X-Forwarded-Proto: https' \
  "http://127.0.0.1:$PORT_NEW/" -o /dev/null
echo "[OK] Homepage, login, GYNRACE e imagem principal responderam no staging."

echo "[2/5] Identificando configuracao oficial do Nginx..."
mapfile -t sites < <(
  grep -RlE 'server_name[[:space:]]+afidelize[.]app' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null \
  | while IFS= read -r file; do readlink -f "$file"; done | sort -u
)
if [[ "${#sites[@]}" != 1 ]]; then
  printf 'ERRO: esperado um arquivo de Nginx para afidelize.app, encontrados: %s\n' "${#sites[@]}"
  exit 2
fi
SITE="${sites[0]}"
COUNT=$(grep -cF 'proxy_pass http://127.0.0.1:3070;' "$SITE" || true)
if [[ "$COUNT" != 2 ]]; then
  echo "ERRO: Nginx nao possui exatamente dois proxys na porta 3070 (encontrados: $COUNT)."
  echo "Nenhuma mudanca aplicada."
  exit 3
fi
nginx -t
echo "Nginx conf: $SITE"

echo "[3/5] Criando backup e alterando Nginx para 3080..."
BACKUP="/root/nginx-fidelize-pre-themes-affiliates-$(date +%Y%m%d-%H%M%S).conf"
cp -p "$SITE" "$BACKUP"
printf '%s\n' "$BACKUP" > /root/fidelize-affiliates-last-nginx-backup.txt
SWITCHED=1
sed -i 's|proxy_pass http://127\.0\.0\.1:3070;|proxy_pass http://127.0.0.1:3080;|g' "$SITE"
nginx -t
systemctl reload nginx

echo "[4/5] Verificando HTTPS publico..."
PASSED=0
for i in $(seq 1 10); do
  if curl --noproxy '*' -fsSkS --compressed --http1.1 --max-time 20 \
     --resolve 'afidelize.app:443:127.0.0.1' \
     -H 'Cache-Control: no-cache, no-store' \
     "https://afidelize.app/links/gynrace?cutover=$i" \
     -o /tmp/fidelize-new-live.html \
     && grep -aq 'data-gynrace-edition=' /tmp/fidelize-new-live.html \
     && curl --noproxy '*' -fsSkS --max-time 20 \
        --resolve 'afidelize.app:443:127.0.0.1' \
        'https://afidelize.app/auth' -o /dev/null \
     && curl --noproxy '*' -fsSkS --max-time 20 \
        --resolve 'afidelize.app:443:127.0.0.1' \
        'https://afidelize.app/' -o /dev/null; then
    PASSED=1
    break
  fi
  echo "Health check $i falhou; repetindo..."
  sleep 2
done
if [[ "$PASSED" != 1 ]]; then
  echo "ERRO: validacao HTTPS falhou; rollback automatico."
  exit 4
fi

echo "[5/5] Salvando PM2 e finalizando..."
pm2 save
SUCCESS=1
echo "===== SITE PUBLICADO COM SUCESSO ====="
echo "Novo Nginx: 127.0.0.1:$PORT_NEW"
echo "Anterior preservado: 127.0.0.1:$PORT_OLD"
echo "Backup Nginx: $BACKUP"
echo "Se necessario, restaurar pelo arquivo em /root/fidelize-affiliates-last-nginx-backup.txt"
