import { describe, expect, it, vi } from 'vitest';

const verifyPassword = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('./supabase', () => ({ supabase: {} }));
vi.mock('./authService', () => ({ authService: { verifyPassword } }));

import { api } from './api';

describe('password confirmation boundary', () => {
  it('uses Supabase Auth for password confirmation', async () => {
    expect(await api.verifyPassword('admin@example.com', 'password')).toBe(true);
  });
});
