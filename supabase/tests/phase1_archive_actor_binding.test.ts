import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migration = readFileSync(fileURLToPath(new URL('../migrations/20261003_phase1_archive_actor_binding.sql', import.meta.url)), 'utf8');

describe('Phase 1 archive actor binding migration', () => {
  it('derives archive authorization from trusted Supabase claims', () => {
    expect(migration).toContain('public.current_app_role() <> \'Admin\'');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('REVOKE EXECUTE ON FUNCTION public.archive_property');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.archive_property');
  });

  it('does not use caller role or caller identity as authorization', () => {
    expect(migration).not.toContain('p_authorized_role <> \'Admin\'');
    expect(migration).not.toContain('trim(p_authorized_by)');
  });
});
