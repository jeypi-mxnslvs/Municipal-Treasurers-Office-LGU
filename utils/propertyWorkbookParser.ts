import * as XLSX from 'xlsx';
import { BARANGAYS, PROPERTY_CLASSES } from '@/constants';
import { SANTA_ROSA_BARANGAY_CODES } from '@/utils/validationPipeline';

export type WorkbookSheetKind = 'PROPERTY_DATA' | 'SUMMARY' | 'INSTRUCTIONS' | 'UNKNOWN';
export type ValueOrigin = 'EXPLICIT_CELL' | 'CACHED_FORMULA_RESULT' | 'MISSING';

export interface PropertyWorkbookIssue {
  code: string;
  message: string;
  sheetName?: string;
  sourceRow?: number;
  severity: 'ERROR' | 'WARNING';
}

export interface PropertyWorkbookCandidate {
  tdNumber: string;
  previousTdNumber: string;
  pin: string;
  ownerName: string;
  address: string;
  barangay: string;
  barangaySource: 'ROW' | 'SHEET' | 'BANNER' | 'FILENAME' | 'USER_CONTEXT';
  barangayConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  propertyClass: string;
  lotAreaSqm: string;
  marketValue: string;
  assessedValue: string;
  lastPaidYear: string;
  delinquencyStartYear: string;
  parcelOriginYear: string;
  sourceSheet: string;
  sourceSheetIndex: number;
  sourceRow: number;
  sourceFormulae: Record<string, string>;
  valueOrigins: Record<string, ValueOrigin>;
}

export interface PropertyWorkbookParseResult {
  candidates: PropertyWorkbookCandidate[];
  issues: PropertyWorkbookIssue[];
  sheets: Array<{ name: string; index: number; kind: WorkbookSheetKind; rowCount: number }>;
}

const normalize = (value: unknown): string => String(value ?? '').trim();
const key = (value: unknown): string => normalize(value).toLowerCase().replace(/[\s_./()-]+/g, '');
const canonicalBarangay = (value: string): string | null => {
  const cleaned = key(value).replace(/josep/g, 'joseph');
  return BARANGAYS.find((barangay) => key(barangay).replace(/josep/g, 'joseph') === cleaned)
    || BARANGAYS.find((barangay) => key(barangay).replace(/josep/g, 'joseph').startsWith(cleaned) && cleaned.length >= 4)
    || null;
};
const canonicalClass = (value: string): string | null => PROPERTY_CLASSES.find((item) => key(item) === key(value)) || null;
const isFiniteNonNegative = (value: string): boolean => value === '' || (Number.isFinite(Number(value.replace(/[,₱$\s]/g, ''))) && Number(value.replace(/[,₱$\s]/g, '')) >= 0);

const findColumn = (headers: string[], aliases: string[]): number => {
  const normalized = headers.map(key);
  return normalized.findIndex((header) => aliases.some((alias) => header === alias || header.includes(alias)));
};

export function detectHeaderRow(rows: unknown[][]): { index: number; headers: string[] } | null {
  let best: { index: number; headers: string[]; score: number } | null = null;
  for (let index = 0; index < Math.min(rows.length, 15); index++) {
    const headers = rows[index].map(normalize);
    const joined = headers.map(key);
    const score = ['tdnumber', 'td', 'arp', 'pin', 'owner', 'ownername', 'barangay', 'marketvalue', 'assessedvalue']
      .filter((alias) => joined.some((header) => header === alias || header.includes(alias))).length;
    if (score >= 3 && (!best || score > best.score)) best = { index, headers, score };
  }
  return best ? { index: best.index, headers: best.headers } : null;
}

const sheetBannerBarangay = (rows: unknown[][]): string | null => {
  for (const row of rows.slice(0, 8)) {
    const text = row.map(normalize).filter(Boolean).join(' ');
    const match = text.match(/barangay\s*[:-]\s*([^|,;]+)/i);
    const resolved = canonicalBarangay(match?.[1] || text);
    if (resolved && (match || /barangay/i.test(text))) return resolved;
  }
  return null;
};

const fileBarangay = (fileName: string): string | null => {
  const matches = BARANGAYS.filter((barangay) => new RegExp(`(?:^|[ _-])${barangay.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[ _.-]|$)`, 'i').test(fileName));
  return matches.length === 1 ? matches[0] : null;
};

const sheetKind = (rows: unknown[][], header: { index: number; headers: string[] } | null): WorkbookSheetKind => {
  if (header) return 'PROPERTY_DATA';
  const text = rows.slice(0, 8).flat().map(normalize).join(' ').toLowerCase();
  if (/instruction|legend|guide|how to/.test(text)) return 'INSTRUCTIONS';
  if (/summary|total|grand total|consolidated/.test(text)) return 'SUMMARY';
  return 'UNKNOWN';
};

const cellValue = (sheet: XLSX.WorkSheet, address: string): { value: string; formula?: string; origin: ValueOrigin } => {
  const cell = sheet[address] as XLSX.CellObject | undefined;
  if (!cell) return { value: '', origin: 'MISSING' };
  const value = cell.w ?? cell.v;
  return {
    value: normalize(value),
    formula: typeof cell.f === 'string' ? cell.f : undefined,
    origin: cell.f ? 'CACHED_FORMULA_RESULT' : 'EXPLICIT_CELL',
  };
};

export function parsePropertyWorkbook(buffer: ArrayBuffer, fileName: string, defaultBarangay = 'All'): PropertyWorkbookParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: true, cellNF: true, cellText: true });
  const issues: PropertyWorkbookIssue[] = [];
  const candidates: PropertyWorkbookCandidate[] = [];
  const sourceFileBarangay = fileBarangay(fileName);
  const seen = new Map<string, PropertyWorkbookCandidate>();
  const sheets: PropertyWorkbookParseResult['sheets'] = [];

  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
    const header = detectHeaderRow(rows);
    const kind = sheetKind(rows, header);
    sheets.push({ name: sheetName, index: sheetIndex, kind, rowCount: rows.length });
    if (kind !== 'PROPERTY_DATA' || !header) return;

    const sheetBarangay = canonicalBarangay(sheetName);
    const bannerBarangay = sheetBannerBarangay(rows);
    const contextBarangays = [sheetBarangay, bannerBarangay, sourceFileBarangay].filter(Boolean) as string[];
    if (new Set(contextBarangays).size > 1) {
      issues.push({ code: 'BARANGAY_CONTEXT_CONFLICT', message: `Conflicting Barangay context in sheet ${sheetName}.`, sheetName, severity: 'ERROR' });
      return;
    }
    const userBarangay = defaultBarangay !== 'All' ? canonicalBarangay(defaultBarangay) : null;
    const headers = header.headers;
    const columns = {
      td: findColumn(headers, ['tdnumber', 'td', 'arp']), previousTd: findColumn(headers, ['previoustd', 'prevtd']),
      pin: findColumn(headers, ['pin']), owner: findColumn(headers, ['ownername', 'owner']), address: findColumn(headers, ['address', 'location']),
      barangay: findColumn(headers, ['barangay', 'brgy']), propertyClass: findColumn(headers, ['propertyclass', 'classification', 'class']),
      lotArea: findColumn(headers, ['lotareasqm', 'lotarea', 'area']), market: findColumn(headers, ['marketvalue', 'mv']), assessed: findColumn(headers, ['assessedvalue', 'av']),
      lastPaid: findColumn(headers, ['lastpaidyear', 'lastpaid']), startYear: findColumn(headers, ['delinquencystartyear', 'startyear', 'unpaidfrom']), originYear: findColumn(headers, ['parceloriginyear', 'originyear']),
    };
    if (columns.td < 0 || columns.owner < 0 || columns.assessed < 0) {
      issues.push({ code: 'AMBIGUOUS_COLUMN_MAPPING', message: `Required TD, owner, or assessed-value column not identified in ${sheetName}.`, sheetName, severity: 'ERROR' });
      return;
    }

    for (let rowIndex = header.index + 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const tdNumber = normalize(row[columns.td]);
      if (!tdNumber || /^total|^grand total/i.test(tdNumber)) continue;
      const rowBarangay = columns.barangay >= 0 ? canonicalBarangay(normalize(row[columns.barangay])) : null;
      const evidence = [rowBarangay, sheetBarangay, bannerBarangay, sourceFileBarangay, userBarangay].filter(Boolean) as string[];
      const distinct = [...new Set(evidence)];
      if (distinct.length > 1) {
        issues.push({ code: 'BARANGAY_CONFLICT', message: `TD ${tdNumber} has conflicting Barangay sources: ${distinct.join(', ')}.`, sheetName, sourceRow: rowIndex + 1, severity: 'ERROR' });
        continue;
      }
      const barangay = distinct[0];
      if (!barangay) {
        issues.push({ code: 'UNRESOLVED_BARANGAY', message: `TD ${tdNumber} has no reliable Barangay context.`, sheetName, sourceRow: rowIndex + 1, severity: 'ERROR' });
        continue;
      }
      const source = rowBarangay ? 'ROW' : sheetBarangay ? 'SHEET' : bannerBarangay ? 'BANNER' : sourceFileBarangay ? 'FILENAME' : 'USER_CONTEXT';
      if (source === 'FILENAME' || source === 'USER_CONTEXT') {
        issues.push({ code: 'LOW_CONFIDENCE_BARANGAY', message: `TD ${tdNumber} uses ${source.toLowerCase()} Barangay context; explicit confirmation required.`, sheetName, sourceRow: rowIndex + 1, severity: 'ERROR' });
        continue;
      }
      const tdCode = tdNumber.match(/^(?:17|TD)-([0-9]{5})-/i)?.[1];
      if (tdCode && SANTA_ROSA_BARANGAY_CODES[barangay] !== tdCode) {
        issues.push({ code: 'TD_BARANGAY_MISMATCH', message: `TD ${tdNumber} code does not match ${barangay}.`, sheetName, sourceRow: rowIndex + 1, severity: 'ERROR' });
        continue;
      }
      const values: Record<string, { value: string; formula?: string; origin: ValueOrigin }> = {};
      for (const [field, column] of Object.entries(columns)) {
        if (column >= 0) values[field] = cellValue(sheet, XLSX.utils.encode_cell({ r: rowIndex, c: column }));
      }
      const candidate: PropertyWorkbookCandidate = {
        tdNumber, previousTdNumber: values.previousTd?.value || '', pin: values.pin?.value || '', ownerName: values.owner?.value || '',
        address: values.address?.value || '', barangay, barangaySource: source, barangayConfidence: source === 'ROW' || source === 'SHEET' ? 'HIGH' : 'MEDIUM',
        propertyClass: values.propertyClass?.value || '', lotAreaSqm: values.lotArea?.value || '', marketValue: values.market?.value || '', assessedValue: values.assessed?.value || '',
        lastPaidYear: values.lastPaid?.value || '', delinquencyStartYear: values.startYear?.value || '', parcelOriginYear: values.originYear?.value || '',
        sourceSheet: sheetName, sourceSheetIndex: sheetIndex, sourceRow: rowIndex + 1,
        sourceFormulae: Object.fromEntries(Object.entries(values).filter(([, value]) => value.formula).map(([field, value]) => [field, value.formula as string])),
        valueOrigins: Object.fromEntries(Object.entries(values).map(([field, value]) => [field, value.origin])),
      };
      if (!canonicalClass(candidate.propertyClass) && candidate.propertyClass) {
        issues.push({ code: 'INVALID_PROPERTY_CLASS', message: `TD ${tdNumber} has unsupported property class: ${candidate.propertyClass}.`, sheetName, sourceRow: rowIndex + 1, severity: 'ERROR' });
        continue;
      }
      if (![candidate.lotAreaSqm, candidate.marketValue, candidate.assessedValue].every(isFiniteNonNegative)) {
        issues.push({ code: 'INVALID_NUMERIC_VALUE', message: `TD ${tdNumber} has invalid numeric property values.`, sheetName, sourceRow: rowIndex + 1, severity: 'ERROR' });
        continue;
      }
      if (!candidate.assessedValue) {
        issues.push({ code: 'MISSING_ASSESSED_VALUE', message: `TD ${tdNumber} has no assessed value; it will remain a shell record.`, sheetName, sourceRow: rowIndex + 1, severity: 'WARNING' });
      }
      const previous = seen.get(tdNumber.toUpperCase());
      if (previous) {
        const same = JSON.stringify({ ...previous, sourceSheet: undefined, sourceRow: undefined }) === JSON.stringify({ ...candidate, sourceSheet: undefined, sourceRow: undefined });
        issues.push({ code: same ? 'DUPLICATE_IDENTICAL_ROW' : 'DUPLICATE_TD_CONFLICT', message: `Duplicate TD ${tdNumber} found in workbook.`, sheetName, sourceRow: rowIndex + 1, severity: same ? 'WARNING' : 'ERROR' });
        if (!same) continue;
        continue;
      } else seen.set(tdNumber.toUpperCase(), candidate);
      candidates.push(candidate);
    }
  });
  return { candidates, issues, sheets };
}
