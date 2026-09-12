import { Property, TaxYearRecord, CalculationResult, MunicipalTaxSettings, TaxSummary } from '../types';
import { 
  CURRENT_YEAR, 
  PENALTY_RATE_PER_MONTH, 
  MAX_PENALTY_MONTHS 
} from '../constants';

export interface TaxCalculationOptions {
  paymentDate?: Date;
  settings?: Partial<MunicipalTaxSettings>;
  overrides?: Record<number, {
    basicTax?: number;
    sefTax?: number;
    discountRate?: number;
    reason?: string;
  }>;
}

/**
 * Pure RA 7160 Tax Engine with Municipal Payment-Date Discount Policies
 * Implements Santa Rosa LGU Treasury Rules:
 * - Jan 1 - Mar 31: 20% early payment discount (default)
 * - Apr 1 - Dec 31: 10% regular prompt discount (payment-date-based policy)
 * - Delinquent prior years: strictly 0% discount
 * - Authorized Assessor manual overrides for Basic Tax, SEF Tax, and Discount Rate
 * - Dynamic derived calculation of Discount Amount and Net Due
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

  // Calculate from year after lastPaidYear up to CURRENT_YEAR
  const startYear = property.lastPaidYear + 1;
  const endYear = CURRENT_YEAR;

  if (startYear > endYear) {
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

  for (let year = startYear; year <= endYear; year++) {
    const isCurrentYear = year === CURRENT_YEAR;
    const isDelinquent = year < CURRENT_YEAR;

    // 1. Statutory Base Tax: 1% Basic Tax + 1% SEF Tax = 2% Base Rate
    const systemBasicTax = Math.round(property.assessedValue * 0.01 * 100) / 100;
    const systemSefTax = Math.round(property.assessedValue * 0.01 * 100) / 100;
    const systemBaseTax = systemBasicTax + systemSefTax;

    // 2. Penalty Calculation Logic (RA 7160 Sec. 255: 2% per month, capped at 36 months / 72%)
    let monthsDelayed: number;
    if (isDelinquent) {
      const monthsSinceStartOfTaxYear = ((CURRENT_YEAR - year) * 12) + paymentMonth;
      monthsDelayed = monthsSinceStartOfTaxYear;
    } else {
      monthsDelayed = paymentMonth;
    }

    const effectiveMonths = Math.min(monthsDelayed, MAX_PENALTY_MONTHS);
    const penaltyRate = effectiveMonths * PENALTY_RATE_PER_MONTH;
    const penaltyAmount = Math.round(systemBaseTax * penaltyRate * 100) / 100;

    // 3. System-calculated Discount Rate strictly based on payment date & delinquency
    let systemDiscountRate: number;
    if (isDelinquent) {
      // Delinquent prior-year obligations: strictly 0% discount
      systemDiscountRate = delinquentRate;
    } else {
      // Current year payment-date-based discount policy:
      if (paymentMonth >= earlyStartMonth && paymentMonth <= earlyEndMonth) {
        systemDiscountRate = earlyDiscountRate; // 20% Jan 1 - Mar 31
      } else {
        systemDiscountRate = regularPromptRate; // 10% Apr 1 - Dec 31
      }
    }

    // 4. Authorized Assessor Manual Overrides
    const override = options?.overrides?.[year];
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

    // 5. Derived Computations:
    // - Base Tax = Basic Tax + SEF Tax
    // - Discount Amount = (Basic Tax + SEF Tax) * Discount Rate
    // - Net Due = Base Tax + Penalty - Discount Amount
    const appliedBaseTax = Math.round((appliedBasicTax + appliedSefTax) * 100) / 100;
    const discountAmount = Math.round(appliedBaseTax * appliedDiscountRate * 100) / 100;
    const totalDue = Math.max(0, Math.round((appliedBaseTax + penaltyAmount - discountAmount) * 100) / 100);

    records.push({
      year,
      status: isCurrentYear ? 'Current' : 'Delinquent',
      basicTax: appliedBasicTax,
      sefTax: appliedSefTax,
      baseTax: appliedBaseTax,
      systemBasicTax,
      systemSefTax,
      systemDiscountRate,
      isManuallyEdited,
      editReason,
      monthsDelayed: effectiveMonths,
      penaltyRate,
      penaltyAmount,
      discountRate: appliedDiscountRate,
      discountAmount,
      totalDue,
      isPayable: true,
    });

    totalBasicTax += appliedBasicTax;
    totalSefTax += appliedSefTax;
    totalBaseTax += appliedBaseTax;
    totalPenalty += penaltyAmount;
    totalDiscount += discountAmount;
    grandTotal += totalDue;
  }

  // Sort: Oldest years first (Standard ledger view / Arrears-First rule)
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
  };
};