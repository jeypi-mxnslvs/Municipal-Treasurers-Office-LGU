import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase 3 audit integrity migration', () => {
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261005_phase3_audit_integrity.sql'), 'utf8');

  it('defines atomic verification, reversal, and valuation RPCs', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.verify_delinquency_period');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.revert_delinquency_verification');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.transcribe_historical_assessed_value');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain('INSERT INTO public.rptar_audit_logs');
    expect(migration).toContain('Admin session required');
    expect(migration).toContain('Reversal reason is required');
    expect(migration).toContain("status='SUPERSEDED'");
    expect(migration).toContain('supersedes_id');
  });

  it('enforces trusted identity, arrears-first ordering, and immutable audits', () => {
    expect(migration).toContain('TD number does not match authoritative property record');
    expect(migration).toContain('Arrears-first verification required');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON public.rptar_audit_logs');
    expect(migration).toContain('uq_active_verification_period');
    expect(migration).toContain("status <> 'SUPERSEDED'");
    expect(migration).toContain("Unsupported evidence type: %");
  });
});
