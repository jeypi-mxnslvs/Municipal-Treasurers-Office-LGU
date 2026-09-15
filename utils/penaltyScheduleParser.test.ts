import { describe, it, expect } from 'vitest';
import {
  parsePenaltyScheduleCsv,
  calculateStatutoryRateForLabel,
  SANTA_ROSA_SCHEDULE_LABELS,
} from './penaltyScheduleParser';

describe('Dynamic Penalty Schedule Parser (DEBT-DOM-04 / COMPUTATION.csv)', () => {
  const sampleTemplateCsv = `REPUBLIC OF THE PHILIPPINES,,,,,,,,,,,,,,,,,
PROVINCE OF NUEVA ECIJA,,,,,,,,,,,,,,,,,
Office of the Treasurer,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,
NOTICE OF DELIQUENCY IN THE PAYMENT OF REAL PROPERTY TAX IN THE,,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,
,,,,,,,OR#,,,,,,Date:,SEPTEMBER 01-31 2026,,,
,,,,,,,,,,,,,,,,,
,,,,,,LAST PAYMENT:,,,,,,,,,,,
,"Notice is hereby served pursuant to the provision of Section 254, Republic Act No. 7160 ( Local Government Code of 1991 ) the Real Property Tax for Calendar",,,,,,,,,,,,,,,,
"year  2025  and the previous years, has been delinquent with the respect to the figures.",,,,,,,,,,,,,,,,,
,,,,,,,,,,,,,,,,,
Tax Declaration No.,,Area,"Assess Value",Location,,Kind of Property,,,,Year,Unpaid Taxes,,Penalties/Discount,,Total Tax Delinquency,,
,,,,,,,,,,,,,,,,,
,,,,,,,,,,1973-79, - ,, - ,, - ,,
,,,,,,,,,,1980-85, - ,, - ,, - ,,
,,,,,,,,,,1986, - ,, - ,, - ,,
,,,,,,,,,,1987-1991, - ,, - ,, - ,,
,,,,,,,,,,1992-1993, - ,, - ,, - ,,
,,,,,,,,,,1994-2005, - ,, - ,, - ,,
,,,,,,,,,,2006-11, - ,, - ,, - ,,
,,,,,,,,,,2012, - ,, - ,, - ,,
,,,,,,,,,,2013, - ,, - ,, - ,,
,,,,,,,,,,2014, - ,, - ,, - ,,
,,,,,,,,,,2015, - ,, - ,, - ,,
,,,,,,,,,,2016, - ,, - ,, - ,,
,,,,,,,,,,2017, - ,, - ,, - ,,
,,,,,,,,,,2018, - ,, - ,, - ,,
,,,,,,,,,,2019, - ,, - ,, - ,,
,,,,,,,,,,2020, - ,, - ,, - ,,
,,,,,,,,,,2021, - ,, - ,, - ,,
,,,,,,,,,,2022, - ,, - ,, - ,,
,,,,,,,,,,2023, - ,, - ,, - ,,
,,,,,,,,,,2024, - ,, - ,, - ,,
,,,,,,,,,,2025, - ,, - ,, - ,,
,,,,,,,,,,2026 1-2Q, - ,, - ,, - ,,
,,,,,,,,,,2026 3-4 Q, - ,,,, - ,,
,,,,,,,,,,2027, - ,, - ,, - ,,
,,,,,,,,,,,,,,,,,
Prepared by:,,,,,,,Received by:,,,,,,,,,,
Revenue Collection Clerk,,,,,,,Signature over printed name & Date,,,,,,Municipal Treasurer,,,,
`;

  it('parses blank template (Mode B) and computes statutory rates based on effective month', () => {
    const result = parsePenaltyScheduleCsv(sampleTemplateCsv);

    expect(result.effectiveYear).toBe(2026);
    expect(result.effectiveMonth).toBe(9);
    expect(result.effectiveMonthName).toBe('September');
    expect(result.sourceMode).toBe('STATUTORY_CALCULATED');

    // Historical legacy brackets <= 1993 capped at 24%
    expect(result.rates['1973-79']).toBe(0.24);
    expect(result.rates['1980-85']).toBe(0.24);
    expect(result.rates['1986']).toBe(0.24);
    expect(result.rates['1987-1991']).toBe(0.24);
    expect(result.rates['1992-1993']).toBe(0.24);

    // Multi-decade statutory cap at 72%
    expect(result.rates['1994-2005']).toBe(0.72);
    expect(result.rates['2006-11']).toBe(0.72);
    expect(result.rates['2012']).toBe(0.72);
    expect(result.rates['2023']).toBe(0.72);

    // Dynamic recent years (September 2026)
    // 2024: (2 * 12 + 9) * 2% = 33 * 2% = 66%
    expect(result.rates['2024']).toBe(0.66);
    // 2025: (1 * 12 + 9) * 2% = 21 * 2% = 42%
    expect(result.rates['2025']).toBe(0.42);
    // 2026 1-2Q: 9 * 2% = 18%
    expect(result.rates['2026 1-2Q']).toBe(0.18);
    // 2026 3-4 Q: 0%
    expect(result.rates['2026 3-4 Q']).toBe(0.00);
    // 2027: 0.00 base penalty
    expect(result.rates['2027']).toBe(0.00);
  });

  it('parses July schedule dynamically with adjusted rates for 2024 and 2025', () => {
    const julyRate2024 = calculateStatutoryRateForLabel('2024', 2026, 7);
    const julyRate2025 = calculateStatutoryRateForLabel('2025', 2026, 7);
    const julyRate2026Q1 = calculateStatutoryRateForLabel('2026 1-2Q', 2026, 7);

    // July 2026:
    // 2024: (2 * 12 + 7) * 2% = 31 * 2% = 62%
    expect(julyRate2024).toBe(0.62);
    // 2025: (1 * 12 + 7) * 2% = 19 * 2% = 38%
    expect(julyRate2025).toBe(0.38);
    // 2026 1-2Q: 7 * 2% = 14%
    expect(julyRate2026Q1).toBe(0.14);
  });

  it('parses evaluated numbers (Mode A) when populated amounts are present', () => {
    const evaluatedCsv = `REPUBLIC OF THE PHILIPPINES,,,,,,,,,,,,,,,,,
NOTICE OF DELIQUENCY IN THE PAYMENT OF REAL PROPERTY TAX IN THE,,,,,,,,,,,,,,,,,
,,,,,,,OR#,,,,,,Date:,OCTOBER 01-31 2026,,,
Tax Declaration No.,,Area,Assess Value,Location,,Kind of Property,,,,Year,Unpaid Taxes,,Penalties/Discount,,Total Tax Delinquency,,
,,,,,,,,,,1973-79, 1000 ,, 240 ,, 1240 ,,
,,,,,,,,,,1994-2005, 1000 ,, 720 ,, 1720 ,,
,,,,,,,,,,2023, 1000 ,, 720 ,, 1720 ,,
,,,,,,,,,,2024, 1000 ,, 680 ,, 1680 ,,
,,,,,,,,,,2025, 1000 ,, 440 ,, 1440 ,,
,,,,,,,,,,2026 1-2Q, 1000 ,, 200 ,, 1200 ,,
,,,,,,,,,,2026 3-4 Q, 1000 ,, 0 ,, 1000 ,,
Prepared by:,,,,,,,Received by:,,,,,,,,,,
`;

    const result = parsePenaltyScheduleCsv(evaluatedCsv);
    expect(result.sourceMode).toBe('EVALUATED_NUMBERS');
    expect(result.effectiveMonth).toBe(10);
    expect(result.rates['1973-79']).toBe(0.24);
    expect(result.rates['2024']).toBe(0.68);
    expect(result.rates['2025']).toBe(0.44);
    expect(result.rates['2026 1-2Q']).toBe(0.20);
    expect(result.rates['2026 3-4 Q']).toBe(0.00);
  });

  it('rejects invalid or non-Notice CSV files', () => {
    const shortCsv = 'Name,Age,Address\nJohn,30,Santa Rosa';
    expect(() => parsePenaltyScheduleCsv(shortCsv)).toThrow(
      'Invalid computation sheet: File is too short to be a valid Notice of Delinquency schedule.'
    );

    const missingSignatureCsv = Array(12).fill('Name,Age,Address,100,200,300').join('\n');
    expect(() => parsePenaltyScheduleCsv(missingSignatureCsv)).toThrow(
      'Invalid computation sheet: Missing statutory Notice of Delinquency header signature.'
    );
  });

  it('ensures all canonical Santa Rosa period labels are populated in output schedule', () => {
    const result = parsePenaltyScheduleCsv(sampleTemplateCsv);
    for (const label of SANTA_ROSA_SCHEDULE_LABELS) {
      expect(result.rates[label]).toBeDefined();
      expect(typeof result.rates[label]).toBe('number');
      expect(result.rates[label]).toBeLessThanOrEqual(0.72);
      expect(result.rates[label]).toBeGreaterThanOrEqual(0.00);
    }
  });
});
