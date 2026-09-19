export type ScheduleAdjustment = 'PENALTY' | 'DISCOUNT';

export interface ComputationScheduleSourceCell {
  address: string;
  formula: string;
}

export interface ParsedComputationScheduleRow {
  periodLabel: string;
  startYear: number;
  endYear: number;
  multiplier: number;
  baseTaxRate: number;
  adjustment: ScheduleAdjustment;
  adjustmentRate: number;
  operation: 'ADD' | 'SUBTRACT';
  sourceSheet: string;
  sourceRow: number;
  sourceCells: ComputationScheduleSourceCell[];
}

export interface ComputationScheduleParseResult {
  rows: ParsedComputationScheduleRow[];
  errors: string[];
}

interface FormulaCells {
  label?: string;
  unpaidFormula?: ComputationScheduleSourceCell;
  adjustmentFormula?: ComputationScheduleSourceCell;
  totalFormula?: ComputationScheduleSourceCell;
}

const CELL_REF = /([A-Z]+)(\d+)/i;
const BASE_FORMULA = /\*\s*([0-9]+(?:\.[0-9]+)?)(?:\s*\)?\s*\*\s*([0-9]+(?:\.[0-9]+)?))?/i;
const ADJUSTMENT_FORMULA = /\*\s*([0-9]+(?:\.[0-9]+)?)/i;

const parsePeriod = (label: string): { startYear: number; endYear: number } | null => {
  const years = label.match(/\b(\d{4})(?:\s*[-–]\s*(?:\d{2,4}))?\b/);
  if (!years) return null;
  const range = label.match(/(\d{4})\s*[-–]\s*(\d{2,4})/);
  const startYear = Number(years[1]);
  if (!range) return { startYear, endYear: startYear };
  const rawEnd = range[2];
  const endYear = rawEnd.length === 2
    ? Math.floor(startYear / 100) * 100 + Number(rawEnd)
    : Number(rawEnd);
  return endYear >= startYear ? { startYear, endYear } : null;
};

const parseRate = (formula: string): number | null => {
  const match = formula.match(ADJUSTMENT_FORMULA);
  if (!match) return null;
  const rate = Number(match[1]);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : null;
};

const parseBase = (formula: string): { rate: number; multiplier: number } | null => {
  const match = formula.match(BASE_FORMULA);
  if (!match) return null;
  const rate = Number(match[1]);
  const multiplier = match[2] === undefined ? 1 : Number(match[2]);
  return Number.isFinite(rate) && Number.isFinite(multiplier) && rate >= 0 && multiplier > 0
    ? { rate, multiplier }
    : null;
};

/**
 * Normalizes formulas from one computation workbook sheet.
 * It reads formulas as evidence; it never evaluates arbitrary spreadsheet code.
 */
export function parseComputationSheet(
  sheetName: string,
  cells: Record<string, string>,
): ComputationScheduleParseResult {
  const byRow = new Map<number, FormulaCells>();
  const errors: string[] = [];

  for (const [address, value] of Object.entries(cells)) {
    const ref = address.match(CELL_REF);
    if (!ref || !value) continue;
    const row = Number(ref[2]);
    const column = ref[1].toUpperCase();
    const current = byRow.get(row) || {};
    if (column === 'K') current.label = value.trim();
    if (column === 'L') current.unpaidFormula = { address, formula: value };
    if (column === 'N') current.adjustmentFormula = { address, formula: value };
    if (column === 'P') current.totalFormula = { address, formula: value };
    byRow.set(row, current);
  }

  const rows: ParsedComputationScheduleRow[] = [];
  for (const [sourceRow, item] of byRow) {
    if (!item.label || !item.unpaidFormula || !item.adjustmentFormula) continue;
    const period = parsePeriod(item.label);
    const base = parseBase(item.unpaidFormula.formula);
    const rate = parseRate(item.adjustmentFormula.formula);
    if (!period || !base || rate === null) {
      errors.push(`${sheetName}!${item.adjustmentFormula.address}: unsupported computation formula for ${item.label}`);
      continue;
    }
    const operation = item.totalFormula?.formula.includes('-') ? 'SUBTRACT' : 'ADD';
    rows.push({
      periodLabel: item.label,
      startYear: period.startYear,
      endYear: period.endYear,
      multiplier: base.multiplier,
      baseTaxRate: base.rate,
      adjustment: operation === 'SUBTRACT' ? 'DISCOUNT' : 'PENALTY',
      adjustmentRate: rate,
      operation,
      sourceSheet: sheetName,
      sourceRow,
      sourceCells: [item.unpaidFormula, item.adjustmentFormula, ...(item.totalFormula ? [item.totalFormula] : [])],
    });
  }

  return { rows, errors };
}
