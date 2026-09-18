import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalHttpRepository } from './LocalHttpRepository';

describe('Phase 4: Deployment Abstraction (ITreasuryRepository & LocalHttpRepository)', () => {
  let repo: LocalHttpRepository;

  beforeEach(() => {
    repo = new LocalHttpRepository('http://192.168.1.100:8000/api/v1');
    vi.restoreAllMocks();
  });

  it('initializes with custom on-premise base URL', () => {
    expect(repo.getBackupDownloadUrl()).toBe('http://192.168.1.100:8000/api/v1/admin/backup');
  });

  it('dispatches getProperties to local HTTP REST endpoint', async () => {
    const mockProperties = [
      { id: '1', tdNumber: 'TD-001', ownerName: 'Juan Dela Cruz', assessedValue: 100000, lastPaidYear: 2024, barangay: 'Poblacion', propertyClass: 'Residential', isShellRecord: false, address: 'Rizal St.' }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProperties,
    });

    const result = await repo.getProperties('Juan', 'Poblacion');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.1.100:8000/api/v1/properties?search=Juan&barangay=Poblacion',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
    expect(result).toEqual(mockProperties);
  });

  it('dispatches verifyDelinquencyPeriod via local HTTP endpoint', async () => {
    const mockVerification = {
      id: 101,
      propertyId: 1,
      tdNumberSnapshot: 'TD-001',
      periodKey: '2024',
      taxYear: 2024,
      periodLabel: 'Tax Year 2024',
      status: 'VERIFIED_SETTLED_EXTERNALLY',
      verificationType: 'EXTERNAL_SETTLEMENT_EVIDENCE',
      sourceReference: 'OR-2024-9988',
      remarks: 'Prior payment settled',
      verifiedBy: 1,
      verifiedAt: '2026-09-18T00:00:00.000Z',
      stationId: 'Desk-1',
      createdAt: '2026-09-18T00:00:00.000Z'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVerification,
    });

    const result = await repo.verifyDelinquencyPeriod({
      propertyId: 1,
      tdNumber: 'TD-001',
      periodKey: '2024',
      taxYear: 2024,
      periodLabel: 'Tax Year 2024',
      status: 'VERIFIED_SETTLED_EXTERNALLY',
      verificationType: 'EXTERNAL_SETTLEMENT_EVIDENCE',
      sourceReference: 'OR-2024-9988',
      verifiedBy: 1,
      stationId: 'Desk-1'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.1.100:8000/api/v1/delinquency/verify',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result.id).toBe(101);
    expect(result.status).toBe('VERIFIED_SETTLED_EXTERNALLY');
  });

  it('dispatches supervisory reversal via local HTTP endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Verification successfully reversed' }),
    });

    await repo.revertDelinquencyVerification({
      propertyId: 1,
      taxYear: 2024,
      reason: 'Erroneous external receipt encoded',
      authorizedBy: 'Supervisor Admin'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.1.100:8000/api/v1/delinquency/revert',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('throws descriptive error on HTTP non-200 responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'Supervisor authorization required' }),
    });

    await expect(
      repo.revertDelinquencyVerification({
        propertyId: 1,
        taxYear: 2024,
        reason: 'Error',
        authorizedBy: 'Clerk'
      })
    ).rejects.toThrow('Supervisor authorization required');
  });
});
