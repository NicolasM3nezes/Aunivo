import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY?.trim()
if (!key) throw new Error('STRIPE_SECRET_KEY is required')
const stripe = new Stripe(key)
const live = key.startsWith('sk_live_')
console.log(`Aunivo Stripe setup: ${live ? 'LIVE MODE' : 'TEST MODE'}`)
if (live && process.env.ALLOW_STRIPE_LIVE_SETUP !== 'true') throw new Error('Live mode blocked. Set ALLOW_STRIPE_LIVE_SETUP=true explicitly to continue.')

const plans = [
  { key: 'pro', name: 'Aunivo Pro', monthly: 22900, yearly: 229000 },
  { key: 'business', name: 'Aunivo Business', monthly: 49900, yearly: 499000 },
] as const

async function productFor(plan: typeof plans[number]) {
  const list = await stripe.products.search({ query: `metadata['app']:'aunivo' AND metadata['plan_key']:'${plan.key}'` })
  return list.data[0] ?? stripe.products.create({ name: plan.name, metadata: { app: 'aunivo', plan_key: plan.key } })
}

async function priceFor(product: Stripe.Product, plan: typeof plans[number], interval: 'monthly' | 'yearly') {
  const lookup = `aunivo_${plan.key}_${interval}_brl`
  const existing = await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 })
  if (existing.data[0]) return existing.data[0]
  return stripe.prices.create({ product: product.id, currency: 'brl', unit_amount: plan[interval], recurring: { interval: interval === 'monthly' ? 'month' : 'year' }, lookup_key: lookup, metadata: { app: 'aunivo', plan_key: plan.key, interval } })
}

const output: Record<string, string> = {}
for (const plan of plans) {
  const product = await productFor(plan)
  for (const interval of ['monthly', 'yearly'] as const) {
    const price = await priceFor(product, plan, interval)
    output[`STRIPE_${plan.key.toUpperCase()}_${interval === 'monthly' ? 'MONTHLY' : 'YEARLY'}_PRICE_ID`] = price.id
  }
}
console.log('\nAdd these values to .env.local:')
for (const [name, value] of Object.entries(output)) console.log(`${name}=${value}`)
console.log('\nTest-mode and live-mode products are separate. Run this again with the appropriate key when promoting to live mode.')
