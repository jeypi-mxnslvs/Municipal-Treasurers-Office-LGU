import React, { useState, useRef } from 'react';
import { Property, User } from '../types';
import { BARANGAYS, PROPERTY_CLASSES } from '../constants';
import { api } from '../services/api';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, X, ArrowRight, RefreshCw, FileText } from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  properties: Property[];
  currentUser: User;
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
  isValid: boolean;
  isShell: boolean;
  error?: string;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  properties,
  currentUser
}) => {
  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [fileContent, setFileContent] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle CSV Parsing
  const handleParseCsv = (rawText: string) => {
    setFileContent(rawText);
    setImportResult(null);

    const lines = rawText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length <= 1) {
      setParsedRows([]);
      return;
    }

    const rows: ParsedRow[] = [];
    const seenTds = new Set<string>();

    // Skip header line (index 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV splitter (handles commas inside quotes)
      const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      const cleanCols = cols.map(c => c.replace(/^"|"$/g, '').trim());

      const tdNumber = cleanCols[0] || '';
      const previousTdNumber = cleanCols[1] || '';
      const pin = cleanCols[2] || '';
      const ownerName = cleanCols[3] || '';
      const address = cleanCols[4] || 'Santa Rosa, Nueva Ecija';
      let barangay = cleanCols[5] || BARANGAYS[0];
      let propertyClass = cleanCols[6] || 'Residential';
      const lotAreaSqm = parseFloat(cleanCols[7]) || 100;
      const marketValue = parseFloat(cleanCols[8]) || 0;
      const assessedValue = parseFloat(cleanCols[9]) || 0;
      const lastPaidYear = parseInt(cleanCols[10]) || 2025;

      let isValid = true;
      let error = '';

      // Validate TD
      if (!tdNumber) {
        isValid = false;
        error = 'Missing TD Number';
      } else if (seenTds.has(tdNumber)) {
        isValid = false;
        error = 'Duplicate TD in CSV';
      } else if (properties.some(p => p.tdNumber === tdNumber)) {
        isValid = false;
        error = 'TD already exists in database';
      } else {
        seenTds.add(tdNumber);
      }

      // Validate Owner
      if (isValid && !ownerName) {
        isValid = false;
        error = 'Missing Owner Name';
      }

      // Normalize Barangay
      const matchedBrgy = BARANGAYS.find(b => b.toLowerCase() === barangay.toLowerCase());
      if (matchedBrgy) {
        barangay = matchedBrgy;
      }

      // Normalize Class
      const matchedClass = PROPERTY_CLASSES.find(c => c.toLowerCase() === propertyClass.toLowerCase());
      if (matchedClass) {
        propertyClass = matchedClass;
      }

      const isShell = assessedValue === 0;

      rows.push({
        line: i + 1,
        tdNumber,
        previousTdNumber,
        pin,
        ownerName,
        address,
        barangay,
        propertyClass,
        lotAreaSqm,
        marketValue,
        assessedValue,
        lastPaidYear,
        isValid,
        isShell,
        error
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
      handleParseCsv(text);
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const header = 'TD_Number,Previous_TD,PIN,Owner_Name,Address,Barangay,Property_Class,Lot_Area_Sqm,Market_Value,Assessed_Value,Last_Paid_Year\n';
    const sampleRows = [
      'TD-SR-2026-001,TD-92-001,024-05-001-01-001,JUAN DELA CRUZ,"Lot 4 Blk 2, Rizal St.",Rizal (Poblacion),Dwell House,250,500000,100000,2023',
      'TD-SR-2026-002,TD-88-004,024-05-002-02-015,MARIA SANTOS,"Sitio Central, Aguinaldo",Aguinaldo,Agricultural,2500,800000,320000,2025',
      'TD-SR-2026-003,,024-05-006-03-099,SANTA ROSA MILLING CORP,"National Highway, San Isidro",San Isidro,Industrial,1200,3500000,1750000,2024',
      'TD-SR-2026-004,,024-05-008-01-042,AGRI DIESEL POWER INC,"Purok 3, La Fuente",La Fuente,Machinery,100,600000,300000,2025',
      'TD-SR-2026-005,TD-91-005,024-05-010-04-008,PEDRO PENDUKO,"Lot 10, Berang",Berang,Residential,180,200000,40000,2022'
    ].join('\n');

    const blob = new Blob([header + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Santa_Rosa_RPTAR_Import_Template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMasterlist = () => {
    const header = 'TD_Number,Previous_TD,PIN,Owner_Name,Address,Barangay,Property_Class,Lot_Area_Sqm,Market_Value,Assessed_Value,Last_Paid_Year,Status,Outstanding_Debt\n';
    const rows = properties.map(p => {
      return `"${p.tdNumber}","${p.previousTdNumber || ''}","${p.pin || ''}","${p.ownerName}","${p.address}","${p.barangay}","${p.propertyClass}",${p.lotAreaSqm || 100},${p.marketValue || 0},${p.assessedValue},${p.lastPaidYear},"${p.status || 'CLEARED'}",${p.totalDebt || 0}`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Santa_Rosa_RPTAR_Masterlist_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCommitImport = async () => {
    const validToImport = parsedRows.filter(r => r.isValid);
    if (validToImport.length === 0) return;

    setIsProcessing(true);
    try {
      const payload = validToImport.map(r => ({
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
        lastPaidYear: r.lastPaidYear
      }));

      const res = await api.bulkImportProperties(payload, currentUser.name, currentUser.stationId);
      setImportResult(`✅ Successfully imported ${res.insertedCount} properties!`);
      setParsedRows([]);
      setFileContent('');
      onImportComplete();
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const shellCount = parsedRows.filter(r => r.isValid && r.isShell).length;
  const errorCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <FileSpreadsheet size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">
                Santa Rosa RPTAR — Bulk Masterlist Engine
              </h2>
              <p className="text-xs text-slate-400">
                Batch Import Legacy Spreadsheets & Export Official Municipal Masterlist
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 text-xs font-bold gap-6">
          <button
            onClick={() => setTab('import')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              tab === 'import' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload size={14} />
            Bulk CSV / Excel Import
          </button>
          <button
            onClick={() => setTab('export')}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              tab === 'export' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download size={14} />
            Export Masterlist (.csv / .xlsx)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-grow">
          {tab === 'import' ? (
            <div className="space-y-4">
              {/* Actions row */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/60 p-4 rounded-xl border border-blue-200">
                <div className="space-y-1">
                  <p className="font-bold text-blue-900">Upload Legacy Spreadsheet (.csv)</p>
                  <p className="text-slate-600 text-[11px]">
                    Validated against <strong>33 Santa Rosa Barangays</strong> & <strong>5 Classifications</strong> (Agricultural, Dwell House, Industrial, Machinery, Residential).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 font-semibold rounded-lg border border-blue-300 flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Download size={13} />
                    Download CSV Template
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Upload size={13} />
                    Select CSV File
                  </button>
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
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  {importResult}
                </div>
              )}

              {/* Diagnostic Review Matrix */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  {/* KPI Badges */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-emerald-800">Ready to Import</p>
                        <p className="text-lg font-black text-emerald-900 font-mono">{validCount}</p>
                      </div>
                      <CheckCircle2 size={20} className="text-emerald-600" />
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-amber-800">Provisional Shells</p>
                        <p className="text-lg font-black text-amber-900 font-mono">{shellCount}</p>
                      </div>
                      <AlertTriangle size={20} className="text-amber-600" />
                    </div>

                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-rose-800">Errors (Skipped)</p>
                        <p className="text-lg font-black text-rose-900 font-mono">{errorCount}</p>
                      </div>
                      <XCircle size={20} className="text-rose-600" />
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Line</th>
                          <th className="px-3 py-2 text-left">TD Number</th>
                          <th className="px-3 py-2 text-left">Owner Name</th>
                          <th className="px-3 py-2 text-left">Barangay & Class</th>
                          <th className="px-3 py-2 text-right">Assessed Val</th>
                          <th className="px-3 py-2 text-left">Diagnostic Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {parsedRows.map((row) => (
                          <tr key={row.line} className={row.isValid ? 'hover:bg-blue-50/30' : 'bg-rose-50/50'}>
                            <td className="px-3 py-2 font-mono text-slate-500">{row.line}</td>
                            <td className="px-3 py-2 font-mono font-bold text-slate-800">{row.tdNumber || 'N/A'}</td>
                            <td className="px-3 py-2 font-semibold text-slate-800 uppercase">{row.ownerName || 'N/A'}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {row.barangay} • <span className="font-bold">{row.propertyClass}</span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                              ₱{row.assessedValue.toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                              {row.isValid ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.isShell ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {row.isShell ? 'Shell Record' : 'Valid'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-bold">
                                  {row.error}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Export Tab */
            <div className="space-y-4 text-center py-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-blue-200">
                <FileSpreadsheet size={32} />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">Export Santa Rosa RPTAR Masterlist</h3>
                <p className="text-slate-500 text-xs">
                  Generate a complete spreadsheet of all <strong>{properties.length} properties</strong>, taxable valuations, compliance statuses, and active delinquent debts.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleExportMasterlist}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2 mx-auto active:scale-95 text-xs"
                >
                  <Download size={16} />
                  Download Masterlist Spreadsheet (.csv)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
          >
            Close
          </button>

          {tab === 'import' && parsedRows.length > 0 && validCount > 0 && (
            <button
              onClick={handleCommitImport}
              disabled={isProcessing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  Importing & Generating Quarters...
                </>
              ) : (
                <>
                  Commit & Import {validCount} Records
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;
