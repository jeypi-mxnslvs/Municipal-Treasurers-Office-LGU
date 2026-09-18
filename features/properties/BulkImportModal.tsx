import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Property, User, CsvImportRowState, CsvImportBatch } from '@/types';
import { BARANGAYS, PROPERTY_CLASSES, HISTORICAL_BASELINE_YEAR } from '@/constants';
import { api } from '@/services/api';
import { mergeEncoderLabel } from '@/utils/encoderAttribution';
import { getPropertyCompleteness } from '@/utils/propertyCompleteness';
import { validatePin } from '@/utils/validationPipeline';
import { BreakdownAlertModal } from '@/components/common/BreakdownAlertModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  FolderClock,
  Filter,
  ShieldCheck,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  properties: Property[];
  currentUser: User;
}

interface RowDiff {
  field: string;
  label: string;
  oldVal: string;
  newVal: string;
}

interface ParsedRow {
  line: number;
  tdNumber: string;
  previousTdNumber: string;
  pin: string;
  ownerName: string;
  address: string;
  barangay: string;
  propertyClass: string;
  lotAreaSqm: number;
  marketValue: number;
  assessedValue: number;
  lastPaidYear: number;
  delinquencyStartYear?: number;
  parcelOriginYear?: number | null;
  hasHistoricalGap?: boolean;
  gapRange?: string;
  state: CsvImportRowState;
  isShell: boolean;
  existingProperty?: Property;
  diffs: RowDiff[];
  error?: string;
  encoderLabel: string;
  entryType: 'MANUAL' | 'CSV_IMPORT';
}

/** RFC 4180 parser. Keeps quoted CR/LF inside fields and rejects bad quotes. */
const parseCsv = (text: string): Array<{ line: number; fields: string[] }> => {
  const rows: Array<{ line: number; fields: string[] }> = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let rowStart = 1;
  let line = 1;

  const finishField = () => {
    fields.push(field.trim());
    field = '';
  };
  const finishRow = () => {
    finishField();
    if (fields.some(value => value !== '')) rows.push({ line: rowStart, fields });
    fields = [];
    rowStart = line;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted) {
        quoted = false;
      } else if (field.trim() === '') {
        quoted = true;
      } else {
        throw new Error(`Malformed CSV quote near line ${line}.`);
      }
    } else if (char === ',' && !quoted) {
      finishField();
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      line++;
      finishRow();
    } else {
      field += char;
      if (char === '\n') line++;
    }
  }

  if (quoted) throw new Error(`Malformed CSV: unclosed quote near line ${line}.`);
  if (field || fields.length > 0) finishRow();
  return rows;
};

const parseImportNumber = (raw: string | undefined, fallback: number): number => {
  const value = (raw || '').trim();
  if (!value) return fallback;
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(value.replace(/,/g, ''))) return Number.NaN;
  return Number(value.replace(/,/g, ''));
};

const csvEscape = (value: unknown): string => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

/**
 * Resilient barangay matcher for Santa Rosa's 33 official barangays.
 * Matches exact, handles variations like "Rizal" vs "Rizal (Poblacion)", and "San Josep" vs "San Joseph".
 */
const matchSantaRosaBarangay = (raw: string): string | null => {
  if (!raw) return null;
  const clean = raw.trim().toLowerCase();

  // 1. Direct exact match
  const exact = BARANGAYS.find((b) => b.toLowerCase() === clean);
  if (exact) return exact;

  // 2. Normalized match (strip "(Poblacion)", normalize "Josep" -> "Joseph")
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s*\(poblacion\)/gi, '')
      .replace(/\bjosep\b/gi, 'joseph')
      .trim();

  const normalized = BARANGAYS.find((b) => norm(b) === norm(clean));
  if (normalized) return normalized;

  // 3. Prefix / Substring match
  const prefix = BARANGAYS.find(
    (b) => b.toLowerCase().startsWith(clean) || clean.startsWith(b.toLowerCase())
  );
  return prefix || null;
};

const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  properties,
  currentUser,
}) => {
  const [tab, setTab] = useState<'import' | 'history' | 'export'>('import');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
    unchanged: number;
    batchId?: number;
  } | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [selectedBarangayFilter, setSelectedBarangayFilter] = useState<string>('All');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [importBatches, setImportBatches] = useState<CsvImportBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load batch history whenever modal opens or history tab is selected
  const loadBatchHistory = async () => {
    setIsLoadingBatches(true);
    try {
      const batches = await api.getImportBatches();
      setImportBatches(batches);
    } catch (err) {
      console.error('Failed to load import batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBatchHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    if (tab === 'history') {
      loadBatchHistory();
    }
  }, [tab]);

  // Parse CSV with "Last Import Wins" Smart Upsert & Row Classification
  const handleParseCsv = (rawText: string, fileName = 'Import.csv') => {
    setImportResult(null);
    setUploadedFileName(fileName);

    let csvRows: Array<{ line: number; fields: string[] }>;
    try {
      csvRows = parseCsv(rawText.replace(/^\uFEFF/, ''));
    } catch (error) {
      setParsedRows([]);
      setImportError(error instanceof Error ? error.message : 'Malformed CSV file.');
      return;
    }
    if (csvRows.length <= 1) {
      setParsedRows([]);
      return;
    }

    // Step 1: Pre-scan to find last line index for each TD Number ("Last Import Wins" rule)
    const rawParsed: Array<{
      line: number;
      tdNumber: string;
      previousTdNumber: string;
      pin: string;
      ownerName: string;
      address: string;
      rawBarangay: string;
      rawPropertyClass: string;
      lotAreaSqm: number;
      marketValue: number;
      assessedValue: number;
      rawLastPaid: string;
      rawStartYear: string;
      rawOriginYear: string;
    }> = [];

    const lastSeenIndexByTd = new Map<string, number>();

    // Parse header to map column names dynamically if present
    const headerCols = csvRows[0].fields.map((h) =>
      h.toLowerCase().replace(/[\s_-]+/g, '')
    );

    const findColIdx = (keywords: string[], defaultIdx: number): number => {
      const idx = headerCols.findIndex((h) =>
        keywords.some((k) => h === k || h.includes(k))
      );
      return idx !== -1 ? idx : defaultIdx;
    };

    const colTd = findColIdx(['tdnumber', 'td', 'arp'], 0);
    const colPrevTd = findColIdx(['previoustd', 'prevtd'], 1);
    const colPin = findColIdx(['pin'], 2);
    const colOwner = findColIdx(['ownername', 'owner'], 3);
    const colAddress = findColIdx(['address', 'location'], 4);
    const colBarangay = findColIdx(['barangay', 'brgy'], 5);
    const colClass = findColIdx(['propertyclass', 'class', 'classification'], 6);
    const colLotArea = findColIdx(['lotareasqm', 'lotarea', 'area'], 7);
    const colMv = findColIdx(['marketvalue', 'mv'], 8);
    const colAv = findColIdx(['assessedvalue', 'av'], 9);

    // Strict column groups for Start Year, Paid Year, and Parcel Origin Year
    const colStartYear = findColIdx(
      ['startyear', 'delinquentyear', 'yearfrom', 'unpaidfrom', 'fromyear', 'delinquencystartyear'],
      -1
    );
    const colLastPaid = findColIdx(
      ['lastpaidyear', 'lastpaid', 'lastpayment'],
      colStartYear === -1 ? 10 : -1
    );
    const colOriginYear = findColIdx(
      ['originyear', 'parceloriginyear', 'creationyear', 'origyear'],
      -1
    );

    for (let i = 1; i < csvRows.length; i++) {
      const csvRow = csvRows[i];
      const cleanCols = csvRow.fields;

      const tdNumber = cleanCols[colTd] || '';
      const previousTdNumber = cleanCols[colPrevTd] || '';
      const pin = cleanCols[colPin] || '';
      const ownerName = cleanCols[colOwner] || '';
      const address = cleanCols[colAddress] || 'Santa Rosa, Nueva Ecija';
      const rawBarangay = cleanCols[colBarangay] || '';
      const rawPropertyClass = cleanCols[colClass] || '';
      const lotAreaSqm = parseImportNumber(cleanCols[colLotArea], 100);
      const marketValue = parseImportNumber(cleanCols[colMv], 0);
      const assessedValue = parseImportNumber(cleanCols[colAv], 0);
      const rawLastPaid = colLastPaid !== -1 ? cleanCols[colLastPaid]?.trim() || '' : '';
      const rawStartYear = colStartYear !== -1 ? cleanCols[colStartYear]?.trim() || '' : '';
      const rawOriginYear = colOriginYear !== -1 ? cleanCols[colOriginYear]?.trim() || '' : '';

      const record = {
        line: csvRow.line,
        tdNumber,
        previousTdNumber,
        pin,
        ownerName,
        address,
        rawBarangay,
        rawPropertyClass,
        lotAreaSqm,
        marketValue,
        assessedValue,
        rawLastPaid,
        rawStartYear,
        rawOriginYear,
      };

      rawParsed.push(record);
      if (tdNumber) {
        lastSeenIndexByTd.set(tdNumber.toUpperCase(), i + 1);
      }
    }

    // Step 2: Classify each row with strict validation and smart upsert logic
    const rows: ParsedRow[] = [];

    for (const r of rawParsed) {
      const upperTd = r.tdNumber.toUpperCase();
      let state: CsvImportRowState = 'VALID_NEW';
      let error = '';
      const diffs: RowDiff[] = [];

      // TD validation
      if (!r.tdNumber) {
        state = 'INVALID_TD';
        error = 'Missing TD Number';
      }

      // Barangay validation against Santa Rosa 33 Barangays
      const matchedBrgy = matchSantaRosaBarangay(r.rawBarangay);
      const barangay = matchedBrgy || r.rawBarangay || BARANGAYS[0];
      if (!matchedBrgy && r.rawBarangay) {
        state = 'INVALID_BARANGAY';
        error = `Unrecognized Barangay: "${r.rawBarangay}" (Must be one of Santa Rosa's 33)`;
      }

      // Property Class validation
      let propertyClass = r.rawPropertyClass || 'Residential';
      const matchedClass = PROPERTY_CLASSES.find(
        (c) => c.toLowerCase() === r.rawPropertyClass.toLowerCase()
      );
      if (matchedClass) {
        propertyClass = matchedClass;
      } else if (r.rawPropertyClass && !matchedClass) {
        state = 'INVALID_PROPERTY_CLASS';
        error = `Unrecognized Property Class: "${r.rawPropertyClass}"`;
      }

      // Numeric validation
      if (![r.lotAreaSqm, r.marketValue, r.assessedValue].every(Number.isFinite) || r.assessedValue < 0 || r.marketValue < 0 || r.lotAreaSqm < 0) {
        state = 'INVALID_NUMERIC_VALUE';
        error = 'Lot Area, Market Value, and Assessed Value must be valid non-negative numbers';
      }

      // Cadastral PIN format validation if provided
      if (!error && r.pin && r.pin.trim()) {
        const pinCheck = validatePin(r.pin);
        if (!pinCheck.isValid) {
          state = 'INVALID_NUMERIC_VALUE';
          error = pinCheck.error || 'Invalid Cadastral PIN format (024-XX-XXX-XX-XXX)';
        }
      }

      // "Last Import Wins" duplicate resolution within same CSV file
      if (!error && upperTd) {
        const lastLine = lastSeenIndexByTd.get(upperTd);
        if (lastLine !== undefined && lastLine !== r.line) {
          state = 'DUPLICATE_IN_FILE';
          error = `Superseded by line ${lastLine} ("Last Import Wins")`;
        }
      }

      // Match against existing database properties for Smart Upsert
      let existingProperty: Property | undefined;
      if (!error && state !== 'DUPLICATE_IN_FILE' && upperTd) {
        existingProperty = properties.find((p) => p.tdNumber.toUpperCase() === upperTd);

        if (existingProperty) {
          // Compare fields to detect diffs
          if (existingProperty.ownerName.trim().toUpperCase() !== r.ownerName.trim().toUpperCase()) {
            diffs.push({
              field: 'ownerName',
              label: 'Owner',
              oldVal: existingProperty.ownerName,
              newVal: r.ownerName,
            });
          }
          if (existingProperty.address.trim() !== r.address.trim()) {
            diffs.push({
              field: 'address',
              label: 'Address',
              oldVal: existingProperty.address,
              newVal: r.address,
            });
          }
          if (existingProperty.barangay !== barangay) {
            diffs.push({
              field: 'barangay',
              label: 'Barangay',
              oldVal: existingProperty.barangay,
              newVal: barangay,
            });
          }
          if (existingProperty.propertyClass !== propertyClass) {
            diffs.push({
              field: 'propertyClass',
              label: 'Class',
              oldVal: existingProperty.propertyClass,
              newVal: propertyClass,
            });
          }
          if (Math.abs(existingProperty.assessedValue - r.assessedValue) > 0.01) {
            diffs.push({
              field: 'assessedValue',
              label: 'Assessed Value',
              oldVal: `₱${existingProperty.assessedValue.toLocaleString()}`,
              newVal: `₱${r.assessedValue.toLocaleString()}`,
            });
          }
          if (Math.abs(existingProperty.marketValue - r.marketValue) > 0.01) {
            diffs.push({
              field: 'marketValue',
              label: 'Market Value',
              oldVal: `₱${existingProperty.marketValue.toLocaleString()}`,
              newVal: `₱${r.marketValue.toLocaleString()}`,
            });
          }
          if (Math.abs((existingProperty.lotAreaSqm || 0) - r.lotAreaSqm) > 0.01) {
            diffs.push({
              field: 'lotAreaSqm',
              label: 'Lot Area',
              oldVal: `${existingProperty.lotAreaSqm || 0} sqm`,
              newVal: `${r.lotAreaSqm} sqm`,
            });
          }

          if (diffs.length > 0) {
            state = 'VALID_UPDATE';
          } else {
            state = 'UNCHANGED';
          }
        } else {
          state = 'VALID_NEW';
        }
      }

      // Statutory Delinquency Start Year, Last Paid Year & Parcel Origin Resolution
      const parsedStart = r.rawStartYear ? parseInt(r.rawStartYear, 10) : NaN;
      const parsedPaid = r.rawLastPaid ? parseInt(r.rawLastPaid, 10) : NaN;
      const parsedOrigin = r.rawOriginYear ? parseInt(r.rawOriginYear, 10) : NaN;

      const parcelOriginYear: number | null = !isNaN(parsedOrigin) ? parsedOrigin : (existingProperty?.parcelOriginYear ?? null);

      let resolvedLastPaidYear: number;
      let resolvedDelinquencyStartYear: number | undefined;

      const hasStart = !isNaN(parsedStart) && parsedStart >= 1970 && parsedStart <= 2026;
      const hasPaid = !isNaN(parsedPaid) && parsedPaid >= 1970 && parsedPaid <= 2026;

      if (hasStart && hasPaid) {
        // Both columns provided: enforce strict consistency: start_year === last_paid_year + 1
        if (parsedStart !== parsedPaid + 1) {
          state = 'CONFLICTING_RECORD';
          error = `Conflicting columns: start_year (${parsedStart}) and last_paid_year (${parsedPaid}) disagree. Expected start_year = last_paid_year + 1. Routed to manual review.`;
          resolvedLastPaidYear = parsedPaid;
          resolvedDelinquencyStartYear = parsedStart;
        } else {
          resolvedLastPaidYear = parsedPaid;
          resolvedDelinquencyStartYear = parsedStart;
        }
      } else if (hasStart) {
        // Start year provided: last_paid_year = start_year - 1
        resolvedDelinquencyStartYear = parsedStart;
        resolvedLastPaidYear = parsedStart - 1;
      } else if (hasPaid) {
        // Last paid year provided: start_year = last_paid_year + 1
        resolvedLastPaidYear = parsedPaid;
        resolvedDelinquencyStartYear = parsedPaid + 1;
      } else if (existingProperty) {
        // Existing property: preserve recorded ledger
        resolvedLastPaidYear = existingProperty.lastPaidYear;
        resolvedDelinquencyStartYear = existingProperty.delinquencyStartYear ?? (existingProperty.lastPaidYear + 1);
      } else {
        // New property with neither column provided
        state = 'INVALID_NUMERIC_VALUE';
        error = `Missing or invalid Last Paid Year / Delinquency Start Year ("${r.rawLastPaid || r.rawStartYear || 'omitted'}"). Explicit statutory year (1970–2026) is required for new parcels to prevent unverified debt amnesty.`;
        resolvedLastPaidYear = 1973;
        resolvedDelinquencyStartYear = 1974;
      }

      // If existing property is updated, protect established payment history against overwrite
      if (existingProperty && state !== 'CONFLICTING_RECORD') {
        resolvedLastPaidYear = existingProperty.lastPaidYear;
        if (hasStart && !existingProperty.delinquencyStartYear) {
          resolvedDelinquencyStartYear = parsedStart;
        } else {
          resolvedDelinquencyStartYear = existingProperty.delinquencyStartYear ?? (existingProperty.lastPaidYear + 1);
        }
      }

      // Historical Gap Detection:
      // If delinquencyStartYear > effectiveOriginYear, flag unverified historical gap
      const effectiveOrigin = parcelOriginYear ?? HISTORICAL_BASELINE_YEAR;
      let hasHistoricalGap = false;
      let gapRange: string | undefined;
      if (resolvedDelinquencyStartYear && resolvedDelinquencyStartYear > effectiveOrigin) {
        hasHistoricalGap = true;
        gapRange = `${effectiveOrigin}–${resolvedDelinquencyStartYear - 1}`;
      }

      const isShell = getPropertyCompleteness({
        isShellRecord: false,
        pin: r.pin,
        assessedValue: r.assessedValue,
      }).isShellRecord;

      const resolvedEncoderLabel = existingProperty
        ? mergeEncoderLabel(existingProperty.encoderLabel, currentUser.name, false)
        : mergeEncoderLabel('', currentUser.name, false);
      const resolvedEntryType = existingProperty?.entryType || 'CSV_IMPORT';

      rows.push({
        line: r.line,
        tdNumber: r.tdNumber,
        previousTdNumber: r.previousTdNumber,
        pin: r.pin,
        ownerName: r.ownerName,
        address: r.address,
        barangay,
        propertyClass,
        lotAreaSqm: r.lotAreaSqm,
        marketValue: r.marketValue,
        assessedValue: r.assessedValue,
        lastPaidYear: resolvedLastPaidYear,
        delinquencyStartYear: resolvedDelinquencyStartYear,
        parcelOriginYear,
        hasHistoricalGap,
        gapRange,
        state,
        isShell,
        existingProperty,
        diffs,
        error: error || undefined,
        encoderLabel: resolvedEncoderLabel,
        entryType: resolvedEntryType,
      });
    }

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleParseCsv(text, file.name);
    };
    reader.readAsText(file);
  };

  // Download official Santa Rosa 33-Barangay template
  const handleDownloadTemplate = (filterBarangay = 'All') => {
    const header =
      'TD_Number,Previous_TD,PIN,Owner_Name,Address,Barangay,Property_Class,Lot_Area_Sqm,Market_Value,Assessed_Value,Last_Paid_Year,Delinquency_Start_Year,Parcel_Origin_Year\n';

    const targetBrgy = filterBarangay !== 'All' ? filterBarangay : 'Rizal (Poblacion)';
    const sampleRows = [
      `TD-SR-2026-001,TD-92-001,024-05-001-01-001,JUAN DELA CRUZ,"Lot 4 Blk 2, Rizal St.",${targetBrgy},Dwell House,250,500000,100000,2023,2024,`,
      `TD-SR-2026-002,TD-88-004,024-05-002-02-015,MARIA SANTOS,"Sitio Central",${filterBarangay !== 'All' ? targetBrgy : 'Aguinaldo'},Agricultural,2500,800000,320000,2025,2026,`,
      `TD-SR-2026-003,,024-05-006-03-099,SANTA ROSA MILLING CORP,"National Highway",${filterBarangay !== 'All' ? targetBrgy : 'San Isidro'},Industrial,1200,3500000,1750000,,2020,`,
      `TD-SR-2026-004,,024-05-008-01-042,AGRI DIESEL POWER INC,"Purok 3",${filterBarangay !== 'All' ? targetBrgy : 'La Fuente'},Machinery,100,600000,300000,2025,2026,2015`,
      `TD-SR-2026-005,TD-91-005,024-05-010-04-008,PEDRO PENDUKO,"Lot 10",${filterBarangay !== 'All' ? targetBrgy : 'Berang'},Residential,180,200000,40000,2022,2023,`,
    ].join('\n');

    const blob = new Blob([header + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Santa_Rosa_${filterBarangay !== 'All' ? filterBarangay.replace(/\s+/g, '_') : '33_Barangay'}_RPTAR_Template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMasterlist = () => {
    const header =
      'TD_Number,Previous_TD,PIN,Owner_Name,Address,Barangay,Property_Class,Lot_Area_Sqm,Market_Value,Assessed_Value,Last_Paid_Year,Status,Outstanding_Debt,Encoded_By,Entry_Type\n';
    const rows = properties
      .map((p) => {
        return [
          p.tdNumber,
          p.previousTdNumber || '',
          p.pin || '',
          p.ownerName,
          p.address,
          p.barangay,
          p.propertyClass,
          p.lotAreaSqm || 100,
          p.marketValue || 0,
          p.assessedValue,
          p.lastPaidYear,
          p.status || 'CLEARED',
          p.totalDebt || 0,
          p.encoderLabel || '',
          p.entryType || 'CSV_IMPORT',
        ].map(csvEscape).join(',');
      })
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Santa_Rosa_RPTAR_Masterlist_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCommitImport = async () => {
    // Process actionable rows (New, Update, or Unchanged)
    const actionableRows = parsedRows.filter(
      (r) => r.state === 'VALID_NEW' || r.state === 'VALID_UPDATE' || r.state === 'UNCHANGED'
    );
    if (actionableRows.length === 0) return;

    setIsProcessing(true);
    try {
      const payload = actionableRows.map((r) => ({
        tdNumber: r.tdNumber,
        previousTdNumber: r.previousTdNumber,
        pin: r.pin,
        ownerName: r.ownerName,
        address: r.address,
        barangay: r.barangay,
        propertyClass: r.propertyClass,
        lotAreaSqm: r.lotAreaSqm,
        marketValue: r.marketValue,
        assessedValue: r.assessedValue,
        lastPaidYear: r.lastPaidYear,
        delinquencyStartYear: r.delinquencyStartYear,
        parcelOriginYear: r.parcelOriginYear,
        isShellRecord: r.isShell,
        encoderLabel: r.encoderLabel,
        entryType: r.entryType,
      }));

      const importedBarangays = new Set(actionableRows.map(row => row.barangay));
      const detectedBarangay = selectedBarangayFilter !== 'All'
        ? selectedBarangayFilter
        : importedBarangays.size === 1 ? [...importedBarangays][0] : 'Multiple';

      const res = await api.bulkImportProperties(
        payload,
        currentUser.name,
        currentUser.stationId,
        {
          filename: uploadedFileName || `Santa_Rosa_Import_${new Date().toISOString().split('T')[0]}.csv`,
          barangay: detectedBarangay,
        }
      );

      setImportResult({
        inserted: res.insertedCount,
        updated: res.updatedCount,
        unchanged: res.unchangedCount,
        batchId: res.batchId,
      });

      setParsedRows([]);
      onImportComplete();
      await loadBatchHistory();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered rows for the staging table
  const filteredRows = useMemo(() => {
    return parsedRows.filter((row) => {
      const matchesBrgy =
        selectedBarangayFilter === 'All' || row.barangay === selectedBarangayFilter;
      const matchesState =
        stateFilter === 'ALL' ||
        (stateFilter === 'ACTIONABLE' &&
          (row.state === 'VALID_NEW' || row.state === 'VALID_UPDATE' || row.state === 'UNCHANGED')) ||
        row.state === stateFilter;
      return matchesBrgy && matchesState;
    });
  }, [parsedRows, selectedBarangayFilter, stateFilter]);

  // Counts
  const newCount = parsedRows.filter((r) => r.state === 'VALID_NEW').length;
  const updateCount = parsedRows.filter((r) => r.state === 'VALID_UPDATE').length;
  const unchangedCount = parsedRows.filter((r) => r.state === 'UNCHANGED').length;
  const duplicateCount = parsedRows.filter((r) => r.state === 'DUPLICATE_IN_FILE').length;
  const conflictingCount = parsedRows.filter((r) => r.state === 'CONFLICTING_RECORD').length;
  const historicalGapCount = parsedRows.filter((r) => r.hasHistoricalGap).length;
  const errorCount = parsedRows.filter(
    (r) =>
      r.state === 'INVALID_TD' ||
      r.state === 'INVALID_BARANGAY' ||
      r.state === 'INVALID_PROPERTY_CLASS' ||
      r.state === 'INVALID_NUMERIC_VALUE' ||
      r.state === 'CONFLICTING_RECORD'
  ).length;

  const totalActionable = newCount + updateCount + unchangedCount;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] p-0 flex flex-col overflow-hidden gap-0 border-slate-200 shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="bg-slate-900 px-6 py-4 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 rounded-xl shrink-0 shadow-inner">
                <FileSpreadsheet size={20} className="text-white" />
              </div>
              <div>
                <DialogTitle className="font-extrabold text-base leading-tight text-white flex items-center gap-2">
                  <span>Santa Rosa Assessor Import Center</span>
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-emerald-500/40 text-emerald-300 bg-emerald-500/10 font-mono">
                    33 Barangays • Smart Upsert
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Automated "Last Import Wins" Reconciliation, Assessment Staging & Ingestion Audit
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 text-xs font-bold gap-6 shrink-0">
          <button
            type="button"
            onClick={() => setTab('import')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              tab === 'import'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload size={14} />
            Smart CSV Staging & Upsert
            {parsedRows.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-mono font-bold">
                {parsedRows.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              tab === 'history'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderClock size={14} />
            Ingestion History & Folder
            {importBatches.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[10px] font-mono font-bold">
                {importBatches.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('export')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              tab === 'export'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download size={14} />
            Export RPTAR Masterlist
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {tab === 'import' && (
            <div className="space-y-4">
              {/* Financial Protection Notice Banner */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-900">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold text-emerald-950">Statutory Financial History Protection: </span>
                  Bulk CSV uploads update parcel assessments and valuations. Historical cashier payments and property{' '}
                  <code className="bg-emerald-100/80 px-1 py-0.5 rounded font-mono font-bold text-emerald-800">
                    last_paid_year
                  </code>{' '}
                  are strictly immutable and preserved against overwrite.
                </div>
              </div>

              {/* Upload & Barangay Filtering Control */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-sm">Upload Barangay Assessment CSV</p>
                  <p className="text-slate-500 text-[11px]">
                    Supports all <strong>33 Santa Rosa Barangays</strong>. Successive uploads for the same barangay automatically resolve conflicts via <em>"Last Import Wins"</em>.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Template download with Barangay selector */}
                  <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                    <select
                      value={selectedBarangayFilter}
                      onChange={(e) => setSelectedBarangayFilter(e.target.value)}
                      className="text-xs bg-transparent px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none cursor-pointer"
                      title="Filter by Santa Rosa Barangay"
                    >
                      <option value="All">All 33 Barangays</option>
                      {BARANGAYS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplate(selectedBarangayFilter)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border-l border-slate-300 flex items-center gap-1 text-[11px] transition-colors"
                      title="Download Santa Rosa CSV Template"
                    >
                      <Download size={12} />
                      Template
                    </button>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-sm"
                  >
                    <Upload size={13} />
                    Select CSV File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Import Result Alert */}
              {importResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl font-medium flex items-center gap-3 shadow-sm">
                  <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-emerald-950">
                      Batch Ingestion Successfully Completed!
                    </p>
                    <p className="text-emerald-800">
                      {importResult.inserted} New Parcels inserted • {importResult.updated} Existing Parcels updated • {importResult.unchanged} Unchanged records preserved
                      {importResult.batchId ? ` (Batch Ref #${importResult.batchId})` : ''}.
                    </p>
                  </div>
                </div>
              )}

              {/* Diagnostic Review Matrix */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  {/* KPI Summary Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-emerald-800">New Parcels</p>
                      <p className="text-base font-black text-emerald-950 font-mono mt-0.5">{newCount}</p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-blue-800">Updates (Diffs)</p>
                      <p className="text-base font-black text-blue-950 font-mono mt-0.5">{updateCount}</p>
                    </div>

                    <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-slate-600">Unchanged</p>
                      <p className="text-base font-black text-slate-800 font-mono mt-0.5">{unchangedCount}</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-amber-800">Superseded</p>
                      <p className="text-base font-black text-amber-950 font-mono mt-0.5">{duplicateCount}</p>
                    </div>

                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-rose-800">Errors (Skipped)</p>
                      <p className="text-base font-black text-rose-950 font-mono mt-0.5">{errorCount}</p>
                    </div>
                  </div>

                  {/* Staging Filter Controls */}
                  <div className="flex items-center justify-between gap-3 text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2">
                      <Filter size={13} className="text-slate-400" />
                      <span className="font-bold text-slate-700">Filter View:</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStateFilter('ALL')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            stateFilter === 'ALL'
                              ? 'bg-slate-800 text-white'
                              : 'bg-white text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          All ({parsedRows.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStateFilter('VALID_UPDATE')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            stateFilter === 'VALID_UPDATE'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          Updates ({updateCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStateFilter('VALID_NEW')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            stateFilter === 'VALID_NEW'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          New ({newCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStateFilter('DUPLICATE_IN_FILE')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            stateFilter === 'DUPLICATE_IN_FILE'
                              ? 'bg-amber-600 text-white'
                              : 'bg-white text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          Superseded ({duplicateCount})
                        </button>
                        {conflictingCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setStateFilter('CONFLICTING_RECORD')}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              stateFilter === 'CONFLICTING_RECORD'
                                ? 'bg-rose-700 text-white'
                                : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
                            }`}
                          >
                            Conflicting ({conflictingCount})
                          </button>
                        )}
                        {errorCount - conflictingCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setStateFilter('INVALID_TD')}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              stateFilter.startsWith('INVALID')
                                ? 'bg-rose-600 text-white'
                                : 'bg-white text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            Errors ({errorCount - conflictingCount})
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {historicalGapCount > 0 && (
                        <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <AlertTriangle size={11} className="text-amber-600" />
                          {historicalGapCount} with historical gap
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 font-mono">
                        Showing {filteredRows.length} of {parsedRows.length} rows
                      </span>
                    </div>
                  </div>

                  {/* Staging Matrix Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto bg-white shadow-inner">
                    <Table>
                      <TableHeader className="bg-slate-100 text-[10px] uppercase font-bold sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-14">Line</TableHead>
                          <TableHead>TD Number</TableHead>
                          <TableHead>Owner Name</TableHead>
                          <TableHead>Barangay & Class</TableHead>
                          <TableHead className="text-right">Assessed Val</TableHead>
                          <TableHead>Reconciliation State</TableHead>
                          <TableHead>Assessment Diffs</TableHead>
                          <TableHead>Attribution</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.map((row) => (
                          <TableRow
                            key={row.line}
                            className={`transition-colors ${
                              row.state === 'VALID_NEW'
                                ? 'hover:bg-emerald-50/40 bg-emerald-50/10'
                                : row.state === 'VALID_UPDATE'
                                ? 'hover:bg-blue-50/40 bg-blue-50/15 font-medium'
                                : row.state === 'UNCHANGED'
                                ? 'text-slate-600 hover:bg-slate-50'
                                : row.state === 'DUPLICATE_IN_FILE'
                                ? 'opacity-60 bg-amber-50/30'
                                : 'bg-rose-50/40'
                            }`}
                          >
                            <TableCell className="font-mono text-slate-400 text-[11px]">
                              {row.line}
                            </TableCell>
                            <TableCell className="font-mono font-bold text-slate-900">
                              {row.tdNumber || 'N/A'}
                            </TableCell>
                            <TableCell className="font-semibold text-slate-800 uppercase">
                              {row.ownerName || 'N/A'}
                            </TableCell>
                            <TableCell className="text-slate-600">
                              <span className="font-medium text-slate-800">{row.barangay}</span>
                              <span className="text-slate-400"> • </span>
                              <span className="text-slate-600">{row.propertyClass}</span>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-slate-900">
                              ₱{row.assessedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {row.state === 'VALID_NEW' && (
                                <Badge className="text-[9px] bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                                  New Parcel
                                </Badge>
                              )}
                              {row.state === 'VALID_UPDATE' && (
                                <Badge className="text-[9px] bg-blue-100 text-blue-800 border-blue-300 font-bold">
                                  Update ({row.diffs.length} {row.diffs.length === 1 ? 'diff' : 'diffs'})
                                </Badge>
                              )}
                              {row.state === 'UNCHANGED' && (
                                <Badge variant="outline" className="text-[9px] text-slate-500 font-medium">
                                  Unchanged
                                </Badge>
                              )}
                              {row.state === 'DUPLICATE_IN_FILE' && (
                                <Badge className="text-[9px] bg-amber-100 text-amber-800 border-amber-300 font-bold">
                                  Superseded
                                </Badge>
                              )}
                              {row.state === 'CONFLICTING_RECORD' && (
                                <Badge variant="destructive" className="text-[9px] font-bold bg-rose-600 text-white">
                                  ⚠️ Conflicting
                                </Badge>
                              )}
                              {row.state.startsWith('INVALID') && (
                                <Badge variant="destructive" className="text-[9px] font-bold">
                                  {row.error || 'Invalid'}
                                </Badge>
                              )}
                              {row.isShell && (
                                <Badge className="text-[9px] bg-amber-100 text-amber-900 border-amber-300 font-bold ml-1">
                                  ⚠️ RPTAR Req.
                                </Badge>
                              )}
                              {row.hasHistoricalGap && (
                                <Badge className="text-[9px] bg-amber-100 text-amber-900 border-amber-300 font-bold ml-1" title={`Billing begins in ${row.delinquencyStartYear}. Prior historical ledger (${row.gapRange}) preserved unverified pending physical RPTAR audit.`}>
                                  ⚠️ Starts {row.delinquencyStartYear} ({row.gapRange} Unverified)
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-[11px]">
                              {row.diffs.length > 0 ? (
                                <div className="space-y-0.5">
                                  {row.diffs.map((d, didx) => (
                                    <div key={didx} className="text-[10px] text-slate-600">
                                      <span className="font-bold text-slate-700">{d.label}: </span>
                                      <span className="line-through text-slate-400 mr-1">{d.oldVal}</span>
                                      <span className="text-blue-700 font-bold">→ {d.newVal}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : row.state === 'CONFLICTING_RECORD' ? (
                                <span className="text-rose-700 font-semibold text-[10px] flex items-center gap-1">
                                  {row.error}
                                </span>
                              ) : row.isShell ? (
                                <span className="text-amber-700 font-medium text-[10px] flex items-center gap-1">
                                  ⚠️ Pending Physical RPTAR Valuation
                                </span>
                              ) : row.hasHistoricalGap ? (
                                <span className="text-amber-800 font-medium text-[10px] flex items-center gap-1">
                                  Starts {row.delinquencyStartYear} • {row.gapRange} unverified
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10px]">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-[10px]">
                              {row.state === 'VALID_NEW' && (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {row.encoderLabel}
                                </span>
                              )}
                              {row.state === 'VALID_UPDATE' && (
                                <div className="space-y-0.5">
                                  <div className="text-slate-400 text-[9px]">
                                    Prev: {row.existingProperty?.encoderLabel || 'Unspecified'}
                                  </div>
                                  <div className="text-blue-800 font-semibold">
                                    {row.encoderLabel}
                                  </div>
                                </div>
                              )}
                              {row.state === 'UNCHANGED' && (
                                <span className="text-slate-500 text-[10px]">
                                  {row.encoderLabel || row.existingProperty?.encoderLabel || 'Existing'}
                                </span>
                              )}
                              {!['VALID_NEW', 'VALID_UPDATE', 'UNCHANGED'].includes(row.state) && (
                                <span className="text-slate-400 text-[10px]">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Assessor Ingestion Folder & Batch Logs</h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Historical record of CSV spreadsheets uploaded to Santa Rosa RPTAR masterlist.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadBatchHistory}
                  disabled={isLoadingBatches}
                  className="text-xs font-semibold gap-1.5"
                >
                  <RefreshCw size={12} className={isLoadingBatches ? 'animate-spin' : ''} />
                  Refresh History
                </Button>
              </div>

              {isLoadingBatches ? (
                <div className="p-12 text-center text-slate-400 font-medium">
                  <RefreshCw className="animate-spin inline-block mb-2 text-slate-400" size={24} />
                  <p>Loading historical ingestion batches...</p>
                </div>
              ) : importBatches.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-xl p-12 text-center space-y-2">
                  <FolderClock size={36} className="text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">No Import Batches Recorded Yet</p>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto">
                    When you commit a CSV import in the Staging tab, its batch record and row metrics will be cataloged here.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-100 text-[10px] uppercase font-bold">
                      <TableRow>
                        <TableHead>Batch ID</TableHead>
                        <TableHead>Filename</TableHead>
                        <TableHead>Barangay</TableHead>
                        <TableHead className="text-center">Total Rows</TableHead>
                        <TableHead className="text-center">New Inserted</TableHead>
                        <TableHead className="text-center">Updated</TableHead>
                        <TableHead className="text-center">Unchanged</TableHead>
                        <TableHead>Assessor</TableHead>
                        <TableHead>Imported Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importBatches.map((b) => (
                        <TableRow key={b.id || b.batchName} className="hover:bg-slate-50">
                          <TableCell className="font-mono font-bold text-slate-900">
                            #{b.id || b.batchName}
                          </TableCell>
                          <TableCell className="font-mono text-slate-700 text-xs">
                            <div className="flex items-center gap-1.5">
                              <FileText size={13} className="text-blue-600 shrink-0" />
                              <span className="truncate max-w-[180px]" title={b.filename}>{b.filename}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">
                            {b.barangay}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold">
                            {b.totalRows}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-emerald-700">
                            +{b.insertedRows}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-blue-700">
                            {b.updatedRows}
                          </TableCell>
                          <TableCell className="text-center font-mono text-slate-500">
                            {b.unchangedRows}
                          </TableCell>
                          <TableCell className="text-slate-700 text-xs">
                            {b.importedBy}
                          </TableCell>
                          <TableCell className="text-slate-500 font-mono text-[11px] whitespace-nowrap">
                            {b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {tab === 'export' && (
            <div className="space-y-4 text-center py-8">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-emerald-200 shadow-sm">
                <FileSpreadsheet size={32} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">Export Santa Rosa RPTAR Masterlist</h3>
                <p className="text-slate-500 text-xs">
                  Generate a complete municipal spreadsheet of all <strong>{properties.length} active parcels</strong>, assessed valuations, last paid years, and delinquent liabilities.
                </p>
              </div>

              <div className="pt-3">
                <Button
                  type="button"
                  onClick={handleExportMasterlist}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 mx-auto shadow-sm"
                >
                  <Download size={16} />
                  Download Complete Masterlist (.csv)
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex flex-row justify-between items-center shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold"
          >
            Close
          </Button>

          {tab === 'import' && parsedRows.length > 0 && totalActionable > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={handleCommitImport}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs gap-2 shadow-sm"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  Executing Smart Upsert Reconciliation...
                </>
              ) : (
                <>
                  Commit & Upsert {totalActionable} Records
                  <ArrowRight size={14} />
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <BreakdownAlertModal
      isOpen={!!importError}
      onClose={() => setImportError(null)}
      severity="error"
      title="Batch Import Failed"
      summary="The CSV import could not be committed to the masterlist. Any rows already processed were rolled back — the database was not modified."
      guidance="Common causes: a required column is missing, a TD Number is malformed, or a database connectivity issue occurred. Correct the CSV and re-upload. If the issue persists, contact the system administrator."
      technicalDetail={importError ?? undefined}
    />
  </>
  );
};

export default BulkImportModal;
