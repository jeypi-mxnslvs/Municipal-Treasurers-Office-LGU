export interface HistoricalAssessedValueItem {
  value: number;
  transcribedBy: string;
  transcribedAt: string; // ISO 8601 timestamp
  rptarPageReference?: string; // Physical RPTAR ledger citation (e.g. "Vol. 14, Page 22")
  remarks?: string;
}

export interface Property {
  id: string;
  tdNumber: string; 
  previousTdNumber: string; 
  pin?: string;
  ownerName: string;
  address: string;
  barangay: string;
  propertyClass: 'Agricultural' | 'Dwell House' | 'Industrial' | 'Machinery' | 'Residential' | string;
  lotAreaSqm?: number;
  marketValue?: number;
  assessedValue: number;
  lastPaidYear: number;
  lastPaidQuarter?: number; // Last settled quarter: 1, 2, 3, or 4 (default 4 for full year)
  delinquencyStartYear?: number; // Explicit first unpaid year (if provided by import or user)
  parcelOriginYear?: number | null; // Subdivision/creation year. If null, defaults to HISTORICAL_BASELINE_YEAR
  historicalAssessedValues?: Record<string, HistoricalAssessedValueItem>; // Keyed by canonical bracket label
  hasUnverifiedPriorHistory?: boolean; // Derived summary flag: true if >=1 unverified historical record exists
  isShellRecord: boolean;
  totalDebt?: number;
  status?: 'CLEARED' | 'PARTIAL' | 'DELINQUENT';
  assessmentPeriods?: PropertyAssessmentPeriod[];
  encoderLabel?: string; // e.g. "Assessor 1, Assessor 2"
  entryType?: 'MANUAL' | 'CSV_IMPORT'; // 'MANUAL' entries prioritized in #1 position
  createdAt?: string;
  updatedAt?: string;
}

export interface TaxYearRecord {
  id?: string;
  year: number;
  periodLabel?: string;          // Official bracket display string (e.g. "1973-79", "2026 1-2Q")
  startYear?: number;            // Starting year of the bracket
  endYear?: number;              // Ending year of the bracket
  yearsCovered?: number[];       // All calendar years covered (e.g. [1973, 1974, ..., 1979])
  quarterSpan?: string;          // E.g. "1-2Q" or "3-4Q"
  isAdvance?: boolean;           // Advance payment period flag
  quarter?: number;
  status: 'Delinquent' | 'Current' | 'Advance' | 'Cleared';
  periodKey?: string;
  verificationStatus?: DelinquencyPeriodStatus;
  receiptNo?: string;
  clearedAt?: string;
  clearedBy?: string;
  clearanceReference?: string;
  sourceReference?: string;
  assessedValue?: number;        // Period-specific assessed valuation (e.g. 10000 for 1987-1991)
  isMissingValuation?: boolean;  // True if AV has not yet been retrieved from physical RPTAR
  isUnverifiedHistorical?: boolean; // True if period lies in pre-import unverified gap (1971+)
  rptarReference?: string;       // E.g. "RPTAR Vol. 14, Page 22"
  basicTax?: number | null;
  sefTax?: number | null;
  baseTax: number | null;        // NULL for unverified historical records, never 0
  systemBasicTax?: number;       // Original system-calculated Basic Tax
  systemSefTax?: number;         // Original system-calculated SEF Tax
  systemDiscountRate?: number;   // Original system-calculated Discount Rate
  isManuallyEdited?: boolean;    // Flag indicating field(s) were manually overridden
  editReason?: string;           // Mandatory reason for manual assessor override
  monthsDelayed: number;
  penaltyRate: number;
  penaltyAmount: number | null;  // NULL for unverified historical records, never 0
  discountRate?: number;
  discountAmount?: number;
  totalDue: number | null;       // NULL for unverified historical records, never 0
  isPayable?: boolean;
  isStatementReady?: boolean;
  isClearanceEligible?: boolean;
}

export interface TaxSummary {
  totalBasicTax: number;
  totalSefTax: number;
  totalBaseTax: number;
  totalPenalty: number;
  totalDiscount: number;
  grandTotal: number;
}

export interface CalculationResult {
  propertyId?: number | string;
  currentTd?: string;
  ownerName?: string;
  assessedValue?: number;
  records: TaxYearRecord[];
  summary?: TaxSummary;
  grandTotal: number;
}

export type DelinquencyPeriodStatus =
  | 'UNVERIFIED'
  | 'VERIFIED_OUTSTANDING'
  | 'VERIFIED_SETTLED_EXTERNALLY'
  | 'DISPUTED'
  | 'NOT_APPLICABLE'
  | 'SUPERSEDED';

export type VerificationType =
  | 'ASSESSMENT'
  | 'HISTORICAL_VALUATION'
  | 'DELINQUENCY'
  | 'EXTERNAL_SETTLEMENT_EVIDENCE';

export interface DelinquencyPeriodVerification {
  id?: number | string;
  propertyId: number | string;
  tdNumberSnapshot: string;
  periodKey: string;
  taxYear: number;
  periodLabel: string;
  status: DelinquencyPeriodStatus;
  verificationType: VerificationType;
  sourceReference?: string;
  remarks?: string;
  verifiedBy: number | string;
  verifierName?: string;
  verifiedAt: string;
  stationId?: string;
  supersedesId?: number | string;
  reversalReason?: string;
  createdAt?: string;
}

export interface ClearanceEligibilityResult {
  isEligible: boolean;
  reasonsForIneligibility: string[];
  verifiedOutstandingTotal: number;
  unverifiedPeriodsCount: number;
  disputedPeriodsCount: number;
  asOfDate: string;
}

export interface User {
  id: string | number;
  name: string;
  username?: string;
  role: 'Admin' | 'Assessor';
  stationId: string;
}

export interface PropertyAssessmentPeriod {
  id?: number;
  propertyId: number | string;
  tdNumber: string;
  startYear: number;
  endYear: number;
  assessedValue: number;
  marketValue?: number;
  source?: 'CSV_IMPORT' | 'PHYSICAL_RPTAR' | 'SYSTEM_DEFAULT';
  importBatchId?: number;
  status?: 'VALID' | 'MISSING' | 'CONFLICTING';
  isMissing?: boolean;
  remarks?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfficialReceipt {
  receiptNo: string;
  date: string;
  status?: 'ISSUED' | 'VOIDED';
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  bookletId?: string;
  isOffline?: boolean;
  offlineSyncStatus?: 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'FAILED';
  property: {
    id: string | number;
    tdNumber: string;
    pin?: string;
    ownerName: string;
    address: string;
    barangay: string;
    assessedValue: number;
    propertyClass: string;
  };
  itemizedRecords: TaxYearRecord[];
  summary: {
    basicTax: number;
    sefTax: number;
    baseTaxTotal: number;
    penalty: number;
    discount: number;
    totalPaid: number;
  };
  tenderType: 'CASH' | 'CHECK' | 'ONLINE';
  tenderReference?: string;
  postedBy: string;
}

export interface DashboardStatsData {
  totalProperties: number;
  clearedCount: number;
  delinquentCount: number;
  partialCount: number;
  shellRecordsCount: number;
  totalCollected: number;
  todayCollected: number;
  totalDelinquentDebt: number;
  collectionEfficiency: number;
  monthlyTrend: Array<{ month: string; collections: number; target: number }>;
  barangayBreakdown: Array<{ barangay: string; properties: number; outstandingDebt: number }>;
}

export interface RptarAuditLog {
  id: number;
  property_id?: number;
  td_number: string;
  tax_year?: number;
  action_type: 'CREATED' | 'UPDATED' | 'VALUATION_REVISED' | 'FIELD_OVERRIDE' | 'CLEARED' | 'DUES_CLEARED' | 'DELETED' | 'RECEIPT_VOIDED';
  field_changed?: 'BASIC_TAX' | 'SEF_TAX' | 'DISCOUNT_RATE' | string;
  original_value?: number;
  new_value?: number;
  difference?: number;
  reason?: string;
  user_id?: number;
  user_role?: string;
  assessor_name: string;
  station_id: string;
  details: string;
  timestamp: string;
}

export interface SyncStatusData {
  latestMutation: {
    timestamp: string;
    author: string;
    action: string;
    tdNumber: string;
  } | null;
  serverTime: string;
  activeConnections?: number;
}

export interface MunicipalTaxSettings {
  id?: number;
  earlyPaymentDiscountRate: number; // default 0.20 (20% for Jan-Mar)
  earlyPaymentStartMonth: number;    // default 1 (January)
  earlyPaymentEndMonth: number;      // default 3 (March)
  regularPromptDiscountRate: number; // default 0.10 (10% for Apr-Dec payment-date policy)
  delinquentDiscountRate: number;    // default 0.00 (0% for past years)
  effectiveYear: number;             // default 2026
  updatedBy?: string;
  updatedAt?: string;
}

export type CsvImportRowState =
  | 'VALID_NEW'
  | 'VALID_UPDATE'
  | 'UNCHANGED'
  | 'DUPLICATE_IN_FILE'
  | 'INVALID_TD'
  | 'INVALID_BARANGAY'
  | 'INVALID_PROPERTY_CLASS'
  | 'INVALID_NUMERIC_VALUE'
  | 'CONFLICTING_RECORD';

export interface CsvImportBatch {
  id?: number;
  batchName: string;
  barangay: string;
  filename: string;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  unchangedRows: number;
  importedBy: string;
  fileHash?: string;
  fileSizeBytes?: number;
  stationId?: string;
  status?: string;
  rejectedRows?: number;
  errorCount?: number;
  completedAt?: string;
  createdAt?: string;
}

export type ComputationScheduleStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUPERSEDED';

export interface ComputationScheduleRow {
  id?: number;
  periodLabel: string;
  startYear: number;
  endYear: number;
  quarterSpan?: string;
  basicTaxRate?: number;
  sefTaxRate?: number;
  penaltyRate?: number;
  discountRate?: number;
  penaltyMonths?: number;
  discountType?: string;
  applicableClasses?: string[];
  sourceSheet?: string;
  sourceRow?: number;
  sourceFormula?: string;
}

export interface ComputationScheduleVersion {
  id?: number;
  scheduleName: string;
  authorityReference: string;
  sourceFilename: string;
  sourceFileHash: string;
  status: ComputationScheduleStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  uploadedBy: string;
  approvedBy?: string;
  createdAt?: string;
  activatedAt?: string;
  rows: ComputationScheduleRow[];
}

export interface SecurityAuditLog {
  id: number;
  event_type: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'USER_CREATED' | 'ROLE_CHANGED' | 'PASSWORD_RESET' | 'USER_DELETED' | 'ACCESS_DENIED';
  username: string;
  user_id?: number;
  station_id?: string;
  ip_address?: string;
  details?: string;
  created_at: string;
}

export interface ParsedPenaltySchedule {
  effectiveYear: number;
  effectiveMonth: number;
  effectiveMonthName: string;
  scheduleLabel: string;
  rates: Record<string, number>;
  sourceMode: 'EVALUATED_NUMBERS' | 'STATUTORY_CALCULATED';
}
