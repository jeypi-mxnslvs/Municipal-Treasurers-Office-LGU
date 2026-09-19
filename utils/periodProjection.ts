import {
  Property,
  DelinquencyPeriodVerification,
  DelinquencyPeriodStatus,
  VerificationType,
  TaxYearRecord
} from '../types';
import { calculateTaxLiability, TaxCalculationOptions } from './taxLogic';
import { getPropertyCompleteness } from './propertyCompleteness';

export type EffectivePeriodState = DelinquencyPeriodStatus;

export interface ProjectedPeriod {
  /** Stable identifier for the period (e.g., '2024', '1973-1979', '2026-Q1Q2') */
  periodKey: string;
  taxYear: number;
  periodLabel: string;
  quarterSpan?: string;
  quarter?: number;
  yearsCovered?: number[];

  // Tax calculations
  assessedValue: number;
  basicTax: number;
  sefTax: number;
  baseTax: number;
  penaltyAmount: number;
  penaltyRate: number;
  discountAmount: number;
  totalDue: number; // 0 if verified settled externally or unverified gap

  // Lifecycle & Evidence Provenance
  status: EffectivePeriodState;
  verificationType?: VerificationType;
  sourceReference?: string;
  verifiedBy?: number | string;
  verifierName?: string;
  verifiedAt?: string;
  remarks?: string;

  // Impact flags
  isHistoricalGap: boolean;
  isShell: boolean;
  isPayable: boolean;
  clearanceImpact: 'CLEARED' | 'BLOCKS_CLEARANCE' | 'EXEMPT';
  noticeImpact: 'INCLUDE_AS_DELINQUENT' | 'EXCLUDE_SETTLED' | 'UNRESOLVED_DISPUTE' | 'UNRESOLVED_ARCHIVE_GAP';
}

export interface PropertyPeriodProjection {
  propertyId: string;
  tdNumber: string;
  ownerName: string;
  periods: ProjectedPeriod[];
  outstandingTotal: number;
  hasUnverifiedPeriods: boolean;
  hasDisputedPeriods: boolean;
  hasHistoricalGaps: boolean;
  hasIncompleteCoverage: boolean;
  hasInvalidEvidence: boolean;
  isShellRecord: boolean;
  isClearanceEligible: boolean;
  ineligibilityReasons: string[];
}

/**
 * Normalizes a period label/key into a deterministic lookup key.
 */
export function normalizePeriodKey(key: string | number): string {
  return String(key).trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/q\s*(\d+)/g, 'q$1')
    .replace(/(\d{4})-([1-4])-([1-4])q?/, '$1-q$2$3');
}

/**
 * Derives the canonical period key from a TaxYearRecord.
 */
export function derivePeriodKeyFromRecord(record: TaxYearRecord): string {
  if (record.periodKey) {
    return normalizePeriodKey(record.periodKey);
  }
  if (record.quarterSpan) {
    const digits = record.quarterSpan.replace(/[^0-9]/g, '');
    const qNormalized = digits ? `q${digits}` : record.quarterSpan.replace(/\s+/g, '').toLowerCase();
    return normalizePeriodKey(`${record.year}-${qNormalized}`);
  }
  if (record.periodLabel && record.periodLabel.includes('-')) {
    return normalizePeriodKey(record.periodLabel);
  }
  return normalizePeriodKey(record.year);
}

function hasQuarterGranularity(record: TaxYearRecord): boolean {
  return Boolean(record.quarterSpan || record.quarter || record.periodLabel?.match(/\bq/i));
}

function verificationEvidenceIsValid(v: DelinquencyPeriodVerification): boolean {
  const hasReference = Boolean(v.sourceReference?.trim());
  const hasRemarks = Boolean(v.remarks?.trim());
  if (v.status === 'VERIFIED_SETTLED_EXTERNALLY') return hasReference;
  if (v.status === 'DISPUTED') return hasReference || hasRemarks;
  if (v.status === 'VERIFIED_OUTSTANDING') return hasReference || hasRemarks;
  return true;
}

/**
 * Pure, deterministic period-state projection engine.
 *
 * Integrates statutory RA 7160 tax math, archival historical gap preservation,
 * and canonical delinquency verifications into an authoritative period timeline.
 */
export function projectPropertyPeriods(
  property: Property,
  verifications: DelinquencyPeriodVerification[] = [],
  options?: TaxCalculationOptions
): PropertyPeriodProjection {
  const propertyId = String(property.id);
  const isShell = getPropertyCompleteness(property).isShellRecord;
  const scheduleUnavailable = Boolean(options?.computationSchedule?.unavailable);

  // 1. Resolve append-only verification events. A row referenced by supersedesId
  // is historical and cannot remain the effective state for its period.
  const verificationsByKey = new Map<string, DelinquencyPeriodVerification>();

  const supersededIds = new Set(verifications
    .map(v => v.supersedesId === undefined ? undefined : String(v.supersedesId))
    .filter((id): id is string => Boolean(id)));
  const sortedVerifications = [...verifications].sort((a, b) => {
    const timeA = Date.parse(a.verifiedAt || '');
    const timeB = Date.parse(b.verifiedAt || '');
    const safeA = Number.isFinite(timeA) ? timeA : Number.MIN_SAFE_INTEGER;
    const safeB = Number.isFinite(timeB) ? timeB : Number.MIN_SAFE_INTEGER;
    return safeA - safeB || String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });

  for (const v of sortedVerifications) {
    if (v.propertyId !== undefined && String(v.propertyId) !== propertyId) {
      continue;
    }
    if (v.status === 'SUPERSEDED' || (v.id !== undefined && supersededIds.has(String(v.id)))) continue;
    const key = normalizePeriodKey(v.periodKey || v.taxYear);
    verificationsByKey.set(key, v);
  }

  // 2. Obtain raw tax calculation records from statutory tax engine
  const calculationResult = calculateTaxLiability(property, options);

  // 3. Project each record into its authoritative state
  const projectedPeriods: ProjectedPeriod[] = [];
  let computedOutstandingTotal = 0;
  let hasUnverifiedPeriods = false;
  let hasDisputedPeriods = false;
  let hasHistoricalGaps = false;
  let hasInvalidEvidence = false;

  for (const rec of calculationResult.records) {
    const periodKey = derivePeriodKeyFromRecord(rec);
    const activeVerification = verificationsByKey.get(periodKey) ||
      (!hasQuarterGranularity(rec) ? verificationsByKey.get(normalizePeriodKey(rec.year)) : undefined);

    const isHistoricalGap = Boolean(rec.isUnverifiedHistorical);
    if (isHistoricalGap) {
      hasHistoricalGaps = true;
    }

    // Determine lifecycle state
    let status: EffectivePeriodState;
    let verificationType: VerificationType | undefined;
    let sourceReference: string | undefined;
    let verifiedBy: number | string | undefined;
    let verifierName: string | undefined;
    let verifiedAt: string | undefined;
    let remarks: string | undefined;

    if (activeVerification && activeVerification.status !== 'SUPERSEDED') {
      status = activeVerification.status;
      verificationType = activeVerification.verificationType;
      sourceReference = activeVerification.sourceReference;
      verifiedBy = activeVerification.verifiedBy;
      verifierName = activeVerification.verifierName;
      verifiedAt = activeVerification.verifiedAt;
      remarks = activeVerification.remarks;
      if (!verificationEvidenceIsValid(activeVerification)) hasInvalidEvidence = true;
    } else {
      // Missing or superseded verification falls back to statutory baseline
      if (isHistoricalGap) {
        status = 'UNVERIFIED';
      } else if (rec.totalDue !== null && rec.totalDue > 0) {
        status = 'UNVERIFIED';
      } else {
        status = 'UNVERIFIED';
      }
    }

    // Monetary allocation
    const basicTax = rec.basicTax ?? ((rec.baseTax || 0) / 2);
    const sefTax = rec.sefTax ?? ((rec.baseTax || 0) / 2);
    const baseTax = rec.baseTax ?? (basicTax + sefTax);
    const penaltyAmount = rec.penaltyAmount ?? 0;
    const penaltyRate = rec.penaltyRate ?? 0;
    const discountAmount = rec.discountAmount ?? 0;

    let totalDue: number;
    let clearanceImpact: 'CLEARED' | 'BLOCKS_CLEARANCE' | 'EXEMPT';
    let noticeImpact: ProjectedPeriod['noticeImpact'];
    let isPayable: boolean;

    switch (status) {
      case 'VERIFIED_SETTLED_EXTERNALLY':
        totalDue = 0;
        clearanceImpact = 'CLEARED';
        noticeImpact = 'EXCLUDE_SETTLED';
        isPayable = false;
        break;

      case 'NOT_APPLICABLE':
        totalDue = 0;
        clearanceImpact = 'EXEMPT';
        noticeImpact = 'EXCLUDE_SETTLED';
        isPayable = false;
        break;

      case 'DISPUTED':
        totalDue = rec.totalDue ?? 0;
        computedOutstandingTotal += totalDue;
        hasDisputedPeriods = true;
        clearanceImpact = 'BLOCKS_CLEARANCE';
        noticeImpact = 'UNRESOLVED_DISPUTE';
        isPayable = false;
        break;

      case 'VERIFIED_OUTSTANDING':
        totalDue = rec.totalDue ?? 0;
        computedOutstandingTotal += totalDue;
        clearanceImpact = 'BLOCKS_CLEARANCE';
        noticeImpact = 'INCLUDE_AS_DELINQUENT';
        isPayable = true;
        break;

      case 'UNVERIFIED':
      default:
        if (isHistoricalGap) {
          totalDue = 0; // Does not create false mathematical liability without RPTAR volume citation
          clearanceImpact = 'BLOCKS_CLEARANCE';
          noticeImpact = 'UNRESOLVED_ARCHIVE_GAP';
          isPayable = false;
          hasUnverifiedPeriods = true;
        } else {
          totalDue = rec.totalDue ?? 0;
          computedOutstandingTotal += totalDue;
          clearanceImpact = totalDue > 0 ? 'BLOCKS_CLEARANCE' : 'CLEARED';
          noticeImpact = totalDue > 0 ? 'INCLUDE_AS_DELINQUENT' : 'EXCLUDE_SETTLED';
          isPayable = totalDue > 0;
          if (totalDue > 0) {
            hasUnverifiedPeriods = true;
          }
        }
        break;
    }

    projectedPeriods.push({
      periodKey,
      taxYear: rec.year,
      periodLabel: rec.periodLabel || `Tax Year ${rec.year}`,
      quarterSpan: rec.quarterSpan,
      quarter: rec.quarter,
      yearsCovered: rec.yearsCovered,
      assessedValue: rec.assessedValue ?? property.assessedValue,
      basicTax,
      sefTax,
      baseTax,
      penaltyAmount,
      penaltyRate,
      discountAmount,
      totalDue: Math.round(totalDue * 100) / 100,
      status,
      verificationType,
      sourceReference,
      verifiedBy,
      verifierName,
      verifiedAt,
      remarks,
      isHistoricalGap,
      isShell,
      isPayable,
      clearanceImpact,
      noticeImpact
    });
  }

  // 4. Formulate Clearance Eligibility with explicit statutory reasons
  const ineligibilityReasons: string[] = [];
  const hasOutstandingPeriods = projectedPeriods.some(period =>
    period.status === 'VERIFIED_OUTSTANDING' ||
    (period.status === 'UNVERIFIED' && !period.isHistoricalGap && period.totalDue > 0) ||
    (period.status === 'DISPUTED' && period.totalDue > 0)
  );
  const hasIncompleteCoverage = projectedPeriods.length === 0 || projectedPeriods.some(period =>
    period.status === 'UNVERIFIED' || period.clearanceImpact === 'BLOCKS_CLEARANCE'
  );

  if (isShell) {
    ineligibilityReasons.push(
      'Property is classified as a shell record (lacking verified PIN or municipal valuation).'
    );
  }

  if (scheduleUnavailable) {
    ineligibilityReasons.push(
      'No active approved computation schedule was available; built-in baseline requires authorized review before clearance.'
    );
  }

  if (hasHistoricalGaps) {
    ineligibilityReasons.push(
      'Property has unverified historical gap periods (1971+) requiring transcription from physical RPTAR archive books.'
    );
  }

  if (hasDisputedPeriods) {
    ineligibilityReasons.push(
      'Property has active disputed tax liability periods that must be formally resolved by the Municipal Assessor.'
    );
  }

  if (computedOutstandingTotal > 0) {
    ineligibilityReasons.push(
      `Property has outstanding tax liabilities totaling ₱${computedOutstandingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
    );
  }

  if (hasUnverifiedPeriods) {
    ineligibilityReasons.push(
      'Property has unverified delinquency periods that must be verified before clearance.'
    );
  }

  if (hasInvalidEvidence) {
    ineligibilityReasons.push('One or more verification records lack required supporting evidence.');
  }

  if (hasOutstandingPeriods && computedOutstandingTotal === 0) {
    ineligibilityReasons.push('Property has unresolved outstanding periods with no computable balance.');
  }

  if (hasIncompleteCoverage && !hasHistoricalGaps && !hasUnverifiedPeriods) {
    ineligibilityReasons.push('Property does not have complete verified coverage through the calculated periods.');
  }

  const isClearanceEligible = ineligibilityReasons.length === 0;

  return {
    propertyId,
    tdNumber: property.tdNumber,
    ownerName: property.ownerName,
    periods: projectedPeriods,
    outstandingTotal: Math.round(computedOutstandingTotal * 100) / 100,
    hasUnverifiedPeriods,
    hasDisputedPeriods,
    hasHistoricalGaps,
    hasIncompleteCoverage,
    hasInvalidEvidence,
    isShellRecord: isShell,
    isClearanceEligible,
    ineligibilityReasons
  };
}
