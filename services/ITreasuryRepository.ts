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
 * ITreasuryRepository
 * 
 * Canonical application-level contract for Real Property Tax Administration System (RPTAS).
 * All UI modules, teller workflows, and report generators interact exclusively with this contract,
 * allowing the underlying storage engine (Supabase Cloud PostgREST vs On-Premise Municipal PostgreSQL)
 * to be swapped without affecting application business logic or presentation components.
 * 
 * Reference: SSOT.md Section 6.2 & ROADMAP_AND_PHASES.md Phase 4
 */
export interface ITreasuryRepository {
  // 1. Properties & Assessment
  getProperties(search?: string, barangay?: string): Promise<Property[]>;
  getPropertyAssessment(propertyId: string, fallbackProp?: Property, customSettings?: MunicipalTaxSettings): Promise<CalculationResult>;
  getPropertyCompletedRecords(propertyId: string | number, property?: Property): Promise<TaxYearRecord[]>;
  saveProperty(propertyData: Partial<Property>): Promise<Property>;
  saveHistoricalAssessedValue(payload: {
    propertyId: string | number;
    periodLabel: string;
    value: number;
    rptarPageReference?: string;
    assessorName: string;
    reason?: string;
  }): Promise<Property>;
  deleteProperty(propertyId: string): Promise<void>;
  lookupSfmv(barangay: string, propertyClass: string): Promise<{ base_rate_sqm: number; assessment_level: number }>;

  // 2. Collections & Receipts (COA AF-51)
  postPayment(payload: {
    propertyId: string | number;
    paidRecords: TaxYearRecord[];
    tenderType: string;
    tenderReference?: string;
    postedBy: string;
    stationId?: string;
    userId?: number;
  }): Promise<OfficialReceipt>;
  voidReceipt(payload: {
    receiptNo: string;
    reason: string;
    authorizedBy: string;
    stationId?: string;
  }): Promise<{ message: string; receiptNo: string }>;

  // 3. Accountable Forms (AF-51 Sequential Stubs)
  getActiveBooklet(username?: string): Promise<AccountableFormBooklet | null>;
  getBooklets(): Promise<AccountableFormBooklet[]>;
  assignBooklet(bookletId: string, username: string, userId?: number): Promise<void>;

  // 4. Reporting, Analytics & Live Multi-Assessor Sync
  getDashboardStats(): Promise<DashboardStatsData>;
  getSyncStatus(): Promise<SyncStatusData>;
  subscribeToMutations(onMutation: (mutation: { timestamp: string; author: string; action: string; tdNumber?: string }) => void): () => void;

  // 5. User Management & Authentication
  getUsers(): Promise<User[]>;
  lookupUser(username: string): Promise<User | null>;
  login(username: string, password: string, stationId?: string): Promise<{ token: string; user: User }>;
  verifyPassword(username: string, password: string): Promise<boolean>;
  registerUser(userData: {
    username: string;
    password: string;
    fullName: string;
    role: string;
    stationId: string;
  }): Promise<{ message: string; user: User }>;
  deleteUser(id: string | number, adminUsername?: string): Promise<{ message: string }>;
  resetUserPassword(id: string | number, newPassword: string, adminUsername?: string): Promise<{ message: string }>;

  // 6. Audit Logs & Forensic History
  getPropertyAudit(propertyId: string | number): Promise<RptarAuditLog[]>;
  getAllAuditLogs(): Promise<RptarAuditLog[]>;
  logSecurityEvent(event: {
    eventType: SecurityAuditLog['event_type'];
    username: string;
    userId?: number;
    stationId?: string;
    details?: string;
  }): Promise<void>;
  getSecurityAuditLogs(): Promise<SecurityAuditLog[]>;
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
  }): Promise<void>;

  // 7. Municipal Tax Settings & Ordinances
  getMunicipalTaxSettings(): Promise<MunicipalTaxSettings>;
  updateMunicipalTaxSettings(settings: Partial<MunicipalTaxSettings>, updatedBy?: string): Promise<MunicipalTaxSettings>;

  // 8. Assessor Import Center & Smart Upsert
  getImportBatches(barangay?: string): Promise<CsvImportBatch[]>;
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
  }>;

  // 9. Utilities
  getBackupDownloadUrl(): string;
}
