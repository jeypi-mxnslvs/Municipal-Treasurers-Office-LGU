import * as XLSX from 'xlsx';
import {
  ComputationScheduleParseResult,
  parseComputationSheet,
} from './computationScheduleParser';

export interface ParsedComputationWorkbook {
  sourceFileName: string;
  sheets: ComputationScheduleParseResult[];
}

/** Read formula strings from XLS/XLSX; cached displayed values are deliberately ignored. */
export function parseComputationWorkbook(file: ArrayBuffer, sourceFileName: string): ParsedComputationWorkbook {
  const workbook = XLSX.read(file, { type: 'array', cellFormula: true, cellNF: false, cellText: false });
  const sheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const cells: Record<string, string> = {};
    for (const address of Object.keys(sheet)) {
      if (address.startsWith('!')) continue;
      const cell = sheet[address] as XLSX.CellObject;
      if (typeof cell.f === 'string' && cell.f.trim()) cells[address] = cell.f;
      else if (typeof cell.v === 'string' && /^[0-9]{4}/.test(cell.v.trim())) cells[address] = cell.v;
    }
    return parseComputationSheet(sheetName, cells);
  });
  return { sourceFileName, sheets };
}
