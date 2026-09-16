import { Property, TaxYearRecord, PropertyAssessmentPeriod } from '@/types';

/**
 * SCENARIO 1: Multi-Era Property with Historical Assessed Values
 * Real-world case: Juan Dela Cruz owns land dating back to 1987.
 * - 1987-1991: AV was ₱10,000.00 (PD 464, 24% penalty cap)
 * - 1992-1993: AV was ₱15,000.00 (RA 7160 early transition, 24% cap)
 * - 1994-2005: AV was ₱25,000.00 (1994 General Revision, 72% cap)
 * - 2006-2011: AV was ₱40,000.00 (2006 General Revision, 72% cap)
 * - 2012-2025: Current SMV ₱40,000.00
 */
export const FIXTURE_MULTI_ERA_PROPERTY: Property = {
  id: 'prop-fixture-01',
  tdNumber: '03-0001-00101',
  previousTdNumber: 'PREV-87-0101',
  pin: '033-18-001-02-005',
  ownerName: 'Juan Dela Cruz',
  address: '124 Rizal St.',
  barangay: 'Poblacion',
  propertyClass: 'Residential',
  lotAreaSqm: 240,
  marketValue: 200000,
  assessedValue: 40000, // Latest current valuation
  lastPaidYear: 1986,   // Multi-decade arrears
  lastPaidQuarter: 4,
  isShellRecord: false,
};

export const FIXTURE_MULTI_ERA_PERIODS: PropertyAssessmentPeriod[] = [
  {
    id: 101,
    propertyId: 'prop-fixture-01',
    tdNumber: '03-0001-00101',
    startYear: 1987,
    endYear: 1991,
    assessedValue: 10000, // Historical AV
    source: 'PHYSICAL_RPTAR',
    remarks: 'Verified from RPTAR Vol. 14, Page 22',
    status: 'VALID',
    isMissing: false,
  },
  {
    id: 102,
    propertyId: 'prop-fixture-01',
    tdNumber: '03-0001-00101',
    startYear: 1992,
    endYear: 1993,
    assessedValue: 15000,
    source: 'PHYSICAL_RPTAR',
    remarks: 'Verified from RPTAR Vol. 18, Page 05',
    status: 'VALID',
    isMissing: false,
  },
  {
    id: 103,
    propertyId: 'prop-fixture-01',
    tdNumber: '03-0001-00101',
    startYear: 1994,
    endYear: 2005,
    assessedValue: 25000,
    source: 'PHYSICAL_RPTAR',
    remarks: '1994 Municipal General Revision Roll',
    status: 'VALID',
    isMissing: false,
  },
  {
    id: 104,
    propertyId: 'prop-fixture-01',
    tdNumber: '03-0001-00101',
    startYear: 2006,
    endYear: 2011,
    assessedValue: 40000,
    source: 'CSV_IMPORT',
    status: 'VALID',
    isMissing: false,
  },
];

export const FIXTURE_MULTI_ERA_RECORDS: TaxYearRecord[] = [
  {
    year: 1987,
    periodLabel: '1987-1991',
    startYear: 1987,
    endYear: 1991,
    yearsCovered: [1987, 1988, 1989, 1990, 1991],
    assessedValue: 10000,
    isMissingValuation: false,
    rptarReference: 'RPTAR Vol. 14, Page 22',
    status: 'Delinquent',
    basicTax: 500.00,    // 10,000 * 0.01 * 5 yrs
    sefTax: 500.00,      // 10,000 * 0.01 * 5 yrs
    baseTax: 1000.00,
    systemBasicTax: 500.00,
    systemSefTax: 500.00,
    monthsDelayed: 12,
    penaltyRate: 0.24,   // 24% historical cap
    penaltyAmount: 240.00,
    discountRate: 0.00,
    discountAmount: 0.00,
    totalDue: 1240.00,
    isPayable: true,
  },
  {
    year: 1992,
    periodLabel: '1992-1993',
    startYear: 1992,
    endYear: 1993,
    yearsCovered: [1992, 1993],
    assessedValue: 15000,
    isMissingValuation: false,
    rptarReference: 'RPTAR Vol. 18, Page 05',
    status: 'Delinquent',
    basicTax: 300.00,    // 15,000 * 0.01 * 2 yrs
    sefTax: 300.00,      // 15,000 * 0.01 * 2 yrs
    baseTax: 600.00,
    systemBasicTax: 300.00,
    systemSefTax: 300.00,
    monthsDelayed: 12,
    penaltyRate: 0.24,
    penaltyAmount: 144.00,
    discountRate: 0.00,
    discountAmount: 0.00,
    totalDue: 744.00,
    isPayable: true,
  },
  {
    year: 1994,
    periodLabel: '1994-2005',
    startYear: 1994,
    endYear: 2005,
    yearsCovered: [1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005],
    assessedValue: 25000,
    isMissingValuation: false,
    rptarReference: '1994 Municipal General Revision Roll',
    status: 'Delinquent',
    basicTax: 3000.00,   // 25,000 * 0.01 * 12 yrs
    sefTax: 3000.00,     // 25,000 * 0.01 * 12 yrs
    baseTax: 6000.00,
    systemBasicTax: 3000.00,
    systemSefTax: 3000.00,
    monthsDelayed: 36,
    penaltyRate: 0.72,   // 72% statutory cap
    penaltyAmount: 4320.00,
    discountRate: 0.00,
    discountAmount: 0.00,
    totalDue: 10320.00,
    isPayable: true,
  },
  {
    year: 2006,
    periodLabel: '2006-11',
    startYear: 2006,
    endYear: 2011,
    yearsCovered: [2006, 2007, 2008, 2009, 2010, 2011],
    assessedValue: 40000,
    isMissingValuation: false,
    status: 'Delinquent',
    basicTax: 2400.00,   // 40,000 * 0.01 * 6 yrs
    sefTax: 2400.00,     // 40,000 * 0.01 * 6 yrs
    baseTax: 4800.00,
    systemBasicTax: 2400.00,
    systemSefTax: 2400.00,
    monthsDelayed: 36,
    penaltyRate: 0.72,
    penaltyAmount: 3456.00,
    discountRate: 0.00,
    discountAmount: 0.00,
    totalDue: 8256.00,
    isPayable: true,
  },
];

/**
 * SCENARIO 2: Legacy Property with MISSING Historical Assessed Value
 * Real-world case: Account imported from CSV with last paid year 1986.
 * The system identified bracket '1987-1991', but NO AV exists in the digital file.
 * The row MUST be flagged as requiring physical RPTAR lookup.
 */
export const FIXTURE_MISSING_AV_RECORD: TaxYearRecord = {
  year: 1987,
  periodLabel: '1987-1991',
  startYear: 1987,
  endYear: 1991,
  yearsCovered: [1987, 1988, 1989, 1990, 1991],
  assessedValue: undefined,     // MISSING VALUATION
  isMissingValuation: true,      // Flagged for Assessor Action
  status: 'Delinquent',
  basicTax: 0,
  sefTax: 0,
  baseTax: 0,
  systemBasicTax: 0,
  systemSefTax: 0,
  monthsDelayed: 12,
  penaltyRate: 0.24,
  penaltyAmount: 0,
  discountRate: 0,
  discountAmount: 0,
  totalDue: 0,
  isPayable: false,              // Cannot post payment until AV is provided
};

/**
 * SCENARIO 3: Clean Single-Era Modern Property (100% Backward Compatible)
 * Last paid year 2023. Arrears strictly in 2024-2025.
 * Assessed value is uniform (₱50,000.00) matching property.assessedValue.
 */
export const FIXTURE_MODERN_CLEAN_RECORD: TaxYearRecord = {
  year: 2024,
  periodLabel: '2024',
  startYear: 2024,
  endYear: 2024,
  yearsCovered: [2024],
  assessedValue: 50000,
  isMissingValuation: false,
  status: 'Delinquent',
  basicTax: 500.00,
  sefTax: 500.00,
  baseTax: 1000.00,
  systemBasicTax: 500.00,
  systemSefTax: 500.00,
  monthsDelayed: 33,
  penaltyRate: 0.66,
  penaltyAmount: 660.00,
  discountRate: 0.00,
  discountAmount: 0.00,
  totalDue: 1660.00,
  isPayable: true,
};

/**
 * SCENARIO 4: Cleared Historical Era (Settled via AF-51 Official Receipt)
 * 1987-1991 was already settled in 1995 under O.R. No. 5420191.
 */
export const FIXTURE_CLEARED_HISTORICAL_RECORD: TaxYearRecord = {
  year: 1987,
  periodLabel: '1987-1991',
  startYear: 1987,
  endYear: 1991,
  yearsCovered: [1987, 1988, 1989, 1990, 1991],
  assessedValue: 10000,
  isMissingValuation: false,
  status: 'Cleared',
  receiptNo: 'OR-5420191',
  clearedAt: '1995-03-15T09:00:00Z',
  clearanceReference: 'AF-51 Sequential Stub 5420191',
  basicTax: 500.00,
  sefTax: 500.00,
  baseTax: 1000.00,
  monthsDelayed: 0,
  penaltyRate: 0,
  penaltyAmount: 0,
  totalDue: 1000.00,
  isPayable: false,
};
