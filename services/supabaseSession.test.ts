import { describe, expect, it } from 'vitest';
import { mapSupabaseUser, sessionWithinMaximumAge } from './supabaseSession';

describe('Supabase session mapping', () => {
  it('maps only approved trusted roles', () => {
    expect(mapSupabaseUser({
      id: 'user-1',
      email: 'admin@example.com',
      app_metadata: { role: 'Admin' },
      user_metadata: { name: 'Admin', role: 'Assessor', stationId: 'HQ' },
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
    expect(() => mapSupabaseUser({ id: 'user-3', user_metadata: { role: 'Admin' } })).toThrow(
      'Authenticated user has no approved role'
    );
    expect(() => mapSupabaseUser({ id: 'user-4', app_metadata: { role: 'SystemMaintenance' } })).toThrow(
      'Authenticated user has no approved role'
    );
  });

  it('rejects sessions older than eight hours or missing a sign-in time', () => {
    const now = Date.parse('2026-09-20T12:00:00.000Z');
    expect(sessionWithinMaximumAge('2026-09-20T04:00:01.000Z', now)).toBe(true);
    expect(sessionWithinMaximumAge('2026-09-20T04:00:00.000Z', now)).toBe(false);
    expect(sessionWithinMaximumAge(undefined, now)).toBe(false);
  });
});
