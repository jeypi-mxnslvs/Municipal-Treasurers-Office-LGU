import { ITreasuryRepository } from './ITreasuryRepository';
import { SupabaseRepository } from './SupabaseRepository';
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
  CsvImportBatch
} from '@/types';

/**
 * Pluggable Repository Driver Instance
 *
 * Defaults to SupabaseRepository. In an air-gapped or on-premise deployment,
 * this can be swapped with LocalHttpRepository without touching the React UI.
 */
export const treasuryRepository: ITreasuryRepository = new SupabaseRepository();

/**
 * Application-facing facade (`api`).
 * 
 * Preserves the existing UI-facing interface while delegating 100% of data access
 * and persistence operations to `ITreasuryRepository`.
 * 
 * Zero direct Supabase dependencies exist in this file.
 */
export const api = {
  // 1. Properties & Assessment
  getProperties(search?: string, barangay?: string): Promise<Property[]> {
    return treasuryRepository.getProperties(search, barangay);
  },

  getPropertyAssessment(propertyId: string, fallbackProp?: Property, customSettings?: MunicipalTaxSettings): Promise<CalculationResult> {
    return treasuryRepository.getPropertyAssessment(propertyId, fallbackProp, customSettings);
  },

  getPropertyCompletedRecords(propertyId: string | number, property?: Property): Promise<TaxYearRecord[]> {
    return treasuryRepository.getPropertyCompletedRecords(propertyId, property);
  },

  saveProperty(propertyData: Partial<Property>): Promise<Property> {
    return treasuryRepository.saveProperty(propertyData);
  },

  deleteProperty(propertyId: string): Promise<void> {
    return treasuryRepository.deleteProperty(propertyId);
  },

  lookupSfmv(barangay: string, propertyClass: string): Promise<{ base_rate_sqm: number; assessment_level: number }> {
    return treasuryRepository.lookupSfmv(barangay, propertyClass);
  },

  // 2. Payments & Receipts (COA AF-51)
  postPayment(payload: {
    propertyId: string | number;
    paidRecords: TaxYearRecord[];
    tenderType: string;
    tenderReference?: string;
    postedBy: string;
    stationId?: string;
    userId?: number;
  }): Promise<OfficialReceipt> {
    return treasuryRepository.postPayment(payload);
  },

  voidReceipt(payload: {
    receiptNo: string;
    reason: string;
    authorizedBy: string;
    stationId?: string;
  }): Promise<{ message: string; receiptNo: string }> {
    return treasuryRepository.voidReceipt(payload);
  },

  // 3. Accountable Forms (AF-51)
  getActiveBooklet(username?: string): Promise<AccountableFormBooklet | null> {
    return treasuryRepository.getActiveBooklet(username);
  },

  getBooklets(): Promise<AccountableFormBooklet[]> {
    return treasuryRepository.getBooklets();
  },

  assignBooklet(bookletId: string, username: string, userId?: number): Promise<void> {
    return treasuryRepository.assignBooklet(bookletId, username, userId);
  },

  // 4. Dashboard Statistics & Live Multi-Assessor Sync
  getDashboardStats(): Promise<DashboardStatsData> {
    return treasuryRepository.getDashboardStats();
  },

  getSyncStatus(): Promise<SyncStatusData> {
    return treasuryRepository.getSyncStatus();
  },

  subscribeToMutations(onMutation: (mutation: { timestamp: string; author: string; action: string; tdNumber?: string }) => void): () => void {
    return treasuryRepository.subscribeToMutations(onMutation);
  },

  // 5. User Management & Authentication
  getUsers(): Promise<User[]> {
    return treasuryRepository.getUsers();
  },

  login(username: string, password: string, stationId?: string): Promise<{ token: string; user: User }> {
    return treasuryRepository.login(username, password, stationId);
  },

  verifyPassword(username: string, password: string): Promise<boolean> {
    return treasuryRepository.verifyPassword(username, password);
  },

  registerUser(userData: {
    username: string;
    password: string;
    fullName: string;
    role: string;
    stationId: string;
  }): Promise<{ message: string; user: User }> {
    return treasuryRepository.registerUser(userData);
  },

  lookupUser(username: string): Promise<User | null> {
    return treasuryRepository.lookupUser(username);
  },

  deleteUser(id: string | number, adminUsername?: string): Promise<{ message: string }> {
    return treasuryRepository.deleteUser(id, adminUsername);
  },

  resetUserPassword(id: string | number, newPassword: string, adminUsername?: string): Promise<{ message: string }> {
    return treasuryRepository.resetUserPassword(id, newPassword, adminUsername);
  },

  // 6. Audit Logs
  getPropertyAudit(propertyId: string | number): Promise<RptarAuditLog[]> {
    return treasuryRepository.getPropertyAudit(propertyId);
  },

  getAllAuditLogs(): Promise<RptarAuditLog[]> {
    return treasuryRepository.getAllAuditLogs();
  },

  logSecurityEvent(event: {
    eventType: SecurityAuditLog['event_type'];
    username: string;
    userId?: number;
    stationId?: string;
    details?: string;
  }): Promise<void> {
    return treasuryRepository.logSecurityEvent(event);
  },

  getSecurityAuditLogs(): Promise<SecurityAuditLog[]> {
    return treasuryRepository.getSecurityAuditLogs();
  },

  logFieldOverrideAudit(entry: {
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
    return treasuryRepository.logFieldOverrideAudit(entry);
  },

  // 7. Municipal Tax Settings
  getMunicipalTaxSettings(): Promise<MunicipalTaxSettings> {
    return treasuryRepository.getMunicipalTaxSettings();
  },

  updateMunicipalTaxSettings(settings: Partial<MunicipalTaxSettings>, updatedBy?: string): Promise<MunicipalTaxSettings> {
    return treasuryRepository.updateMunicipalTaxSettings(settings, updatedBy);
  },

  // 8. Assessor Import Center & Smart Upsert
  getImportBatches(barangay?: string): Promise<CsvImportBatch[]> {
    return treasuryRepository.getImportBatches(barangay);
  },

  bulkImportProperties(
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
    return treasuryRepository.bulkImportProperties(properties, assessorName, stationId, batchMetadata);
  },

  // 9. Utilities
  getBackupDownloadUrl(): string {
    return treasuryRepository.getBackupDownloadUrl();
  }
};
