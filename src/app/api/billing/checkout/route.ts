import { randomUUID } from 'node:crypto'

import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth/account'
import { priceIdFor } from '@/lib/billing/catalog'
import {
  isCheckoutPlan,
  shouldApplyProTrial,
  subscriptionBlocksCheckout,
} from '@/lib/billing/checkout-rules'
import { billingErrorResponse } from '@/lib/billing/http'
import {
  appUrl,
  stripeServer,
} from '@/lib/billing/stripe/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import {
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('owner')

    const rate = checkRateLimit(
      `billing-checkout:${ctx.userId}`,
      {
        limit: 8,
        windowMs: 60_000,
      },
    )

    if (!rate.success) {
      return rateLimitResponse(rate)
    }

    const body = await request.json().catch(() => null)

    if (!body || !isCheckoutPlan(body.planKey)) {
      return NextResponse.json(
        {
          error: 'Selecione o plano Basic ou Pro.',
        },
        {
          status: 400,
        },
      )
    }

    if (
      body.interval !== undefined &&
      body.interval !== 'monthly'
    ) {
      return NextResponse.json(
        {
          error: 'Somente a cobrança mensal está disponível.',
        },
        {
          status: 400,
        },
      )
    }

    const db = supabaseAdmin()

    const {
      data: billing,
      error: billingError,
    } = await db
      .from('account_billing')
      .select('*')
      .eq('account_id', ctx.accountId)
      .single()

    if (billingError) {
      throw new Error(
        `Não foi possível carregar os dados de cobrança: ${billingError.message}`,
      )
    }

    const stripe = stripeServer()

    let customerId =
      billing.provider_customer_id as string | null

    /*
     * Cada conta deve possuir apenas um Customer no Stripe.
     */
    if (!customerId) {
      const {
        data: profile,
        error: profileError,
      } = await db
        .from('profiles')
        .select('email')
        .eq('user_id', ctx.userId)
        .maybeSingle()

      if (profileError) {
        throw new Error(
          `Não foi possível carregar o perfil: ${profileError.message}`,
        )
      }

      const customer = await stripe.customers.create(
        {
          email: profile?.email ?? undefined,
          name: ctx.account.name,
          metadata: {
            app: 'aunivo',
            account_id: ctx.accountId,
          },
        },
        {
          idempotencyKey: `customer:${ctx.accountId}`,
        },
      )

      customerId = customer.id

      const { error: updateError } = await db
        .from('account_billing')
        .update({
          provider_customer_id: customerId,
          last_synced_at: new Date().toISOString(),
        })
        .eq('account_id', ctx.accountId)

      if (updateError) {
        throw new Error(
          `Não foi possível salvar o cliente Stripe: ${updateError.message}`,
        )
      }
    }

    /*
     * Impede a criação de uma segunda assinatura quando já existe
     * uma assinatura ativa, em teste ou em outro estado bloqueante.
     */
    const subscriptions =
      await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 20,
      })

    const existingSubscription =
      subscriptions.data.find((subscription) => {
        return (
          subscription.metadata.account_id ===
            ctx.accountId &&
          subscriptionBlocksCheckout(
            subscription.status,
          )
        )
      })

    const localSubscriptionBlocks =
      billing.provider_subscription_id &&
      subscriptionBlocksCheckout(
        billing.subscription_status,
      )

    if (
      existingSubscription ||
      localSubscriptionBlocks
    ) {
      const portal =
        await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${appUrl()}/settings?tab=billing`,
        })

      return NextResponse.json({
        url: portal.url,
        portal: true,
      })
    }

    /*
     * Reutiliza uma sessão aberta para evitar que vários cliques
     * criem vários Checkouts simultaneamente.
     */
    const openSessions =
      await stripe.checkout.sessions.list({
        customer: customerId,
        status: 'open',
        limit: 10,
      })

    const existingOpenSession =
      openSessions.data.find((session) => {
        return (
          session.mode === 'subscription' &&
          session.metadata?.account_id ===
            ctx.accountId &&
          session.metadata?.plan_key ===
            body.planKey
        )
      })

    if (existingOpenSession?.url) {
      return NextResponse.json({
        url: existingOpenSession.url,
        reused: true,
      })
    }

    const useTrial = shouldApplyProTrial(
      body.planKey,
      billing.trial_used_at,
    )

    const priceId = priceIdFor(
      body.planKey,
      'monthly',
    )

    const metadata = {
      app: 'aunivo',
      account_id: ctx.accountId,
      plan_key: body.planKey,
      interval: 'monthly',
      pro_trial: String(useTrial),
    }

    /*
     * Cada nova ação de Checkout recebe uma chave própria.
     * Isso evita reutilizar um erro antigo salvo pelo Stripe.
     */
    const checkoutAttemptId = randomUUID()

    const session =
      await stripe.checkout.sessions.create(
        {
          mode: 'subscription',

          customer: customerId,

          /*
           * Necessário para usar tax_id_collection com um
           * Customer existente.
           */
          customer_update: {
            name: 'auto',
            address: 'auto',
          },

          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],

          client_reference_id: ctx.accountId,

          metadata,

          subscription_data: {
            metadata,

            ...(useTrial
              ? {
                  trial_period_days: 14,

                  trial_settings: {
                    end_behavior: {
                      missing_payment_method:
                        'cancel' as const,
                    },
                  },
                }
              : {}),
          },

          /*
           * Solicita cartão mesmo quando o Pro está entrando
           * no período grátis de 14 dias.
           */
          payment_method_collection: 'always',

          allow_promotion_codes: true,

          billing_address_collection: 'required',

          tax_id_collection: {
            enabled: true,
          },

          locale: 'pt-BR',

          success_url:
            `${appUrl()}/settings` +
            '?tab=billing' +
            '&checkout=success' +
            '&session_id={CHECKOUT_SESSION_ID}',

          cancel_url:
            `${appUrl()}/planos?checkout=canceled`,
        },
        {
          idempotencyKey: [
            'checkout',
            ctx.accountId,
            body.planKey,
            useTrial ? 'trial' : 'paid',
            checkoutAttemptId,
          ].join(':'),
        },
      )

    if (!session.url) {
      throw new Error(
        'O Stripe não retornou a URL do Checkout.',
      )
    }

    return NextResponse.json({
      url: session.url,
      trial: useTrial,
    })
  } catch (error) {
    return billingErrorResponse(error)
  }
}