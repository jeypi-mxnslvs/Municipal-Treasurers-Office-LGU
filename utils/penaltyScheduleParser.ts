import { ParsedPenaltySchedule } from '@/types';

/**
 * Canonical month dictionary for parsing municipal notice dates
 */
const MONTH_MAP: Record<string, number> = {
  JANUARY: 1,
  FEBRUARY: 2,
  MARCH: 3,
  APRIL: 4,
  MAY: 5,
  JUNE: 6,
  JULY: 7,
  AUGUST: 8,
  SEPTEMBER: 9,
  OCTOBER: 10,
  NOVEMBER: 11,
  DECEMBER: 12,
};

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Standard Santa Rosa period labels recognized in municipal schedules
 */
export const SANTA_ROSA_SCHEDULE_LABELS = [
  '1973-79',
  '1980-85',
  '1986',
  '1987-1991',
  '1992-1993',
  '1994-2005',
  '2006-11',
  '2012',
  '2013',
  '2014',
  '2015',
  '2016',
  '2017',
  '2018',
  '2019',
  '2020',
  '2021',
  '2022',
  '2023',
  '2024',
  '2025',
  '2026 1-2Q',
  '2026 3-4 Q',
  '2027',
];

/**
 * RFC 4180 compliant CSV line parser.
 */
const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
};

/**
 * Calculate statutory delinquency penalty or discount rate for a specific label and billing date.
 * 
 * Rules:
 * - <= 1993: 24% statutory legacy cap
 * - 1994 to (effectiveYear - 3): 72% maximum statutory cap (RA 7160 Sec. 255)
 * - Recent years: ((effectiveYear - rollYear) * 12 + effectiveMonth) * 2%
 * - Current year 1-2Q: effectiveMonth * 2%
 * - Current year 3-4 Q: 0%
 * - Advance year: -20% (prompt advance discount)
 */
export const calculateStatutoryRateForLabel = (
  label: string,
  effectiveYear: number,
  effectiveMonth: number
): number => {
  if (label === '2027' || label === String(effectiveYear + 1)) {
    return 0.00;
  }

  if (label === '2026 3-4 Q' || label.includes('3-4 Q') || label.includes('3-4Q')) {
    return 0.00;
  }

  if (label === '2026 1-2Q' || label.includes('1-2Q')) {
    const elapsedMonths = effectiveMonth;
    return Math.min(Math.round(elapsedMonths * 0.02 * 10000) / 10000, 0.72);
  }

  if (
    label === '1973-79' ||
    label === '1980-85' ||
    label === '1986' ||
    label === '1987-1991' ||
    label === '1992-1993'
  ) {
    return 0.24;
  }

  let rollYear: number;
  if (label.includes('-')) {
    rollYear = parseInt(label.split('-')[0], 10);
  } else {
    rollYear = parseInt(label, 10);
  }

  if (isNaN(rollYear)) {
    return 0.72;
  }

  if (rollYear <= 1993) {
    return 0.24;
  }

  const elapsedMonths = (effectiveYear - rollYear) * 12 + effectiveMonth;
  const rawRate = elapsedMonths * 0.02;
  return Math.min(Math.round(rawRate * 10000) / 10000, 0.72);
};

/**
 * Parses Notice of Delinquency computation sheets (COMPUTATION.csv / COMPUTATION123.csv).
 * Supports both Mode A (evaluated numbers present) and Mode B (blank template with dashes).
 */
export const parsePenaltyScheduleCsv = (csvContent: string): ParsedPenaltySchedule => {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim() !== '');

  if (lines.length < 10) {
    throw new Error('Invalid computation sheet: File is too short to be a valid Notice of Delinquency schedule.');
  }

  const headerText = lines.slice(0, 10).join(' ').toUpperCase();
  const hasNoticeSignature =
    headerText.includes('NOTICE OF DELIQUENCY') ||
    headerText.includes('NOTICE OF DELINQUENCY') ||
    headerText.includes('OFFICE OF THE TREASURER') ||
    headerText.includes('REAL PROPERTY TAX');

  if (!hasNoticeSignature) {
    throw new Error('Invalid computation sheet: Missing statutory Notice of Delinquency header signature.');
  }

  let effectiveYear = 2026;
  let effectiveMonth = 9;
  let effectiveMonthName = 'September';

  let dateLineFound = false;
  for (const line of lines.slice(0, 15)) {
    const upper = line.toUpperCase();
    for (const [mName, mNum] of Object.entries(MONTH_MAP)) {
      if (upper.includes(mName)) {
        const yearMatch = upper.match(/\b(20\d{2})\b/);
        effectiveMonth = mNum;
        effectiveMonthName = MONTH_NAMES[mNum];
        if (yearMatch) {
          effectiveYear = parseInt(yearMatch[1], 10);
        }
        dateLineFound = true;
        break;
      }
    }
    if (dateLineFound) break;
  }

  let dataStartIndex = -1;
  for (let i = 0; i < Math.min(25, lines.length); i++) {
    const cols = parseCsvLine(lines[i]).map((c) => c.toLowerCase());
    if (cols.some((c) => c.includes('year') || c.includes('unpaid') || c.includes('penalt'))) {
      dataStartIndex = i + 1;
      break;
    }
  }

  if (dataStartIndex === -1) {
    dataStartIndex = 14;
  }

  const rates: Record<string, number> = {};
  let evaluatedCount = 0;

  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (upper.includes('PREPARED BY') || upper.includes('RECEIVED BY')) {
      break;
    }

    const cols = parseCsvLine(line);
    if (cols.length < 2) continue;

    let matchedLabel: string | undefined;
    let labelColIdx = -1;

    for (let c = 0; c < cols.length; c++) {
      const colVal = cols[c].trim();
      const directMatch = SANTA_ROSA_SCHEDULE_LABELS.find(
        (l) => l.toUpperCase() === colVal.toUpperCase()
      );
      if (directMatch) {
        matchedLabel = directMatch;
        labelColIdx = c;
        break;
      }
    }

    if (!matchedLabel || labelColIdx === -1) continue;

    let unpaidTaxes = 0;
    let penaltyValue = 0;
    let hasNumbers = false;

    const remainingCols = cols.slice(labelColIdx + 1).map((val) => {
      return val.replace(/[₱,\s]/g, '');
    });

    const parsedNums: number[] = [];
    for (const val of remainingCols) {
      if (val && val !== '-' && val !== '–' && val !== '—' && !isNaN(parseFloat(val))) {
        parsedNums.push(parseFloat(val));
      }
    }

    if (parsedNums.length >= 2) {
      unpaidTaxes = parsedNums[0];
      penaltyValue = parsedNums[1];
      if (unpaidTaxes > 0 && penaltyValue >= 0) {
        hasNumbers = true;
      }
    }

    if (hasNumbers && unpaidTaxes > 0) {
      const computedRate = Math.min(Math.round((penaltyValue / unpaidTaxes) * 10000) / 10000, 0.72);
      rates[matchedLabel] = computedRate;
      evaluatedCount++;
    } else {
      rates[matchedLabel] = calculateStatutoryRateForLabel(matchedLabel, effectiveYear, effectiveMonth);
    }
  }

  for (const label of SANTA_ROSA_SCHEDULE_LABELS) {
    if (rates[label] === undefined) {
      rates[label] = calculateStatutoryRateForLabel(label, effectiveYear, effectiveMonth);
    }
  }

  const sourceMode: 'EVALUATED_NUMBERS' | 'STATUTORY_CALCULATED' =
    evaluatedCount >= 5 ? 'EVALUATED_NUMBERS' : 'STATUTORY_CALCULATED';

  return {
    effectiveYear,
    effectiveMonth,
    effectiveMonthName,
    scheduleLabel: `${effectiveMonthName} ${effectiveYear} Notice of Delinquency Schedule`,
    rates,
    sourceMode,
  };
};
