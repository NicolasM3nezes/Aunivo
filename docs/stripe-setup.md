# Configuração da Stripe no Aunivo

O Aunivo usa Stripe Checkout hospedado, Customer Portal e webhooks. Nenhuma chave secreta é utilizada no navegador. A arquitetura detalhada, estados, limites e tabelas estão em [billing.md](./billing.md).

## 1. Produtos e preços

O catálogo atualmente confirmado no sistema é:

- Pro: R$ 229/mês ou R$ 2.290/ano.
- Business: R$ 499/mês ou R$ 4.990/ano.

Você pode criar os produtos manualmente no Dashboard ou executar `npm run stripe:setup` com uma chave de teste. O script usa metadata `app=aunivo`, evita duplicações e imprime os quatro Price IDs. Para mudar preços, altere primeiro o catálogo e a estratégia comercial; preços Stripe existentes são imutáveis.

## 2. Variáveis

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_YEARLY_PRICE_ID=
STRIPE_BUSINESS_MONTHLY_PRICE_ID=
STRIPE_BUSINESS_YEARLY_PRICE_ID=
BILLING_GRACE_PERIOD_DAYS=7
NEXT_PUBLIC_SALES_CONTACT_URL=
```

Checkout hospedado não precisa de `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Não adicione uma chave publicável sem uma necessidade real. `.env.local` é ignorado pelo Git.

## 3. Webhook

Crie um endpoint apontando para:

```text
https://SEU_DOMINIO/api/billing/webhook
```

Assine os eventos:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
customer.subscription.trial_will_end
invoice.paid
invoice.payment_failed
invoice.payment_action_required
```

Copie o signing secret específico desse endpoint para `STRIPE_WEBHOOK_SECRET`.

## 4. Customer Portal

Ative atualização de forma de pagamento, histórico de faturas, cancelamento ao fim do período, troca entre preços permitidos e uma política explícita de proration. O Portal é usado para assinaturas existentes e impede a criação acidental de uma segunda assinatura.

## 5. Teste local

```bash
stripe login
stripe listen --forward-to http://localhost:3000/api/billing/webhook
npm run dev
```

O Stripe CLI mostra um `whsec_` temporário; use-o somente no ambiente local durante o teste.

Fluxo recomendado:

1. Crie uma conta em `/cadastro`.
2. Acesse `/planos` ou Configurações → Plano e cobrança.
3. Inicie o Checkout com uma chave `sk_test_`.
4. Use `4242 4242 4242 4242`, validade futura e qualquer CVC.
5. Retorne ao Aunivo e aguarde a confirmação do webhook.
6. Confirme `account_billing` no Supabase.
7. Abra o Customer Portal e teste cancelamento ao fim do período.
8. Use os cartões de falha/3DS documentados pela Stripe para validar `past_due` e autenticação adicional.

## 6. Produção

Test mode e live mode possuem produtos, preços, clientes e secrets separados. Antes de produção, recrie os produtos com uma chave live explicitamente autorizada, troque todos os Price IDs, configure o webhook live, revise Portal, impostos, CPF/CNPJ, recibos e recuperação de pagamentos. Faça uma transação real controlada antes de divulgar o produto.
