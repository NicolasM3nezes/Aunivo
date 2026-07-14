import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRole) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  return createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function requireUuid(value: string | undefined, name = 'account-id'): string {
  if (!value || !UUID_PATTERN.test(value)) throw new Error(`--${name} must be a valid UUID`)
  return value
}

export function printSummary(value: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

export function fail(error: unknown): never {
  process.stderr.write(`${error instanceof Error ? error.message : 'Administrative billing command failed'}\n`)
  process.exit(1)
}
