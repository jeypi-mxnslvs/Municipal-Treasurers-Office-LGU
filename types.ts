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
  isShellRecord: boolean;
  totalDebt?: number;
  status?: 'CLEARED' | 'PARTIAL' | 'DELINQUENT';
}

export interface TaxYearRecord {
  id?: string;
  year: number;
  quarter?: number;
  status: 'Delinquent' | 'Current' | 'Advance';
  basicTax?: number;
  sefTax?: number;
  baseTax: number;
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

export interface OfficialReceipt {
  receiptNo: string;
  date: string;
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
  action_type: 'CREATED' | 'UPDATED' | 'VALUATION_REVISED' | 'CLEARED' | 'DELETED';
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
  };
  serverTime: string;
}