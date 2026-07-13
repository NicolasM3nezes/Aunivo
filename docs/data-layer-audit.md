# Auditoria da camada de dados

Data: 12 de julho de 2026.

## Causa raiz confirmada

O Supabase configurado em `.env.local` está atrás do código do repositório. A
inspeção somente leitura do schema retornou:

- `42703` para `contacts.estimated_value`;
- `42703` para `pipeline_stages.is_won`;
- `PGRST205` para a tabela `account_billing`;
- `deals.updated_at` está disponível.

Isso comprova que as migrations de billing e da V1 ainda não foram aplicadas.
Contato/follow-up depende da 038, billing depende da 036/037 e resultados de
etapas dependem da 040.

## Ordem obrigatória

Em um projeto Supabase de desenvolvimento ou staging, aplique as migrations em
ordem numérica. Para o estado observado, o trecho pendente começa em:

1. `036_billing.sql`;
2. `037_plan_limits_matrix.sql`;
3. `038_aunivo_v1_crm.sql`;
4. `039_v1_signup_atomicity.sql`;
5. `040_pipeline_plan_rules.sql`.

Faça backup antes, execute primeiro em staging e recarregue o schema do
PostgREST depois da aplicação. Não aplique somente a 040: ela depende das
funções e tabelas criadas pela 036 e dos defaults da 038.

## Modelo multi-tenant real

- Organização: `accounts`.
- Membership e papel: `profiles.account_id` e `profiles.account_role`.
- Escopo das entidades: `account_id`.
- Oportunidade: `deals`, ligada a `pipeline_id`, `stage_id` e `contact_id`.
- Etapa ganha/perdida: `pipeline_stages.is_won/is_lost` após a migration 040.

O frontend usa anon key e sessão do usuário; a service role permanece restrita
a código servidor. RLS continua habilitada.

## Validação após aplicar

Use duas organizações de teste e valide criação, edição, recarga e tentativa de
acesso cruzado para contatos, funis, etapas, tags, dashboard e relatórios. Não
use dados de produção. O host configurado localmente não identifica de forma
confiável se o projeto é desenvolvimento ou produção, por isso as migrations
não foram executadas automaticamente por esta auditoria.

