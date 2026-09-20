import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

vi.mock('./supabase', () => ({ supabase: {} }));

import { SupabaseRepository } from './SupabaseRepository';

const source = readFileSync(fileURLToPath(new URL('./SupabaseRepository.ts', import.meta.url)), 'utf8');

describe('SupabaseRepository authentication boundary', () => {
  it('does not contain browser-side password verification or seeded credentials', () => {
    expect(source).not.toContain('password_hash');
    expect(source).not.toContain('admin123');
    expect(source).not.toContain('assessor123');
    expect(source).not.toContain('createSessionToken');
    expect(source).not.toContain("rpc('authenticate_user'");
  });

  it('does not delete a Supabase Auth identity through the legacy users table', async () => {
    await expect(new SupabaseRepository().deleteUser('staff-1')).rejects.toThrow(
      'User deletion must use the Supabase Auth administrator boundary.'
    );
  });
});
