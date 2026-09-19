import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseComputationWorkbook } from './computationWorkbook';

describe('computation workbook parser', () => {
  it('reads formula strings and ignores cached values', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      [], [], [], [], [], [], [], [], [], [], [], [], [], [],
      ['', '', '', '', '', '', '', '', '', '', '1973-79', '=(I15*0.01)*7', '', 'L15*0.24', '', 'L15+N15'],
    ]);
    sheet.L15 = { t: 'n', v: 0, f: '(I15*0.01)*7' };
    sheet.N15 = { t: 'n', v: 0, f: 'L15*0.24' };
    sheet.P15 = { t: 'n', v: 0, f: 'L15+N15' };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'SEP');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const parsed = parseComputationWorkbook(bytes, 'computation.xlsx');
    expect(parsed.sheets[0].rows[0]).toMatchObject({
      periodLabel: '1973-79',
      adjustmentRate: 0.24,
      sourceSheet: 'SEP',
    });
  });
});
