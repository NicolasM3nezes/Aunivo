import type { EffectiveAccountAccess } from './types'

export type PilotPresentationState = 'none' | 'active' | 'ending_soon' | 'expired'

export function pilotPresentationState(access: EffectiveAccountAccess): PilotPresentationState {
  if (!access.isPilot) return 'none'
  if (!access.isActive) return 'expired'
  return (access.daysRemaining ?? 8) <= 7 ? 'ending_soon' : 'active'
}
