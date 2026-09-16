import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineStorage } from './OfflineStorage';
import { OfflineSyncService } from './OfflineSyncService';
import { OfflineTreasuryRepository } from './OfflineTreasuryRepository';
import { Property, TaxYearRecord, OfficialReceipt, OfflinePaymentItem } from '@/types';
import { ITreasuryRepository } from '../ITreasuryRepository';

describe('Phase 5: Offline Resilience & Field Tellering (COA AF-51 Compliance)', () => {
  let storage: OfflineStorage;
  let syncService: OfflineSyncService;
  let mockBaseRepo: ITreasuryRepository;
  let offlineRepo: OfflineTreasuryRepository;

  const sampleProperties: Property[] = [
    {
      id: 'prop-101',
      tdNumber: '2026-001-0001',
      previousTdNumber: '2020-001-0001',
      ownerName: 'Juan Dela Cruz',
      address: '123 Rizal St',
      barangay: 'Poblacion',
      propertyClass: 'Residential',
      assessedValue: 250000,
      lastPaidYear: 2024,
      lastPaidQuarter: 4,
      isShellRecord: false
    },
    {
      id: 'prop-102',
      tdNumber: '2026-002-0050',
      previousTdNumber: '2020-002-0050',
      ownerName: 'Maria Santos',
      address: 'Zone 4',
      barangay: 'Sinalhan',
      propertyClass: 'Agricultural',
      assessedValue: 120000,
      lastPaidYear: 2025,
      lastPaidQuarter: 4,
      isShellRecord: false
    }
  ];

  beforeEach(() => {
    storage = new OfflineStorage();
    syncService = new OfflineSyncService(storage);

    mockBaseRepo = {
      getProperties: vi.fn().mockResolvedValue(sampleProperties),
      getPropertyAssessment: vi.fn(),
      getPropertyCompletedRecords: vi.fn().mockResolvedValue([]),
      saveProperty: vi.fn(),
      saveHistoricalAssessedValue: vi.fn(),
      deleteProperty: vi.fn(),
      lookupSfmv: vi.fn().mockResolvedValue({ base_rate_sqm: 2000, assessment_level: 0.2 }),
      postPayment: vi.fn().mockResolvedValue({
        receiptNo: '5500001',
        date: new Date().toISOString(),
        status: 'ISSUED',
        property: {
          id: 'prop-101',
          tdNumber: '2026-001-0001',
          ownerName: 'Juan Dela Cruz',
          address: '123 Rizal St',
          barangay: 'Poblacion',
          assessedValue: 250000,
          propertyClass: 'Residential'
        },
        itemizedRecords: [],
        summary: {
          basicTax: 2500,
          sefTax: 2500,
          baseTaxTotal: 5000,
          penalty: 0,
          discount: 0,
          totalPaid: 5000
        },
        tenderType: 'CASH',
        postedBy: 'Juan Cashier'
      }),
      voidReceipt: vi.fn().mockResolvedValue({ message: 'Receipt voided successfully', receiptNo: '5500001' }),
      getActiveBooklet: vi.fn().mockResolvedValue(null),
      getBooklets: vi.fn().mockResolvedValue([]),
      assignBooklet: vi.fn().mockResolvedValue(undefined),
      getDashboardStats: vi.fn(),
      getSyncStatus: vi.fn(),
      subscribeToMutations: vi.fn().mockReturnValue(() => {}),
      getUsers: vi.fn().mockResolvedValue([]),
      lookupUser: vi.fn().mockResolvedValue(null),
      login: vi.fn(),
      verifyPassword: vi.fn().mockResolvedValue(true),
      registerUser: vi.fn(),
      deleteUser: vi.fn().mockResolvedValue({ message: 'User deleted' }),
      resetUserPassword: vi.fn().mockResolvedValue({ message: 'Password reset' }),
      getPropertyAudit: vi.fn().mockResolvedValue([]),
      getAllAuditLogs: vi.fn().mockResolvedValue([]),
      logSecurityEvent: vi.fn().mockResolvedValue(undefined),
      getSecurityAuditLogs: vi.fn().mockResolvedValue([]),
      logFieldOverrideAudit: vi.fn().mockResolvedValue(undefined),
      getMunicipalTaxSettings: vi.fn(),
      updateMunicipalTaxSettings: vi.fn(),
      getImportBatches: vi.fn().mockResolvedValue([]),
      bulkImportProperties: vi.fn(),
      getBackupDownloadUrl: vi.fn().mockReturnValue('/backup.sql')
    };

    offlineRepo = new OfflineTreasuryRepository(mockBaseRepo, storage, syncService);
  });

  it('caches properties locally and filters by search and barangay in offline mode', async () => {
    await storage.cacheProperties(sampleProperties);

    const all = await storage.getCachedProperties();
    expect(all.length).toBe(2);

    const filteredBarangay = await storage.getCachedProperties(undefined, 'Sinalhan');
    expect(filteredBarangay.length).toBe(1);
    expect(filteredBarangay[0].ownerName).toBe('Maria Santos');

    const filteredSearch = await storage.getCachedProperties('Dela Cruz');
    expect(filteredSearch.length).toBe(1);
    expect(filteredSearch[0].tdNumber).toBe('2026-001-0001');
  });

  it('allocates strictly sequential AF-51 receipt serials without Math.random()', async () => {
    await storage.registerOfflineBooklet({
      bookletId: 'BK-FIELD-01',
      stationId: 'Mobile-Caravan-01',
      seriesStart: 90001,
      seriesEnd: 90003,
      currentSerial: 90001,
      assignedCashier: 'Ana Lim',
      isActive: true
    });

    const s1 = await storage.allocateNextSerial('Mobile-Caravan-01');
    expect(s1.receiptNo).toBe('90001');
    expect(s1.bookletId).toBe('BK-FIELD-01');

    const s2 = await storage.allocateNextSerial('Mobile-Caravan-01');
    expect(s2.receiptNo).toBe('90002');

    const s3 = await storage.allocateNextSerial('Mobile-Caravan-01');
    expect(s3.receiptNo).toBe('90003');

    // Booklet is now exhausted (seriesEnd 90003 reached)
    await expect(storage.allocateNextSerial('Mobile-Caravan-01')).rejects.toThrow(/exhausted/);
  });

  it('posts payment in offline outbox, generates valid AF-51 receipt, and updates property arrears', async () => {
    // Force offline simulation
    vi.spyOn(offlineRepo as unknown as { isOnline: () => boolean }, 'isOnline').mockReturnValue(false);

    // Seed offline cache
    const testProp: Property = { ...sampleProperties[0], lastPaidYear: 2024 };
    await storage.cacheProperties([testProp]);
    await storage.registerOfflineBooklet({
      bookletId: 'BK-CARAVAN-01',
      stationId: 'Caravan-01',
      seriesStart: 880001,
      seriesEnd: 880050,
      currentSerial: 880001,
      assignedCashier: 'Juan Cashier',
      isActive: true
    });

    const paidRecords: TaxYearRecord[] = [
      {
        year: 2025,
        status: 'Delinquent',
        baseTax: 5000,
        basicTax: 2500,
        sefTax: 2500,
        monthsDelayed: 8,
        penaltyRate: 0.16,
        penaltyAmount: 800,
        totalDue: 5800
      }
    ];

    const receipt = await offlineRepo.postPayment({
      propertyId: 'prop-101',
      paidRecords,
      tenderType: 'CASH',
      postedBy: 'Juan Cashier',
      stationId: 'Caravan-01'
    });

    expect(receipt.status).toBe('ISSUED');
    expect(receipt.isOffline).toBe(true);
    expect(receipt.offlineSyncStatus).toBe('PENDING');
    expect(receipt.summary.totalPaid).toBe(5800);
    expect(receipt.receiptNo).toBe('880001');

    // Verify outbox queue
    const pending = await storage.getPendingPayments();
    expect(pending.length).toBe(1);
    expect(pending[0].receiptSnapshot.isOffline).toBe(true);
  });

  it('synchronizes pending payments sequentially when online and flags conflicts if server advanced', async () => {
    const localStore = new OfflineStorage();
    const testReceipt: OfficialReceipt = {
      receiptNo: '880001',
      date: new Date().toISOString(),
      status: 'ISSUED',
      bookletId: 'BK-CARAVAN-01',
      isOffline: true,
      property: {
        id: 'prop-101',
        tdNumber: '2026-001-0001',
        ownerName: 'Juan Dela Cruz',
        address: '123 Rizal St',
        barangay: 'Poblacion',
        assessedValue: 250000,
        propertyClass: 'Residential'
      },
      itemizedRecords: [],
      summary: {
        basicTax: 2500,
        sefTax: 2500,
        baseTaxTotal: 5000,
        penalty: 0,
        discount: 0,
        totalPaid: 5000
      },
      tenderType: 'CASH',
      postedBy: 'Caravan Cashier'
    };

    const testPaymentItem: OfflinePaymentItem = {
      id: 'offline-pay-001',
      propertyId: 'prop-101',
      receiptNo: '880001',
      bookletId: 'BK-CARAVAN-01',
      paidRecords: [
        {
          year: 2025,
          status: 'Delinquent',
          baseTax: 5000,
          basicTax: 2500,
          sefTax: 2500,
          monthsDelayed: 0,
          penaltyRate: 0,
          penaltyAmount: 0,
          totalDue: 5000
        }
      ],
      totalPaid: 5000,
      tenderType: 'CASH',
      postedBy: 'Caravan Cashier',
      stationId: 'Caravan-01',
      createdAt: new Date().toISOString(),
      syncStatus: 'PENDING',
      receiptSnapshot: testReceipt
    };

    await localStore.enqueuePayment(testPaymentItem);

    // Mock server showing property is already settled through 2025 (Conflict Scenario!)
    const conflictMockRepo: ITreasuryRepository = {
      ...mockBaseRepo,
      getProperties: vi.fn().mockResolvedValue([
        { ...sampleProperties[0], lastPaidYear: 2025 }
      ])
    };

    // Run sync
    const sync = new OfflineSyncService(localStore);
    vi.spyOn(sync, 'isOnline', 'get').mockReturnValue(true);
    
    const result = await sync.sync(conflictMockRepo);
    expect(result.conflicts).toBe(1);
    expect(result.synced).toBe(0);
    expect(result.errors[0].error).toContain('Conflict: Property 2026-001-0001 was already cleared');
  });
});
