# Aunivo V1

CRM simples para pequenas empresas organizarem clientes, negociações e retornos.

## Habilitado

Cadastro e autenticação, dashboard comercial, contatos, etiquetas, notas/histórico,
funis comerciais conforme o plano, follow-up incorporado aos contatos/dashboard, relatórios básicos,
configurações essenciais, plano e suporte.

## Oculto

WhatsApp, inbox, notificações, IA, agentes, base de conhecimento, automações,
broadcasts/campanhas, flows, equipes, convites, API pública, API keys, webhooks,
integrações e analytics avançado. Nenhum módulo foi apagado.

As flags e listas de bloqueio ficam em `src/config/features.ts`. Páginas ocultas
redirecionam para `/dashboard?recurso=indisponivel`; APIs retornam 403 com
`FEATURE_DISABLED` antes de executar lógica externa.

## Banco

Aplique as migrations em ordem, inclusive `038_aunivo_v1_crm.sql`,
`039_v1_signup_atomicity.sql` e `040_pipeline_plan_rules.sql`. Elas adicionam
campos CRM aos contatos, timezone à conta, corrigem billing ausente, garantem um
funil padrão e aplicam as regras comerciais dos funis. Não há operação destrutiva.

O plano técnico `free`, exibido como Basic, mantém um funil totalmente editável.
Pro e Business podem criar múltiplos funis. Dados legados acima do limite Basic
não são apagados.

## Ambiente

Use `.env.local.example`. Para V1: `NEXT_PUBLIC_AUNIVO_V1=true`, locale `pt-BR`,
moeda `BRL`, timezone `America/Sao_Paulo` e suporte opcional. Stripe continua
opcional; não use chaves falsas.

## Reativação

Altere a flag, remova o prefixo correspondente das listas em `features.ts`, recoloque
a superfície de navegação/configuração e valide autenticação, RLS e isolamento por
organização antes do deploy. Para WhatsApp/IA/automações, valide também que nenhuma
chamada externa ocorre sem autorização explícita.

## Checklist

1. Aplicar migrations e revisar RLS.
2. Criar duas contas e validar isolamento de contatos, negócios e billing.
3. Testar cadastro, contato, tags/notas, follow-up, drag-and-drop, ganho/perda e relatórios.
4. Testar rotas/APIs ocultas e mobile.
5. Executar `npm test`, lint, TypeScript e build.

## Limitações

Testes reais de e-mail, RLS, Supabase, Stripe e drag-and-drop exigem serviços e
credenciais de teste. O histórico V1 usa as notas e registros comerciais existentes;
não foi criado event sourcing.
