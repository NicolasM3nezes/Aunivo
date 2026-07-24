import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const requestRoute = read('src/app/api/auth/password-recovery/route.ts')
const resetRoute = read('src/app/api/auth/password-reset/route.ts')
const forgotPage = read('src/app/(public)/(auth)/forgot-password/page.tsx')
const callback = read('src/app/auth/callback/route.ts')
const proxy = read('src/proxy.ts')
const migration = read('supabase/migrations/054_password_recovery_sessions.sql')

describe('password recovery isolation', () => {
  it('uses the recovery API and never signup or confirmation resend', () => {
    expect(requestRoute).toContain('resetPasswordForEmail')
    expect(requestRoute).toContain('`${appUrl}/auth/redefinir-senha`')
    expect(requestRoute).not.toContain('.signUp(')
    expect(requestRoute).not.toContain('.resend(')
    expect(forgotPage).not.toContain('signUp')
    expect(forgotPage).not.toContain('resend')
  })

  it('requires a short-lived, single-use recovery proof before updateUser', () => {
    expect(callback).toContain('password_recovery_sessions')
    expect(proxy).toContain("url.pathname = '/auth/callback'")
    expect(proxy).toContain("url.searchParams.set('next', '/auth/redefinir-senha')")
    expect(resetRoute).toContain("auth.updateUser({ password:")
    expect(resetRoute).toContain(".is('used_at', null)")
    expect(resetRoute).toContain("auth.signOut({ scope: 'local' })")
    expect(resetRoute).toContain("path: '/'")
    expect(callback).toContain("path: '/'")
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL')
  })
})
