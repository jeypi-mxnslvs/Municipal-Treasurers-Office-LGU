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

  it('posts payment atomically via local HTTP endpoint', async () => {
    const mockReceipt = {
      receiptNo: 'AF51-4500001',
      date: '2026-09-15T00:00:00.000Z',
      status: 'ISSUED',
      property: { id: '1', tdNumber: 'TD-001', ownerName: 'Juan', assessedValue: 100000, propertyClass: 'Residential', address: 'Main', barangay: 'Poblacion' },
      itemizedRecords: [],
      summary: { basicTax: 1000, sefTax: 1000, baseTaxTotal: 2000, penalty: 0, discount: 0, totalPaid: 2000 },
      tenderType: 'CASH',
      postedBy: 'Admin'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockReceipt,
    });

    const result = await repo.postPayment({
      propertyId: 1,
      paidRecords: [],
      tenderType: 'CASH',
      postedBy: 'Admin'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.1.100:8000/api/v1/collections/payments',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result.receiptNo).toBe('AF51-4500001');
  });

  it('dispatches supervisory void via local HTTP endpoint', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Official Receipt successfully voided', receiptNo: 'AF51-4500001' }),
    });

    const result = await repo.voidReceipt({
      receiptNo: 'AF51-4500001',
      reason: 'Wrong taxpayer name encoded',
      authorizedBy: 'Supervisor Admin'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://192.168.1.100:8000/api/v1/collections/void',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(result.receiptNo).toBe('AF51-4500001');
  });

  it('throws descriptive error on HTTP non-200 responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'Supervisor authorization required' }),
    });

    await expect(
      repo.voidReceipt({
        receiptNo: 'AF51-4500001',
        reason: 'Error',
        authorizedBy: 'Clerk'
      })
    ).rejects.toThrow('Supervisor authorization required');
  });
});
