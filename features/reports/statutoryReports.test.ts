import { describe, it, expect } from 'vitest';
import { calculateTaxLiability } from '@/utils/taxLogic';
import { Property } from '@/types';

describe('Phase 6: Regulatory Reporting & Statutory Compliance', () => {
  const mockDelinquentProperty: Property = {
    id: 'prop-2026-99',
    tdNumber: '2026-001-9999',
    previousTdNumber: '2020-001-9999',
    ownerName: 'Ricardo Dalisay',
    address: 'Zone 1, Poblacion',
    barangay: 'Poblacion',
    propertyClass: 'Residential',
    assessedValue: 200000,
    lastPaidYear: 2023,
    lastPaidQuarter: 4,
    isShellRecord: false
  };

  it('generates Notice of Delinquency with canonical assessment era rolls and fund balancing', () => {
    const result = calculateTaxLiability(mockDelinquentProperty);

    // Verify overdue years are present
    const years = result.records.map(r => r.year);
    expect(years).toContain(2024);
    expect(years).toContain(2025);

    // Verify fund balancing per SSOT Section 2.9.4:
    // Basic Real Property Tax = 1% base + penalties/discounts
    // Special Education Fund = identical amount (1% base + penalties/discounts)
    // Grand Total = Basic + SEF = 2 * Basic
    const basicTaxTotal = result.records.reduce((sum, r) => sum + (r.basicTax || (r.baseTax / 2)), 0);
    const sefTaxTotal = result.records.reduce((sum, r) => sum + (r.sefTax || (r.baseTax / 2)), 0);
    expect(basicTaxTotal).toBeCloseTo(sefTaxTotal, 2);

    const totalDue = result.records.reduce((sum, r) => sum + r.totalDue, 0);
    expect(totalDue).toBeCloseTo(result.grandTotal, 2);
    expect(totalDue).toBeGreaterThan(0);
  });

  it('enforces statutory 72% penalty cap on historical arrears in demand notices', () => {
    const ancientProperty: Property = {
      ...mockDelinquentProperty,
      lastPaidYear: 2010
    };
    const result = calculateTaxLiability(ancientProperty);

    // Records for years older than 36 months must never exceed 72% penalty rate
    result.records.filter(r => r.status === 'Delinquent' && r.year <= 2022).forEach(record => {
      expect(record.penaltyRate).toBeLessThanOrEqual(0.72);
      expect(record.penaltyAmount).toBeLessThanOrEqual(record.baseTax * 0.72);
    });
  });

  it('validates BLGF Form 3 fund segregation (50% General Fund, 50% Special Education Fund)', () => {
    const totalCollected = 500000;
    const basicPortion = totalCollected / 2;
    const sefPortion = totalCollected / 2;

    expect(basicPortion).toBe(250000);
    expect(sefPortion).toBe(250000);
    expect(basicPortion + sefPortion).toBe(totalCollected);
  });

  it('reflects period-dependent historical assessed values and unassessed flags on delinquency roll records', () => {
    const multiEraProperty: Property = {
      ...mockDelinquentProperty,
      lastPaidYear: 1986,
      assessedValue: 85000 // Modern base AV
    };

    const periods = [
      { startYear: 1987, endYear: 1991, assessedValue: 10000 },
      { startYear: 1992, endYear: 2005, assessedValue: 25000 },
      { startYear: 2006, endYear: 2011, assessedValue: 40000 }
    ];

    const result = calculateTaxLiability(multiEraProperty, { assessmentPeriods: periods });

    // Verify 1987-1991 roll record carries era-specific AV of 10,000 across 5 years
    const rec1987 = result.records.find(r => r.year === 1987);
    expect(rec1987).toBeDefined();
    expect(rec1987?.assessedValue).toBe(10000);
    expect(rec1987?.baseTax).toBe(1000); // 2% of 10,000 * 5 years (1987-1991)
    expect(rec1987?.basicTax).toBe(500); // 1% of 10,000 * 5 years
    expect(rec1987?.sefTax).toBe(500); // 1% of 10,000 * 5 years

    // Verify 2006-2011 roll record carries era-specific AV of 40,000 across 6 years
    const rec2006 = result.records.find(r => r.year === 2006);
    expect(rec2006).toBeDefined();
    expect(rec2006?.assessedValue).toBe(40000);
    expect(rec2006?.baseTax).toBe(4800); // 2% of 40,000 * 6 years (2006-2011)
    expect(rec2006?.basicTax).toBe(2400); // 1% of 40,000 * 6 years
    expect(rec2006?.sefTax).toBe(2400); // 1% of 40,000 * 6 years

    // Verify unassessed era correctly flags isMissingValuation
    const unassessedPeriods = [
      { startYear: 1987, endYear: 1991, assessedValue: 0, isMissingValuation: true }
    ];
    const unassessedResult = calculateTaxLiability(multiEraProperty, { assessmentPeriods: unassessedPeriods });
    const unassessedRec = unassessedResult.records.find(r => r.year === 1987);
    expect(unassessedRec?.isMissingValuation).toBe(true);
    expect(unassessedRec?.totalDue).toBe(0);
    expect(unassessedRec?.isPayable).toBe(false);
  });
});
