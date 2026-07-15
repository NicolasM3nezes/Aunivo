import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/050_self_service_pro_trial.sql'), 'utf8')

describe('self-service trial migration security', () => {
  it('keeps acquisition leads inaccessible to browser roles', () => {
    expect(sql).toContain('ALTER TABLE public.trial_signups ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('ALTER TABLE public.trial_signup_events ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('REVOKE ALL ON public.trial_signups, public.trial_signup_events FROM PUBLIC, anon, authenticated')
  })
  it('activates the trial only through a service-role transaction', () => {
    expect(sql).toContain("IF auth.role() <> 'service_role'")
    expect(sql).toContain("VALUES(target_account_id, 'trial', 'pro', 'active', started, ending")
    expect(sql).toContain("NOW() + INTERVAL '14 days'")
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.activate_self_service_trial')
  })
  it('enforces one signup per e-mail, user and account', () => {
    expect(sql).toContain('trial_signups_normalized_email_unique')
    expect(sql).toContain('trial_signups_auth_user_unique')
    expect(sql).toContain('trial_signups_account_unique')
  })
  it('does not mutate existing accounts or subscriptions during migration', () => {
    expect(sql).not.toMatch(/DELETE\s+FROM/i)
    expect(sql).not.toMatch(/TRUNCATE/i)
    expect(sql).not.toMatch(/UPDATE\s+public\.account_billing\s+SET\s+trial_used_at(?![\s\S]*WHERE\s+account_id\s*=\s*target_account_id)/i)
  })
})
