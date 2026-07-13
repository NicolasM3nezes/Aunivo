# Auditoria Supabase — Aunivo

Data: 13/07/2026  
Escopo local auditado: `supabase/migrations/001`–`042`, chamadas Supabase em `src`, RLS, RPCs, tarefas, notificações, signup e billing.

## Resumo executivo

- O projeto local **não está linkado à Supabase CLI**: não existe `supabase/config.toml`, `.temp/project-ref` ou binário local da CLI. `npx supabase status` expirou tentando resolver a CLI. Portanto, não foi possível afirmar quais migrations constam no histórico remoto nem distinguir com segurança objetos aplicados manualmente.
- O modelo multi-tenant real usa `accounts` + uma linha em `profiles` com `account_id` e `account_role`. **Não existem** `account_members`, `organization_id`, `subscriptions` ou `plan_limits`; membership é representada por `profiles`, assinatura por `account_billing` e catálogo por `billing_plans`.
- A migration 017 substitui as policies legadas baseadas em `user_id` por membership de conta e remove a policy histórica `WITH CHECK (true)` de `messages`. No estado final local não sobra policy de dados de cliente com `USING (true)`/`WITH CHECK (true)`.
- As migrations 035–039 são coerentes e ordenadas. A 040 tem um preflight obrigatório: seu índice parcial único falha se um funil possuir mais de uma etapa cujo nome seja classificado como ganho/perda. A 041 depende de 017, 027, 036, 038 e 040 não é uma dependência funcional direta.
- Foram encontrados `SECURITY DEFINER` auxiliares com `EXECUTE` público herdado (`_bcast_bump`, `recompute_broadcast_counts`, `record_webhook_failure` e helpers de billing). Isso permitia alterações/leitura cruzadas se chamados diretamente por PostgREST. A migration corretiva 042 revoga esses acessos.
- A 042 também torna `tasks.account_id` e `tasks.created_by` imutáveis, corrige a deduplicação de reatribuição e inclui `notification_preferences` no bootstrap atômico.
- O código e o banco concordam com `free`/`pro`/`business` e exibem `Basic`/`Pro`/`Business`. Há, porém, uma decisão comercial conflitante no histórico: 037 define Pro com 5 funis; 040 e o TypeScript tornam Pro ilimitado. Nenhuma regra foi alterada nesta auditoria.
- Não existe limite de tarefas em `BillingLimit`, `PLAN_LIMITS` ou `billing_plans`; tarefas estão sem limite por plano. Isso é ausência explícita, não falha de enforcement.

## Estado local e remoto

| Item | Resultado |
|---|---|
| Migrations locais | 42 (`001`–`042`) |
| Projeto CLI linkado | Não |
| Histórico remoto | Indeterminado |
| Schema remoto | Indeterminado |
| Migrations manuais | Possíveis, não confirmáveis sem acesso remoto |
| `migration repair` | Não recomendado até comparar objetos e histórico |
| `db push` | Não recomendado no estado atual de informação |
| `db reset` | Não executar em produção |

Para obter a comparação real, primeiro instale a CLI e faça o link usando o **project ref real**:

```powershell
npx supabase login
npx supabase link --project-ref <PROJECT_REF_REAL>
npx supabase migration list
npx supabase status
npx supabase db diff --linked
```

Os três últimos comandos são de leitura/diff. Não executar `db push` nem `migration repair` antes de revisar seus resultados.

## Inventário completo

Legenda de risco: baixo = aditivo/recriável; médio = locks, constraints, backfill ou policies; alto = transformação/remoção de dados ou bootstrap crítico.

| Versão | Objetivo e objetos principais | RLS / funções / triggers / índices | Dependência, risco e repetição |
|---|---|---|---|
| 001 | Schema base: profiles, CRM, WhatsApp, pipelines, deals e broadcasts | RLS inicial por `user_id`; `update_updated_at_column`; signup; índices base | Base. Médio. Majoritariamente idempotente; tabelas existentes incompletas não são reconciliadas por `IF NOT EXISTS`. |
| 002 | `deals.assigned_to`; normaliza status para open/won/lost | FK/index e CHECK de status | 001. Médio: UPDATE e constraint podem falhar com valores desconhecidos. Reexecutável. |
| 003 | Correlação WAMID e contadores de campanhas | funções de recompute, trigger agregado e índices | 001. Médio. Reexecutável. |
| 004 | Mantém histórico ao excluir contato | troca FKs de deals/recipients para `ON DELETE SET NULL` | 001/003. Médio: lock/recriação de FK, sem apagar linhas. |
| 005 | Contadores incrementais de campanha | `_bcast_bump`, trigger agregado, recompute | 003. Médio; helper definer foi endurecido em 042. Reexecutável. |
| 006 | Automações, etapas, logs e pendências | RLS por usuário, triggers updated_at, índices | 001. Baixo/médio. Reexecutável. |
| 007 | Incremento atômico de automações | RPC service-role-only | 006. Baixo. Idempotente. |
| 008 | Bucket público de avatares | policies de Storage por pasta do usuário | Storage. Médio: leitura pública intencional. Reexecutável. |
| 009 | Respostas e reações de mensagens | tabela `message_reactions`, FK e RLS | 001. Baixo/médio. Reexecutável. |
| 010 | Fluxos conversacionais e execuções | 4 tabelas, RLS, constraints, triggers e índices | 001. Médio. Reexecutável com ressalva de schema parcial. |
| 011 | Beta flags no profile | coluna `beta_features`, constraint/default | 001. Baixo. Reexecutável. |
| 012 | Incremento atômico de fluxos | RPC service-role-only | 010. Baixo. Idempotente. |
| 013 | Unicidade de phone_number_id | índice/constraint único | 001. Médio/alto: falha deliberadamente se houver duplicados; não apaga dados. |
| 014 | Integração completa de templates Meta | colunas, normalização de status, CHECKs e índices únicos | 001. Médio/alto: UPDATEs e índices podem falhar com dados inválidos/duplicados. |
| 015 | Estado de registro do WhatsApp | colunas de registro/configuração | 001/014. Baixo. Aditivo. |
| 016 | Mídia em flows | novo node type, bucket público e policies Storage | 010. Médio: altera CHECK; mídia pública por URL. |
| 017 | Fundação multi-tenant | accounts/invitations/enum, account_id, backfill, NOT NULL, RLS completo, signup | 001–016. **Alto**: backfill global, SET NOT NULL e substituição de todas as policies. Reexecutável por projeto, mas exige backup. |
| 018 | Gestão de membros | RPCs set role/remove/transfer | 017. Alto impacto lógico, com validações e transação. Idempotente. |
| 019 | Convites | RPCs peek/redeem; remove conta pessoal órfã | 017/018. Alto: DELETE controlado de account após mover profile; revisar antes de produção. |
| 020 | Ajustes pós multi-tenant | índices de engine e policies de mídia por conta | 017. Médio. Reexecutável. |
| 021 | Moeda padrão da conta | `accounts.default_currency` BRL + CHECK | 017. Baixo/médio. Aditivo. |
| 022 | Deduplicação de telefone por conta | função de merge, reparenting, DELETE de duplicados, índice único | 017. **Alto**: apaga linhas duplicadas após consolidar relacionamentos. Backup obrigatório. |
| 023 | Mídia do chat | bucket público e policies por conta | 017/020. Médio: anexos ficam publicamente legíveis por URL. |
| 024 | Presença de membros | tabela, RLS read-only, RPC heartbeat e Realtime | 017. Baixo/médio. RPC endurecida em 042. |
| 025 | Filtro paginado por tags | RPC security-invoker | 017. Baixo. RLS continua aplicada. |
| 026 | Chaves da API pública | `api_keys`, RLS admin+ e índices | 017. Baixo/médio. |
| 027 | Notificações | tabela, RLS recipient-only, trigger de atribuição e Realtime | 017. Baixo/médio. UPDATE limitado a `read_at` por grant de coluna. |
| 028 | Webhooks de saída | tabela/RLS e contador de falhas | 017/026. Médio. RPC de falha vulnerável a chamada direta foi restringida em 042. |
| 029 | Resposta de IA | ai_configs, colunas de conversa e RPC slot | 017. Médio; chave cifrada no app. |
| 030 | Base de conhecimento | pgvector, documentos/chunks, RLS e busca | 029. Médio/alto: extensão/index vetorial; RPCs originais eram definer. |
| 031 | Grant do slot de IA | concede RPC somente a service_role | 029. Baixo. |
| 032 | Corrige leitura cruzada da base IA | substitui buscas por SECURITY INVOKER | 030. Segurança alta, execução baixo risco. |
| 033 | Polimento de IA e uso | novas colunas e `ai_usage_log` com RLS | 029/030. Baixo/médio. |
| 034 | Bloqueia escalada via profile | trigger preserva account_id/account_role e policy self-update | 017. Segurança alta, execução baixo risco. |
| 035 | Mensagens interativas e quick replies | coluna JSONB, tabela quick_replies, RLS account/agent e índice | 017/010. Baixo/médio. Aditivo. |
| 036 | Billing Stripe e enforcement | 6 tabelas, catálogo, uso, funções, triggers de limite, RLS/grants | 026–030/027. Médio/alto: cria triggers em várias tabelas e faz backfill de billing. |
| 037 | Matriz Basic/Pro/Business | UPDATE do catálogo; limite ativo de automações/flows | 036. Médio. Idempotente, mas sobrescreve JSON de limites. |
| 038 | Defaults V1 CRM | 5 colunas contact, timezone, bootstrap billing/pipeline/stages | 021/036/037. Médio: DO percorre todas as contas; não recria tabelas/policies. Aditivo/idempotente. |
| 039 | Signup atômico + reparo | substitui `handle_new_user`; repara auth sem profile | 038. Alto impacto de bootstrap, mas não reassocia memberships existentes. Idempotente. |
| 040 | Regras comerciais e outcomes do funil | atualiza limite; is_won/is_lost; índices únicos; proteção do último funil | 036–039. Médio/alto: índices falham com outcomes duplicados. Requer preflight. |
| 041 | Tarefas e alertas | tasks/preferences, RLS, FKs, triggers, RPC, notification columns/index | 017/027/036/038. Médio. Aditivo, mas recria CHECK de tipos de notificação. |
| 042 | Hardening da auditoria | revoga RPCs internos, endurece tasks/signup e defaults | 005/024/028/036/038/041. Baixo/médio. Aditivo e idempotente. |

## Operações perigosas e avaliação

As ocorrências relevantes (não contam `DROP POLICY/TRIGGER IF EXISTS` usado apenas para recriação idempotente):

| Arquivo/linha | Operação | Impacto e recomendação |
|---|---|---|
| 002:17 | UPDATE de todos deals active/null | Conversão intencional. Confirmar contagens antes/depois. |
| 013: índice único | UNIQUE phone_number_id | Falha se duplicado. Rodar query de duplicados; não deduplicar automaticamente. |
| 014:94–97 | UPDATE de status | Preserva linhas, mas altera valores. Fazer backup de templates. |
| 017:276–292 | SET NOT NULL em account_id | Falha se backfill incompleto; 017 tenta preencher antes. Validar nulos. |
| 017: DO de policies | DROP de todas policies listadas | Janela está na mesma transação; se CREATE falhar, rollback. Nunca executar trechos isolados. |
| 019:229 | DELETE da conta pessoal anterior | Só após mover profile e verificar ownership. Ainda exige teste/backup. |
| 022:66–101 | UPDATE/DELETE de contatos duplicados | Consolida e apaga duplicados reais. Migration de maior risco de dados. Backup e dry-run obrigatórios. |
| 030 | CREATE EXTENSION vector / HNSW | Pode exigir extensão disponível e lock/custo de índice. |
| 036:64 | INSERT account_billing para todas contas | Backfill não destrutivo; pode disparar carga em base grande. |
| 037:3–19 | UPDATE JSON de todos planos conhecidos | Sobrescreve limites persistidos. Confirmar se não há customização manual. |
| 038:40 | DO em todas contas | Pode criar billing/pipeline/stages e gerar carga; não apaga dados. |
| 039:34–62 | reparo de auth sem profile | Cria objetos ausentes; toda migration reverte se um bootstrap falhar. |
| 040:13–19 | UPDATE de stages + UNIQUE parcial | Pode falhar se houver mais de um outcome por pipeline. Usar o preflight. |
| 041:79–84 | troca do CHECK de notification.type | Pode falhar se existirem tipos manuais não listados. Consultar `SELECT DISTINCT type`. |

`CASCADE` encontrado em FKs significa limpeza de filhos quando o pai é excluído. É apropriado para account-owned rows, mas torna exclusões de `accounts`, `auth.users`, `tasks` e conversas de alto impacto; não há migration com `DROP ... CASCADE`, `TRUNCATE` ou `DROP TABLE`.

## RLS e isolamento por conta

| Área | SELECT | INSERT | UPDATE | DELETE | Resultado |
|---|---|---|---|---|---|
| contacts/deals/conversations | member | agent+ | agent+ | agent+ | Correto por account_id |
| pipelines/stages | member | admin+ | admin+ | admin+ | Stage validado via pipeline pai |
| automations/flows | member | agent+ | agent+ | agent+ | Correto; logs/runs são read-only para cliente |
| messages | member via conversation | agent+ via conversation | agent+ via conversation | agent+ via conversation | Policy `true` legada removida em 017 |
| tasks | member | agent+ + created_by=auth.uid | agent+ | agent+ | Relações cross-account bloqueadas; identidade imutável em 042 |
| notifications | somente recipient | sem client insert | recipient, apenas coluna read_at possui GRANT | sem client delete | Correto |
| notification_preferences | próprio usuário | próprio usuário | próprio usuário | sem delete | Correto |
| accounts/profiles | members/self | apenas bootstrap/self profile | admin account/self profile com trigger privilegiado | sem client delete | Correto após 034 |
| billing_plans | authenticated e ativo | service only | service only | service only | Catálogo público a autenticados |
| account_billing | owner SELECT | service only | service only | service only | Correto; APIs usam admin client |
| billing usage | member SELECT | service only | service only | service only | Correto |
| API keys/webhooks/AI config | member/admin conforme tabela | admin+ | admin+ | admin+ | Correto por account_id |

Riscos residuais:

1. Buckets `avatars`, `flow-media` e `chat-media` são públicos. Write RLS é isolada, mas qualquer pessoa com a URL pode ler o objeto. Para anexos sensíveis, a evolução segura é bucket privado + URL assinada; não foi alterado por exigir mudança de produto e código.
2. Muitas tabelas ainda carregam `user_id` legado além de `account_id`. O isolamento usa `account_id`; `user_id` é autoria/auditoria. Não usar o campo legado como tenant boundary.
3. Child tables sem `account_id` próprio (messages, stages, tags de contato, nodes) são isoladas por join ao pai. Isso é correto, mas as FKs e policies do pai são parte da fronteira de segurança.

## RPCs

| RPC/função | Código | Segurança final |
|---|---|---|
| increment_automation_execution_count | engine | service_role-only; definer necessário |
| increment_flow_execution_count | engine | service_role-only; definer necessário |
| set_member_role/remove/transfer | APIs de membros | authenticated, valida caller/account/role |
| peek_invitation | API pública de convite | anon/auth; retorna metadados limitados, token hashed |
| redeem_invitation | API de convite | auth obrigatório, transação atômica |
| touch_presence | heartbeat | deriva account pelo auth.uid; anon removido em 042 |
| filter_contacts_by_tags | contatos | SECURITY INVOKER; RLS aplicada |
| match_ai_knowledge_* | IA | corrigidas para SECURITY INVOKER em 032 |
| increment_billing_usage | billing | service_role-only + idempotency key opcional |
| record_webhook_failure | entrega webhooks | service_role-only em 042; antes aceitava endpoint arbitrário |
| sync_my_task_notifications | sino | authenticated, exige auth.uid, recipient derivado do caller, dedupe diária |

`sync_my_task_notifications` é segura para repetição: o índice `(user_id,dedupe_key)` bloqueia duplicatas. Só considera `status='pending'`; concluídas/canceladas não alertam. Preferências são lidas por recipient. A tarefa é selecionada por `COALESCE(assigned_to,created_by)=auth.uid()`, e 041/042 garantem que esses usuários pertencem à conta da tarefa. Alertas de atraso são no máximo um por tarefa/usuário/dia.

## Tarefas e notificações

- `due_at` é `TIMESTAMPTZ`; a data local é calculada com `accounts.timezone`.
- `completed_at` é preenchido ao entrar em completed e limpo ao reabrir/cancelar.
- Status válidos: pending/completed/cancelled. Prioridade: low/medium/high.
- `contact_id` e `deal_id` usam SET NULL para preservar a tarefa quando o registro relacionado é removido.
- `assigned_to` usa `auth.users.id`, consistente com as opções do formulário (`profiles.user_id`). Deals usam modelo diferente: `deals.assigned_to` referencia `profiles.id`; o código respeita essa diferença.
- O Realtime usa nomes de canal distintos e cleanup em unmount; não foi encontrada reutilização conflitante.
- Em 042, reatribuir uma tarefa para o mesmo usuário depois de removê-la/atribuí-la a outro gera novo evento, sem duplicar a mesma atualização.

## Billing e planos

- Chaves persistidas: `free`, `pro`, `business`.
- Nomes: Basic, Pro, Business.
- 037 define Pro com 5 pipelines; 040 muda Pro e Business para ilimitado, e `PLAN_LIMITS.pro.pipelines` também é `null`. O estado final local é consistente internamente, mas conflita com a matriz oficial anterior de “até 5 funis”. É uma decisão comercial que deve ser confirmada antes de aplicar 040.
- Contatos, membros, automações ativas, flows, destinatários e IA possuem chaves de limite. `ai_agents` está no catálogo/tipo, mas não foi encontrada tabela específica de agentes customizados para enforcement por contagem.
- Não existe limite de tarefas.
- Trial e statuses Stripe são coerentes entre DB e TypeScript. O fallback aplica Basic quando billing ainda não existe; erros de billing não relacionados a schema continuam falhando fechados.
- Webhook Stripe usa `billing_webhook_events` para idempotência e sincroniza customer/subscription/price em `account_billing`.
- Preços ficam no TypeScript/env Stripe; não são persistidos nas migrations. Nenhum preço foi alterado.

## Migration 038 detalhada

038 tem 40 linhas e não recria tabelas, RLS ou enums. Ela:

1. adiciona campos CRM a contacts;
2. adiciona timezone a accounts;
3. garante account_billing para contas existentes;
4. cria `ensure_v1_account_defaults`, service-role-only;
5. cria trigger AFTER INSERT em accounts;
6. percorre contas existentes e garante um pipeline/etapas.

Ela depende de accounts/default_currency, billing e pipelines. É idempotente por `IF NOT EXISTS`, `ON CONFLICT` e checagens de existência. Em banco populado, o risco é operacional (lock curto nos ALTERs e iteração de todas as contas), não perda de dados. Ela não deve ser dividida retroativamente se já aplicada; futuras correções devem ser novas migrations.

## Signup e onboarding

Fluxo final após 042:

```text
auth.users INSERT
  -> handle_new_user (transação do INSERT)
     -> accounts (BRL, America/Sao_Paulo)
        -> billing trigger
        -> defaults V1 trigger (pipeline + stages)
     -> profiles owner
     -> notification_preferences
     -> ensure_v1_account_defaults (idempotente)
```

Não há criação duplicada no frontend: signup chama apenas `supabase.auth.signUp`. `accounts.owner_user_id` é UNIQUE; profile é UNIQUE(user_id); billing é UNIQUE(account_id); preferências têm PK user_id. 039 removeu o catch que engolia falhas, então uma falha aborta o signup em vez de deixar auth órfão. 042 recria defensivamente o trigger e mantém retries idempotentes.

## Divergências código/schema

- Não há tipos gerados do Supabase (`Database` schema). O projeto usa interfaces manuais e casts; isso limita a verificação automática de coluna/relationship. `Account`, `Deal` e `Notification` foram alinhados nesta auditoria.
- O embed `profiles!deals_assigned_to_fkey` está correto para a FK nominal de 002.
- Não foram encontradas chamadas para tabelas inexistentes entre os nomes prioritários. `account_members`, `subscriptions` e `plan_limits` não são tabelas do modelo.
- `ai_agents` existe como chave de limite sem tabela/contador correspondente.
- A migration 041 recria o CHECK de `notifications.type`; tipos adicionados manualmente no remoto causariam falha. Consulte `SELECT DISTINCT type FROM notifications` antes.

## Backup, aplicação e reversão

Antes de qualquer alteração remota:

1. Gere backup pelo Dashboard Supabase ou `pg_dump` com a connection string real:

```powershell
pg_dump --format=custom --no-owner --no-acl --file aunivo-before-migrations.dump "<DATABASE_URL>"
```

2. Exporte separadamente tabelas críticas: accounts, profiles, contacts, pipelines, pipeline_stages, deals, notifications, tasks, billing_plans e account_billing.
3. Rode [o preflight](../supabase/preflight/035_042_preflight.sql) no SQL Editor em blocos compatíveis com os objetos existentes.
4. Faça a aplicação primeiro em staging/clonagem e execute o checklist abaixo.

042 não apaga dados e não requer downtime planejado; recria funções/triggers transacionalmente. Rollback lógico de 042 exige restaurar grants/funções anteriores, o que reabriria vulnerabilidades; prefira corrigir adiante. Migrations 017, 022, 036 e 040 podem gerar locks/carga e devem ser aplicadas em janela controlada.

## Ordem recomendada — condicionada ao histórico remoto

1. Linkar CLI e obter `migration list`/`db diff --linked`.
2. Rodar preflight e backup.
3. Para cada versão 035–041 marcada como remota ausente, verificar se seus objetos já existem manualmente.
4. Se objetos **não** existem, aplicar migrations pendentes em ordem numérica em staging.
5. Se objetos existem mas o histórico não, não fazer push: comparar definições e só então propor `migration repair --status applied <versão>` com aprovação explícita.
6. Aplicar 042 apenas depois de 041 estar aplicada/registrada.
7. Repetir preflight, testes funcionais e diff.

Não há base factual para fornecer hoje um comando `migration repair` específico: a versão e o status remoto são desconhecidos. Inventá-los poderia corromper o histórico.

## Checklist manual

- [ ] Cadastro cria auth/profile/account/prefs/billing/pipeline/stages uma vez.
- [ ] Retry de signup não duplica conta ou pipeline.
- [ ] Login carrega conta e papel corretos.
- [ ] Criar/editar contato e validar limite do Basic/Pro.
- [ ] Criar negócio, mover etapa, marcar ganho/perda.
- [ ] Criar/editar/concluir/reabrir/excluir tarefa.
- [ ] Vincular tarefa a contato/deal da mesma conta.
- [ ] Tentar vínculo cross-account e confirmar erro do banco.
- [ ] Atribuir, remover e reatribuir ao mesmo usuário; confirmar novo alerta único.
- [ ] Recarregar/pollar várias vezes; confirmar zero duplicatas no mesmo dia.
- [ ] Concluir tarefa atrasada; confirmar que não gera novo alerta.
- [ ] Desativar/ativar cada preferência e confirmar comportamento.
- [ ] Marcar uma/todas notificações como lidas.
- [ ] Criar segundo usuário; validar viewer/agent/admin.
- [ ] Conta B não lê/escreve contacts, deals, tasks, notifications ou billing da A.
- [ ] Basic bloqueia segundo pipeline e não permite excluir o último.
- [ ] Confirmar decisão: Pro 5 pipelines ou ilimitado.
- [ ] Abrir relatórios, configurações e portal de cobrança.
- [ ] Processar webhook Stripe duplicado e confirmar idempotência.

## Validação automática

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Aprovado, zero erros |
| `npm run lint` | Aprovado, zero erros; 23 warnings preexistentes em broadcasts/flows/inbox/pipelines |
| `npm test` | 75 arquivos e 677 testes aprovados |
| `npm run build` | Aprovado; 66 páginas geradas e rotas de tasks/billing presentes |

Não foi possível validar o SQL contra uma instância local porque a Supabase CLI não está instalada/configurada neste checkout e não há stack local ativa. O preflight remoto e uma aplicação em staging continuam obrigatórios antes da produção.
