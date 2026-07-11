import { describe, expect, it } from 'vitest'
import { PLAN_DISPLAY_NAMES, PLAN_FEATURES, PLAN_LIMITS } from './plan-permissions'

describe('official plan matrix', () => {
  it('keeps stable internal keys and public names', () => {
    expect(PLAN_DISPLAY_NAMES).toEqual({ free: 'Basic', pro: 'Pro', business: 'Business' })
  })

  it('matches Pro resource and integration limits', () => {
    expect(PLAN_LIMITS.pro).toMatchObject({ members: 3, contacts: 5_000, pipelines: 5, automations: 25, flows: 10, ai_agents: 3, ai_replies_monthly: 2_000, broadcast_recipients_monthly: 5_000 })
    expect(PLAN_FEATURES.pro).toMatchObject({ campaigns: true, api: false, webhooks: false, mcp: false })
  })

  it('makes Business unlimited and fully enabled', () => {
    expect(Object.values(PLAN_LIMITS.business).every((value) => value === null)).toBe(true)
    expect(Object.values(PLAN_FEATURES.business).every(Boolean)).toBe(true)
  })
})
