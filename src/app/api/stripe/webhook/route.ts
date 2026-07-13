// Canonical Stripe endpoint. Keep /api/billing/webhook as a backwards-
// compatible alias for environments that already registered it.
import { POST as billingWebhookPost } from '../../billing/webhook/route'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return billingWebhookPost(request)
}
