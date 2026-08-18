import { Property, TaxYearRecord, CalculationResult } from '../types';
import { 
  CURRENT_YEAR, 
  BASE_TAX_RATE, 
  PENALTY_RATE_PER_MONTH, 
  MAX_PENALTY_MONTHS 
} from '../constants';

/**
 * Calculates the delinquency and tax due for a property based on its last paid year.
 * Implements the "Arrears First" rule logic.
 */
export const calculateTaxLiability = (property: Property): CalculationResult => {
  const records: TaxYearRecord[] = [];
  let grandTotal = 0;
  
  // We calculate from the year AFTER the last paid year, up to the CURRENT YEAR.
  const startYear = property.lastPaidYear + 1;
  const endYear = CURRENT_YEAR;

  // If fully paid
  if (startYear > endYear) {
    return { records: [], grandTotal: 0 };
  }

  for (let year = startYear; year <= endYear; year++) {
    const isCurrentYear = year === CURRENT_YEAR;
    
    // Base Tax Calculation
    const baseTax = property.assessedValue * BASE_TAX_RATE;
    
    // Penalty Calculation Logic
    let monthsDelayed = 0;

    if (year < CURRENT_YEAR) {
      // Past years are calculated from Jan 1st of that year to Present
      // Simplified logic: If it's a full past year, we consider it 12 months late per year passed
      // relative to the tax cycle.
      // However, the rule says max 36 months (72%).
      // Let's approximate delay based on how many months have passed since Jan 1 of that tax year.
      const monthsSinceStartOfTaxYear = ((CURRENT_YEAR - year) * 12) + (new Date().getMonth() + 1);
      monthsDelayed = monthsSinceStartOfTaxYear;
    } else {
      // Current year: Delay starts usually after Q1 or based on local ordinance. 
      // For this prototype, let's assume delay counts if we are past March (Q1).
      // If currently January, delay is 0.
      const currentMonthIndex = new Date().getMonth(); // 0 = Jan
      // Assuming penalty starts accruing immediately for prototype simplicity or after Jan.
      monthsDelayed = currentMonthIndex + 1; 
    }

    // Cap the effective months for penalty calculation
    const effectiveMonths = Math.min(monthsDelayed, MAX_PENALTY_MONTHS);
    
    // Calculate Penalty Amount
    const penaltyRate = effectiveMonths * PENALTY_RATE_PER_MONTH;
    const penaltyAmount = baseTax * penaltyRate;

    const totalDue = baseTax + penaltyAmount;
    
    records.push({
      year,
      status: isCurrentYear ? 'Current' : 'Delinquent',
      baseTax,
      monthsDelayed: effectiveMonths, // Displaying the capped months used for calc
      penaltyRate,
      penaltyAmount,
      totalDue,
      isPayable: true // In a real app, logic might force sequential selection
    });

    grandTotal += totalDue;
  }

  // Sort: Oldest years first (Standard ledger view)
  records.sort((a, b) => a.year - b.year);

  return {
    records,
    grandTotal
  };
};