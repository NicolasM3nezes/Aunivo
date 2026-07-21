import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  serializeContact,
  findOrCreateContact,
  ContactError,
} from './contacts';

describe('serializeContact', () => {
  it('flattens contact_tags(tags(*)) onto a tags array and nulls missing fields', () => {
    const row = {
      id: 'c1',
      phone: '+14155550123',
      name: 'Jane',
      email: null,
      company: 'Acme',
      avatar_url: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      contact_tags: [
        { tags: { id: 't1', name: 'vip', color: '#fff' } },
        { tags: null }, // orphaned join — dropped
      ],
    };
    expect(serializeContact(row)).toEqual({
      id: 'c1',
      phone: '+14155550123',
      name: 'Jane',
      email: null,
      company: 'Acme',
      avatar_url: null,
      tags: [{ id: 't1', name: 'vip', color: '#fff' }],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    });
  });

  it('tolerates a row with no contact_tags key', () => {
    const row = {
      id: 'c2',
      phone: '+1',
      name: null,
      email: null,
      company: null,
      avatar_url: null,
      created_at: 'a',
      updated_at: 'b',
    };
    expect(serializeContact(row).tags).toEqual([]);
  });

  it('serializes a missing phone as null', () => {
    expect(serializeContact({
      id: 'c3', phone: null, name: 'No phone', email: null, company: null,
      avatar_url: null, created_at: 'a', updated_at: 'b',
    }).phone).toBeNull();
  });
});

describe('findOrCreateContact', () => {
  const noopDb = {} as SupabaseClient;

  it('rejects a non-E.164 phone with a 400 ContactError', async () => {
    await expect(
      findOrCreateContact(noopDb, 'acc', 'user', { phone: 'not-a-number' })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      findOrCreateContact(noopDb, 'acc', 'user', { phone: 'not-a-number' })
    ).rejects.toBeInstanceOf(ContactError);
  });

  it('requires a name when phone is empty', async () => {
    await expect(
      findOrCreateContact(noopDb, 'acc', 'user', { phone: null })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('creates a name-only contact with a null phone', async () => {
    const insert = vi.fn(() => ({
      select: () => ({
        single: async () => ({ data: { id: 'c-name-only' }, error: null }),
      }),
    }));
    const db = {
      from: vi.fn(() => ({ insert })),
    } as unknown as SupabaseClient;

    await expect(
      findOrCreateContact(db, 'acc', 'user', { name: 'Maria', phone: '' })
    ).resolves.toEqual({ id: 'c-name-only', created: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Maria', phone: null })
    );
  });
});
