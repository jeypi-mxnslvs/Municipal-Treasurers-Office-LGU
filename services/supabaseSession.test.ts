import { describe, expect, it } from 'vitest';
import { mapSupabaseUser } from './supabaseSession';

describe('Supabase session mapping', () => {
  it('maps only approved trusted roles', () => {
    expect(mapSupabaseUser({
      id: 'user-1',
      email: 'admin@example.com',
      user_metadata: { name: 'Admin', role: 'Admin', stationId: 'HQ' },
    })).toEqual({
      id: 'user-1',
      name: 'Admin',
      username: 'admin@example.com',
      role: 'Admin',
      stationId: 'HQ',
    });
  });

  it('rejects missing or unknown roles', () => {
    expect(() => mapSupabaseUser({ id: 'user-2', email: 'unknown@example.com', user_metadata: {} })).toThrow(
      'Authenticated user has no approved role'
    );
  });
});
