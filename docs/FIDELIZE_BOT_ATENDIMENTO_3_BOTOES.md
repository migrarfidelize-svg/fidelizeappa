# Fidelize — WhatsApp do suporte institucional

**Estado:** implementação em branch de homologação. Sem publicação na VPS; sem disparos reais.

## Objetivo e custo
- Central exclusiva do suporte Fidelize (não é atendimento ao cliente dos lojistas).
- Dois modos: **Bot** (padrão econômico, sem chamadas ao motor IA) ou **IA** (agente existente, ativação explícita pelo superadministrador).
- Admin > Atendimento > Configurações > Bot / IA: modo e prévia simulada.
- O modo Bot não implica custo zero de WhatsApp/API/hospedagem. Elimina o consumo de IA nas três opções.

## Mensagem inicial
Olá! Você está falando com a Fidelize. Como podemos ajudar? Escolha uma das opções:

**Suporte** · **Planos** · **Sugestões** (exatamente três botões clicáveis, sem números).

UAZAPI usa mensagem interativa `/send/menu` com `type=button` e três `choices` estáveis. **Não há fallback numerado no suporte Fidelize**: caso a UAZAPI rejeite o envio interativo, a API retorna falha, registrada pelo webhook para reprocessamento ou investigação. Não envia menu textual por números. A apresentação visual final é controlada pelo aplicativo WhatsApp e pela compatibilidade do dispositivo/provedor.

## Comportamento
- **Suporte:** resposta de fila; cria/reutiliza ticket institucional, fila **Suporte**, tags **Suporte** e **Aguardando atendimento**; estado `waiting`, `bot_paused=true`. Não faz perguntas livres nem chama IA. Um membro autorizado assume a conversa manualmente na Inbox.
- **Planos:** lê somente `plans.is_active=true` e `archived_at IS NULL` do banco, em `display_order`; envia nome, mensalidade/anuidade e descrição, sem preços codificados no bot. Novos preços editados pelo admin serão usados no próximo atendimento.
- **Sugestões:** solicita uma mensagem; a próxima mensagem recebida já fica registrada em `crm_messages`, marca tag **Sugestões**, confirma recebimento e não demanda intervenção imediata.
- **Voltar:** mensagem `menu` retorna os três botões. Conversa de suporte aguarda funcionário; depois de encerrada, nova mensagem reabre no menu.
- **IA:** retorna à engine existente, não cria IA nova nem usa IA quando modo Bot está ativo.

## Proteções
- Bot só atua no workspace institucional, verificado por `slug=admin` e `name=Fidelize`; outros estabelecimentos mantêm fluxos atuais.
- Validação de webhook já usa segredo por tenant e ID do provedor para idempotência.
- Alternar modo requer role global `super_admin`; funcionários autorizados podem visualizar sem alterar.
- Não muda organização dos menus/categorias dos produtos.
- Não altera dados de produção, não migra conversas existentes e não publica o modo novo até o deploy.

## Homologação obrigatória
1. Confirmar provedor UAZAPI conectado ao WhatsApp institucional e capacidade real de botões na versão instalada.
2. Enviar 'oi' e verificar três botões reais, um clique em cada opção. Simular erro de `/send/menu` e confirmar que **nenhum texto numerado é enviado**.
3. Verificar fila/tag/ticket e ausência de respostas durante espera; testar atendimento humano.
4. Conferir que os planos recebidos refletem alterações reais do admin e excluem desativados.
5. Confirmar sugestão armazenada, sem iniciar ticket; confirmar retorno ao menu.
6. Testar IA ativa/desativa e não cobrança de tokens em modo Bot.
7. Conferir idempotência (webhook duplicado), acesso entre tenants e fechamento/reabertura.
8. Revisão em iOS/Android, preview CRM e atualização sem cache na VPS.

**Notas:** WhatsApp pode variar suporte a botões por número e tipo de provedor. Para conversas fora da janela de serviço da API oficial, mensagens iniciadas pela empresa podem exigir template aprovado e cobrança de mensagens; este fluxo foi projetado para responder a contato recebido.
