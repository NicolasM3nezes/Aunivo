import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  assertFeature: vi.fn(),
  assertWithinLimit: vi.fn(),
  insertSteps: vi.fn(),
  inserted: vi.fn(),
  deleted: vi.fn(),
  countResult: { count: 0, error: null as { message: string } | null },
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/account', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/account')>('@/lib/auth/account')
  return { ...actual, requireRole: mocks.requireRole }
})
vi.mock('@/lib/billing/entitlements', async () => {
  const actual = await vi.importActual<typeof import('@/lib/billing/entitlements')>('@/lib/billing/entitlements')
  return { ...actual, assertFeature: mocks.assertFeature, assertWithinLimit: mocks.assertWithinLimit }
})
vi.mock('@/lib/automations/steps-tree', () => ({ insertSteps: mocks.insertSteps }))
vi.mock('@/lib/automations/admin-client', () => ({
  supabaseAdmin: () => ({
    from: () => {
      const countQuery = {
        select: () => countQuery,
        eq: () => countQuery,
        then: (resolve: (value: typeof mocks.countResult) => void) => resolve(mocks.countResult),
      }
      const deleteQuery = { eq: () => deleteQuery }
      return {
        select: () => countQuery,
        insert: (payload: unknown) => {
          mocks.inserted(payload)
          return { select: () => ({ single: async () => ({ data: { id: 'automation-1' }, error: null }) }) }
        },
        delete: () => {
          mocks.deleted()
          return deleteQuery
        },
      }
    },
  }),
}))

import { POST } from './route'

function request(body: object) {
  return new Request('http://localhost/api/automations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/automations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.countResult.count = 0
    mocks.countResult.error = null
    mocks.requireRole.mockResolvedValue({ userId: 'user-1', accountId: 'account-1', role: 'owner' })
    mocks.assertFeature.mockResolvedValue(undefined)
    mocks.assertWithinLimit.mockResolvedValue(undefined)
    mocks.insertSteps.mockResolvedValue(null)
  })

  it('creates a draft using the authenticated account context', async () => {
    const response = await POST(request({ name: 'Boas-vindas', trigger_type: 'new_message_received', is_active: false, steps: [] }))
    expect(response.status).toBe(201)
    expect(mocks.inserted).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', account_id: 'account-1', name: 'Boas-vindas' }))
    expect(mocks.assertWithinLimit).not.toHaveBeenCalled()
  })

  it('checks the active-plan limit before creating an active automation', async () => {
    const response = await POST(request({ name: 'Ativa', trigger_type: 'new_message_received', is_active: true, steps: [{ step_type: 'send_message', step_config: { text: 'Olá' } }] }))
    expect(response.status).toBe(201)
    expect(mocks.assertWithinLimit).toHaveBeenCalledWith('account-1', 'automations', 0)
  })

  it('rolls back the parent row if inserting steps fails', async () => {
    mocks.insertSteps.mockResolvedValue('step insert failed')
    const response = await POST(request({ name: 'Com etapas', trigger_type: 'new_message_received', is_active: false, steps: [{ step_type: 'send_message', step_config: { text: 'Olá' } }] }))
    expect(response.status).toBe(500)
    expect(mocks.deleted).toHaveBeenCalledOnce()
  })
})
