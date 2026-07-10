import 'server-only'
import Stripe from 'stripe'

let client: Stripe | null = null
export function stripeServer(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY is required')
  client ??= new Stripe(key)
  return client
}

export function stripeWebhookSecret(): string {
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!value) throw new Error('STRIPE_WEBHOOK_SECRET is required')
  return value
}

export function appUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!value) throw new Error('NEXT_PUBLIC_APP_URL is required')
  return value.replace(/\/$/, '')
}
