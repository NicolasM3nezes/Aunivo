import { describe, expect, it } from 'vitest';
import { getMemberRoleLabel, isInvitableMemberRole, MEMBER_ROLE_OPTIONS } from './member-roles';

describe('member role presentation', () => {
  it('permite convidar apenas atendente e administrador', () => {
    expect(MEMBER_ROLE_OPTIONS.map((option) => option.value)).toEqual(['agent', 'admin']);
    expect(isInvitableMemberRole('agent')).toBe(true);
    expect(isInvitableMemberRole('admin')).toBe(true);
    expect(isInvitableMemberRole('owner')).toBe(false);
    expect(isInvitableMemberRole('viewer')).toBe(false);
  });

  it('resolve o rótulo pelo tradutor compartilhado', () => {
    expect(getMemberRoleLabel('agent', (role) => ({ agent: 'Atendente', admin: 'Administrador', owner: 'Proprietário', viewer: 'Visualizador' })[role])).toBe('Atendente');
  });
});

