# Reconstrução do módulo Atendimento (Central Omnichannel)

## 1. Auditoria — o que já existe e será reutilizado

**Tabelas (todas reutilizadas, sem arquitetura paralela):**
- `crm_conversations` (status, priority, assigned_to, assigned_at, closed_at, last_message_at, metadata, contact_id, establishment_id)
- `crm_messages` (direction, provider, provider_message_id, message_type, media, processed_at)
- `crm_contacts`, `crm_tags`, `crm_conversation_tags`, `crm_contact_tags`, `crm_internal_notes`
- `crm_support_tickets`, `crm_conversation_locks`, `crm_flows`, `crm_flow_steps`, `crm_agent_settings`, `crm_templates`, `crm_quick_replies`, `crm_broadcasts`
- `establishment_members` + `member_permissions` + `member_can()` (RBAC existente), `is_super_admin()`
- `whatsapp_connections` / `whatsapp_providers` / `integrations` (canal), `auth_otps` (OTP)

**Funções/serviços reutilizados:** `authorizeCRMEstablishment`, `assertActiveCRMAssignee`, `acquire_crm_lock` / `release_crm_lock`, `flow-engine.server.ts`, `agent-engine.server.ts`, `bootstrap.server.ts`, `getActiveWhatsAppProvider`, webhook `/api/public/webhooks/whatsapp`, `useCRMRealtime`, `usePermissions`.

**Lacunas encontradas:**
- Estados: enum `crm_conversation_status` tem apenas `bot | waiting | assigned | closed` — faltam **pausado** e distinção de encerramento com motivo.
- Não existe tabela de **auditoria de conversa** (eventos, estado anterior/novo, origem).
- Não existe **fila/equipe**, **SLA**, **motivos de encerramento**, **disponibilidade/capacidade de agente**.
- Não existe flag de **bot silenciado** por conversa (takeover hoje é implícito).
- `getCRMEstablishments` exige superadmin → a área inteira hoje é admin-only (`/hash/atendimento`) e obriga escolher estabelecimento no topo.

## 2. Migrations necessárias (incrementais)

1. `ALTER TYPE crm_conversation_status ADD VALUE 'paused'` (mantém os valores atuais; `bot`, `waiting`, `assigned`, `closed` continuam válidos).
2. `crm_conversations`: colunas novas `queue_id`, `bot_paused boolean default false`, `first_response_at`, `waiting_since`, `close_reason_id`, `close_note`, `sla_due_at`.
3. Novas tabelas (com GRANTs + RLS por `establishment_id`, mesmo padrão das atuais):
   - `crm_conversation_events` (auditoria: event, from_status, to_status, actor_id, source, metadata)
   - `crm_queues` (nome, cor, prioridade, sla_first_response_min, sla_resolution_min, horário)
   - `crm_queue_members`
   - `crm_agent_presence` (status online/ausente/offline, capacidade, atualizado_em)
   - `crm_close_reasons`
4. Realtime: adicionar `crm_conversation_events` e `crm_agent_presence` à publicação.
5. Permissões: registrar as ações `atendimento.*` no catálogo existente (`src/lib/permissions.ts` + `member_can`), sem RBAC paralelo.

## 3. Máquina de estados (server-side, única fonte de verdade)

```text
nova            -> waiting
waiting         -> bot        (automação assume)
bot             -> assigned   (takeover humano; bot_paused = true)
waiting         -> assigned   (agente puxa da fila)
assigned        -> paused | closed | assigned (transferência)
assigned/paused -> bot        (devolver ao bot; bot_paused = false)
closed          -> waiting    (cliente responde / reabertura)
```
Transições inválidas são rejeitadas no servidor. Cada transição grava um evento em `crm_conversation_events`.

**Takeover:** `takeoverConversation` usa `acquire_crm_lock` + `UPDATE ... WHERE assigned_to IS NULL` (compare-and-set). Se já houver responsável, retorna o estado atual em vez de sobrescrever. Define `bot_paused = true`; o `flow-engine`/`agent-engine` passam a checar essa flag e o webhook para de responder automaticamente nessa conversa.

**Isolamento multi-tenant:** toda função server passa por `requireSupabaseAuth` + `authorizeCRMEstablishment` (membership ativa) e filtra por `establishment_id`; RLS nas tabelas novas; realtime filtrado por `establishment_id=eq.<tenant>`.

## 4. Seletor de estabelecimento

Existe porque a tela nasceu como ferramenta interna sob `/hash` (superadmin). Correção: o módulo passa a viver em `/app/atendimento`, com o tenant resolvido pela sessão (mesmo contexto do restante do painel do lojista). O dropdown some para o usuário comum; superadmin ganha um **context switcher** separado, identificado, protegido por `is_super_admin` e auditado.

## 5. Nova navegação

`/app/atendimento` → **Inbox** (default), Fila, Contatos, Automações, Agentes, Relatórios, Configurações.
WhatsApp, OTP, Webhooks, Providers, Tags, Filas, Motivos de encerramento e diagnóstico técnico movem-se para Configurações › Canais / Avançado (componentes atuais reaproveitados, sem reescrever OTP).

## 6. UI

- **Inbox desktop 3 painéis**: filas/filtros/lista · conversa · ficha 360º.
- Lista: avatar, nome, telefone, prévia, hora, não lidas, status (BOT/HUMANO), agente, prioridade, tempo aguardando, SLA. Busca + filtros (status, agente, fila, tag, prioridade, período, não lidas, SLA). Ordenação: SLA vencido → espera → prioridade → atividade.
- Conversa: bolhas distintas para cliente/bot/agente/sistema, mídia, status de entrega, header operacional, barra de ações (Assumir, Transferir, Devolver ao bot, Pausar, Finalizar com motivo, Nota interna, Prioridade, Tags).
- Ficha 360º: contato + tags + histórico de atendimentos + dados de fidelidade já existentes (cartões, carimbos, recompensas) via funções atuais.
- **Kanban** secundário e **Relatórios** com métricas derivadas de dados reais (sem mocks).
- Responsivo: desktop 3 colunas, tablet 2 + drawer, mobile navegação progressiva.

## 7. Regressão preservada

OTP (backend intacto, só muda onde a tela vive), fluxos e agente IA, webhook WhatsApp, providers (Evolution/Z-API/UAZAPI atrás da abstração atual — a Inbox só vê mensagens normalizadas), broadcasts, permissões existentes.

## 8. Riscos

- `ALTER TYPE ... ADD VALUE` exige migration própria (não pode ser usado na mesma transação que o consome) — será separada.
- Volume de arquivos alto; entrega em fases, com typecheck e testes CRM existentes (`src/lib/crm/__tests__`) a cada fase.
