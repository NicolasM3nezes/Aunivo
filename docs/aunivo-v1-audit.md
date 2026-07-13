# Auditoria da Aunivo V1

Data da auditoria: 12 de julho de 2026.

## Escopo comercial

A V1 é um CRM simples, em português do Brasil, para pequenas empresas. A superfície
ativa inclui autenticação, dashboard, contatos, etiquetas, notas, follow-up, um funil
principal, oportunidades, relatórios básicos, configurações essenciais, planos e
billing. A moeda padrão é BRL e o fuso padrão é `America/Sao_Paulo`.

Ficam preservados no código, mas ocultos e bloqueados: WhatsApp, inbox, notificações,
IA, agentes, base de conhecimento, automações, campanhas, flows, equipes, convites,
integrações, webhooks, API pública, chaves de API e analytics avançado. A fonte de
verdade é `src/config/features.ts`. Páginas desabilitadas redirecionam para o
dashboard e APIs desabilitadas exigem autenticação e respondem `403 FEATURE_DISABLED`.

## Resultado por área

- **Cadastro e onboarding:** o trigger de criação foi tornado atômico pela migration
  `039_v1_signup_atomicity.sql`. Falhas de conta, perfil ou funil agora desfazem o
  cadastro, em vez de deixarem um usuário órfão. A migration também repara usuários
  existentes sem perfil, sem reatribuir organizações existentes.
- **Isolamento:** consultas e mutações críticas de contatos, oportunidades e funil
  carregam `account_id`; as políticas RLS existentes continuam sendo a última linha de
  defesa. A associação à organização vive em `profiles.account_id`.
- **Contatos:** nome e telefone são obrigatórios no fluxo da V1; telefone brasileiro é
  normalizado e validado no formulário e na importação CSV. E-mail, empresa, cargo,
  origem, observações, etiquetas, último contato e próximo follow-up permanecem
  disponíveis.
- **Funil:** apenas o funil principal é exposto. As etapas padrão são Novo contato, Em
  atendimento, Orçamento enviado, Negociação, Fechado e Perdido. O drag-and-drop
  persiste por organização e restaura o estado visual se a gravação falhar.
- **Oportunidades:** título, contato e etapa são validados. Consultas a equipe e inbox
  não são executadas com os módulos desabilitados.
- **Dashboard e relatórios:** métricas comerciais e follow-ups funcionam sem depender
  de WhatsApp, automações, IA ou Stripe.
- **Billing:** é opcional para o funcionamento do CRM. Sem configuração Stripe, a área
  financeira informa indisponibilidade; o restante da aplicação permanece utilizável.
- **Páginas públicas:** promessas de IA, WhatsApp, campanhas e automações foram
  removidas da landing e dos planos ativos.
- **Suporte:** o atalho para WhatsApp só aparece quando
  `NEXT_PUBLIC_SUPPORT_WHATSAPP` está configurado.

## Banco e implantação

Aplicar todas as migrations em ordem, com atenção a:

1. `038_aunivo_v1_crm.sql`: campos de CRM, timezone, correção de billing e bootstrap
   idempotente do funil principal.
2. `039_v1_signup_atomicity.sql`: cadastro atômico e reparo conservador de perfis.

A migration 039 depende da 038. Antes do deploy, use um projeto Supabase de staging,
faça backup e valide dois usuários em organizações distintas. Nunca exponha a service
role no cliente.

## Ambiente mínimo

Obrigatório: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Configure
também `NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_APP_URL` com a URL canônica. Os padrões da
V1 estão documentados em `.env.local.example`. Stripe e suporte são opcionais; chaves
de WhatsApp, Meta, IA e automações devem permanecer vazias enquanto os módulos
estiverem desabilitados.

## Como reativar módulos futuros

Reativar exige mais do que mostrar um menu: altere a flag, remova os prefixos de
bloqueio correspondentes, restaure a navegação e execute uma revisão específica de
autorização, RLS, segredos, consentimento e chamadas externas. Equipes e convites
também exigem retestar papéis; WhatsApp e IA exigem retestar criptografia e webhooks.

## Limitações de validação

A suíte local cobre utilitários e fluxos simulados. E-mail real, callbacks de
autenticação, políticas RLS no Postgres, webhooks/checkout Stripe e drag-and-drop em
navegador precisam de credenciais e serviços de staging. O histórico da V1 é formado
por notas e registros comerciais existentes; não há event sourcing. O contato entra
no funil por meio de uma oportunidade (`deals`), não por uma coluna de etapa no contato.

