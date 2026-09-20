import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth: { getSession } } }));

import { LocalHttpRepository } from './LocalHttpRepository';

describe('LocalHttpRepository session boundary', () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: { access_token: 'supabase-access-token' } } });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
  });

  it('uses the Supabase session token instead of localStorage tokens', async () => {
    await new LocalHttpRepository('https://local.example/api').getProperties();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://local.example/api/properties?',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer supabase-access-token' }),
      })
    );
  });
});
