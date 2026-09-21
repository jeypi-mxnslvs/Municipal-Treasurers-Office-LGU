import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { BARANGAYS } from '@/constants';
import type { DelinquencyPeriodVerification, Property } from '@/types';
import { parsePropertyWorkbook } from '@/utils/propertyWorkbookParser';
import { auditPropertyForVerification, validatePaymentEligibility } from '@/utils/validationPipeline';
import { calculateTaxLiability } from '@/utils/taxLogic';
import { derivePeriodKeyFromRecord, projectPropertyPeriods } from '@/utils/periodProjection';

const fixturePath = resolve(process.cwd(), 'docs/evidence/phase6/pilot_masterlist.csv');
const fixture = readFileSync(fixturePath, 'utf8');
const fixtureRows = fixture.trim().split('\n').map((line) => line.split(','));
const headers = fixtureRows[0];
const rows = fixtureRows.slice(1);

const workbookBytes = (sheets: Record<string, unknown[][]>) => {
  const workbook = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), name);
  }
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

const baseProperty: Property = {
  id: 'phase6-pilot-property',
  tdNumber: '17-23001-00001',
  previousTdNumber: '',
  pin: '024-01-001-01-001',
  ownerName: 'Pilot Owner 01',
  address: 'Pilot Address 01',
  barangay: 'Rizal (Poblacion)',
  propertyClass: 'Residential',
  lotAreaSqm: 101,
  marketValue: 401000,
  assessedValue: 80100,
  lastPaidYear: 2025,
  lastPaidQuarter: 4,
  parcelOriginYear: 2020,
  isShellRecord: false,
  disposition: 'ACTIVE',
};

const verification = (
  status: DelinquencyPeriodVerification['status'],
  overrides: Partial<DelinquencyPeriodVerification> = {},
): DelinquencyPeriodVerification => ({
  id: 1,
  propertyId: baseProperty.id,
  tdNumberSnapshot: baseProperty.tdNumber,
  periodKey: '2026',
  taxYear: 2026,
  periodLabel: '2026',
  status,
  verificationType: status === 'VERIFIED_SETTLED_EXTERNALLY'
    ? 'EXTERNAL_SETTLEMENT_EVIDENCE'
    : 'DELINQUENCY',
  sourceReference: 'OFFICIAL-EXT-2026-0001',
  remarks: 'Phase 6 sanitized pilot evidence',
  verifiedBy: 'pilot-assessor',
  verifiedAt: '2026-09-21T00:00:00.000Z',
  stationId: 'PILOT-DESK',
  ...overrides,
});

describe('Phase 6 representative municipal pilot', () => {
  it('locks the sanitized source hash and imports all 33 barangays idempotently', () => {
    expect(createHash('sha256').update(fixture).digest('hex')).toBe(
      'd448f1711175bf51f1db4671528a66f58ffd921e87df742bd5df1b2398d0d813',
    );
    expect(rows).toHaveLength(33);
    expect(new Set(rows.map((row) => row[5]))).toEqual(new Set(BARANGAYS));

    const sheets = Object.fromEntries(rows.map((row) => [row[5], [headers, row]]));
    const bytes = workbookBytes(sheets);
    const first = parsePropertyWorkbook(bytes, 'phase6-pilot.xlsx');
    const repeated = parsePropertyWorkbook(bytes, 'phase6-pilot.xlsx');

    expect(first.candidates).toHaveLength(33);
    expect(first.issues.filter((issue) => issue.severity === 'ERROR')).toHaveLength(0);
    expect(repeated).toEqual(first);
  });

  it('classifies duplicate, conflict, invalid numeric, invalid class, missing AV, and shell cases', () => {
    const valid = rows[0];
    const conflicting = [...valid];
    conflicting[3] = 'Conflicting Pilot Owner';
    const invalidNumeric = [...rows[1]];
    invalidNumeric[8] = 'not-a-number';
    const invalidClass = [...rows[2]];
    invalidClass[6] = 'Commercial';
    const missingAv = [...rows[3]];
    missingAv[9] = '';

    const result = parsePropertyWorkbook(workbookBytes({
      Data: [headers, valid, valid, conflicting, invalidNumeric, invalidClass, missingAv],
    }), 'phase6-edge-cases.xlsx');
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).toEqual(expect.arrayContaining([
      'DUPLICATE_IDENTICAL_ROW',
      'DUPLICATE_TD_CONFLICT',
      'INVALID_NUMERIC_VALUE',
      'INVALID_PROPERTY_CLASS',
      'MISSING_ASSESSED_VALUE',
    ]));
    expect(auditPropertyForVerification({ ...baseProperty, pin: '', assessedValue: 0, isShellRecord: true })).toEqual(
      expect.objectContaining({ canVerify: false }),
    );
  });

  it('uses physical RPTAR provenance and the approved statutory penalty boundaries', () => {
    const archival: Property = {
      ...baseProperty,
      lastPaidYear: 2019,
      delinquencyStartYear: 2020,
      parcelOriginYear: 1987,
      historicalAssessedValues: {
        '1987-1991': {
          value: 50000,
          transcribedBy: 'Pilot Assessor',
          transcribedAt: '2026-09-21T00:00:00.000Z',
          rptarPageReference: 'RPTAR Vol. PILOT-14 Folio 22',
        },
      },
    };
    const result = calculateTaxLiability(archival, {
      paymentDate: new Date(2026, 8, 15),
      splitCurrentYearQuarters: true,
    });
    const historical = result.records.find((record) => record.periodLabel === '1987-1991');

    expect(historical).toEqual(expect.objectContaining({
      assessedValue: 50000,
      rptarReference: 'RPTAR Vol. PILOT-14 Folio 22',
      penaltyRate: 0.24,
      totalDue: 6200,
    }));
    expect(result.records.find((record) => record.periodLabel === '2024')?.penaltyRate).toBe(0.66);
    expect(result.records.find((record) => record.periodLabel === '2025')?.penaltyRate).toBe(0.42);
    expect(result.records.find((record) => record.periodLabel === '2026 1-2Q')?.penaltyRate).toBe(0.18);
    expect(result.records.every((record) => record.penaltyRate <= 0.72)).toBe(true);
  });

  it('enforces arrears-first selection across multi-year records', () => {
    expect(validatePaymentEligibility({
      isShellRecord: false,
      lastPaidYear: 2023,
      selectedRecords: [{ year: 2025 }, { year: 2026 }],
    }).isValid).toBe(false);
    expect(validatePaymentEligibility({
      isShellRecord: false,
      lastPaidYear: 2023,
      selectedRecords: [{ year: 2024 }, { year: 2025 }, { year: 2026 }],
    }).isValid).toBe(true);
  });

  it('projects external evidence, disputes, supersession, and clearance outcomes', () => {
    const outstanding = projectPropertyPeriods(baseProperty, [verification('VERIFIED_OUTSTANDING')]);
    const unverified = projectPropertyPeriods(baseProperty);
    const disputed = projectPropertyPeriods(baseProperty, [verification('DISPUTED')]);
    const settled = projectPropertyPeriods(baseProperty, [verification('VERIFIED_SETTLED_EXTERNALLY')]);
    const superseded = projectPropertyPeriods(baseProperty, [
      verification('VERIFIED_SETTLED_EXTERNALLY', { id: 10 }),
      verification('DISPUTED', { id: 11, supersedesId: 10, verifiedAt: '2026-09-21T00:01:00.000Z' }),
    ]);
    const historicalGap = projectPropertyPeriods({
      ...baseProperty,
      lastPaidYear: 2024,
      delinquencyStartYear: 2025,
      parcelOriginYear: 2020,
    });

    expect(outstanding.isClearanceEligible).toBe(false);
    expect(unverified.hasUnverifiedPeriods).toBe(true);
    expect(disputed.hasDisputedPeriods).toBe(true);
    expect(settled).toEqual(expect.objectContaining({ isClearanceEligible: true, outstandingTotal: 0 }));
    expect(settled.periods[0]).toEqual(expect.objectContaining({
      status: 'VERIFIED_SETTLED_EXTERNALLY',
      sourceReference: 'OFFICIAL-EXT-2026-0001',
      clearanceImpact: 'CLEARED',
    }));
    expect(superseded.hasDisputedPeriods).toBe(true);
    expect(historicalGap.hasHistoricalGaps).toBe(true);

    const shell = projectPropertyPeriods({ ...baseProperty, pin: '', assessedValue: 0, isShellRecord: true });
    expect(shell).toEqual(expect.objectContaining({ isShellRecord: true, isClearanceEligible: false }));

    const repositorySource = readFileSync(resolve(process.cwd(), 'services/SupabaseRepository.ts'), 'utf8');
    expect(repositorySource).toContain("fallbackProp.disposition !== 'ACTIVE'");
    expect(repositorySource).toContain("prop.disposition !== 'ACTIVE'");
  });

  it('balances SOA and notice totals into equal Basic and SEF allocations', () => {
    const result = calculateTaxLiability(
      { ...baseProperty, lastPaidYear: 2023 },
      { paymentDate: new Date(2026, 8, 21) },
    );
    const payable = result.records.filter((record) => !record.isUnverifiedHistorical && record.totalDue !== null);
    const basic = payable.reduce((sum, record) => sum + (record.totalDue ?? 0) / 2, 0);
    const sef = payable.reduce((sum, record) => sum + (record.totalDue ?? 0) / 2, 0);

    expect(basic).toBeCloseTo(sef, 2);
    expect(basic + sef).toBeCloseTo(result.grandTotal, 2);
    expect(result.records.map((record) => [record.periodLabel, record.baseTax, record.penaltyRate, record.totalDue])).toEqual([
      ['2024', 1602, 0.66, 2659.32],
      ['2025', 1602, 0.42, 2274.84],
      ['2026', 1602, 0, 1441.8],
    ]);
    expect(result.grandTotal).toBe(6375.96);
    const notice = calculateTaxLiability(
      { ...baseProperty, lastPaidYear: 2023 },
      { paymentDate: new Date(2026, 8, 21), splitCurrentYearQuarters: true },
    );
    expect(notice.records.map((record) => [record.periodLabel, record.baseTax, record.penaltyAmount, record.discountAmount, record.totalDue])).toEqual([
      ['2024', 1602, 1057.32, 0, 2659.32],
      ['2025', 1602, 672.84, 0, 2274.84],
      ['2026 1-2Q', 801, 144.18, 0, 945.18],
      ['2026 3-4 Q', 801, 0, 0, 801],
    ]);
    expect(notice.grandTotal).toBe(6680.34);
    payable.forEach((record) => {
      expect((record.basicTax ?? 0) + (record.sefTax ?? 0)).toBeCloseTo(record.baseTax ?? 0, 2);
    });
  });

  it('retains trusted negative permissions for browser roles', () => {
    const boundary = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20261004_phase1_authorization_boundary.sql'),
      'utf8',
    );
    expect(boundary).toContain("auth.jwt() -> 'app_metadata' ->> 'role'");
    expect(boundary).toContain('Assessor or Admin session required');
    expect(boundary).toContain('Admin session required');
    expect(boundary).toContain('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated');
    expect(boundary).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.purge_sample_masterlist[\s\S]*TO authenticated/);
  });

  it('derives a stable quarter-aware verification sequence', () => {
    const result = calculateTaxLiability({ ...baseProperty, lastPaidYear: 2023 }, {
      paymentDate: new Date(2026, 8, 15),
      splitCurrentYearQuarters: true,
    });
    const keys = result.records.map(derivePeriodKeyFromRecord);
    expect(keys).toEqual(['2024', '2025', '2026-q12', '2026-q34']);
  });
});
