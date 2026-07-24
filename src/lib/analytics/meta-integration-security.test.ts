import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const pixel = read('src/components/analytics/meta-pixel.tsx')
const signup = read('src/components/public/trial-signup-form.tsx')
const callback = read('src/app/auth/callback/route.ts')
const webhook = read('src/app/api/billing/webhook/route.ts')
const migration = read('supabase/migrations/053_meta_conversion_idempotency.sql')

describe('Meta analytics integration boundaries', () => {
  it('keeps a single Pixel bootstrap and route-deduplicated PageView', () => {
    expect(pixel.match(/id="meta-pixel"/g)).toHaveLength(1)
    expect(pixel).toContain('__aunivoMetaPixelLastPageView')
    expect(pixel).toContain("trackMetaEvent('PageView')")
  })

  it('does not complete registration or start trial in the landing form', () => {
    expect(signup).not.toMatch(/CompleteRegistration|StartTrial/)
    expect(callback).toContain("eventName: 'CompleteRegistration'")
    expect(callback).toContain("eventName: 'StartTrial'")
  })

  it('sources paid conversions from trusted Stripe objects', () => {
    expect(webhook).toContain("eventName: 'AddPaymentInfo'")
    expect(webhook).toContain("eventName: 'Subscribe'")
    expect(webhook).toContain("eventName: 'Purchase'")
    expect(webhook).toContain('invoice.amount_paid / 100')
    expect(webhook).toContain("session.payment_status === 'paid'")
  })

  it('deduplicates by event and external reference behind RLS', () => {
    expect(migration).toContain('analytics_conversion_reference_unique')
    expect(migration).toContain('provider, event_name, external_reference')
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL')
  })
})
