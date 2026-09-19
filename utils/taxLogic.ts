import { Property, TaxYearRecord, CalculationResult, MunicipalTaxSettings, TaxSummary, PropertyAssessmentPeriod } from '../types';
import { 
  CURRENT_YEAR, 
  PENALTY_RATE_PER_MONTH, 
  MAX_PENALTY_MONTHS,
  HISTORICAL_BASELINE_YEAR,
  CANONICAL_MUNICIPAL_BRACKETS,
  PeriodBracketDefinition
} from '../constants';

export type { PeriodBracketDefinition };
export { CANONICAL_MUNICIPAL_BRACKETS };

/**
 * Returns the effective statutory origin year of a parcel.
 * If parcelOriginYear is known (e.g. 2015 subdivision), returns that year.
 * If unknown (null/undefined), defaults conservatively to HISTORICAL_BASELINE_YEAR (1971).
 */
export const getEffectiveOriginYear = (property: Property): number => {
  return property.parcelOriginYear ?? HISTORICAL_BASELINE_YEAR;
};

/**
 * Santa Rosa Municipal Treasurer Notice of Delinquency Penalty Rates
 * Historical rolls (<= 1993) are capped at 24% (0.24) under municipal operational schedule.
 * General revision rolls from 1994 onwards reach the 72% statutory cap.
 */
export const SANTA_ROSA_LEGACY_PENALTY_RATE = 0.24;

export const SANTA_ROSA_MUNICIPAL_PENALTY_SCHEDULE: Record<string, number> = {
  '1971-72': 0.24,
  '1973-79': 0.24,
  '1980-85': 0.24,
  '1986': 0.24,
  '1987-1991': 0.24,
  '1992-1993': 0.24,
  '1994-2005': 0.72,
  '2006-11': 0.72,
  '2012': 0.72,
  '2013': 0.72,
  '2014': 0.72,
  '2015': 0.72,
  '2016': 0.72,
  '2017': 0.72,
  '2018': 0.72,
  '2019': 0.72,
  '2020': 0.72,
  '2021': 0.72,
  '2022': 0.72,
  '2023': 0.72,
  '2024': 0.66,
  '2025': 0.42,
  '2026 1-2Q': 0.18,
  '2026 3-4 Q': 0.00,
  '2027': 0.00, // advance discount 0.20
};

export interface PeriodValuationItem {
  assessedValue: number;
  marketValue?: number;
  rptarReference?: string;
  isMissing?: boolean;
}

export interface TaxCalculationOptions {
  paymentDate?: Date;
  settings?: Partial<MunicipalTaxSettings>;
  groupHistoricalBrackets?: boolean; // Default true: aggregates years < 2012 into canonical brackets
  splitCurrentYearQuarters?: boolean; // If true, splits current year into 1-2Q and 3-4 Q
  includeAdvanceYear?: boolean;        // If true, appends advance year (2027)
  discountCurrentQuarters?: boolean;  // If true, enables prompt discount on 3-4 Q (defaults to false for Notice of Delinquency)
  completedPeriodLabels?: string[];   // Filter out already settled partial quarters/periods
  penaltyScheduleOverride?: Record<string, number>; // Dynamic municipal penalty schedule override
  basicTaxScheduleOverride?: Record<string, number>;
  sefTaxScheduleOverride?: Record<string, number>;
  computationSchedule?: import('../types').ComputationScheduleApplication;
  periodValuations?: Record<string, PeriodValuationItem | number>; // Period-specific historical valuations
  assessmentPeriods?: Array<Partial<PropertyAssessmentPeriod> & { startYear: number; endYear: number; assessedValue: number }>;                  // Structured assessment periods
  overrides?: Record<number | string, {
    basicTax?: number;
    sefTax?: number;
    discountRate?: number;
    reason?: string;
  }>;
}

/**
 * Pure RA 7160 Tax Engine with Municipal Payment-Date Discount Policies & Canonical Brackets
 * Implements Santa Rosa LGU Treasury Rules:
 * - Historical assessment era aggregation brackets (< 2012)
 * - Annual individual rolls (2012 to 2025)
 * - Jan 1 - Mar 31: 20% early payment discount (default)
 * - Apr 1 - Dec 31: 10% regular prompt discount (payment-date-based policy)
 * - Delinquent prior years: strictly 0% discount, 2% monthly penalty capped at 72%
 * - Authorized Assessor manual overrides for Basic Tax, SEF Tax, and Discount Rate
 */
export const calculateTaxLiability = (
  property: Property,
  options?: TaxCalculationOptions
): CalculationResult => {
  const records: TaxYearRecord[] = [];
  let grandTotal = 0;
  let totalBasicTax = 0;
  let totalSefTax = 0;
  let totalBaseTax = 0;
  let totalPenalty = 0;
  let totalDiscount = 0;

  const paymentDate = options?.paymentDate || new Date();
  const paymentMonth = paymentDate.getMonth() + 1; // 1 (Jan) to 12 (Dec)

  // Configurable Municipal Tax Policy settings (defaults to Santa Rosa standards)
  const earlyDiscountRate = options?.settings?.earlyPaymentDiscountRate ?? 0.20;
  const earlyStartMonth = options?.settings?.earlyPaymentStartMonth ?? 1;
  const earlyEndMonth = options?.settings?.earlyPaymentEndMonth ?? 3;
  const regularPromptRate = options?.settings?.regularPromptDiscountRate ?? 0.10;
  const delinquentRate = options?.settings?.delinquentDiscountRate ?? 0.00;

  const groupHistorical = options?.groupHistoricalBrackets ?? true;
  const splitCurrentYear = options?.splitCurrentYearQuarters ?? false;
  const includeAdvance = options?.includeAdvanceYear ?? false;

  // If lastPaidYear === CURRENT_YEAR, lastPaidQuarter defines how many quarters of CURRENT_YEAR are settled.
  // If lastPaidYear === CURRENT_YEAR, lastPaidQuarter defines how many quarters of CURRENT_YEAR are settled.
  // If lastPaidYear < CURRENT_YEAR, 0 quarters of CURRENT_YEAR are settled.
  const currentYearPaidQuarter = property.lastPaidYear === CURRENT_YEAR
    ? (property.lastPaidQuarter !== undefined && property.lastPaidQuarter !== null ? Number(property.lastPaidQuarter) : 4)
    : 0;

  const isCurrentYearPartial = property.lastPaidYear === CURRENT_YEAR && currentYearPaidQuarter < 4;
  const activeStartYear = property.delinquencyStartYear !== undefined && !isNaN(property.delinquencyStartYear)
    ? property.delinquencyStartYear
    : (isCurrentYearPartial ? CURRENT_YEAR : property.lastPaidYear + 1);
  const endYear = CURRENT_YEAR;

  const originYear = getEffectiveOriginYear(property);
  const hasHistoricalGap = (property.delinquencyStartYear !== undefined && property.delinquencyStartYear > originYear) ||
    (Boolean(property.hasUnverifiedPriorHistory) && activeStartYear > originYear);

  if (activeStartYear > endYear && !includeAdvance && !hasHistoricalGap) {
    return {
      propertyId: property.id,
      currentTd: property.tdNumber,
      ownerName: property.ownerName,
      assessedValue: property.assessedValue,
      records: [],
      summary: {
        totalBasicTax: 0,
        totalSefTax: 0,
        totalBaseTax: 0,
        totalPenalty: 0,
        totalDiscount: 0,
        grandTotal: 0,
      },
      grandTotal: 0,
    };
  }

  // Helper to resolve period-specific assessed value, RPTAR citation, and missing status
  const resolvePeriodValuation = (params: {
    year: number;
    periodLabel?: string;
    startYear: number;
    endYear: number;
  }): {
    assessedValue: number;
    isMissingValuation: boolean;
    rptarReference?: string;
  } => {
    const { year, periodLabel, startYear: sYear, endYear: eYear } = params;

    // 1. Direct match by periodLabel or year in options.periodValuations
    if (options?.periodValuations) {
      const entry = (periodLabel && options.periodValuations[periodLabel] !== undefined)
        ? options.periodValuations[periodLabel]
        : options.periodValuations[year] !== undefined
          ? options.periodValuations[year]
          : options.periodValuations[String(year)];

      if (entry !== undefined) {
        if (typeof entry === 'number') {
          return {
            assessedValue: entry,
            isMissingValuation: entry <= 0,
          };
        }
        return {
          assessedValue: entry.assessedValue ?? 0,
          isMissingValuation: Boolean(entry.isMissing || (entry.assessedValue !== undefined && entry.assessedValue <= 0)),
          rptarReference: entry.rptarReference,
        };
      }
    }

    // 2. Overlapping match in options.assessmentPeriods or property.assessmentPeriods
    const activeAssessmentPeriods = (options?.assessmentPeriods && options.assessmentPeriods.length > 0)
      ? options.assessmentPeriods
      : property.assessmentPeriods;

    if (activeAssessmentPeriods && activeAssessmentPeriods.length > 0) {
      const matched = activeAssessmentPeriods.find(p => 
        (p.startYear <= sYear && p.endYear >= eYear) ||
        (p.startYear <= year && p.endYear >= year) ||
        (sYear <= p.endYear && eYear >= p.startYear)
      );
      if (matched) {
        return {
          assessedValue: matched.assessedValue ?? 0,
          isMissingValuation: Boolean(matched.isMissing || (matched.assessedValue !== undefined && matched.assessedValue <= 0)),
          rptarReference: matched.remarks,
        };
      }
    }

    // 3. If caller explicitly passed a periodValuations dictionary, and this historical bracket (< 2012) is absent from it:
    if (options?.periodValuations && eYear < 2012) {
      return {
        assessedValue: 0,
        isMissingValuation: true,
      };
    }

    // 4. Default: Modern era (>= 2012) or standard baseline without periodValuations:
    // Falls back to property.assessedValue for 100% backward compatibility
    return {
      assessedValue: property.assessedValue,
      isMissingValuation: property.assessedValue <= 0,
    };
  };

  // Helper to generate a single TaxYearRecord for any period / bracket
  const createRecord = (params: {
    year: number;
    periodLabel?: string;
    startYear: number;
    endYear: number;
    yearsCovered: number[];
    isDelinquent: boolean;
    isCurrentYear: boolean;
    isAdvance?: boolean;
    quarterSpan?: string;
    quarter?: number;
    multiplier: number; // 1 for 1 year, N for multi-year bracket, 0.5 for semi-annual
    forcedAssessedValue?: number;
    forcedRptarRef?: string;
    isUnverifiedHistorical?: boolean;
  }) => {
    const { year, periodLabel, startYear: sYear, endYear: eYear, yearsCovered, isDelinquent, isAdvance, quarterSpan, quarter, multiplier } = params;

    if (periodLabel && options?.completedPeriodLabels?.includes(periodLabel)) {
      return;
    }

    let valuation: { assessedValue: number; isMissingValuation: boolean; rptarReference?: string };
    if (params.forcedAssessedValue !== undefined) {
      valuation = {
        assessedValue: params.forcedAssessedValue,
        isMissingValuation: params.forcedAssessedValue <= 0,
        rptarReference: params.forcedRptarRef,
      };
    } else {
      valuation = resolvePeriodValuation({ year, periodLabel, startYear: sYear, endYear: eYear });
    }

    const periodAssessedValue = valuation.assessedValue;
    const isMissingVal = valuation.isMissingValuation;
    const rptarRef = valuation.rptarReference;

    const basicRate = periodLabel && options?.basicTaxScheduleOverride?.[periodLabel] !== undefined
      ? options.basicTaxScheduleOverride[periodLabel] : 0.01;
    const sefRate = periodLabel && options?.sefTaxScheduleOverride?.[periodLabel] !== undefined
      ? options.sefTaxScheduleOverride[periodLabel] : 0.01;
    const annualBasicTax = isMissingVal ? 0 : Math.round(periodAssessedValue * basicRate * 100) / 100;
    const annualSefTax = isMissingVal ? 0 : Math.round(periodAssessedValue * sefRate * 100) / 100;

    const systemBasicTax = Math.round(annualBasicTax * multiplier * 100) / 100;
    const systemSefTax = Math.round(annualSefTax * multiplier * 100) / 100;
    const systemBaseTax = systemBasicTax + systemSefTax;

    // Penalty Calculation (RA 7160 Sec. 255)
    let monthsDelayed: number;
    let penaltyRate: number;
    let penaltyAmount: number;

    const activePenaltySchedule = options?.penaltyScheduleOverride || SANTA_ROSA_MUNICIPAL_PENALTY_SCHEDULE;

    if (isDelinquent && !isMissingVal) {
      if (periodLabel && activePenaltySchedule[periodLabel] !== undefined) {
        // Direct rate from active Santa Rosa Treasury Municipal Schedule
        penaltyRate = activePenaltySchedule[periodLabel];
        monthsDelayed = Math.round(penaltyRate / PENALTY_RATE_PER_MONTH);
      } else if (eYear <= 1993) {
        // Historical and legacy rolls (<= 1993) capped at 24% under Santa Rosa Treasury schedule
        penaltyRate = SANTA_ROSA_LEGACY_PENALTY_RATE;
        monthsDelayed = 12;
      } else if (quarterSpan === '1-2Q') {
        monthsDelayed = paymentMonth;
        penaltyRate = Math.min(monthsDelayed * PENALTY_RATE_PER_MONTH, 0.72);
      } else {
        monthsDelayed = ((CURRENT_YEAR - sYear) * 12) + paymentMonth;
        const effectiveMonths = Math.min(monthsDelayed, MAX_PENALTY_MONTHS);
        penaltyRate = effectiveMonths * PENALTY_RATE_PER_MONTH;
      }
      penaltyAmount = Math.round(systemBaseTax * penaltyRate * 100) / 100;
    } else {
      monthsDelayed = isAdvance ? 0 : paymentMonth;
      penaltyRate = (periodLabel && activePenaltySchedule[periodLabel] !== undefined)
        ? activePenaltySchedule[periodLabel]
        : (eYear <= 1993 ? SANTA_ROSA_LEGACY_PENALTY_RATE : (isDelinquent ? 0.72 : 0));
      penaltyAmount = 0;
    }

    // Discount Calculation
    let systemDiscountRate: number;
    if (isDelinquent || isMissingVal) {
      systemDiscountRate = delinquentRate; // 0%
    } else if (isAdvance) {
      systemDiscountRate = earlyDiscountRate; // 20% advance discount
    } else if (quarterSpan === '3-4 Q') {
      systemDiscountRate = options?.discountCurrentQuarters ? regularPromptRate : 0.00;
    } else {
      if (paymentMonth >= earlyStartMonth && paymentMonth <= earlyEndMonth) {
        systemDiscountRate = earlyDiscountRate; // 20% Jan 1 - Mar 31
      } else {
        systemDiscountRate = regularPromptRate; // 10% Apr 1 - Dec 31
      }
    }

    // Assessor Manual Overrides (matches by year or periodLabel)
    const override = options?.overrides?.[year] || (periodLabel ? options?.overrides?.[periodLabel] : undefined);
    const isManuallyEdited = Boolean(
      override && (
        override.basicTax !== undefined ||
        override.sefTax !== undefined ||
        override.discountRate !== undefined
      )
    );

    const appliedBasicTax = override?.basicTax !== undefined ? override.basicTax : systemBasicTax;
    const appliedSefTax = override?.sefTax !== undefined ? override.sefTax : systemSefTax;
    const appliedDiscountRate = override?.discountRate !== undefined ? override.discountRate : systemDiscountRate;
    const editReason = override?.reason;

    const appliedBaseTax = Math.round((appliedBasicTax + appliedSefTax) * 100) / 100;
    const discountAmount = Math.round(appliedBaseTax * appliedDiscountRate * 100) / 100;
    const isUnverified = Boolean(params.isUnverifiedHistorical);
    const totalDue = isUnverified ? null : Math.max(0, Math.round((appliedBaseTax + penaltyAmount - discountAmount) * 100) / 100);
    const isPayable = !isMissingVal && !isUnverified;

    const status: TaxYearRecord['status'] = isAdvance 
      ? 'Advance' 
      : isDelinquent 
        ? 'Delinquent' 
        : 'Current';

    records.push({
      year,
      periodLabel,
      startYear: sYear,
      endYear: eYear,
      yearsCovered,
      quarterSpan,
      quarter,
      status,
      assessedValue: isUnverified ? undefined : periodAssessedValue,
      isMissingValuation: isMissingVal,
      isUnverifiedHistorical: isUnverified,
      rptarReference: rptarRef,
      basicTax: isUnverified ? null : appliedBasicTax,
      sefTax: isUnverified ? null : appliedSefTax,
      baseTax: isUnverified ? null : appliedBaseTax,
      systemBasicTax: isUnverified ? undefined : systemBasicTax,
      systemSefTax: isUnverified ? undefined : systemSefTax,
      systemDiscountRate: isUnverified ? undefined : systemDiscountRate,
      isManuallyEdited,
      editReason,
      monthsDelayed: Math.min(monthsDelayed, MAX_PENALTY_MONTHS),
      penaltyRate,
      penaltyAmount: isUnverified ? null : penaltyAmount,
      discountRate: appliedDiscountRate,
      discountAmount,
      totalDue,
      isPayable,
      computationScheduleVersionId: options?.computationSchedule?.versionId,
      computationScheduleReference: options?.computationSchedule?.authorityReference,
      computationScheduleSourceHash: options?.computationSchedule?.sourceFileHash,
      computationScheduleFallback: options?.computationSchedule?.fallback,
    });

    if (!isUnverified && totalDue !== null) {
      totalBasicTax += appliedBasicTax;
      totalSefTax += appliedSefTax;
      totalBaseTax += appliedBaseTax;
      totalPenalty += penaltyAmount;
      totalDiscount += discountAmount;
      grandTotal += totalDue;
    }
  };

  // 0. Unconditional Preserved Historical Gap (whenever activeStartYear > originYear)
  if (hasHistoricalGap) {
    const gapEndYear = (property.delinquencyStartYear !== undefined ? property.delinquencyStartYear : activeStartYear) - 1;
    const gapBrackets = CANONICAL_MUNICIPAL_BRACKETS.filter(
      (b) => b.startYear <= gapEndYear && b.endYear >= originYear
    );

    for (const bracket of gapBrackets) {
      const effStart = Math.max(bracket.startYear, originYear);
      const effEnd = Math.min(bracket.endYear, gapEndYear);
      const count = effEnd - effStart + 1;
      const years = Array.from({ length: count }, (_, i) => effStart + i);
      const isFullBracket = effStart === bracket.startYear && effEnd === bracket.endYear;
      const label = isFullBracket ? bracket.label : count === 1 ? String(effStart) : `${effStart}-${String(effEnd).slice(-2)}`;

      if (options?.completedPeriodLabels?.includes(label) || options?.completedPeriodLabels?.includes(bracket.label)) {
        continue;
      }

      // Check if transcribed in property.historicalAssessedValues
      const transcribed = property.historicalAssessedValues?.[bracket.label] || property.historicalAssessedValues?.[label];

      if (transcribed && transcribed.value > 0) {
        // Transcribed from Physical RPTAR: VERIFIED!
        createRecord({
          year: effStart,
          periodLabel: label,
          startYear: effStart,
          endYear: effEnd,
          yearsCovered: years,
          isDelinquent: true,
          isCurrentYear: false,
          multiplier: count,
          forcedAssessedValue: transcribed.value,
          forcedRptarRef: transcribed.rptarPageReference || 'Physical RPTAR Transcription',
          isUnverifiedHistorical: false,
        });
      } else {
        // UNVERIFIED Historical Bracket: pending physical RPTAR audit
        const activePenaltySchedule = options?.penaltyScheduleOverride || SANTA_ROSA_MUNICIPAL_PENALTY_SCHEDULE;
        const penaltyRate = activePenaltySchedule[bracket.label] ?? 
          activePenaltySchedule[label] ?? 
          (effEnd <= 1993 ? SANTA_ROSA_LEGACY_PENALTY_RATE : 0.72);

        records.push({
          year: effStart,
          periodLabel: label,
          startYear: effStart,
          endYear: effEnd,
          yearsCovered: years,
          status: 'Delinquent',
          assessedValue: undefined,
          isMissingValuation: true,
          isUnverifiedHistorical: true,
          rptarReference: 'Pending Physical RPTAR Ledger Audit',
          basicTax: null,
          sefTax: null,
          baseTax: null,
          systemBasicTax: undefined,
          systemSefTax: undefined,
          systemDiscountRate: 0,
          monthsDelayed: Math.min(((CURRENT_YEAR - effStart) * 12) + paymentMonth, MAX_PENALTY_MONTHS),
          penaltyRate,
          penaltyAmount: null,
          discountRate: 0,
          discountAmount: 0,
          totalDue: null,
          isPayable: false,
        });
      }
    }
  }

  // 1. Process Historical Brackets (< 2012) for active delinquent years
  if (groupHistorical && activeStartYear < 2012) {
    const historicalBrackets = CANONICAL_MUNICIPAL_BRACKETS.filter(b => b.endYear < 2012);
    for (const bracket of historicalBrackets) {
      const effectiveStart = Math.max(bracket.startYear, activeStartYear);
      const effectiveEnd = Math.min(bracket.endYear, endYear);

      if (effectiveStart <= effectiveEnd) {
        const count = effectiveEnd - effectiveStart + 1;
        const years = Array.from({ length: count }, (_, i) => effectiveStart + i);
        const isFullBracket = effectiveStart === bracket.startYear && effectiveEnd === bracket.endYear;
        const label = isFullBracket 
          ? bracket.label 
          : count === 1 
            ? String(effectiveStart) 
            : `${effectiveStart}-${String(effectiveEnd).slice(-2)}`;

        createRecord({
          year: effectiveStart,
          periodLabel: label,
          startYear: effectiveStart,
          endYear: effectiveEnd,
          yearsCovered: years,
          isDelinquent: true,
          isCurrentYear: false,
          multiplier: count,
        });
      }
    }
  } else if (!groupHistorical && activeStartYear < 2012) {
    const maxHistorical = Math.min(2011, endYear);
    for (let y = activeStartYear; y <= maxHistorical; y++) {
      createRecord({
        year: y,
        periodLabel: String(y),
        startYear: y,
        endYear: y,
        yearsCovered: [y],
        isDelinquent: true,
        isCurrentYear: false,
        multiplier: 1,
      });
    }
  }

  // 2. Process Modern Era (2012 to 2025)
  const modernStart = Math.max(2012, activeStartYear);
  const modernEnd = Math.min(2025, endYear);
  for (let y = modernStart; y <= modernEnd; y++) {
    createRecord({
      year: y,
      periodLabel: String(y),
      startYear: y,
      endYear: y,
      yearsCovered: [y],
      isDelinquent: true,
      isCurrentYear: false,
      multiplier: 1,
    });
  }

  // 3. Process Current Operational Year (2026)
  if (activeStartYear <= CURRENT_YEAR && endYear >= CURRENT_YEAR) {
    const isFirstHalfPaid = currentYearPaidQuarter >= 2;
    const isSecondHalfPaid = currentYearPaidQuarter >= 4;

    if (splitCurrentYear) {
      // 2026 1-2Q: Overdue / delinquent quarters (only if not already settled)
      if (!isFirstHalfPaid) {
        createRecord({
          year: CURRENT_YEAR,
          periodLabel: `${CURRENT_YEAR} 1-2Q`,
          startYear: CURRENT_YEAR,
          endYear: CURRENT_YEAR,
          yearsCovered: [CURRENT_YEAR],
          quarterSpan: '1-2Q',
          isDelinquent: paymentMonth > 6, // Delinquent if paying in Q3/Q4 (after June 30)
          isCurrentYear: true,
          multiplier: 0.5,
        });
      }

      // 2026 3-4 Q: Current / prompt settlement window (only if Q3/Q4 not already settled)
      if (!isSecondHalfPaid) {
        createRecord({
          year: CURRENT_YEAR,
          periodLabel: `${CURRENT_YEAR} 3-4 Q`,
          startYear: CURRENT_YEAR,
          endYear: CURRENT_YEAR,
          yearsCovered: [CURRENT_YEAR],
          quarterSpan: '3-4 Q',
          isDelinquent: false,
          isCurrentYear: true,
          multiplier: 0.5,
        });
      }
    } else {
      // Standard annual current year record
      const remainingQuarters = 4 - currentYearPaidQuarter;
      if (remainingQuarters > 0) {
        const mult = remainingQuarters / 4;
        createRecord({
          year: CURRENT_YEAR,
          periodLabel: mult === 1 ? String(CURRENT_YEAR) : `${CURRENT_YEAR} ${currentYearPaidQuarter + 1}-4Q`,
          startYear: CURRENT_YEAR,
          endYear: CURRENT_YEAR,
          yearsCovered: [CURRENT_YEAR],
          quarterSpan: mult === 0.5 ? '3-4 Q' : undefined,
          isDelinquent: false,
          isCurrentYear: true,
          multiplier: mult,
        });
      }
    }
  }

  // 4. Advance Year (2027) if requested
  if (includeAdvance) {
    const advYear = CURRENT_YEAR + 1;
    createRecord({
      year: advYear,
      periodLabel: String(advYear),
      startYear: advYear,
      endYear: advYear,
      yearsCovered: [advYear],
      isDelinquent: false,
      isCurrentYear: false,
      isAdvance: true,
      multiplier: 1,
    });
  }

  // Ensure chronological order
  records.sort((a, b) => a.year - b.year);

  const summary: TaxSummary = {
    totalBasicTax: Math.round(totalBasicTax * 100) / 100,
    totalSefTax: Math.round(totalSefTax * 100) / 100,
    totalBaseTax: Math.round(totalBaseTax * 100) / 100,
    totalPenalty: Math.round(totalPenalty * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  };

  return {
    propertyId: property.id,
    currentTd: property.tdNumber,
    ownerName: property.ownerName,
    assessedValue: property.assessedValue,
    records,
    summary,
    grandTotal: Math.round(grandTotal * 100) / 100,
    computationSchedule: options?.computationSchedule,
  };
};
