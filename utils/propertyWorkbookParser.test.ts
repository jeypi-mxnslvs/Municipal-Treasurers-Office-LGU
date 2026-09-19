import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parsePropertyWorkbook } from './propertyWorkbookParser';

const workbookBytes = (sheets: Record<string, unknown[][]>) => {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
};

describe('property workbook parser', () => {
  it('parses multiple barangay tabs and skips summary tabs', () => {
    const bytes = workbookBytes({
      Rizal: [['TD Number', 'Owner', 'Barangay', 'Assessed Value'], ['TD-23001-00001', 'Owner A', '', 100000]],
      Maliolio: [['TD Number', 'Owner', 'Barangay', 'Assessed Value'], ['TD-23016-00001', 'Owner B', '', 200000]],
      Summary: [['Grand Total', 300000]],
    });
    const result = parsePropertyWorkbook(bytes, 'RPTAR.xlsx');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((row) => row.barangay)).toEqual(['Rizal (Poblacion)', 'Maliolio']);
    expect(result.sheets.find((sheet) => sheet.name === 'Summary')?.kind).toBe('SUMMARY');
  });

  it('fails closed for missing context and conflicting duplicate TD values', () => {
    const bytes = workbookBytes({
      Data: [['TD Number', 'Owner', 'Assessed Value'], ['TD-23001-00001', 'Owner A', 100000], ['TD-23001-00001', 'Owner B', 120000]],
    });
    const result = parsePropertyWorkbook(bytes, 'RPTAR.xlsx');
    expect(result.candidates).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === 'UNRESOLVED_BARANGAY')).toBe(true);
  });
});
