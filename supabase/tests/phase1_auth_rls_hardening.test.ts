import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migration = readFileSync(fileURLToPath(new URL('../migrations/20261002_phase1_auth_rls_hardening.sql', import.meta.url)), 'utf8');

describe('Phase 1 authorization migration', () => {
  it('revokes anonymous access and blocks legacy password authentication', () => {
    expect(migration).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon');
    expect(migration).toContain('REVOKE EXECUTE ON FUNCTION public.authenticate_user');
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.authenticate_user');
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('WITH CHECK (public.is_admin())');
  });

  it('protects audit logs from direct browser writes and deletion', () => {
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.rptar_audit_logs FROM authenticated');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.security_audit_logs FROM authenticated');
    expect(migration).toContain('FOR DELETE');
  });
});
