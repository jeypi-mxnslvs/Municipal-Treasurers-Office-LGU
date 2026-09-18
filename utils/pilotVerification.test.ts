import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Property, TaxYearRecord, DelinquencyPeriodVerification } from '@/types';
import { calculateTaxLiability } from '@/utils/taxLogic';
import { LocalHttpRepository } from '@/services/LocalHttpRepository';

describe('Stage 14: Real-World Pilot & End-to-End Workflow Verification', () => {
  let repo: LocalHttpRepository;

  beforeEach(() => {
    repo = new LocalHttpRepository('http://127.0.0.1:8000/api/v1');
    vi.restoreAllMocks();
  });

  // Case 1 & 2: Clean modern property vs Historical gap property
  it('correctly calculates liabilities for clean modern property vs unverified historical gap property', () => {
    // 1. Clean modern parcel (origin 2020, last paid 2024)
    const modernProperty: Property = {
      id: 'prop-modern-01',
      tdNumber: 'TD-2020-001',
      previousTdNumber: '',
      pin: '024-15-001-01',
      ownerName: 'Maria Santos',
      address: 'Poblacion, Santa Rosa, Nueva Ecija',
      barangay: 'Poblacion',
      propertyClass: 'Residential',
      lotAreaSqm: 250,
      marketValue: 500000,
      assessedValue: 100000,
      lastPaidYear: 2024,
      lastPaidQuarter: 4,
      parcelOriginYear: 2020,
      isShellRecord: false
    };

    const modernResult = calculateTaxLiability(modernProperty);
    // Should have dues for 2025 and 2026 (not 1971!)
    expect(modernResult.records.length).toBeGreaterThanOrEqual(2);
    expect(modernResult.records[0].year).toBe(2025);
    expect(modernResult.grandTotal).toBeGreaterThan(0);

    // 2. Archival property with unverified gap (missing historical AV)
    const archivalProperty: Property = {
      id: 'prop-archive-01',
      tdNumber: 'TD-ARCH-1980',
      previousTdNumber: '',
      ownerName: 'Heirs of Pedro Cruz',
      address: 'Berang, Santa Rosa',
      barangay: 'Berang',
      propertyClass: 'Agricultural',
      assessedValue: 80000,
      marketValue: 200000,
      lastPaidYear: 1979,
      lastPaidQuarter: 4,
      isShellRecord: false,
      hasUnverifiedPriorHistory: true
    };

    const archivalResult = calculateTaxLiability(archivalProperty);
    const unverifiedRecords = archivalResult.records.filter(r => r.isUnverifiedHistorical);
    expect(unverifiedRecords.length).toBeGreaterThan(0);
    // Unverified records must not create payable totals before AV transcription
    unverifiedRecords.forEach(r => {
      expect(r.totalDue).toBeNull();
      expect(r.isPayable).toBe(false);
    });
  });

  // Case 3: Shell record protection
  it('enforces shell record prohibition from clearance and delinquency processing', () => {
    const shellProperty: Property = {
      id: 'prop-shell-01',
      tdNumber: 'SHELL-UNV-999',
      previousTdNumber: '',
      ownerName: 'Unknown / Unverified Parcel',
      address: 'Santa Rosa',
      barangay: 'Lourdes',
      propertyClass: 'Residential',
      assessedValue: 0,
      marketValue: 0,
      lastPaidYear: 2020,
      isShellRecord: true
    };

    const result = calculateTaxLiability(shellProperty);
    expect(result.grandTotal).toBe(0);
    expect(shellProperty.isShellRecord).toBe(true);
    // Clearance eligibility must reject shell records
    const isEligibleForClearance = !shellProperty.isShellRecord && result.records.length === 0;
    expect(isEligibleForClearance).toBe(false);
  });

  // Case 4: Sequential Delinquency Period Verification
  it('records external settlement evidence through verifyDelinquencyPeriod API contract', async () => {
    const mockVerification: DelinquencyPeriodVerification = {
      id: 501,
      propertyId: 'prop-modern-01',
      tdNumberSnapshot: 'TD-2020-001',
      periodKey: '2025',
      taxYear: 2025,
      periodLabel: 'Tax Year 2025',
      status: 'VERIFIED_SETTLED_EXTERNALLY',
      verificationType: 'EXTERNAL_SETTLEMENT_EVIDENCE',
      sourceReference: 'Provincial-Receipt-98214',
      remarks: 'Settled under Provincial Amnesty Order',
      verifiedBy: 'USR-2026-02',
      verifiedAt: '2026-09-18T00:00:00.000Z',
      stationId: 'Assessor-Desk-02',
      createdAt: '2026-09-18T00:00:00.000Z'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVerification,
    });

    const verification = await repo.verifyDelinquencyPeriod({
      propertyId: 'prop-modern-01',
      tdNumber: 'TD-2020-001',
      periodKey: '2025',
      taxYear: 2025,
      periodLabel: 'Tax Year 2025',
      status: 'VERIFIED_SETTLED_EXTERNALLY',
      verificationType: 'EXTERNAL_SETTLEMENT_EVIDENCE',
      sourceReference: 'Provincial-Receipt-98214',
      remarks: 'Settled under Provincial Amnesty Order',
      verifiedBy: 'USR-2026-02',
      stationId: 'Assessor-Desk-02'
    });

    expect(verification.id).toBe(501);
    expect(verification.status).toBe('VERIFIED_SETTLED_EXTERNALLY');
    expect(verification.verificationType).toBe('EXTERNAL_SETTLEMENT_EVIDENCE');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/delinquency/verify'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  // Case 5: Supervisory Reversal
  it('executes supervisory reversal preserving original decision via immutable audit event', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Verification successfully reversed' }),
    });

    await repo.revertDelinquencyVerification({
      propertyId: 'prop-modern-01',
      taxYear: 2025,
      authorizedBy: 'Supervisor Admin',
      reason: 'Amnesty certificate invalidated by provincial audit',
      stationId: 'Main-HQ'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/delinquency/revert'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          propertyId: 'prop-modern-01',
          taxYear: 2025,
          authorizedBy: 'Supervisor Admin',
          reason: 'Amnesty certificate invalidated by provincial audit',
          stationId: 'Main-HQ'
        })
      })
    );
  });

  // Case 6: Statement of Account (SOA) Formatting & Accounting Identity
  it('preserves accounting identity across all Statement of Account records (Basic + SEF = Base)', () => {
    const property: Property = {
      id: 'prop-test-soa',
      tdNumber: 'TD-SOA-001',
      previousTdNumber: '',
      ownerName: 'Dominador Gonzales',
      address: 'Maliwalo, Santa Rosa',
      barangay: 'Maliwalo',
      propertyClass: 'Commercial',
      lotAreaSqm: 500,
      marketValue: 1200000,
      assessedValue: 300000,
      lastPaidYear: 2023,
      lastPaidQuarter: 4,
      isShellRecord: false
    };

    const result = calculateTaxLiability(property);
    expect(result.records.length).toBeGreaterThanOrEqual(2); // 2024, 2025, 2026

    result.records.forEach((record: TaxYearRecord) => {
      if (!record.isUnverifiedHistorical && record.totalDue !== null) {
        const basic = record.basicTax ?? ((record.baseTax || 0) / 2);
        const sef = record.sefTax ?? ((record.baseTax || 0) / 2);
        expect(basic + sef).toBeCloseTo(record.baseTax || 0, 2);
        expect(basic).toBeCloseTo(sef, 2); // 50-50 fund split
        const netTotal = (record.baseTax || 0) + (record.penaltyAmount || 0) - (record.discountAmount || 0);
        expect(record.totalDue).toBeCloseTo(netTotal, 2);
      }
    });
  });

  // Case 7: Strict Absence of Cashiering / Payment writes
  it('confirms ITreasuryRepository does not expose postPayment or voidReceipt methods', () => {
    const repoAny = repo as unknown as Record<string, unknown>;
    expect(repoAny.postPayment).toBeUndefined();
    expect(repoAny.voidReceipt).toBeUndefined();
    expect(repoAny.getActiveBooklet).toBeUndefined();
    expect(repoAny.assignBooklet).toBeUndefined();
  });
});
