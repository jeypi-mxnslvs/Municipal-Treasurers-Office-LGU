import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({
  authMock: {
    signInWithPassword: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock('./supabase', () => ({ supabase: { auth: authMock } }));

import { AuthService } from './authService';

describe('AuthService Supabase Auth boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses Supabase Auth and maps trusted user metadata', async () => {
    authMock.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-1',
          email: 'assessor@example.com',
          user_metadata: { name: 'Municipal Assessor', role: 'Assessor', stationId: 'Desk-1' },
        },
        session: { access_token: 'supabase-session' },
      },
      error: null,
    });

    const service = new AuthService();
    const result = await service.login('assessor@example.com', 'secret');

    expect(authMock.signInWithPassword).toHaveBeenCalledWith({
      email: 'assessor@example.com',
      password: 'secret',
    });
    expect(result).toEqual({
      token: 'supabase-session',
      user: {
        id: 'auth-user-1',
        name: 'Municipal Assessor',
        username: 'assessor@example.com',
        role: 'Assessor',
        stationId: 'Desk-1',
      },
    });
  });

  it('rejects authentication errors without creating a local session', async () => {
    authMock.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: new Error('Invalid login') });

    await expect(new AuthService().login('bad@example.com', 'bad')).rejects.toThrow('Invalid login');
    expect(authMock.signInWithPassword).toHaveBeenCalledTimes(1);
  });
});
