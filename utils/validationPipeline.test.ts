/**
 * LGU Treasury Connect — Validation Pipeline Test Suite
 *
 * Tests every validator in utils/validationPipeline.ts against the full
 * statutory constraint set and edge cases documented in the implementation plan.
 *
 * Test ID format: TC-VAL-XX (field validators) / TC-FORM-XX (aggregate)
 *                 TC-PAY-XX (payment eligibility) / TC-VOID-XX / TC-USR-XX
 */

import { describe, it, expect } from 'vitest';
import {
  validateTdNumber,
  validateOwnerName,
  validateAssessedValue,
  validateLotArea,
  validateLastPaidYear,
  validatePropertyForm,
  validatePaymentEligibility,
  validateVoidWorkflow,
  validatePassword,
  validateUserDeletion,
  MIN_STATUTORY_YEAR,
  MAX_STATUTORY_YEAR,
  SANTA_ROSA_BARANGAY_CODES,
} from './validationPipeline';

// ─────────────────────────────────────────────────────────────────────────────
// TC-VAL-01: validateTdNumber
// ─────────────────────────────────────────────────────────────────────────────
describe('validateTdNumber', () => {
  it('TC-VAL-01a: rejects empty string', () => {
    const r = validateTdNumber('');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('TC-VAL-01b: rejects undefined', () => {
    const r = validateTdNumber(undefined);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('TC-VAL-01c: rejects free-text (no pattern match)', () => {
    const r = validateTdNumber('invalid-td');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/format/i);
  });

  it('TC-VAL-01d: rejects TD with non-Santa-Rosa barangay code', () => {
    const r = validateTdNumber('17-99999-00001');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/23001.{1,10}23033/);
  });

  it('TC-VAL-01e: rejects barangay code mismatch with selected barangay', () => {
    // Rizal (Poblacion) = 23001; TD number says 23002 (Aguinaldo)
    const r = validateTdNumber('17-23002-00001', 'Rizal (Poblacion)');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/23001/);
    expect(r.error).toMatch(/Rizal/i);
  });

  it('TC-VAL-01f: accepts valid TD number without barangay cross-check', () => {
    const r = validateTdNumber('17-23001-00123');
    expect(r.isValid).toBe(true);
    expect(r.error).toBeUndefined();
  });

  it('TC-VAL-01g: accepts valid TD number with matching barangay', () => {
    const r = validateTdNumber('17-23001-00123', 'Rizal (Poblacion)');
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-01h: accepts TD- prefix format', () => {
    const r = validateTdNumber('TD-23010-9999', 'La Fuente');
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-01i: all 33 Santa Rosa barangay codes are valid when embedded', () => {
    Object.entries(SANTA_ROSA_BARANGAY_CODES).forEach(([brgy, code]) => {
      const td = `17-${code}-00001`;
      const r = validateTdNumber(td, brgy);
      expect(r.isValid).toBe(true);
    });
  });

  it('TC-VAL-01j: rejects TD with whitespace-only', () => {
    const r = validateTdNumber('   ');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/required/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-VAL-02: validateOwnerName
// ─────────────────────────────────────────────────────────────────────────────
describe('validateOwnerName', () => {
  it('TC-VAL-02a: rejects empty string', () => {
    const r = validateOwnerName('');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('TC-VAL-02b: rejects whitespace-only string', () => {
    const r = validateOwnerName('   ');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('TC-VAL-02c: rejects single character', () => {
    const r = validateOwnerName('A');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/2 characters/i);
  });

  it('TC-VAL-02d: rejects undefined', () => {
    const r = validateOwnerName(undefined);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('TC-VAL-02e: accepts standard Filipino name', () => {
    const r = validateOwnerName('Juan Dela Cruz');
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-02f: accepts name with hyphen and period', () => {
    const r = validateOwnerName('Maria O. Santos-Reyes');
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-02g: accepts name with ampersand (business names)', () => {
    const r = validateOwnerName('Santos & Cruz Enterprises');
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-02h: rejects names with unsafe special characters', () => {
    const r = validateOwnerName('Juan <script>');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/invalid characters/i);
  });

  it('TC-VAL-02i: accepts minimum 2-character name', () => {
    const r = validateOwnerName('Jo');
    expect(r.isValid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-VAL-03: validateAssessedValue
// ─────────────────────────────────────────────────────────────────────────────
describe('validateAssessedValue', () => {
  it('TC-VAL-03a: rejects negative number', () => {
    const r = validateAssessedValue(-5000);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/negative/i);
  });

  it('TC-VAL-03b: rejects NaN', () => {
    const r = validateAssessedValue(NaN);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/valid number/i);
  });

  it('TC-VAL-03c: rejects non-numeric string', () => {
    const r = validateAssessedValue('abc');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/valid number/i);
  });

  it('TC-VAL-03d: rejects Infinity', () => {
    const r = validateAssessedValue(Infinity);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/valid number/i);
  });

  it('TC-VAL-03e: accepts 0 but returns shell record advisory', () => {
    const r = validateAssessedValue(0);
    expect(r.isValid).toBe(true);
    expect(r.advisory).toMatch(/Shell Record/i);
  });

  it('TC-VAL-03f: accepts positive assessed value', () => {
    const r = validateAssessedValue(150000);
    expect(r.isValid).toBe(true);
    expect(r.error).toBeUndefined();
    expect(r.advisory).toBeUndefined();
  });

  it('TC-VAL-03g: accepts assessed value as numeric string', () => {
    const r = validateAssessedValue('75000.50');
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-03h: rejects undefined', () => {
    const r = validateAssessedValue(undefined);
    expect(r.isValid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-VAL-04: validateLastPaidYear
// ─────────────────────────────────────────────────────────────────────────────
describe('validateLastPaidYear', () => {
  it('TC-VAL-04a: rejects year below statutory minimum', () => {
    const r = validateLastPaidYear(MIN_STATUTORY_YEAR - 1);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/1900/);
  });

  it('TC-VAL-04b: rejects 1850', () => {
    const r = validateLastPaidYear(1850);
    expect(r.isValid).toBe(false);
  });

  it('TC-VAL-04c: rejects year above statutory ceiling', () => {
    const r = validateLastPaidYear(MAX_STATUTORY_YEAR + 1);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/2026/);
  });

  it('TC-VAL-04d: rejects 2035', () => {
    const r = validateLastPaidYear(2035);
    expect(r.isValid).toBe(false);
  });

  it('TC-VAL-04e: accepts boundary MIN_STATUTORY_YEAR (1900)', () => {
    const r = validateLastPaidYear(MIN_STATUTORY_YEAR);
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-04f: accepts boundary MAX_STATUTORY_YEAR (2026)', () => {
    const r = validateLastPaidYear(MAX_STATUTORY_YEAR);
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-04g: accepts 2024', () => {
    const r = validateLastPaidYear(2024);
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-04h: rejects NaN', () => {
    const r = validateLastPaidYear(NaN);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/valid integer year/i);
  });

  it('TC-VAL-04i: accepts year as numeric string', () => {
    const r = validateLastPaidYear('2022');
    expect(r.isValid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-VAL-05: validateLotArea
// ─────────────────────────────────────────────────────────────────────────────
describe('validateLotArea', () => {
  it('TC-VAL-05a: rejects negative area', () => {
    const r = validateLotArea(-10);
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/negative/i);
  });

  it('TC-VAL-05b: accepts zero area', () => {
    const r = validateLotArea(0);
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-05c: accepts positive area', () => {
    const r = validateLotArea(250.5);
    expect(r.isValid).toBe(true);
  });

  it('TC-VAL-05d: rejects NaN', () => {
    const r = validateLotArea(NaN);
    expect(r.isValid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-FORM-01: validatePropertyForm (aggregate)
// ─────────────────────────────────────────────────────────────────────────────
describe('validatePropertyForm', () => {
  it('TC-FORM-01a: returns empty errors for fully valid form', () => {
    const errors = validatePropertyForm({
      tdNumber: '17-23001-00123',
      ownerName: 'Juan Dela Cruz',
      assessedValue: 150000,
      lotAreaSqm: 200,
      lastPaidYear: 2024,
      barangay: 'Rizal (Poblacion)',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('TC-FORM-01b: catches multiple simultaneous field errors', () => {
    const errors = validatePropertyForm({
      tdNumber: '',
      ownerName: '',
      assessedValue: -1,
      lotAreaSqm: -5,
      lastPaidYear: 1800,
    });
    expect(errors.tdNumber).toBeDefined();
    expect(errors.ownerName).toBeDefined();
    expect(errors.assessedValue).toBeDefined();
    expect(errors.lotAreaSqm).toBeDefined();
    expect(errors.lastPaidYear).toBeDefined();
  });

  it('TC-FORM-01c: does not add errors for valid optional fields', () => {
    const errors = validatePropertyForm({
      tdNumber: '17-23010-00001',
      ownerName: 'Maria Santos',
      assessedValue: 0, // valid (advisory only, not an error)
      lotAreaSqm: 0,
      lastPaidYear: 2025,
      barangay: 'La Fuente',
    });
    expect(errors.assessedValue).toBeUndefined();
    expect(errors.lotAreaSqm).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-PAY-01: validatePaymentEligibility
// ─────────────────────────────────────────────────────────────────────────────
describe('validatePaymentEligibility', () => {
  it('TC-PAY-01a: blocks payment on shell record', () => {
    const r = validatePaymentEligibility({
      isShellRecord: true,
      lastPaidYear: 2022,
      selectedRecords: [{ year: 2023 }],
    });
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/Shell Record/i);
  });

  it('TC-PAY-01b: blocks payment with no selected records', () => {
    const r = validatePaymentEligibility({
      isShellRecord: false,
      lastPaidYear: 2022,
      selectedRecords: [],
    });
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/No tax year/i);
  });

  it('TC-PAY-01c: blocks payment when oldest selected year skips delinquent years', () => {
    // lastPaidYear = 2022, so next expected year is 2023, but user selected 2024
    const r = validatePaymentEligibility({
      isShellRecord: false,
      lastPaidYear: 2022,
      selectedRecords: [{ year: 2024 }, { year: 2025 }],
    });
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/Arrears-First/i);
    expect(r.error).toMatch(/2023/);
  });

  it('TC-PAY-01d: accepts valid arrears-first sequential payment', () => {
    const r = validatePaymentEligibility({
      isShellRecord: false,
      lastPaidYear: 2022,
      selectedRecords: [{ year: 2023 }, { year: 2024 }],
    });
    expect(r.isValid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-VOID-01: validateVoidWorkflow
// ─────────────────────────────────────────────────────────────────────────────
describe('validateVoidWorkflow', () => {
  it('TC-VOID-01a: rejects empty void reason', () => {
    const errors = validateVoidWorkflow({ voidReason: '', adminPassword: 'password' });
    expect(errors.voidReason).toMatch(/COA/i);
  });

  it('TC-VOID-01b: rejects missing admin password', () => {
    const errors = validateVoidWorkflow({ voidReason: 'Duplicate receipt', adminPassword: '' });
    expect(errors.adminPassword).toMatch(/password/i);
  });

  it('TC-VOID-01c: rejects whitespace-only reason', () => {
    const errors = validateVoidWorkflow({ voidReason: '   ', adminPassword: 'pass' });
    expect(errors.voidReason).toBeDefined();
  });

  it('TC-VOID-01d: accepts valid void workflow inputs', () => {
    const errors = validateVoidWorkflow({
      voidReason: 'Duplicate receipt issued in error',
      adminPassword: 'admin123',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-USR-01: validatePassword
// ─────────────────────────────────────────────────────────────────────────────
describe('validatePassword', () => {
  it('TC-USR-01a: rejects empty password', () => {
    const r = validatePassword('');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/required/i);
  });

  it('TC-USR-01b: rejects password shorter than 6 chars', () => {
    const r = validatePassword('abc');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/6 characters/i);
  });

  it('TC-USR-01c: accepts password of exactly 6 chars', () => {
    const r = validatePassword('abc123');
    expect(r.isValid).toBe(true);
  });

  it('TC-USR-01d: accepts strong password', () => {
    const r = validatePassword('S3cur3P@ssw0rd!');
    expect(r.isValid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-USR-02: validateUserDeletion
// ─────────────────────────────────────────────────────────────────────────────
describe('validateUserDeletion', () => {
  it('TC-USR-02a: blocks deletion of root admin account', () => {
    const r = validateUserDeletion('admin', 'superuser');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/cannot be deleted/i);
  });

  it('TC-USR-02b: blocks self-deletion', () => {
    const r = validateUserDeletion('maria.assessor', 'maria.assessor');
    expect(r.isValid).toBe(false);
    expect(r.error).toMatch(/own active/i);
  });

  it('TC-USR-02c: allows deletion of another non-admin user', () => {
    const r = validateUserDeletion('pedro.clerk', 'admin');
    expect(r.isValid).toBe(true);
  });

  it('TC-USR-02d: allows admin to delete another admin', () => {
    const r = validateUserDeletion('maria.admin', 'john.admin');
    expect(r.isValid).toBe(true);
  });
});
