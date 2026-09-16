/**
 * LGU Treasury Connect — Validation Pipeline
 *
 * Pure, side-effect-free validation functions for all UI fields and statutory
 * business rules. No DOM, no React, no API calls — safe to import in both
 * component code and Vitest unit tests.
 *
 * Statutory references:
 *  - TD Number format: BLGF/Provincial Assessor conventions for Nueva Ecija
 *  - Last Paid Year ceiling: current tax year (2026 per system)
 *  - Assessed Value / shell record: RA 7160 Title II, Sec. 201
 *  - Arrears-First payment rule: RA 7160 Sec. 252 (chronological settlement)
 *  - Shell Record payment prohibition: SSOT.md §4.3
 */

// ─── Canonical Santa Rosa Barangay Code Registry ─────────────────────────────
export const SANTA_ROSA_BARANGAY_CODES: Record<string, string> = {
  'Rizal (Poblacion)': '23001',
  'Aguinaldo': '23002',
  'Berang': '23003',
  'Burgos': '23004',
  'Cojuangco (Poblacion)': '23005',
  'Del Pilar': '23006',
  'Gomez': '23007',
  'Inspector': '23008',
  'Isla': '23009',
  'La Fuente': '23010',
  'Liwayway': '23011',
  'Lourdes': '23012',
  'Luna': '23013',
  'Mabini': '23014',
  'Malacañang': '23015',
  'Maliolio': '23016',
  'Mapalad': '23017',
  'Rajal Centro': '23018',
  'Rajal Norte': '23019',
  'Rajal Sur': '23020',
  'San Gregorio': '23021',
  'San Isidro': '23022',
  'San Joseph': '23023',
  'San Mariano': '23024',
  'San Pedro': '23025',
  'Santa Teresita': '23026',
  'Santo Rosario': '23027',
  'Sapsap': '23028',
  'Soledad': '23029',
  'Tagpos': '23030',
  'Tramo': '23031',
  'Valenzuela (Poblacion)': '23032',
  'Zamora (Poblacion)': '23033',
};

/** All valid 5-digit barangay codes for Santa Rosa, Nueva Ecija */
const VALID_BRGY_CODES = new Set(Object.values(SANTA_ROSA_BARANGAY_CODES));

/** Earliest plausible year a property could have been registered under the LGC */
export const MIN_STATUTORY_YEAR = 1900;

/** Current statutory tax year ceiling — update each calendar year */
export const MAX_STATUTORY_YEAR = 2026;

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  /** Advisory text shown even when the field is technically valid */
  advisory?: string;
}

export type FormErrors = Record<string, string>;

// ─── Individual Field Validators ──────────────────────────────────────────────

/**
 * Validates Tax Declaration Number.
 *
 * Accepted formats:
 *  - `17-23001-00123`  (standard Philippine TD format: province-brgy-sequence)
 *  - `TD-23001-00123`  (alternative TD prefix)
 *
 * When `selectedBarangay` is provided, the 5-digit barangay code embedded in
 * the TD number is cross-validated against the selected barangay.
 */
export function validateTdNumber(
  tdNumber: string | undefined,
  selectedBarangay?: string
): ValidationResult {
  const raw = (tdNumber ?? '').trim();

  if (!raw) {
    return { isValid: false, error: 'Tax Declaration Number is required.' };
  }

  // Accept: 17-NNNNN-NNNNN or TD-NNNNN-NNNNN (N = digit, 4-5 digits allowed for sequence)
  const pattern = /^(17|TD)-(\d{5})-(\d{4,5})$/i;
  const match = raw.match(pattern);

  if (!match) {
    return {
      isValid: false,
      error: 'TD Number must match format 17-XXXXX-XXXXX (e.g. 17-23001-00001).',
    };
  }

  const embeddedCode = match[2];

  // Cross-validate embedded code is a valid Santa Rosa barangay code
  if (!VALID_BRGY_CODES.has(embeddedCode)) {
    return {
      isValid: false,
      error: `Barangay code "${embeddedCode}" in TD Number is not a valid Santa Rosa code (23001-23033).`,
    };
  }

  // Cross-validate against the selected barangay in the form
  if (selectedBarangay) {
    const expectedCode = SANTA_ROSA_BARANGAY_CODES[selectedBarangay];
    if (expectedCode && embeddedCode !== expectedCode) {
      return {
        isValid: false,
        error: `TD Number barangay code (${embeddedCode}) does not match selected barangay "${selectedBarangay}" (expected ${expectedCode}).`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates the declared property owner name.
 * Minimum 2 characters after trimming. Allows letters, spaces, hyphens,
 * periods, apostrophes, and standard Filipino name punctuation.
 */
export function validateOwnerName(name: string | undefined): ValidationResult {
  const trimmed = (name ?? '').trim();

  if (!trimmed) {
    return { isValid: false, error: 'Declared owner name is required.' };
  }

  if (trimmed.length < 2) {
    return { isValid: false, error: 'Owner name must be at least 2 characters.' };
  }

  // Allow letters (including Filipino/accented), spaces, hyphens, periods, apostrophes, commas, ampersands
  const namePattern = /^[a-zA-Z\u00C0-\u024F0-9\s\-.,''&()]+$/;
  if (!namePattern.test(trimmed)) {
    return {
      isValid: false,
      error: 'Owner name contains invalid characters.',
    };
  }

  return { isValid: true };
}

/**
 * Validates Taxable Assessed Value.
 * Must be a finite, non-negative number.
 * A value of 0 is technically valid but triggers an advisory (shell record).
 */
export function validateAssessedValue(value: number | string | undefined): ValidationResult {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? NaN);

  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, error: 'Assessed value must be a valid number.' };
  }

  if (num < 0) {
    return { isValid: false, error: 'Assessed value cannot be negative.' };
  }

  if (num === 0) {
    return {
      isValid: true,
      advisory:
        'Assessed value is 0. This property will be flagged as a Shell Record and cannot receive payments until verified by the Municipal Assessor.',
    };
  }

  return { isValid: true };
}

/**
 * Validates lot area in square metres.
 * Must be a non-negative finite number. Zero is allowed (unmetered land).
 */
export function validateLotArea(area: number | string | undefined): ValidationResult {
  const num = typeof area === 'string' ? parseFloat(area) : (area ?? NaN);

  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, error: 'Lot area must be a valid number.' };
  }

  if (num < 0) {
    return { isValid: false, error: 'Lot area cannot be negative.' };
  }

  return { isValid: true };
}

/**
 * Validates the Last Paid Year against the statutory range.
 * Under RA 7160, delinquency accrues from the year after the last paid year,
 * so values outside the plausible range indicate data entry errors.
 */
export function validateLastPaidYear(year: number | string | undefined): ValidationResult {
  const num = typeof year === 'string' ? parseInt(year, 10) : (year ?? NaN);

  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, error: 'Last paid year must be a valid integer year.' };
  }

  if (!Number.isInteger(num)) {
    return { isValid: false, error: 'Last paid year must be a whole number.' };
  }

  if (num < MIN_STATUTORY_YEAR) {
    return {
      isValid: false,
      error: `Last paid year must be ${MIN_STATUTORY_YEAR} or later (statutory minimum).`,
    };
  }

  if (num > MAX_STATUTORY_YEAR) {
    return {
      isValid: false,
      error: `Last paid year cannot exceed the current statutory ceiling (${MAX_STATUTORY_YEAR}).`,
    };
  }

  return { isValid: true };
}

// ─── Aggregate Form Validator ─────────────────────────────────────────────────

export interface PropertyFormInput {
  tdNumber?: string;
  ownerName?: string;
  assessedValue?: number | string;
  lotAreaSqm?: number | string;
  lastPaidYear?: number | string;
  barangay?: string;
}

/**
 * Validates all required fields on the Property Encoding form (RptarModal).
 * Returns an error dictionary keyed by field name.
 * An empty dictionary means the form is valid.
 */
export function validatePropertyForm(data: PropertyFormInput): FormErrors {
  const errors: FormErrors = {};

  const tdResult = validateTdNumber(data.tdNumber, data.barangay);
  if (!tdResult.isValid && tdResult.error) {
    errors.tdNumber = tdResult.error;
  }

  const ownerResult = validateOwnerName(data.ownerName);
  if (!ownerResult.isValid && ownerResult.error) {
    errors.ownerName = ownerResult.error;
  }

  const assessedResult = validateAssessedValue(data.assessedValue);
  if (!assessedResult.isValid && assessedResult.error) {
    errors.assessedValue = assessedResult.error;
  }

  const lotResult = validateLotArea(data.lotAreaSqm);
  if (!lotResult.isValid && lotResult.error) {
    errors.lotAreaSqm = lotResult.error;
  }

  const yearResult = validateLastPaidYear(data.lastPaidYear);
  if (!yearResult.isValid && yearResult.error) {
    errors.lastPaidYear = yearResult.error;
  }

  return errors;
}

// ─── Statutory Payment Eligibility Validator ──────────────────────────────────

export interface PaymentEligibilityInput {
  isShellRecord: boolean;
  lastPaidYear: number;
  selectedRecords: { year: number }[];
}

/**
 * Validates whether a payment can be posted against a property.
 *
 * Rules enforced:
 *  1. Shell Record Prohibition (SSOT §4.3): unverified parcels cannot receive payments.
 *  2. Arrears-First Rule (RA 7160 Sec. 252): payment must start from oldest unpaid year.
 *  3. No empty selection: at least one tax year record must be selected.
 */
export function validatePaymentEligibility(input: PaymentEligibilityInput): ValidationResult {
  if (input.isShellRecord) {
    return {
      isValid: false,
      error:
        'This property is flagged as an Unverified Shell Record. Payment cannot be posted until the Municipal Assessor completes verification and removes the shell flag (SSOT §4.3).',
    };
  }

  if (input.selectedRecords.length === 0) {
    return {
      isValid: false,
      error: 'No tax year records are selected for payment.',
    };
  }

  // Verify the oldest selected year is lastPaidYear + 1 (Arrears-First Rule)
  const sortedYears = [...input.selectedRecords].sort((a, b) => a.year - b.year);
  const oldestSelectedYear = sortedYears[0].year;
  const expectedOldestYear = input.lastPaidYear + 1;

  if (oldestSelectedYear !== expectedOldestYear) {
    return {
      isValid: false,
      error: `Arrears-First Rule (RA 7160 §252): Payment must begin from the oldest unpaid year (${expectedOldestYear}). Cannot skip delinquent years.`,
    };
  }

  return { isValid: true };
}

// ─── Void Workflow Validator ──────────────────────────────────────────────────

export interface VoidWorkflowInput {
  voidReason: string;
  adminPassword: string;
}

/**
 * Validates the OR void workflow inputs before submitting to the API.
 * COA regulations require a stated reason for every cancellation.
 */
export function validateVoidWorkflow(input: VoidWorkflowInput): FormErrors {
  const errors: FormErrors = {};

  if (!input.voidReason.trim()) {
    errors.voidReason = 'A valid cancellation reason is required under COA regulations.';
  }

  if (!input.adminPassword.trim()) {
    errors.adminPassword = 'Supervisor password confirmation is required.';
  }

  return errors;
}

// ─── User Administration Validators ──────────────────────────────────────────

/**
 * Validates password strength for new staff account registration
 * or password reset workflows.
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.length === 0) {
    return { isValid: false, error: 'Password is required.' };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: 'Password must be at least 6 characters long.',
    };
  }

  return { isValid: true };
}

/**
 * Policy guard for the System Administrator account.
 * Returns a policy violation message if deletion is attempted on
 * the root admin or the currently logged-in user.
 */
export function validateUserDeletion(
  targetUsername: string,
  currentUsername: string
): ValidationResult {
  if (targetUsername === 'admin') {
    return {
      isValid: false,
      error:
        'The primary System Administrator account cannot be deleted. This is a system governance protection rule under the treasury security policy.',
    };
  }

  if (targetUsername === currentUsername) {
    return {
      isValid: false,
      error: 'You cannot delete your own active administrator account while logged in.',
    };
  }

  return { isValid: true };
}
