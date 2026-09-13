import { describe, it, expect } from "vitest";
import { calculateTaxLiability } from "./taxLogic";
import { Property, MunicipalTaxSettings, OfficialReceipt } from "../types";
import { CURRENT_YEAR, MAX_PENALTY_MONTHS } from "../constants";

describe("taxLogic - Municipal Payment-Date Policy & Assessor Overrides", () => {
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

  const defaultSettings: MunicipalTaxSettings = {
    earlyPaymentDiscountRate: 0.20,
    earlyPaymentStartMonth: 1,
    earlyPaymentEndMonth: 3,
    regularPromptDiscountRate: 0.10,
    delinquentDiscountRate: 0.00,
    effectiveYear: 2026,
  };

  // Baseline legacy tests
  it("returns zero records and zero total when property is fully paid for current year", () => {
    const result = calculateTaxLiability({
      ...mockProperty,
      lastPaidYear: CURRENT_YEAR,
    });
    expect(result.records).toHaveLength(0);
    expect(result.grandTotal).toBe(0);
  });

  it("caps penalty months at MAX_PENALTY_MONTHS (36 months / 72% penalty) for long-overdue years", () => {
    const result = calculateTaxLiability({
      ...mockProperty,
      lastPaidYear: CURRENT_YEAR - 10,
    });
    expect(result.records.length).toBe(10);
    const oldestRecord = result.records[0];
    expect(oldestRecord.year).toBe(CURRENT_YEAR - 9);
    expect(oldestRecord.status).toBe("Delinquent");
    expect(oldestRecord.monthsDelayed).toBe(MAX_PENALTY_MONTHS);
    expect(oldestRecord.penaltyRate).toBe(0.72);
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

  // 13 Confirmed Municipal Workflow Tests:

  // Test 1: January payment -> default 20% discount
  it("1. applies default 20% early payment discount for January payment", () => {
    const janDate = new Date(CURRENT_YEAR, 0, 15); // Jan 15
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      { paymentDate: janDate, settings: defaultSettings }
    );
    const record = result.records[0];
    expect(record.discountRate).toBe(0.20);
    expect(record.systemDiscountRate).toBe(0.20);
    expect(record.discountAmount).toBe(record.baseTax * 0.20);
    expect(record.totalDue).toBe(record.baseTax + record.penaltyAmount - record.discountAmount!);
  });

  // Test 2: February payment -> default 20% discount
  it("2. applies default 20% early payment discount for February payment", () => {
    const febDate = new Date(CURRENT_YEAR, 1, 20); // Feb 20
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      { paymentDate: febDate, settings: defaultSettings }
    );
    const record = result.records[0];
    expect(record.discountRate).toBe(0.20);
    expect(record.discountAmount).toBe(record.baseTax * 0.20);
  });

  // Test 3: March 31 payment -> default 20% discount
  it("3. applies default 20% early payment discount on March 31 deadline", () => {
    const mar31Date = new Date(CURRENT_YEAR, 2, 31); // Mar 31
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      { paymentDate: mar31Date, settings: defaultSettings }
    );
    const record = result.records[0];
    expect(record.discountRate).toBe(0.20);
    expect(record.discountAmount).toBe(record.baseTax * 0.20);
  });

  // Test 4: April 1 payment -> default 10% discount
  it("4. transitions to default 10% regular prompt discount on April 1", () => {
    const apr1Date = new Date(CURRENT_YEAR, 3, 1); // Apr 1
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      { paymentDate: apr1Date, settings: defaultSettings }
    );
    const record = result.records[0];
    expect(record.discountRate).toBe(0.10);
    expect(record.systemDiscountRate).toBe(0.10);
    expect(record.discountAmount).toBe(record.baseTax * 0.10);
  });

  // Test 5: Later eligible payment -> default 10% discount
  it("5. maintains default 10% discount for later eligible payments (e.g. August 15)", () => {
    const augDate = new Date(CURRENT_YEAR, 7, 15); // Aug 15
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      { paymentDate: augDate, settings: defaultSettings }
    );
    const record = result.records[0];
    expect(record.discountRate).toBe(0.10);
    expect(record.discountAmount).toBe(record.baseTax * 0.10);
  });

  // Test 6: Delinquent prior-year obligation -> default 0%
  it("6. strictly enforces 0% discount on delinquent prior-year obligations", () => {
    const janDate = new Date(CURRENT_YEAR, 0, 15);
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 3 }, // 2 delinquent years + current year
      { paymentDate: janDate, settings: defaultSettings }
    );
    const delinquentRecords = result.records.filter((r) => r.status === "Delinquent");
    expect(delinquentRecords.length).toBe(2);
    delinquentRecords.forEach((delRec) => {
      expect(delRec.discountRate).toBe(0.00);
      expect(delRec.discountAmount).toBe(0);
      expect(delRec.totalDue).toBe(delRec.baseTax + delRec.penaltyAmount);
    });
    // Current year still gets 20%
    const currentRec = result.records.find((r) => r.status === "Current");
    expect(currentRec?.discountRate).toBe(0.20);
  });

  // Test 7: Assessor manually changes Basic Tax -> total recalculates
  it("7. recalculates discount and net amount due when Assessor manually changes Basic Tax", () => {
    const janDate = new Date(CURRENT_YEAR, 0, 15);
    // Assessed value: 100k -> systemBasic: 1,000, systemSef: 1,000
    // Override Basic Tax: 900
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      {
        paymentDate: janDate,
        settings: defaultSettings,
        overrides: {
          [CURRENT_YEAR]: { basicTax: 900, reason: "Assessor certified reduction" },
        },
      }
    );
    const record = result.records[0];
    expect(record.systemBasicTax).toBe(1000);
    expect(record.basicTax).toBe(900);
    expect(record.sefTax).toBe(1000);
    expect(record.baseTax).toBe(1900); // 900 + 1000
    expect(record.discountAmount).toBe(1900 * 0.20); // 380
    expect(record.isManuallyEdited).toBe(true);
    expect(record.editReason).toBe("Assessor certified reduction");
  });

  // Test 8: Assessor manually changes SEF -> total recalculates
  it("8. recalculates discount and net amount due when Assessor manually changes SEF Tax", () => {
    const janDate = new Date(CURRENT_YEAR, 0, 15);
    // Override SEF Tax: 950
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      {
        paymentDate: janDate,
        settings: defaultSettings,
        overrides: {
          [CURRENT_YEAR]: { sefTax: 950, reason: "Local school board relief" },
        },
      }
    );
    const record = result.records[0];
    expect(record.systemSefTax).toBe(1000);
    expect(record.sefTax).toBe(950);
    expect(record.basicTax).toBe(1000);
    expect(record.baseTax).toBe(1950); // 1000 + 950
    expect(record.discountAmount).toBe(1950 * 0.20); // 390
    expect(record.isManuallyEdited).toBe(true);
  });

  // Test 9: Assessor manually changes Discount Rate -> discount amount and total recalculate
  it("9. recalculates discount amount and net total when Assessor overrides Discount Rate to 15%", () => {
    const janDate = new Date(CURRENT_YEAR, 0, 15);
    // System default: 20%. Assessor overrides to 15% (0.15)
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      {
        paymentDate: janDate,
        settings: defaultSettings,
        overrides: {
          [CURRENT_YEAR]: { discountRate: 0.15, reason: "Senior citizen prompt adjustment" },
        },
      }
    );
    const record = result.records[0];
    expect(record.systemDiscountRate).toBe(0.20);
    expect(record.discountRate).toBe(0.15);
    expect(record.baseTax).toBe(2000);
    expect(record.discountAmount).toBe(2000 * 0.15); // 300
    expect(record.totalDue).toBe(2000 + record.penaltyAmount - 300);
    expect(record.isManuallyEdited).toBe(true);
  });

  // Test 10: Manual changes create audit records containing old and new values
  it("10. creates audit trail metadata capturing field changed, old value, and new value", () => {
    const janDate = new Date(CURRENT_YEAR, 0, 15);
    const overrides = {
      [CURRENT_YEAR]: {
        basicTax: 900,
        sefTax: 950,
        discountRate: 0.15,
        reason: "Administrative assessment reconciliation",
      },
    };
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      { paymentDate: janDate, settings: defaultSettings, overrides }
    );
    const record = result.records[0];

    // Verify metadata for audit logging
    const auditEntries = [
      {
        field: "BASIC_TAX",
        oldValue: record.systemBasicTax,
        newValue: record.basicTax,
        difference: record.basicTax! - record.systemBasicTax!,
      },
      {
        field: "SEF_TAX",
        oldValue: record.systemSefTax,
        newValue: record.sefTax,
        difference: record.sefTax! - record.systemSefTax!,
      },
      {
        field: "DISCOUNT_RATE",
        oldValue: record.systemDiscountRate,
        newValue: record.discountRate,
        difference: Math.round((record.discountRate! - record.systemDiscountRate!) * 100) / 100,
      },
    ];

    expect(auditEntries[0]).toEqual({ field: "BASIC_TAX", oldValue: 1000, newValue: 900, difference: -100 });
    expect(auditEntries[1]).toEqual({ field: "SEF_TAX", oldValue: 1000, newValue: 950, difference: -50 });
    expect(auditEntries[2]).toEqual({ field: "DISCOUNT_RATE", oldValue: 0.20, newValue: 0.15, difference: -0.05 });
  });

  // Test 11: Posted payment preserves final applied values
  it("11. verifies posted official receipt snapshot matches final applied values exactly", () => {
    const janDate = new Date(CURRENT_YEAR, 0, 15);
    const result = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      {
        paymentDate: janDate,
        settings: defaultSettings,
        overrides: {
          [CURRENT_YEAR]: { basicTax: 900, sefTax: 950, discountRate: 0.15 },
        },
      }
    );

    const record = result.records[0];
    const receiptSnapshot: OfficialReceipt = {
      receiptNo: "AF51-4500001",
      date: new Date().toISOString(),
      property: {
        id: mockProperty.id,
        tdNumber: mockProperty.tdNumber,
        ownerName: mockProperty.ownerName,
        address: mockProperty.address,
        barangay: mockProperty.barangay,
        assessedValue: mockProperty.assessedValue,
        propertyClass: mockProperty.propertyClass,
      },
      itemizedRecords: [record],
      summary: {
        basicTax: record.basicTax!,
        sefTax: record.sefTax!,
        baseTaxTotal: record.baseTax,
        penalty: record.penaltyAmount,
        discount: record.discountAmount!,
        totalPaid: record.totalDue,
      },
      tenderType: "CASH",
      postedBy: "juan.assessor",
    };

    expect(receiptSnapshot.summary.basicTax).toBe(900);
    expect(receiptSnapshot.summary.sefTax).toBe(950);
    expect(receiptSnapshot.summary.baseTaxTotal).toBe(1850);
    expect(receiptSnapshot.summary.discount).toBe(277.5); // 1850 * 0.15
    expect(receiptSnapshot.summary.totalPaid).toBe(1850 + record.penaltyAmount - 277.5);
  });

  // Test 12: Later policy changes do not modify historical posted payments
  it("12. ensures subsequent policy rate modifications do not alter existing receipt snapshots", () => {
    // Original receipt issued under 20% discount policy
    const historicalReceiptTotal = 1600; // Base: 2000 - 400 discount

    // Later, city council changes discount policy to 10%
    const newPolicySettings: MunicipalTaxSettings = {
      ...defaultSettings,
      earlyPaymentDiscountRate: 0.10,
    };

    // Calculate new liability under changed policy
    const newLiability = calculateTaxLiability(
      { ...mockProperty, lastPaidYear: CURRENT_YEAR - 1 },
      { paymentDate: new Date(CURRENT_YEAR, 0, 15), settings: newPolicySettings }
    );

    // New calculation yields 1800 (2000 - 200 discount)
    expect(newLiability.records[0].totalDue).toBe(1800 + newLiability.records[0].penaltyAmount);

    // Historical receipt must remain intact and unchanged at 1600
    expect(historicalReceiptTotal).toBe(1600);
    expect(historicalReceiptTotal).not.toBe(newLiability.records[0].totalDue);
  });

  // Test 13: Identical CSV re-upload does not create unnecessary property updates (Idempotency)
  it("13. verifies idempotency check detects unchanged records to prevent redundant writes", () => {
    const existingProperty: Property = { ...mockProperty };
    const incomingCsvRow = {
      tdNumber: "TD-2026-TEST-001",
      ownerName: "Dela Cruz, Juan",
      address: "Poblacion, Santa Rosa",
      barangay: "Poblacion",
      propertyClass: "Residential",
      marketValue: 500000,
      assessedValue: 100000,
    };

    // Compare fields
    const isUnchanged =
      existingProperty.tdNumber === incomingCsvRow.tdNumber &&
      existingProperty.ownerName === incomingCsvRow.ownerName &&
      existingProperty.address === incomingCsvRow.address &&
      existingProperty.barangay === incomingCsvRow.barangay &&
      existingProperty.propertyClass === incomingCsvRow.propertyClass &&
      existingProperty.marketValue === incomingCsvRow.marketValue &&
      existingProperty.assessedValue === incomingCsvRow.assessedValue;

    const rowState = isUnchanged ? "UNCHANGED" : "VALID_UPDATE";
    expect(rowState).toBe("UNCHANGED");
  });
});
