import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY?.trim()
if (!key) throw new Error('STRIPE_SECRET_KEY is required')
const stripe = new Stripe(key)
const live = key.startsWith('sk_live_')
console.log(`Aunivo Stripe setup: ${live ? 'LIVE MODE' : 'TEST MODE'}`)
if (live && process.env.ALLOW_STRIPE_LIVE_SETUP !== 'true') throw new Error('Live mode blocked. Set ALLOW_STRIPE_LIVE_SETUP=true explicitly to continue.')

const plans = [
  { key: 'free', envKey: 'BASIC', name: 'Aunivo Basic', monthly: 1290 },
  { key: 'pro', envKey: 'PRO', name: 'Aunivo Pro', monthly: 3990 },
] as const

async function productFor(plan: typeof plans[number]) {
  const list = await stripe.products.search({ query: `metadata['app']:'aunivo' AND metadata['plan_key']:'${plan.key}'` })
  return list.data[0] ?? stripe.products.create({ name: plan.name, metadata: { app: 'aunivo', plan_key: plan.key } })
}

async function priceFor(product: Stripe.Product, plan: typeof plans[number]) {
  const lookup = `aunivo_${plan.key}_monthly_brl`
  const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 })
  if (existing.data[0]) return existing.data[0]
  return stripe.prices.create({ product: product.id, currency: 'brl', unit_amount: plan.monthly, recurring: { interval: 'month' }, lookup_key: lookup, metadata: { app: 'aunivo', plan_key: plan.key, interval: 'monthly' } })
}

const output: Record<string, string> = {}
for (const plan of plans) {
  const product = await productFor(plan)
  const price = await priceFor(product, plan)
  output[`STRIPE_${plan.envKey}_MONTHLY_PRICE_ID`] = price.id
}
console.log('\nAdd these values to .env.local:')
for (const [name, value] of Object.entries(output)) console.log(`${name}=${value}`)
console.log('\nTest-mode and live-mode products are separate. Run this again with the appropriate key when promoting to live mode.')
