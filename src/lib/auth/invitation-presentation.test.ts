import { describe, expect, it } from 'vitest';
import { formatInvitationExpiryDate, INVITE_EXPIRATION_OPTIONS } from './invitation-presentation';

describe('invitation presentation', () => {
  it('oferece validades amigáveis mantendo dias numéricos', () => {
    expect(INVITE_EXPIRATION_OPTIONS.map((option) => option.value)).toEqual([1, 3, 7, 14, 30]);
  });

  it('formata a expiração em pt-BR e no fuso do produto', () => {
    expect(formatInvitationExpiryDate('2026-07-21T15:00:00.000Z')).toMatch(/^21 de jul\. de 2026$/);
  });
});

