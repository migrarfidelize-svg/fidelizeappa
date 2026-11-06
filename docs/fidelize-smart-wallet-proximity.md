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
   **Importante:** para passes Apple já salvos, a sincronização atual marca o passe
   como alterado, mas o sistema ainda não envia o push silencioso APNs.
   Até implementar APNs, pode ser necessário reinstalar o passe no iPhone.
5. Desativar na loja e ressincronizar para reverter.
