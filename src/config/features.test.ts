import { describe, expect, it } from 'vitest';
import { FEATURES, isV1DisabledApi, isV1DisabledPage } from './features';

describe('Aunivo V1 route guards', () => {
  it('bloqueia módulos futuros e seus descendentes', () => {
    expect(FEATURES.automations).toBe(false);
    expect(isV1DisabledPage('/inbox')).toBe(true);
    expect(isV1DisabledPage('/automations')).toBe(true);
    expect(isV1DisabledPage('/automations/new')).toBe(true);
    expect(isV1DisabledApi('/api/automations/cron')).toBe(true);
    expect(isV1DisabledApi('/api/whatsapp/config')).toBe(true);
    expect(isV1DisabledApi('/api/account/members/abc')).toBe(false);
    expect(isV1DisabledPage('/join/invite-token')).toBe(false);
    expect(isV1DisabledApi('/api/account/transfer-ownership')).toBe(true);
  });
  it('mantém o núcleo CRM disponível', () => {
    expect(isV1DisabledPage('/contacts')).toBe(false);
    expect(isV1DisabledPage('/pipelines')).toBe(false);
    expect(isV1DisabledApi('/api/billing/state')).toBe(false);
  });
});
