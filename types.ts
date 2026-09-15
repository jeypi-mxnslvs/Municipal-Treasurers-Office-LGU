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
  isShellRecord: boolean;
  totalDebt?: number;
  status?: 'CLEARED' | 'PARTIAL' | 'DELINQUENT';
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
  receiptNo?: string;
  clearedAt?: string;
  clearedBy?: string;
  clearanceReference?: string;
  basicTax?: number;
  sefTax?: number;
  baseTax: number;
  systemBasicTax?: number;       // Original system-calculated Basic Tax
  systemSefTax?: number;         // Original system-calculated SEF Tax
  systemDiscountRate?: number;   // Original system-calculated Discount Rate
  isManuallyEdited?: boolean;    // Flag indicating field(s) were manually overridden
  editReason?: string;           // Mandatory reason for manual assessor override
  monthsDelayed: number;
  penaltyRate: number;
  penaltyAmount: number;
  discountRate?: number;
  discountAmount?: number;
  totalDue: number;
  isPayable?: boolean;
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

export interface User {
  id: string | number;
  name: string;
  username?: string;
  role: 'Cashier' | 'Assessor' | 'Admin' | 'Viewer';
  stationId: string;
}

export interface AccountableFormBooklet {
  id: number;
  bookletId: string;
  formType: 'AF-51';
  seriesStart: number;
  seriesEnd: number;
  currentSerial: number;
  assignedToUserId?: number;
  assignedToUsername?: string;
  status: 'ACTIVE' | 'EXHAUSTED' | 'REVOKED';
  createdAt?: string;
}

export interface OfficialReceipt {
  receiptNo: string;
  date: string;
  status?: 'ISSUED' | 'VOIDED';
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  bookletId?: string;
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
  createdAt?: string;
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