import { ITreasuryRepository } from '../ITreasuryRepository';
import { offlineStorage, OfflineStorage } from './OfflineStorage';
import { offlineSyncService, OfflineSyncService } from './OfflineSyncService';
import {
  Property,
  CalculationResult,
  OfficialReceipt,
  DashboardStatsData,
  User,
  RptarAuditLog,
  SyncStatusData,
  SecurityAuditLog,
  AccountableFormBooklet,
  TaxYearRecord,
  MunicipalTaxSettings,
  CsvImportBatch,
  OfflinePaymentItem
} from '@/types';
import { calculateTaxLiability } from '@/utils/taxLogic';

/**
 * OfflineTreasuryRepository
 * 
 * Resilient decorator implementing ITreasuryRepository.
 * Bridges central server drivers (Supabase / LocalHttp) with client-side IndexedDB outbox.
 * 
 * Enables uninterrupted tellering during provincial power outages or mobile caravans.
 * Automatically synchronizes transactions when connectivity is restored.
 * 
 * Reference: ROADMAP_AND_PHASES.md Phase 5
 */
export class OfflineTreasuryRepository implements ITreasuryRepository {
  private baseRepo: ITreasuryRepository;
  private storage: OfflineStorage;
  private syncService: OfflineSyncService;

  constructor(
    baseRepo: ITreasuryRepository,
    storage: OfflineStorage = offlineStorage,
    syncService: OfflineSyncService = offlineSyncService
  ) {
    this.baseRepo = baseRepo;
    this.storage = storage;
    this.syncService = syncService;
    this.syncService.setRepository(baseRepo);
  }

  setBaseRepository(repo: ITreasuryRepository) {
    this.baseRepo = repo;
    this.syncService.setRepository(repo);
  }

  getBaseRepository(): ITreasuryRepository {
    return this.baseRepo;
  }

  private isOnline(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  // 1. Properties & Assessment
  async getProperties(search?: string, barangay?: string): Promise<Property[]> {
    if (this.isOnline()) {
      try {
        const properties = await this.baseRepo.getProperties(search, barangay);
        this.storage.cacheProperties(properties).catch(() => {});
        return properties;
      } catch (err) {
        console.warn('Network request failed, reading from offline IndexedDB cache:', err);
      }
    }
    return this.storage.getCachedProperties(search, barangay);
  }

  async getPropertyAssessment(
    propertyId: string,
    fallbackProp?: Property,
    customSettings?: MunicipalTaxSettings
  ): Promise<CalculationResult> {
    if (this.isOnline()) {
      try {
        return await this.baseRepo.getPropertyAssessment(propertyId, fallbackProp, customSettings);
      } catch (err) {
        console.warn('Network request failed for assessment, calculating from offline cache:', err);
      }
    }

    let prop = fallbackProp;
    if (!prop) {
      prop = (await this.storage.getCachedPropertyById(propertyId)) || undefined;
    }

    if (!prop) {
      throw new Error(`Property ${propertyId} not found in offline local storage.`);
    }

    return calculateTaxLiability(prop, { settings: customSettings });
  }

  async getPropertyCompletedRecords(propertyId: string | number, property?: Property): Promise<TaxYearRecord[]> {
    if (this.isOnline()) {
      try {
        return await this.baseRepo.getPropertyCompletedRecords(propertyId, property);
      } catch (err) {
        console.warn('Network request failed for completed records, generating from local cache:', err);
      }
    }

    let prop = property;
    if (!prop) {
      prop = (await this.storage.getCachedPropertyById(propertyId)) || undefined;
    }

    if (!prop || prop.lastPaidYear < 1970) return [];

    const completed: TaxYearRecord[] = [];
    const minYear = Math.max(prop.lastPaidYear - 4, 1971);
    const baseTax = Math.round(prop.assessedValue * 0.02 * 100) / 100;

    for (let y = minYear; y <= prop.lastPaidYear; y++) {
      completed.push({
        year: y,
        status: 'Cleared',
        baseTax,
        basicTax: baseTax / 2,
        sefTax: baseTax / 2,
        monthsDelayed: 0,
        penaltyRate: 0,
        penaltyAmount: 0,
        discountRate: 0,
        discountAmount: 0,
        totalDue: baseTax,
        clearanceReference: 'Settled per Masterlist Baseline (Offline Cached)',
        clearedBy: 'Historical RPTAR Record',
      });
    }

    return completed;
  }

  async saveProperty(propertyData: Partial<Property>): Promise<Property> {
    if (this.isOnline()) {
      const saved = await this.baseRepo.saveProperty(propertyData);
      this.storage.cacheProperties([saved]).catch(() => {});
      return saved;
    }
    throw new Error('Property masterlist modifications require an active network connection.');
  }

  async deleteProperty(propertyId: string): Promise<void> {
    if (this.isOnline()) {
      return this.baseRepo.deleteProperty(propertyId);
    }
    throw new Error('Property deletion requires an active network connection.');
  }

  async lookupSfmv(barangay: string, propertyClass: string): Promise<{ base_rate_sqm: number; assessment_level: number }> {
    if (this.isOnline()) {
      try {
        return await this.baseRepo.lookupSfmv(barangay, propertyClass);
      } catch {
        // Fallback
      }
    }
    return { base_rate_sqm: 2000, assessment_level: 0.20 };
  }

  // 2. Collections & Receipts (COA AF-51)
  async postPayment(payload: {
    propertyId: string | number;
    paidRecords: TaxYearRecord[];
    tenderType: string;
    tenderReference?: string;
    postedBy: string;
    stationId?: string;
    userId?: number;
  }): Promise<OfficialReceipt> {
    if (this.isOnline()) {
      try {
        const receipt = await this.baseRepo.postPayment(payload);
        const maxYear = Math.max(...payload.paidRecords.map(r => r.year));
        this.storage.updatePropertyArrears(payload.propertyId, maxYear, 4).catch(() => {});
        return receipt;
      } catch (err) {
        console.warn('Online payment failed, falling back to offline outbox queue:', err);
      }
    }

    // OFFLINE PAYMENT POSTING (Field Tellering / Mobile Caravan)
    const stationId = payload.stationId || 'Caravan-Station-01';
    const { receiptNo, bookletId } = await this.storage.allocateNextSerial(stationId);

    let prop = await this.storage.getCachedPropertyById(payload.propertyId);
    if (!prop) {
      prop = {
        id: String(payload.propertyId),
        tdNumber: `TD-LOCAL-${payload.propertyId}`,
        previousTdNumber: '',
        ownerName: 'Field Taxpayer',
        address: 'Santa Rosa, Nueva Ecija',
        barangay: 'Poblacion',
        propertyClass: 'Residential',
        assessedValue: 100000,
        lastPaidYear: 2025,
        lastPaidQuarter: 4,
        isShellRecord: false
      };
    }

    const totalPaid = payload.paidRecords.reduce((sum, r) => sum + (r.totalDue || 0), 0);
    const basicTax = payload.paidRecords.reduce((sum, r) => sum + (r.basicTax ?? ((r.baseTax || 0) / 2)), 0);
    const sefTax = payload.paidRecords.reduce((sum, r) => sum + (r.sefTax ?? ((r.baseTax || 0) / 2)), 0);
    const baseTaxTotal = payload.paidRecords.reduce((sum, r) => sum + (r.baseTax || 0), 0);
    const penalty = payload.paidRecords.reduce((sum, r) => sum + (r.penaltyAmount || 0), 0);
    const discount = payload.paidRecords.reduce((sum, r) => sum + (r.discountAmount || 0), 0);

    const nowIso = new Date().toISOString();

    const officialReceipt: OfficialReceipt = {
      receiptNo,
      date: nowIso,
      status: 'ISSUED',
      bookletId,
      isOffline: true,
      offlineSyncStatus: 'PENDING',
      property: {
        id: prop.id,
        tdNumber: prop.tdNumber,
        pin: prop.pin,
        ownerName: prop.ownerName,
        address: prop.address,
        barangay: prop.barangay,
        assessedValue: prop.assessedValue,
        propertyClass: prop.propertyClass
      },
      itemizedRecords: payload.paidRecords,
      summary: {
        basicTax,
        sefTax,
        baseTaxTotal,
        penalty,
        discount,
        totalPaid
      },
      tenderType: (payload.tenderType as 'CASH' | 'CHECK' | 'ONLINE') || 'CASH',
      tenderReference: payload.tenderReference,
      postedBy: payload.postedBy
    };

    const maxPaidYear = Math.max(...payload.paidRecords.map(r => r.year));
    await this.storage.updatePropertyArrears(payload.propertyId, maxPaidYear, 4);

    const offlineItem: OfflinePaymentItem = {
      id: `off-${Date.now()}-${receiptNo}`,
      propertyId: payload.propertyId,
      receiptNo,
      bookletId,
      paidRecords: payload.paidRecords,
      totalPaid,
      tenderType: payload.tenderType,
      tenderReference: payload.tenderReference,
      postedBy: payload.postedBy,
      stationId,
      userId: payload.userId,
      createdAt: nowIso,
      syncStatus: 'PENDING',
      receiptSnapshot: officialReceipt
    };

    await this.storage.enqueuePayment(offlineItem);

    return officialReceipt;
  }

  async voidReceipt(payload: {
    receiptNo: string;
    reason: string;
    authorizedBy: string;
    stationId?: string;
  }): Promise<{ message: string; receiptNo: string }> {
    if (this.isOnline()) {
      return this.baseRepo.voidReceipt(payload);
    }
    throw new Error('Supervisory voiding of official receipts requires an active online connection to audit server.');
  }

  // 3. Accountable Forms (AF-51 Sequential Stubs)
  async getActiveBooklet(username?: string): Promise<AccountableFormBooklet | null> {
    if (this.isOnline()) {
      try {
        return await this.baseRepo.getActiveBooklet(username);
      } catch {
        // Fallback to offline
      }
    }
    const off = await this.storage.getActiveBooklet();
    if (off) {
      return {
        id: 9999,
        bookletId: off.bookletId,
        formType: 'AF-51',
        seriesStart: off.seriesStart,
        seriesEnd: off.seriesEnd,
        currentSerial: off.currentSerial,
        status: 'ACTIVE'
      };
    }
    return null;
  }

  async getBooklets(): Promise<AccountableFormBooklet[]> {
    if (this.isOnline()) {
      return this.baseRepo.getBooklets();
    }
    const active = await this.getActiveBooklet();
    return active ? [active] : [];
  }

  async assignBooklet(bookletId: string, username: string, userId?: number): Promise<void> {
    if (this.isOnline()) {
      return this.baseRepo.assignBooklet(bookletId, username, userId);
    }
    throw new Error('Assigning booklets requires an online connection.');
  }

  // 4. Reporting, Analytics & Live Multi-Assessor Sync
  async getDashboardStats(): Promise<DashboardStatsData> {
    if (this.isOnline()) {
      try {
        return await this.baseRepo.getDashboardStats();
      } catch {
        // Fallback
      }
    }
    const props = await this.storage.getCachedProperties();
    const pending = await this.storage.getPendingPayments();
    const offlineCollections = pending.reduce((sum, p) => sum + p.totalPaid, 0);

    return {
      totalProperties: props.length,
      clearedCount: props.filter(p => p.lastPaidYear >= 2026).length,
      delinquentCount: props.filter(p => p.lastPaidYear < 2026 && !p.isShellRecord).length,
      partialCount: 0,
      shellRecordsCount: props.filter(p => p.isShellRecord).length,
      totalCollected: offlineCollections,
      todayCollected: offlineCollections,
      totalDelinquentDebt: 0,
      collectionEfficiency: 85,
      monthlyTrend: [],
      barangayBreakdown: []
    };
  }

  async getSyncStatus(): Promise<SyncStatusData> {
    if (this.isOnline()) {
      try {
        return await this.baseRepo.getSyncStatus();
      } catch {
        // Fallback
      }
    }
    return {
      latestMutation: null,
      serverTime: new Date().toISOString()
    };
  }

  subscribeToMutations(onMutation: (mutation: { timestamp: string; author: string; action: string; tdNumber?: string }) => void): () => void {
    if (this.isOnline()) {
      return this.baseRepo.subscribeToMutations(onMutation);
    }
    return () => {};
  }

  // 5. User Management & Authentication
  async getUsers(): Promise<User[]> {
    if (this.isOnline()) {
      return this.baseRepo.getUsers();
    }
    return [];
  }

  async lookupUser(username: string): Promise<User | null> {
    if (this.isOnline()) {
      return this.baseRepo.lookupUser(username);
    }
    return null;
  }

  async login(username: string, password: string, stationId?: string): Promise<{ token: string; user: User }> {
    if (this.isOnline()) {
      return this.baseRepo.login(username, password, stationId);
    }
    // Emergency offline field teller login fallback
    return {
      token: `offline-token-${Date.now()}`,
      user: {
        id: 'caravan-user-1',
        name: username || 'Mobile Caravan Cashier',
        username: username || 'cashier1',
        role: 'Cashier',
        stationId: stationId || 'Caravan-Station-01'
      }
    };
  }

  async verifyPassword(username: string, password: string): Promise<boolean> {
    if (this.isOnline()) {
      return this.baseRepo.verifyPassword(username, password);
    }
    return false;
  }

  async registerUser(userData: {
    username: string;
    password: string;
    fullName: string;
    role: string;
    stationId: string;
  }): Promise<{ message: string; user: User }> {
    if (this.isOnline()) {
      return this.baseRepo.registerUser(userData);
    }
    throw new Error('Registering users requires an online connection.');
  }

  async deleteUser(id: string | number, adminUsername?: string): Promise<{ message: string }> {
    if (this.isOnline()) {
      return this.baseRepo.deleteUser(id, adminUsername);
    }
    throw new Error('User deletion requires an online connection.');
  }

  async resetUserPassword(id: string | number, newPassword: string, adminUsername?: string): Promise<{ message: string }> {
    if (this.isOnline()) {
      return this.baseRepo.resetUserPassword(id, newPassword, adminUsername);
    }
    throw new Error('Password reset requires an online connection.');
  }

  // 6. Audit Logs & Forensic History
  async getPropertyAudit(propertyId: string | number): Promise<RptarAuditLog[]> {
    if (this.isOnline()) {
      return this.baseRepo.getPropertyAudit(propertyId);
    }
    return [];
  }

  async getAllAuditLogs(): Promise<RptarAuditLog[]> {
    if (this.isOnline()) {
      return this.baseRepo.getAllAuditLogs();
    }
    return [];
  }

  async logSecurityEvent(event: {
    eventType: SecurityAuditLog['event_type'];
    username: string;
    userId?: number;
    stationId?: string;
    details?: string;
  }): Promise<void> {
    if (this.isOnline()) {
      return this.baseRepo.logSecurityEvent(event);
    }
  }

  async getSecurityAuditLogs(): Promise<SecurityAuditLog[]> {
    if (this.isOnline()) {
      return this.baseRepo.getSecurityAuditLogs();
    }
    return [];
  }

  async logFieldOverrideAudit(entry: {
    propertyId?: number | string;
    tdNumber: string;
    taxYear: number;
    fieldChanged: 'BASIC_TAX' | 'SEF_TAX' | 'DISCOUNT_RATE' | string;
    originalValue: number;
    newValue: number;
    reason: string;
    assessorName: string;
    stationId?: string;
    userId?: number;
    userRole?: string;
  }): Promise<void> {
    if (this.isOnline()) {
      return this.baseRepo.logFieldOverrideAudit(entry);
    }
  }

  // 7. Municipal Tax Settings & Ordinances
  async getMunicipalTaxSettings(): Promise<MunicipalTaxSettings> {
    if (this.isOnline()) {
      try {
        return await this.baseRepo.getMunicipalTaxSettings();
      } catch {
        // Fallback
      }
    }
    return {
      id: 1,
      earlyPaymentDiscountRate: 0.20,
      earlyPaymentStartMonth: 1,
      earlyPaymentEndMonth: 3,
      regularPromptDiscountRate: 0.10,
      delinquentDiscountRate: 0.00,
      effectiveYear: 2026
    };
  }

  async updateMunicipalTaxSettings(settings: Partial<MunicipalTaxSettings>, updatedBy?: string): Promise<MunicipalTaxSettings> {
    if (this.isOnline()) {
      return this.baseRepo.updateMunicipalTaxSettings(settings, updatedBy);
    }
    throw new Error('Updating municipal tax settings requires an online connection.');
  }

  // 8. Assessor Import Center & Smart Upsert
  async getImportBatches(barangay?: string): Promise<CsvImportBatch[]> {
    if (this.isOnline()) {
      return this.baseRepo.getImportBatches(barangay);
    }
    return [];
  }

  async bulkImportProperties(
    properties: Array<Partial<Property> & Record<string, unknown>>,
    assessorName?: string,
    stationId?: string,
    batchMetadata?: { filename?: string; barangay?: string }
  ): Promise<{
    message: string;
    insertedCount: number;
    updatedCount: number;
    unchangedCount: number;
    batchId?: number;
    errors: unknown[];
  }> {
    if (this.isOnline()) {
      return this.baseRepo.bulkImportProperties(properties, assessorName, stationId, batchMetadata);
    }
    throw new Error('Bulk property import requires an online connection.');
  }

  // 9. Utilities
  getBackupDownloadUrl(): string {
    return this.baseRepo.getBackupDownloadUrl();
  }
}
