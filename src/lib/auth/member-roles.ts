import type { AccountRole } from './roles';

export type InvitableMemberRole = 'agent' | 'admin';

export const INVITABLE_MEMBER_ROLES = ['agent', 'admin'] as const satisfies readonly InvitableMemberRole[];

export const MEMBER_ROLE_OPTIONS = [
  { value: 'agent', labelKey: 'agent', descriptionKey: 'agentHint' },
  { value: 'admin', labelKey: 'admin', descriptionKey: 'adminHint' },
] as const satisfies readonly {
  value: InvitableMemberRole;
  labelKey: AccountRole;
  descriptionKey: 'agentHint' | 'adminHint';
}[];

export function isInvitableMemberRole(value: unknown): value is InvitableMemberRole {
  return typeof value === 'string' && (INVITABLE_MEMBER_ROLES as readonly string[]).includes(value);
}

export function getMemberRoleLabel(
  role: AccountRole,
  translate: (key: AccountRole) => string,
): string {
  return translate(role);
}

