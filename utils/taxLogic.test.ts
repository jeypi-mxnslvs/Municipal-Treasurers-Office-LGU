import { describe, it, expect } from "vitest";
import { calculateTaxLiability } from "./taxLogic";
import { Property } from "../types";
import { CURRENT_YEAR, BASE_TAX_RATE, MAX_PENALTY_MONTHS } from "../constants";

describe("taxLogic - calculateTaxLiability (RA 7160 Engine)", () => {
  const mockProperty: Property = {
    id: "1",
    tdNumber: "TD-2026-TEST-001",
    previousTdNumber: "",
    pin: "021-14-001-01-001",
    ownerName: "Dela Cruz, Juan",
    address: "Poblacion, Santa Rosa",
    barangay: "Poblacion",
    propertyClass: "Residential",
    lotAreaSqm: 250,
    marketValue: 500000,
    assessedValue: 100000,
    lastPaidYear: CURRENT_YEAR,
    isShellRecord: false,
  };

  it("returns zero records and zero total when property is fully paid for current year", () => {
    const result = calculateTaxLiability({
      ...mockProperty,
      lastPaidYear: CURRENT_YEAR,
    });

    expect(result.records).toHaveLength(0);
    expect(result.grandTotal).toBe(0);
  });

  it("calculates 1 year liability correctly with base tax equal to assessedValue * BASE_TAX_RATE", () => {
    const result = calculateTaxLiability({
      ...mockProperty,
      lastPaidYear: CURRENT_YEAR - 1,
    });

    expect(result.records).toHaveLength(1);
    const currentRecord = result.records[0];
    expect(currentRecord.year).toBe(CURRENT_YEAR);
    expect(currentRecord.status).toBe("Current");
    expect(currentRecord.baseTax).toBe(mockProperty.assessedValue * BASE_TAX_RATE);
    expect(currentRecord.totalDue).toBe(currentRecord.baseTax + currentRecord.penaltyAmount);
    expect(result.grandTotal).toBe(currentRecord.totalDue);
  });

  it("caps penalty months at MAX_PENALTY_MONTHS (36 months / 72% penalty) for long-overdue years", () => {
    // Delinquent for 10 years
    const result = calculateTaxLiability({
      ...mockProperty,
      lastPaidYear: CURRENT_YEAR - 10,
    });

    expect(result.records.length).toBe(10);

    // Check oldest record (10 years ago)
    const oldestRecord = result.records[0];
    expect(oldestRecord.year).toBe(CURRENT_YEAR - 9);
    expect(oldestRecord.status).toBe("Delinquent");
    expect(oldestRecord.monthsDelayed).toBe(MAX_PENALTY_MONTHS); // strictly capped at 36
    expect(oldestRecord.penaltyRate).toBe(0.72); // 36 * 0.02 = 72%
    expect(oldestRecord.penaltyAmount).toBe(oldestRecord.baseTax * 0.72);
  });

  it("orders records chronologically (Arrears First) so oldest years are cleared first", () => {
    const result = calculateTaxLiability({
      ...mockProperty,
      lastPaidYear: CURRENT_YEAR - 4,
    });

    const years = result.records.map((r) => r.year);
    const sortedYears = [...years].sort((a, b) => a - b);
    expect(years).toEqual(sortedYears);
    expect(years[0]).toBe(CURRENT_YEAR - 3);
    expect(years[years.length - 1]).toBe(CURRENT_YEAR);
  });

  it("handles properties with 0 assessed value correctly", () => {
    const result = calculateTaxLiability({
      ...mockProperty,
      assessedValue: 0,
      lastPaidYear: CURRENT_YEAR - 2,
    });

    expect(result.records.length).toBe(2);
    expect(result.grandTotal).toBe(0);
    result.records.forEach((rec) => {
      expect(rec.baseTax).toBe(0);
      expect(rec.penaltyAmount).toBe(0);
      expect(rec.totalDue).toBe(0);
    });
  });
});
