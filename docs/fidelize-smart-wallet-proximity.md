# Fidelize Smart Wallet — georrelevância

No painel /app/wallet, o lojista habilita a localização real do estabelecimento e
define o texto do cartão Apple. Por padrão tudo fica desativado e nenhuma localização
do consumidor é coletada ou rastreada pela Fidelize.

Apple: campo pass.json locations[] com relevantText.
Google: merchantLocations[] no loyaltyObject; 'locations' é obsoleto.
A exibição do cartão/aviso depende de permissões, políticas e raio do sistema operacional.
O Google escolhe o texto dos avisos.

## Publicação
1. Aplicar a migração SQL no banco antes de publicar o novo código.
2. Conferir credenciais reais das carteiras nativas no servidor.
3. Publicar em ambiente de teste; escolher loja-piloto, salvar e clicar
   "Atualizar cartões já salvos".
4. Testar em iPhone e Android físicos com permissões.
   O servidor tenta enviar um sinal silencioso via APNs (HTTP/2 e certificado P12).
   Apple decide quando o passe será atualizado; se a APNs falhar, o passe
   permanece marcado para atualização ou poderá exigir reinstalação.
   Verificar a entrega dos pushes nos logs/testes antes de anunciar como disponível.
5. Desativar na loja e ressincronizar para reverter.
