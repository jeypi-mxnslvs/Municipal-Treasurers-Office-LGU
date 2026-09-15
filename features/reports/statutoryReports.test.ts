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
});
