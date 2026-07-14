import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/045_account_access_grants.sql'), 'utf8')

describe('access grants database boundary', () => {
  it('enables RLS and gives browser roles no table privileges', () => {
    expect(sql).toContain('ALTER TABLE public.account_access_grants ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON public.account_access_grants FROM PUBLIC, anon, authenticated')
    expect(sql).toContain('GRANT ALL ON public.account_access_grants TO service_role')
  })
  it('preserves grant and customer data instead of deleting it on expiry', () => {
    expect(sql).not.toMatch(/DELETE FROM public\.account_access_grants/i)
    expect(sql).not.toMatch(/TRUNCATE public\.account_access_grants/i)
  })
  it('exposes only a membership-scoped boolean to authenticated callers', () => {
    expect(sql).toContain('current_account_has_billing_access')
    expect(sql).toContain("public.is_account_member(target_account_id, 'viewer')")
  })
})
