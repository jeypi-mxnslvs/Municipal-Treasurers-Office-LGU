import { describe, it, expect } from 'vitest';
import { Property, TaxYearRecord, OfficialReceipt } from '../types';
import {
  generateNoticeOfDelinquencyCsv,
  generateWordHtml,
  generateReceiptCsv,
  generateReceiptWordHtml,
  formatPesos,
  DocumentExportTotals,
} from './documentExport';

describe('utils/documentExport', () => {
  const mockProperty: Property = {
    id: 'prop-test-01',
    tdNumber: 'TD-SR-2026-001',
    previousTdNumber: 'TD-SR-2020-001',
    pin: '023-01-001-01',
    ownerName: 'Juan Dela Cruz',
    address: '123 Rizal St.',
    barangay: 'Poblacion',
    propertyClass: 'Residential',
    lotAreaSqm: 250,
    assessedValue: 200000,
    lastPaidYear: 2023,
    lastPaidQuarter: 4,
    isShellRecord: false,
  };

  const mockRecords: TaxYearRecord[] = [
    {
      year: 2024,
      periodLabel: '2024',
      startYear: 2024,
      endYear: 2024,
      yearsCovered: [2024],
      status: 'Delinquent',
      assessedValue: 200000,
      baseTax: 4000, // 2% of 200k = 4,000 (2,000 Basic + 2,000 SEF)
      basicTax: 2000,
      sefTax: 2000,
      monthsDelayed: 33,
      penaltyRate: 0.66,
      penaltyAmount: 2640,
      discountRate: 0,
      discountAmount: 0,
      totalDue: 6640,
      isPayable: true,
    },
    {
      year: 2025,
      periodLabel: '2025',
      startYear: 2025,
      endYear: 2025,
      yearsCovered: [2025],
      status: 'Delinquent',
      assessedValue: 200000,
      baseTax: 4000,
      basicTax: 2000,
      sefTax: 2000,
      monthsDelayed: 21,
      penaltyRate: 0.42,
      penaltyAmount: 1680,
      discountRate: 0,
      discountAmount: 0,
      totalDue: 5680,
      isPayable: true,
    },
  ];

  const mockTotals: DocumentExportTotals = {
    basic: 6160,
    sef: 6160,
    grandTotal: 12320,
  };

  it('formats currency with peso sign and commas', () => {
    expect(formatPesos(12345.67)).toBe('₱12,345.67');
    expect(formatPesos(null)).toBe(' -   ');
    expect(formatPesos(undefined)).toBe(' -   ');
  });

  it('generates Notice of Delinquency CSV matching COMPUTATION.csv signature', () => {
    const csv = generateNoticeOfDelinquencyCsv(
      mockProperty,
      mockRecords,
      mockTotals,
      'September 16, 2026'
    );

    // Verify statutory header
    expect(csv).toContain('REPUBLIC OF THE PHILIPPINES');
    expect(csv).toContain('Office of the Treasurer - Municipality of Santa Rosa');
    expect(csv).toContain('NOTICE OF DELINQUENCY IN THE PAYMENT OF REAL PROPERTY TAX (RA 7160 SEC. 254)');
    expect(csv).toContain('Date:,"SEPTEMBER 16, 2026"');
    expect(csv).toContain('LAST PAYMENT:,2023 (Q4)');

    // Verify table columns line
    expect(csv).toContain(
      'Tax Declaration No.,,Area,Assess Value,Location,,Kind of Property,,,,Year,Unpaid Taxes,,Penalties/Discount,,Total Tax Delinquency,,'
    );

    // Verify data rows (1% fund basis: 4000 baseTax -> 2000.00 unpaid taxes)
    expect(csv).toContain('"TD-SR-2026-001",,"250","200000.00","Poblacion, Santa Rosa",,"Residential",,,,2024, 2000.00 ,, 1320.00 ,, 3320.00 ,,');
    expect(csv).toContain('"TD-SR-2026-001",,"250","200000.00","Poblacion, Santa Rosa",,"Residential",,,,2025, 2000.00 ,, 840.00 ,, 2840.00 ,,');

    // Verify fund totals and signatories
    expect(csv).toContain('BASIC,,6160.00');
    expect(csv).toContain('SEF,,6160.00');
    expect(csv).toContain('TOTAL,,12320.00');
    expect(csv).toContain('Revenue Collection Clerk');
    expect(csv).toContain('Myra V. Cunanan');
    expect(csv).toContain('Municipal Treasurer');
  });

  it('generates Microsoft Word compatible HTML document with MSO Word XML and letterhead', () => {
    const wordHtml = generateWordHtml({
      documentTitle: 'Notice of Delinquency in the Payment of Real Property Tax',
      property: mockProperty,
      records: mockRecords,
      totals: mockTotals,
    });

    // Check Word XML headers
    expect(wordHtml).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
    expect(wordHtml).toContain('<w:WordDocument>');
    expect(wordHtml).toContain('<w:View>Print</w:View>');

    // Check letterhead and metadata
    expect(wordHtml).toContain('Municipality of Santa Rosa');
    expect(wordHtml).toContain('Office of the Municipal Treasurer');
    expect(wordHtml).toContain('TD-SR-2026-001');
    expect(wordHtml).toContain('Juan Dela Cruz');

    // Check table borders and cells
    expect(wordHtml).toContain('border: 1.5pt solid #000000;');
    expect(wordHtml).toContain('₱6,160.00');
    expect(wordHtml).toContain('₱12,320.00');
    expect(wordHtml).toContain('Myra V. Cunanan');
  });

  const mockReceipt: OfficialReceipt = {
    receiptNo: 'AF51-4500013',
    date: '2026-09-16T11:59:51.000Z',
    status: 'ISSUED',
    property: {
      id: 'prop-test-01',
      tdNumber: '17-23001-84332',
      pin: '956-20-517-60-872',
      ownerName: 'Adoracion Aquino',
      address: '39 Aguinaldo',
      barangay: 'Aguinaldo',
      propertyClass: 'Machinery',
      assessedValue: 1718200,
    },
    itemizedRecords: [
      {
        year: 2005,
        periodLabel: '2005',
        startYear: 2005,
        endYear: 2005,
        yearsCovered: [2005],
        status: 'Delinquent',
        assessedValue: 1718200,
        baseTax: 200,
        basicTax: 100,
        sefTax: 100,
        monthsDelayed: 36,
        penaltyRate: 0.72,
        penaltyAmount: 144,
        discountRate: 0,
        discountAmount: 0,
        totalDue: 344,
        isPayable: true,
      },
    ],
    summary: {
      basicTax: 100,
      sefTax: 100,
      baseTaxTotal: 200,
      penalty: 144,
      discount: 0,
      totalPaid: 344,
    },
    tenderType: 'CASH',
    postedBy: 'Helen Abejuro (Assessor • Assessor-Desk-03)',
  };

  it('generates Accountable Form 51 Clearance Slip CSV with statutory fields', () => {
    const csv = generateReceiptCsv(mockReceipt);

    expect(csv).toContain('REPUBLIC OF THE PHILIPPINES');
    expect(csv).toContain('OFFICIAL REAL PROPERTY TAX CLEARANCE SLIP & LEDGER');
    expect(csv).toContain('ACCOUNTABLE FORM NO. 51 REF:,"AF51-4500013"');
    expect(csv).toContain('STATUS:,"OFFICIALLY ISSUED (RA 7160)"');
    expect(csv).toContain('Tax Declaration No. (TDN):,"17-23001-84332"');
    expect(csv).toContain('Property Index No. (PIN):,"956-20-517-60-872"');
    expect(csv).toContain('Declared Owner:,"Adoracion Aquino"');
    expect(csv).toContain('Machinery');
    expect(csv).toContain('"2005",100.00,100.00,144.00,0.00,344.00');
    expect(csv).toContain('Grand Totals:,100.00,100.00,144.00,0.00,344.00');
    expect(csv).toContain('OFFICIALLY CLEARED UNDER RA 7160');
    expect(csv).toContain('Helen Abejuro (Assessor • Assessor-Desk-03)');
  });

  it('generates Microsoft Word compatible Clearance Slip with MSO Word XML and VOID banner support', () => {
    const wordHtml = generateReceiptWordHtml(mockReceipt);

    expect(wordHtml).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
    expect(wordHtml).toContain('<w:WordDocument>');
    expect(wordHtml).toContain('OFFICIAL REAL PROPERTY TAX CLEARANCE SLIP & LEDGER');
    expect(wordHtml).toContain('AF51-4500013');
    expect(wordHtml).toContain('17-23001-84332');
    expect(wordHtml).toContain('Adoracion Aquino');
    expect(wordHtml).toContain('₱344.00');
    expect(wordHtml).toContain('Helen Abejuro (Assessor • Assessor-Desk-03)');

    // Test voided receipt handling
    const voidedReceipt: OfficialReceipt = {
      ...mockReceipt,
      status: 'VOIDED',
      voidReason: 'Supervisory correction',
      voidedBy: 'Treasury Admin',
      voidedAt: '2026-09-16T12:30:00.000Z',
    };

    const voidedWordHtml = generateReceiptWordHtml(voidedReceipt);
    expect(voidedWordHtml).toContain('*** OFFICIAL RECEIPT VOIDED & CANCELLED (COA AUDIT PROTOCOL) ***');
    expect(voidedWordHtml).toContain('Supervisory correction');

    const voidedCsv = generateReceiptCsv(voidedReceipt);
    expect(voidedCsv).toContain('STATUS:,"VOIDED / CANCELLED (COA)"');
    expect(voidedCsv).toContain('CANCELLATION REASON:,"Supervisory correction"');
    expect(voidedCsv).toContain('CANCELLED / VOIDED UNDER COA PROTOCOLS');
  });
});
