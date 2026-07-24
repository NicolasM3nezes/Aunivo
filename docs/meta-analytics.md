# Meta Pixel e Conversions API

O Pixel é instalado uma única vez pelo layout público. `PageView` continua
separado de `ViewContent` e acompanha navegação do App Router.

## Funil

| Ação real | Evento | Origem |
| --- | --- | --- |
| Visita à landing ou planos | `ViewContent` | Pixel |
| Primeira etapa aceita pelo backend | `Lead` | Pixel |
| Conta ativada após confirmação | `CompleteRegistration` | Conversions API |
| Grant Pro de 14 dias ativado | `StartTrial` | Conversions API |
| Sessão Stripe criada com URL válida | `InitiateCheckout` | Pixel |
| Checkout pago confirma dados de pagamento | `AddPaymentInfo` | Conversions API |
| Primeira assinatura paga confirmada | `Subscribe` | Conversions API |
| Invoice paga | `Purchase` | Conversions API |
| WhatsApp, e-mail ou vendas | `Contact` | Pixel |
| Solicitação de piloto aceita | `SubmitApplication` | Pixel |

`Search`, `Schedule`, `AddToCart`, `AddToWishlist`, `CustomizeProduct`,
`Donate` e `FindLocation` estão tipados, mas não possuem ponto de disparo
porque não há ação comercial equivalente. Renovações geram `Purchase` por
invoice paga, mas não um novo `Subscribe`.

## Idempotência

Eventos de servidor usam `event_id` determinístico. A tabela
`analytics_conversion_events` possui unicidade por provedor, evento e
referência externa:

- cadastro/trial: ID do `trial_signup`;
- pagamento: ID da invoice;
- assinatura: ID da subscription;
- dados de pagamento: ID da Checkout Session.

## Configuração

- `NEXT_PUBLIC_META_PIXEL_ID`: Pixel existente.
- `NEXT_PUBLIC_ANALYTICS_DEBUG=true`: log resumido no navegador, somente para desenvolvimento.
- `META_CONVERSIONS_API_TOKEN`: token do dataset/Pipeline da Meta, somente servidor.
- `META_GRAPH_API_VERSION`: versão fixada da Graph API.
- `META_TEST_EVENT_CODE`: opcional, somente servidor.

Na Meta, autorize o token para o mesmo Pixel/dataset e valide os eventos em
“Test Events”. O token nunca deve ser exposto como variável `NEXT_PUBLIC_*`.

## Consentimento

O projeto ainda não possui consentimento específico para cookies de
publicidade. O consentimento de comunicações do cadastro cobre e-mail e
WhatsApp, não o Pixel. A integração reconhece
`window.__aunivoAnalyticsConsent = 'denied'`, mas um CMP/banner e a atualização
da Política de Cookies precisam de aprovação visual/jurídica antes de ativar o
Pixel em jurisdições que exijam consentimento prévio.

## StartTrial

`StartTrial` é enviado pela Conversions API depois da ativação confirmada do
grant de 14 dias. Seu valor de referência comercial é numérico (`39.90`) e a
moeda é `BRL`; isso não representa receita recebida. O `event_id`
`trial:<trial_signup_id>` e o ledger impedem repetição em callback, recuperação
de ativação, atualização ou novo login. A função equivalente do Pixel está
tipada e usa o mesmo payload, mas não possui ponto de disparo enquanto a CAPI
for a fonte principal.
