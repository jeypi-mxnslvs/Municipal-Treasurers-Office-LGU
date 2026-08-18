/**
 * RA 7160 Philippine Real Property Tax Engine
 */

export const CURRENT_YEAR = 2026;
export const BASIC_TAX_RATE = 0.01; // 1% Basic Tax (LGU Province standard) or 0.02 for City
export const SEF_TAX_RATE = 0.01;   // 1% Special Education Fund
export const TOTAL_BASE_RATE = BASIC_TAX_RATE + SEF_TAX_RATE; // 2% Total Base Rate
export const PENALTY_RATE_PER_MONTH = 0.02; // 2% per month
export const MAX_PENALTY_MONTHS = 36; // Capped at 36 months (72%)
export const PROMPT_DISCOUNT_RATE = 0.10; // 10% prompt payment discount

/**
 * Computes the itemized quarterly tax liability for a property
 * @param {Object} property - The property record
 * @param {Array} unpaidQuarterRows - Rows from quarterly_payment_status table where status = 'DELINQUENT'
 */
export const calculateTaxLiability = (property, unpaidQuarterRows = []) => {
  const assessedValue = property.assessed_value || property.assessedValue || 0;
  const annualBaseTax = assessedValue * TOTAL_BASE_RATE;
  const quarterlyBaseTax = annualBaseTax / 4;
  const quarterlyBasicTax = (assessedValue * BASIC_TAX_RATE) / 4;
  const quarterlySefTax = (assessedValue * SEF_TAX_RATE) / 4;

  const now = new Date();
  const currentMonth = now.getMonth(); // 0 = Jan, 11 = Dec

  let records = [];
  let grandTotal = 0;
  let totalBasicTax = 0;
  let totalSefTax = 0;
  let totalPenalty = 0;
  let totalDiscount = 0;

  // Determine if there are past-year arrears (prior to CURRENT_YEAR)
  const hasPastArrears = unpaidQuarterRows.some(row => row.tax_year < CURRENT_YEAR);

  for (const row of unpaidQuarterRows) {
    const year = row.tax_year;
    const quarter = row.quarter;

    // Calculate delay in months based on quarter due date
    // Q1 due March 31 (month 2), Q2 due June 30 (month 5), Q3 due Sept 30 (month 8), Q4 due Dec 31 (month 11)
    let monthsDelayed = 0;

    if (year < CURRENT_YEAR) {
      const yearsDiff = CURRENT_YEAR - year;
      // Months from the end of the delinquent quarter to current date
      const quarterEndMonth = quarter * 3 - 1; // 2, 5, 8, 11
      monthsDelayed = (yearsDiff * 12) + (currentMonth - quarterEndMonth);
      if (monthsDelayed < 0) monthsDelayed = 0;
    } else if (year === CURRENT_YEAR) {
      const quarterEndMonth = quarter * 3 - 1;
      if (currentMonth > quarterEndMonth) {
        monthsDelayed = currentMonth - quarterEndMonth;
      } else {
        monthsDelayed = 0; // Current or in advance
      }
    }

    const effectiveMonths = Math.min(Math.max(monthsDelayed, 0), MAX_PENALTY_MONTHS);
    const penaltyRate = effectiveMonths * PENALTY_RATE_PER_MONTH;
    const penaltyAmount = quarterlyBaseTax * penaltyRate;

    // Prompt payment discount: only if zero penalty accrued AND no past years arrears
    let discountAmount = 0;
    let discountRate = 0;
    if (effectiveMonths === 0 && !hasPastArrears && year >= CURRENT_YEAR) {
      discountRate = PROMPT_DISCOUNT_RATE;
      discountAmount = quarterlyBaseTax * discountRate;
    }

    const totalDue = quarterlyBaseTax + penaltyAmount - discountAmount;

    records.push({
      id: `${year}-Q${quarter}`,
      year,
      quarter,
      status: effectiveMonths > 0 ? 'Delinquent' : (year === CURRENT_YEAR ? 'Current' : 'Advance'),
      basicTax: quarterlyBasicTax,
      sefTax: quarterlySefTax,
      baseTax: quarterlyBaseTax,
      monthsDelayed: effectiveMonths,
      penaltyRate,
      penaltyAmount,
      discountRate,
      discountAmount,
      totalDue
    });

    grandTotal += totalDue;
    totalBasicTax += quarterlyBasicTax;
    totalSefTax += quarterlySefTax;
    totalPenalty += penaltyAmount;
    totalDiscount += discountAmount;
  }

  // Sort: Oldest year, then oldest quarter first
  records.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.quarter - b.quarter;
  });

  return {
    propertyId: property.id,
    currentTd: property.current_td || property.tdNumber,
    ownerName: property.owner_name || property.ownerName,
    assessedValue,
    records,
    summary: {
      totalBasicTax,
      totalSefTax,
      totalBaseTax: totalBasicTax + totalSefTax,
      totalPenalty,
      totalDiscount,
      grandTotal
    }
  };
};
