import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/052_confirmed_trial_activation.sql'),
  'utf8',
)
const signupRoute = readFileSync(
  resolve(process.cwd(), 'src/app/api/trial-signups/route.ts'),
  'utf8',
)

describe('ativação do trial após confirmação', () => {
  it('não confirma, autentica ou ativa o trial no cadastro', () => {
    expect(signupRoute).not.toContain('email_confirm: true')
    expect(signupRoute).not.toContain('signInWithPassword')
    expect(signupRoute).not.toContain("rpc('activate_self_service_trial'")
    expect(signupRoute).toContain('emailRedirectTo')
  })

  it('valida confirmação e preserva exatamente 14 dias na RPC idempotente', () => {
    expect(migration).toContain('auth_user.email_confirmed_at IS NULL')
    expect(migration).toContain("ending := started + INTERVAL '14 days'")
    expect(migration).toContain("signup.status IN ('trial_active','trial_expired','converted')")
    expect(migration).toContain('FOR UPDATE')
  })

  it('não cria Stripe e fecha RLS para usuários sem acesso ativo', () => {
    expect(migration).not.toMatch(/provider_customer_id/i)
    expect(migration).toContain('public.billing_account_has_access(target_account_id)')
    expect(migration).toContain('u.email_confirmed_at IS NOT NULL')
  })
})
