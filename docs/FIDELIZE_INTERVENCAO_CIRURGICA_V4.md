# FIDELIZE — Intervenção cirúrgica V4

**Estado:** desenvolvimento em branch de homologação; **não publicado na VPS**.

## Regras preservadas
- Não mudar as categorias, os grupos e a ordem dos menus existentes.
- Não alterar GYNRACE e Kariny Nails. Os renderizadores exclusivos continuam separados.
- Não migrar automaticamente temas existentes; V4 é escolha opt-in.
- Não alterar dados financeiros, históricos, cartões, carimbos ou conteúdo dos lojistas sem migração testada.
- Não executar migrations de produção nem deploy sem backup e comparação da versão ativa.

## Alterações já preparadas nesta branch

| Módulo | Alteração | Tipo de validação |
| --- | --- | --- |
| CRM institucional | Workspace Fidelize exclusivo, sem fallback para primeira empresa | teste de autorização e isolamento |
| CRM / permissões | Superadmin controla configurações; owner/manager **da instituição** pode supervisionar atendimento | teste de gerente autorizado e lojista negado |
| Admin | Gerentes institucionais veem apenas a entrada de Atendimento; menu completo dos superadmins intacto | compilação e teste de rota pendente |
| Carteira / login | Endpoint legado de senha previsível por telefone desativado; login moderno por OTP preservado | inspeção de implementação, E2E OTP pendente |
| Carteira / offline | Snapshot por usuário, tokens removidos, cache antigo invalidado e limpeza no logout | testes unitários passaram |
| Bio Commerce | Biblioteca expandida de 10 para 27 presets (9 nichos, 3 por nicho), sem migração automática | testes de presets |
| Bio Commerce / UX | Hero e grade editorial adaptados aos presets novos; miniaturas de composição no editor | build automático, QA visual pendente |
| Catálogo / cardápio | Fonte única publicada; paginação para abrir lista completa dentro da Bio Commerce | build automático, testes E2E pendentes |
| Acesso público | Bloqueio de dados de Bio despublicada e estabelecimentos inativos | revisão de código; pentest pendente |
| CI | GitHub Actions para testes unitários direcionados e build, sem qualquer deploy | ver histórico da branch |

## Diagnóstico de banco (somente leitura)
Consultas executadas em 2026-11-08 UTC:
- 28 estabelecimentos, 37 cartões de fidelidade, 160 carimbos.
- 23 estruturas de cardápio/catálogo; 10 páginas Bio Commerce.
- 31 registros de customers sem user_id: **não vincular automaticamente por telefone**.
- Workspace institucional Fidelize (slug reservado admin) com 13 conversas e 82 mensagens.
- Advisors Supabase apontaram 40 ocorrências de segurança/informação e 586 de performance/informação. Alertas de RLS `auth_rls_initplan` são principalmente de performance; **não são por si prova de vazamento de dados**.
- RPCs de afiliados usam SECURITY DEFINER; algumas são funções públicas de leitura e outras têm checagens de autenticação. Não revogar privilégios indiscriminadamente.

## Validações pendentes antes de concluir e subir à VPS

### P0 / segurança
1. Fluxo OTP de login e recuperação, com testes de posse real do WhatsApp.
2. Cartão do consumidor: QR /c/token no leitor do lojista, aplicação do carimbo, resgate e histórico sem duplicidade.
3. E2E do atendimento institucional (superadmin, gestor institucional e lojista de outra empresa), incluindo chamadas diretas ao backend.
4. WhatsApp e agente de IA: recebimento, envio, reconexão, webhooks, handoff, intervenção humana, permissões.
5. Testes de isolamento multiempresa, política RLS, função SECURITY DEFINER e exposição de informações sensíveis.
6. Validar sessões entre contas e PWA offline em iOS/Android.

### P1 / UX e negócio
1. Testar visualmente as 27 direções em desktop, tablet, mobile e navegador interno Instagram.
2. Completar refinamentos de composição avançada por nicho, mantendo a referência de qualidade das páginas exclusivas.
3. Editor de temas: salvar rascunho, publicar, restaurar, arrastar seções, acessibilidade e efeitos.
4. Catálogo e cardápio: conferir preços, disponibilidade, variantes, paginação, links e categorias **sem alterar organização atual**.
5. Revisar afiliados: atribuição de compra, conciliação, comissões, saldo e saque.
6. Revisar financeiro, planos, Asaas, webhooks e reconciliação.
7. Revisar notificações, retenção, e-mail, marketing, analytics, testes e limites de planos.
8. Revisar performance dos índices, consultas e políticas indicadas pelos advisors.

### P2 / homologação final
1. Comparar head desta branch com build realmente ativo na VPS/PM2 (a branch main está antiga).
2. Criar backup validado da VPS e Supabase, registrar commits, compilar e realizar E2E em staging.
3. Testar regressão visual **pixel a pixel** de GYNRACE e Kariny; testar menus atuais.
4. Registrar evidências de testes, cobertura, bloqueios, rollback e versão candidata.
5. Somente após todas as verificações, preparar release para publicação manual na VPS.

**Não considerar o PR uma entrega de produção.** As áreas pendentes acima não devem ser marcadas como corrigidas até passarem por testes.
