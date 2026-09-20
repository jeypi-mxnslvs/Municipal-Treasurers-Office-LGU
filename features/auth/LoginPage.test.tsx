import { describe, expect, it, vi } from 'vitest';

const { supabaseAuth } = vi.hoisted(() => ({
  supabaseAuth: { signInWithPassword: vi.fn() },
}));

vi.mock('@/services/supabase', () => ({ supabase: { auth: supabaseAuth } }));
vi.mock('@/services/api', () => ({ api: { login: vi.fn() } }));

import LoginPage from './LoginPage';

describe('LoginPage authentication boundary', () => {
  it('does not ship workstation account maps or fallback passwords', () => {
    expect(LoginPage.toString()).not.toContain('admin123');
    expect(LoginPage.toString()).not.toContain('assessor123');
  });
});
