/** Stable database keys. Display names must never be persisted as plan keys. */
export type InternalPlan = 'free' | 'pro' | 'business'

export const PLAN_DISPLAY_NAMES: Record<InternalPlan, string> = {
  free: 'Basic',
  pro: 'Pro',
  business: 'Business',
}

export const PLAN_LIMITS = {
  free: { members: 1, contacts: 200, pipelines: 1, automations: 1, flows: 0, ai_agents: 0, ai_replies_monthly: 25, broadcast_recipients_monthly: 0 },
  pro: { members: 3, contacts: 5_000, pipelines: 5, automations: 25, flows: 10, ai_agents: 3, ai_replies_monthly: 2_000, broadcast_recipients_monthly: 5_000 },
  business: { members: null, contacts: null, pipelines: null, automations: null, flows: null, ai_agents: null, ai_replies_monthly: null, broadcast_recipients_monthly: null },
} as const

export const PLAN_FEATURES = {
  free: { campaigns: false, advancedAutomations: false, flows: false, customAiAgents: false, knowledgeBase: false, advancedReports: false, api: false, webhooks: false, mcp: false, prioritySupport: false },
  pro: { campaigns: true, advancedAutomations: true, flows: true, customAiAgents: true, knowledgeBase: true, advancedReports: true, api: false, webhooks: false, mcp: false, prioritySupport: false },
  business: { campaigns: true, advancedAutomations: true, flows: true, customAiAgents: true, knowledgeBase: true, advancedReports: true, api: true, webhooks: true, mcp: true, prioritySupport: true },
} as const
