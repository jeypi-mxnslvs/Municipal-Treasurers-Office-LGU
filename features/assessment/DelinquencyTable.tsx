import React, { useState, useEffect, useRef } from 'react';
import { TaxYearRecord, TaxSummary, Property, User } from '@/types';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Tag, Calendar, CheckSquare, Layers, Sparkles, Pencil, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/services/api';

interface DelinquencyTableProps {
  records: TaxYearRecord[];
  completedRecords?: TaxYearRecord[];
  summary?: TaxSummary;
  grandTotal?: number;
  canEdit?: boolean;
  property?: Property | null;
  currentUser?: User | null;
  onSelectionChange?: (selected: TaxYearRecord[], subtotal: number) => void;
}

type EditableField = 'BASIC_TAX' | 'SEF_TAX' | 'DISCOUNT_RATE' | 'ASSESSED_VALUE';
type OrganizerTab = 'OUTSTANDING' | 'COMPLETED' | 'ALL';

const DelinquencyTable: React.FC<DelinquencyTableProps> = ({ 
  records: initialRecords, 
  completedRecords = [],
  summary: _summary, 
  grandTotal: _grandTotal,
  canEdit = true,
  property,
  currentUser,
  onSelectionChange 
}) => {
  // Local mutable records state to support dynamic assessor overrides
  const [records, setRecords] = useState<TaxYearRecord[]>(initialRecords);

  useEffect(() => {
    setRecords(initialRecords);
  }, [initialRecords]);

  // Active Organizer Tab State
  const [activeTab, setActiveTab] = useState<OrganizerTab>('OUTSTANDING');

  // Auto-focus COMPLETED if outstanding is empty but completed records exist
  useEffect(() => {
    if (records.length === 0 && completedRecords.length > 0) {
      setActiveTab('COMPLETED');
    } else if (records.length > 0 && activeTab === 'COMPLETED' && completedRecords.length === 0) {
      setActiveTab('OUTSTANDING');
    }
  }, [records.length, completedRecords.length, activeTab]);

  // Store selected index range (from index 0 up to selectedMaxIndex inclusive) for outstanding records
  const [selectedMaxIndex, setSelectedMaxIndex] = useState<number>(records.length - 1);

  // Default to selecting all records whenever new records load
  useEffect(() => {
    setSelectedMaxIndex(records.length - 1);
  }, [records.length]);

  // Identify unverified historical records
  const unverifiedRecords = React.useMemo(
    () => records.filter(r => r.isUnverifiedHistorical),
    [records]
  );
  const hasHistoricalGap = unverifiedRecords.length > 0 || Boolean(property?.hasUnverifiedPriorHistory);

  // Collapsible state: default true (collapsed) when >= 3 unverified records exist
  const [isHistoricalRollCollapsed, setIsHistoricalRollCollapsed] = useState<boolean>(true);

  // Compute selected subset for outstanding records (strictly excludes unverified historical records)
  const selectedRecords = React.useMemo(
    () => records
      .slice(0, selectedMaxIndex + 1)
      .filter(r => !r.isUnverifiedHistorical && r.isPayable !== false && r.totalDue !== null),
    [records, selectedMaxIndex]
  );
  const selectedSubtotal = React.useMemo(
    () => selectedRecords.reduce((sum, r) => sum + (r.totalDue || 0), 0),
    [selectedRecords]
  );
  const selectedBasicTax = selectedRecords.reduce((sum, r) => sum + (r.basicTax || ((r.baseTax ?? 0) / 2) || 0), 0);
  const selectedSefTax = selectedRecords.reduce((sum, r) => sum + (r.sefTax || ((r.baseTax ?? 0) / 2) || 0), 0);
  const selectedPenalties = selectedRecords.reduce((sum, r) => sum + (r.penaltyAmount || 0), 0);
  const selectedDiscounts = selectedRecords.reduce((sum, r) => sum + (r.discountAmount || 0), 0);

  // Aggregates for completed / settled records
  const completedTotalDue = React.useMemo(
    () => completedRecords.reduce((sum, r) => sum + (r.totalDue || 0), 0),
    [completedRecords]
  );
  const completedBasicTax = React.useMemo(
    () => completedRecords.reduce((sum, r) => sum + (r.basicTax || ((r.baseTax ?? 0) / 2) || 0), 0),
    [completedRecords]
  );
  const completedSefTax = React.useMemo(
    () => completedRecords.reduce((sum, r) => sum + (r.sefTax || ((r.baseTax ?? 0) / 2) || 0), 0),
    [completedRecords]
  );
  const completedPenalties = React.useMemo(
    () => completedRecords.reduce((sum, r) => sum + (r.penaltyAmount || 0), 0),
    [completedRecords]
  );
  const completedDiscounts = React.useMemo(
    () => completedRecords.reduce((sum, r) => sum + (r.discountAmount || 0), 0),
    [completedRecords]
  );

  // Active list of records to render based on selected organizer tab
  const displayedRecords = React.useMemo(() => {
    let list: TaxYearRecord[];
    if (activeTab === 'COMPLETED') {
      list = completedRecords;
    } else if (activeTab === 'ALL') {
      const combined = [...completedRecords, ...records];
      list = combined.sort((a, b) => a.year - b.year);
    } else {
      list = records;
    }

    if (isHistoricalRollCollapsed && unverifiedRecords.length >= 3 && activeTab !== 'COMPLETED') {
      return list.filter(r => !r.isUnverifiedHistorical);
    }
    return list;
  }, [activeTab, completedRecords, records, isHistoricalRollCollapsed, unverifiedRecords.length]);

  // Modal state for manual assessor override
  const [editingRecord, setEditingRecord] = useState<TaxYearRecord | null>(null);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [rptarRefInput, setRptarRefInput] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stable callback ref to avoid effect recreation loops
  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  // Notify parent component of selection updates
  useEffect(() => {
    if (onSelectionChangeRef.current) {
      onSelectionChangeRef.current(selectedRecords, selectedSubtotal);
    }
  }, [selectedRecords, selectedSubtotal]);

  // If no records exist in either outstanding or completed
  if (records.length === 0 && completedRecords.length === 0) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Account Fully Cleared</h3>
          <p className="text-slate-500 text-sm mt-1">This property has no recorded outstanding or historical tax obligations.</p>
        </CardContent>
      </Card>
    );
  }

  // Quick Scope Helpers
  const handleSelectOldestYear = () => {
    setSelectedMaxIndex(0);
  };

  const handleSelectAll = () => {
    setSelectedMaxIndex(records.length - 1);
  };

  const handleCheckboxClick = (index: number) => {
    setSelectedMaxIndex(index);
  };

  // Open the override modal for a specific record and field
  const handleOpenEditModal = (record: TaxYearRecord, field: EditableField, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRecord(record);
    setEditingField(field);
    setErrorMessage(null);
    setEditReason('');
    setRptarRefInput(record.rptarReference || '');

    if (field === 'ASSESSED_VALUE') {
      setEditValue(record.assessedValue !== undefined && record.assessedValue > 0 ? String(record.assessedValue) : '');
      if (record.isUnverifiedHistorical) {
        setEditReason('Physical RPTAR Ledger Transcription');
      }
    } else if (field === 'BASIC_TAX') {
      setEditValue(String(record.basicTax ?? ((record.baseTax ?? 0) / 2)));
    } else if (field === 'SEF_TAX') {
      setEditValue(String(record.sefTax ?? ((record.baseTax ?? 0) / 2)));
    } else if (field === 'DISCOUNT_RATE') {
      setEditValue(String(((record.discountRate ?? 0) * 100).toFixed(2)));
    }
  };

  // Apply the manual adjustment with live recalculation and audit trail dispatch
  const handleSaveOverride = async () => {
    if (!editingRecord || !editingField) return;

    if (!editReason.trim()) {
      setErrorMessage('A mandatory justification is required under Philippine statutory audit rules.');
      return;
    }

    const numericVal = parseFloat(editValue);
    if (isNaN(numericVal) || numericVal < 0) {
      setErrorMessage('Please enter a valid non-negative number.');
      return;
    }

    let finalAssessedValue = editingRecord.assessedValue;
    let finalRptarReference = editingRecord.rptarReference;
    let isMissingValuation = editingRecord.isMissingValuation;
    let finalBasicTax = editingRecord.basicTax ?? ((editingRecord.baseTax ?? 0) / 2);
    let finalSefTax = editingRecord.sefTax ?? ((editingRecord.baseTax ?? 0) / 2);
    let finalDiscountRate = editingRecord.discountRate ?? 0;
    let originalValue = 0;
    let newValue = 0;

    if (editingField === 'ASSESSED_VALUE') {
      originalValue = editingRecord.assessedValue ?? 0;
      newValue = numericVal;
      finalAssessedValue = numericVal;
      finalRptarReference = rptarRefInput.trim() || undefined;
      isMissingValuation = numericVal <= 0;

      const yearsMultiplier = editingRecord.yearsCovered?.length || (editingRecord.quarterSpan ? 0.5 : 1);
      finalBasicTax = isMissingValuation ? 0 : Math.round(numericVal * 0.01 * yearsMultiplier * 100) / 100;
      finalSefTax = isMissingValuation ? 0 : Math.round(numericVal * 0.01 * yearsMultiplier * 100) / 100;
    } else if (editingField === 'BASIC_TAX') {
      originalValue = editingRecord.systemBasicTax ?? ((editingRecord.baseTax ?? 0) / 2);
      newValue = numericVal;
      finalBasicTax = numericVal;
    } else if (editingField === 'SEF_TAX') {
      originalValue = editingRecord.systemSefTax ?? ((editingRecord.baseTax ?? 0) / 2);
      newValue = numericVal;
      finalSefTax = numericVal;
    } else if (editingField === 'DISCOUNT_RATE') {
      originalValue = editingRecord.systemDiscountRate ?? 0;
      newValue = numericVal / 100;
      finalDiscountRate = numericVal / 100;
    }

    // Recalculate derived fields
    const appliedBaseTax = Math.round((finalBasicTax + finalSefTax) * 100) / 100;
    const penaltyAmount = isMissingValuation ? 0 : Math.round(appliedBaseTax * editingRecord.penaltyRate * 100) / 100;
    const discountAmount = isMissingValuation ? 0 : Math.round(appliedBaseTax * finalDiscountRate * 100) / 100;
    const totalDue = isMissingValuation ? 0 : Math.max(0, Math.round((appliedBaseTax + penaltyAmount - discountAmount) * 100) / 100);
    const isPayable = !isMissingValuation;

    const updatedRecord: TaxYearRecord = {
      ...editingRecord,
      assessedValue: finalAssessedValue,
      isMissingValuation,
      isUnverifiedHistorical: isMissingValuation ? Boolean(editingRecord.isUnverifiedHistorical) : false,
      rptarReference: finalRptarReference,
      basicTax: finalBasicTax,
      sefTax: finalSefTax,
      baseTax: appliedBaseTax,
      penaltyAmount,
      discountRate: finalDiscountRate,
      discountAmount,
      totalDue,
      isPayable,
      isManuallyEdited: true,
      editReason: editReason.trim(),
    };

    // Update state using composite period key to avoid collision on split-quarter periods (e.g. 2026 1-2Q vs 2026 3-4 Q)
    const targetKey = editingRecord.periodLabel || String(editingRecord.year);
    setRecords(prev => prev.map(r => {
      const recordKey = r.periodLabel || String(r.year);
      return recordKey === targetKey ? updatedRecord : r;
    }));

    // If transcribing historical AV, persist permanently to database
    if (property?.id && editingField === 'ASSESSED_VALUE' && numericVal > 0) {
      try {
        await api.saveHistoricalAssessedValue({
          propertyId: property.id,
          periodLabel: editingRecord.periodLabel || String(editingRecord.year),
          value: numericVal,
          rptarPageReference: rptarRefInput.trim() || undefined,
          assessorName: currentUser?.name || 'Authorized Assessor',
          reason: editReason.trim(),
        });
      } catch (saveErr) {
        console.error('Failed to persist historical assessed value to database:', saveErr);
      }
    }

    // Log individual field-level audit record
    if (property?.tdNumber) {
      await api.logFieldOverrideAudit({
        propertyId: property.id,
        tdNumber: property.tdNumber,
        taxYear: editingRecord.year,
        fieldChanged: editingRecord.periodLabel ? `${editingField} (${editingRecord.periodLabel})` : editingField,
        originalValue,
        newValue,
        reason: editReason.trim(),
        assessorName: currentUser?.name || 'Authorized Assessor',
        stationId: currentUser?.stationId || 'Assessor-Desk-02',
        userId: typeof currentUser?.id === 'number' ? currentUser.id : undefined,
        userRole: currentUser?.role,
      });
    }

    // Close modal
    setEditingField(null);
    setEditingRecord(null);
  };

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-fade-in-up">
      {/* Header & Sequential Scope Selector */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/80 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-emerald-600" />
            <h3 className="text-slate-800 font-bold text-sm">
              Sequential Statement of Account (RA 7160 Arrears-First)
            </h3>
          </div>
          <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
            <Calendar size={12} /> {records.length > 0 ? `${records.length} ${records.length === 1 ? 'Tax Year Owed' : 'Tax Years Owed'}` : `${completedRecords.length} ${completedRecords.length === 1 ? 'Tax Year Settled' : 'Tax Years Settled'}`}
          </Badge>
        </div>

        {/* Organizer Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('OUTSTANDING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'OUTSTANDING'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Outstanding Dues</span>
              <Badge variant={records.length > 0 ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 font-bold">
                {records.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'COMPLETED'
                  ? 'bg-white text-emerald-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 size={12} className="text-emerald-600" />
              <span>Completed Dues</span>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5 py-0 font-bold">
                {completedRecords.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={12} className="text-slate-500" />
              <span>All History</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
                {records.length + completedRecords.length}
              </Badge>
            </button>
          </div>

          {/* Account status indicator */}
          {records.length === 0 && completedRecords.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-300 font-bold">
              <CheckCircle2 size={13} className="text-emerald-600" />
              Account Fully Cleared — Good Standing
            </div>
          )}
        </div>

        {/* 1-Click Scope Buttons (Visible when activeTab is Outstanding or All with outstanding records) */}
        {activeTab !== 'COMPLETED' && records.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/70 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px] mr-1">
              Payment Scope:
            </span>
            <Button
              type="button"
              variant={selectedMaxIndex === 0 ? "default" : "outline"}
              size="sm"
              onClick={handleSelectOldestYear}
              className="h-8 gap-1.5 rounded-lg text-xs"
            >
              <CheckSquare size={13} />
              Pay Oldest Period ({records[0]?.periodLabel || records[0]?.year})
            </Button>

            {records.length > 2 && (
              <Button
                type="button"
                variant={
                  selectedMaxIndex === records.length - 2
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => setSelectedMaxIndex(records.length - 2)}
                className="h-8 gap-1.5 rounded-lg text-xs"
              >
                <Layers size={13} />
                Pay Prior Arrears (Excl. Current Year)
              </Button>
            )}

            {records.length > 1 && (
              <Button
                type="button"
                variant={selectedMaxIndex === records.length - 1 ? "default" : "outline"}
                size="sm"
                onClick={handleSelectAll}
                className="h-8 gap-1.5 rounded-lg text-xs"
              >
                <Sparkles size={13} />
                Pay All Dues ({records.length} {records.length === 1 ? 'Period' : 'Periods'})
              </Button>
            )}
          </div>
        )}

        {/* Historical Gap Alert Banner */}
        {hasHistoricalGap && (
          <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
            <div className="space-y-0.5 flex-1">
              <div className="font-bold flex items-center justify-between">
                <span>
                  Historical Delinquency Gap Detected ({property?.parcelOriginYear || 1971}–{(property?.delinquencyStartYear || 2026) - 1})
                </span>
                <Badge variant="outline" className="text-[10px] font-bold bg-amber-100 text-amber-900 border-amber-400">
                  Physical RPTAR Audit Required
                </Badge>
              </div>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                Digital import for this parcel begins in tax year <strong>{property?.delinquencyStartYear || 'modern roll'}</strong>. Prior historical assessment rolls from <strong>{property?.parcelOriginYear || 1971}</strong> to <strong>{(property?.delinquencyStartYear || 2026) - 1}</strong> are retained as unverified records. Payments cannot be posted for unverified periods until valuations are transcribed from physical RPTAR archive books.
              </p>
            </div>
          </div>
        )}

        {/* Informative Subtitle for Completed Tab */}
        {activeTab === 'COMPLETED' && (
          <div className="pt-1 text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 border-t border-slate-200/70">
            <span>Showing settled tax liabilities ({completedRecords.length} {completedRecords.length === 1 ? 'tax year' : 'tax years'} cleared).</span>
            <span className="font-semibold text-emerald-700">Official Municipal Receipts & Masterlist Baseline</span>
          </div>
        )}
      </div>

      {/* Historical Ledger Collapsible Header (if >= 3 unverified records) */}
      {unverifiedRecords.length >= 3 && activeTab !== 'COMPLETED' && (
        <div className="px-4 py-2 bg-amber-50/70 border-b border-amber-200/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
              Archive Roll
            </Badge>
            <span className="font-bold text-slate-800">
              Historical Ledger ({property?.parcelOriginYear || 1971}–{(property?.delinquencyStartYear || 2026) - 1}):
            </span>
            <span className="text-slate-600 text-[11px]">
              {unverifiedRecords.length} period(s) pending physical RPTAR audit
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsHistoricalRollCollapsed(prev => !prev)}
            className="h-7 text-xs font-semibold text-amber-900 hover:bg-amber-100/80 cursor-pointer gap-1"
          >
            {isHistoricalRollCollapsed ? (
              <>
                <span>Expand {unverifiedRecords.length} Unverified Rows</span>
                <ChevronDown size={14} />
              </>
            ) : (
              <>
                <span>Collapse Historical Rows</span>
                <ChevronUp size={14} />
              </>
            )}
          </Button>
        </div>
      )}
      
      {/* Itemized Table - Scrollable container for multi-year delinquency rolls (e.g. 1971-2026) */}
      <div className="overflow-y-auto overflow-x-auto max-h-[560px] flex-grow relative">
        <Table className="w-full min-w-[780px] table-fixed text-sm font-sans">
          <TableHeader className="bg-slate-100/95 backdrop-blur-xs sticky top-0 z-10 shadow-2xs">
            <TableRow className="hover:bg-transparent border-b border-slate-200">
              <TableHead className="w-[4%] min-w-[36px] text-center font-bold text-slate-700 uppercase tracking-wider text-[11px] py-3 pl-3 pr-2">Select</TableHead>
              <TableHead className="w-[14%] min-w-[125px] text-left font-bold text-slate-700 uppercase tracking-wider text-[11px] py-3 pl-2 pr-1.5">Period & Status</TableHead>
              <TableHead className="w-[13%] min-w-[105px] text-right font-bold text-slate-700 uppercase tracking-wider text-[11px] py-3 px-1.5">Assessed Value</TableHead>
              <TableHead className="w-[13%] min-w-[100px] text-right font-bold text-slate-700 uppercase tracking-wider text-[11px] py-3 px-1.5">Basic (1%)</TableHead>
              <TableHead className="w-[13%] min-w-[100px] text-right font-bold text-slate-700 uppercase tracking-wider text-[11px] py-3 px-1.5">SEF (1%)</TableHead>
              <TableHead className="w-[14%] min-w-[100px] text-right font-bold text-slate-700 uppercase tracking-wider text-[11px] py-3 px-1.5">
                Penalty <span className="text-slate-500 font-normal text-[10px]">(Rate)</span>
              </TableHead>
              <TableHead className="w-[11%] min-w-[80px] text-right font-bold text-slate-700 uppercase tracking-wider text-[11px] py-3 px-1.5">Discount</TableHead>
              <TableHead className="w-[18%] min-w-[130px] text-right font-bold text-slate-800 uppercase tracking-wider text-[11px] py-3 pl-2 pr-6">Net Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {displayedRecords.map((record, idx) => {
              const isCleared = record.status === 'Cleared';
              const isDelinquent = record.status === 'Delinquent';
              const isUnassessed = Boolean(record.isMissingValuation || record.isUnverifiedHistorical || record.baseTax === null);
              const hasDiscount = Boolean(record.discountAmount && record.discountAmount > 0);

              const isBasicOverridden = !isCleared && record.systemBasicTax !== undefined && record.basicTax !== record.systemBasicTax;
              const isSefOverridden = !isCleared && record.systemSefTax !== undefined && record.sefTax !== record.systemSefTax;
              const isDiscountOverridden = !isCleared && record.systemDiscountRate !== undefined && record.discountRate !== record.systemDiscountRate;

              // Find index in outstanding records for Arrears-First sequential selection
              const outstandingIndex = records.findIndex(r => 
                (r.periodLabel && record.periodLabel) 
                  ? r.periodLabel === record.periodLabel 
                  : r.year === record.year
              );
              const isSelected = !isCleared && outstandingIndex !== -1 && outstandingIndex <= selectedMaxIndex;

              return (
                <TableRow 
                  key={record.periodLabel ? `${record.year}-${record.periodLabel}-${idx}` : `${record.year}-${idx}`} 
                  onClick={() => !isCleared && !isUnassessed && outstandingIndex !== -1 && handleCheckboxClick(outstandingIndex)}
                  className={`transition-colors ${
                    isCleared
                      ? 'bg-slate-50/60 hover:bg-slate-100/60 cursor-default'
                      : isUnassessed
                        ? 'bg-amber-50/20 hover:bg-amber-50/40 cursor-default'
                        : isSelected 
                          ? 'bg-emerald-50/40 hover:bg-emerald-50/60 font-medium cursor-pointer' 
                          : 'opacity-40 hover:opacity-75 bg-slate-50/20 cursor-pointer'
                  }`}
                >
                  {/* 1. Selection Checkbox */}
                  <TableCell className="text-center py-2.5 pl-3 pr-2">
                    {isCleared ? (
                      <span title={`Cleared / Settled (${record.clearanceReference || 'Official Settlement'})`}>
                        <CheckCircle2 size={16} className="text-emerald-600 inline-block" />
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected && !isUnassessed}
                        disabled={isUnassessed}
                        onChange={() => !isUnassessed && outstandingIndex !== -1 && handleCheckboxClick(outstandingIndex)}
                        title={record.isUnverifiedHistorical ? "Unverified historical period. Valuation must be transcribed from physical RPTAR." : isUnassessed ? "Must verify historical Assessed Value from Physical RPTAR before selecting." : undefined}
                        className="w-4.5 h-4.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 transition-transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    )}
                  </TableCell>

                  {/* 2. Period & Integrated Status (Tightly Proportioned) */}
                  <TableCell className="font-bold text-slate-900 py-2.5 pl-2 pr-1.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-xs sm:text-sm font-extrabold tracking-tight tabular-nums ${isCleared ? 'text-slate-700' : 'text-slate-900'}`}>
                          {record.periodLabel || record.year}
                        </span>
                        {isCleared ? (
                          <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0 bg-emerald-100 text-emerald-800 border-emerald-300">
                            ✓ Cleared
                          </Badge>
                        ) : record.isUnverifiedHistorical ? (
                          <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0 bg-amber-100 text-amber-900 border-amber-400">
                            ⚠️ Unverified
                          </Badge>
                        ) : isDelinquent ? (
                          <Badge variant="destructive" className="text-[10px] font-bold px-1.5 py-0 bg-rose-100 text-rose-800 border-rose-300">
                            Delq
                          </Badge>
                        ) : (
                          <Badge variant="default" className="text-[10px] font-bold px-1.5 py-0 bg-blue-100 text-blue-800 border-blue-300">
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {record.yearsCovered && record.yearsCovered.length > 1 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-semibold tracking-tight whitespace-nowrap">
                            {record.yearsCovered.length} Yrs
                          </span>
                        )}
                        {record.quarter && !record.quarterSpan && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold">
                            Q{record.quarter}
                          </span>
                        )}
                        {record.receiptNo && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-emerald-50 text-emerald-800 border-emerald-300 font-bold" title={`Issued Receipt: ${record.receiptNo}`}>
                            OR #{record.receiptNo}
                          </Badge>
                        )}
                        {record.isManuallyEdited && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-800 border-amber-300 font-bold" title={record.editReason || 'Assessor adjusted'}>
                            Adj
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* 3. Assessed Value */}
                  <TableCell className="text-right py-2.5 px-1.5">
                    {isUnassessed ? (
                      <div className="flex items-center justify-end gap-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-800 border-amber-300 font-bold font-mono">
                          ⚠️ Unset (RPTAR)
                        </Badge>
                        {canEdit && !isCleared && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleOpenEditModal(record, 'ASSESSED_VALUE', e)}
                            className="h-6 px-1.5 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-xs cursor-pointer"
                            title="Input historical Assessed Value from Physical RPTAR"
                          >
                            + AV
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center justify-end gap-1">
                          <span className={`text-xs sm:text-sm font-bold tabular-nums ${isCleared ? 'text-slate-700' : 'text-slate-900'}`}>
                            ₱{(record.assessedValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          {canEdit && !isCleared && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditModal(record, 'ASSESSED_VALUE', e)}
                              className="text-slate-400 hover:text-blue-700 p-0.5 rounded transition-colors cursor-pointer"
                              title="Adjust Assessed Value (Physical RPTAR)"
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                        {record.rptarReference && (
                          <span className="text-[9px] text-emerald-700 font-medium tracking-tight truncate max-w-[130px]" title={record.rptarReference}>
                            ✓ {record.rptarReference}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>

                  {/* 4. Basic Tax (1%) */}
                  <TableCell className="text-right py-2.5 px-1.5">
                    {isUnassessed ? (
                      <span className="text-slate-400 font-mono italic text-xs">Pending AV</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center justify-end gap-1">
                          <span className={`text-xs sm:text-sm font-bold tabular-nums ${isBasicOverridden ? 'text-amber-800 underline decoration-dotted font-black' : isCleared ? 'text-slate-700' : 'text-slate-900'}`}>
                            ₱{(record.basicTax ?? (record.baseTax / 2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          {canEdit && !isCleared && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditModal(record, 'BASIC_TAX', e)}
                              className="text-slate-400 hover:text-blue-700 p-0.5 rounded transition-colors cursor-pointer"
                              title="Manually adjust Basic Tax"
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal tabular-nums truncate max-w-full">
                          {isCleared ? 'Settled' : (record.systemBasicTax !== null && record.systemBasicTax !== undefined) ? `Def: ₱${record.systemBasicTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Def: Pending AV'}
                        </span>
                      </div>
                    )}
                  </TableCell>

                  {/* 5. SEF Tax (1%) */}
                  <TableCell className="text-right py-2.5 px-1.5">
                    {isUnassessed ? (
                      <span className="text-slate-400 font-mono italic text-xs">Pending AV</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center justify-end gap-1">
                          <span className={`text-xs sm:text-sm font-bold tabular-nums ${isSefOverridden ? 'text-amber-800 underline decoration-dotted font-black' : isCleared ? 'text-slate-700' : 'text-slate-900'}`}>
                            ₱{(record.sefTax ?? ((record.baseTax ?? 0) / 2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          {canEdit && !isCleared && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditModal(record, 'SEF_TAX', e)}
                              className="text-slate-400 hover:text-blue-700 p-0.5 rounded transition-colors cursor-pointer"
                              title="Manually adjust SEF Tax"
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal tabular-nums truncate max-w-full">
                          {isCleared ? 'Settled' : (record.systemSefTax !== null && record.systemSefTax !== undefined) ? `Def: ₱${record.systemSefTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Def: Pending AV'}
                        </span>
                      </div>
                    )}
                  </TableCell>

                  {/* 6. Delinquency Penalty */}
                  <TableCell className="text-right py-2.5 px-1.5">
                    {isUnassessed ? (
                      <span className="text-slate-400 font-mono italic text-xs">Pending AV</span>
                    ) : (record.penaltyAmount ?? 0) > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className={`text-xs sm:text-sm font-bold tabular-nums ${isCleared ? 'text-slate-700' : 'text-rose-700'}`}>
                          +₱{(record.penaltyAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium tabular-nums truncate max-w-full">
                          {((record.penaltyRate ?? 0) * 100).toFixed(0)}% ({record.monthsDelayed ?? 0}m)
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs font-medium tabular-nums">₱0.00</span>
                    )}
                  </TableCell>

                  {/* 7. Prompt / Advance Discount */}
                  <TableCell className="text-right py-2.5 px-1.5">
                    {isUnassessed ? (
                      <span className="text-slate-400 font-mono italic text-xs">—</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <div className="flex items-center justify-end gap-1">
                          <span className={`text-xs sm:text-sm font-bold flex items-center gap-0.5 tabular-nums ${isDiscountOverridden ? 'text-amber-800 underline decoration-dotted font-black' : (hasDiscount ? 'text-emerald-700' : 'text-slate-500')}`}>
                            {hasDiscount && <Tag size={10} className="text-emerald-600" />}
                            {((record.discountRate ?? 0) * 100).toFixed(1)}%
                          </span>
                          {canEdit && !isDelinquent && !isCleared && (
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditModal(record, 'DISCOUNT_RATE', e)}
                              className="text-slate-400 hover:text-blue-700 p-0.5 rounded transition-colors cursor-pointer"
                              title="Manually adjust Discount Rate"
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal tabular-nums truncate max-w-full">
                          {hasDiscount 
                            ? `-₱${(record.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : (isCleared ? 'Settled' : isDelinquent ? '0% Delq' : `Def: ${((record.systemDiscountRate ?? 0) * 100).toFixed(0)}%`)}
                        </span>
                      </div>
                    )}
                  </TableCell>

                  {/* 8. Net Total Due (Normal weight, clean right-aligned) */}
                  <TableCell className={`text-right text-xs sm:text-sm tabular-nums py-2.5 pl-2 pr-6 font-normal ${
                    isCleared ? 'text-emerald-800' : isUnassessed ? 'text-amber-700' : 'text-slate-800'
                  }`}>
                    {isUnassessed || record.totalDue === null ? (
                      <span className="text-amber-700 font-mono text-xs font-semibold">Requires RPTAR</span>
                    ) : (
                      `₱${record.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Selected Scope Dynamic Summary Footer */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 border-t border-slate-800 shrink-0">
        {activeTab === 'COMPLETED' ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 mb-4 border-b border-slate-800 text-xs sm:text-sm">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Cleared Basic Tax:</p>
                <p className="font-bold text-base text-slate-100 tabular-nums mt-0.5">
                  ₱{completedBasicTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Cleared SEF (1%):</p>
                <p className="font-bold text-base text-slate-100 tabular-nums mt-0.5">
                  ₱{completedSefTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Cleared Penalties:</p>
                <p className="font-bold text-base text-slate-300 tabular-nums mt-0.5">
                  ₱{completedPenalties.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Cleared Discounts:</p>
                <p className="font-bold text-base text-emerald-400 tabular-nums mt-0.5">
                  -₱{completedDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-emerald-400 text-xs sm:text-sm uppercase tracking-wider font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> Total Cleared Liabilities ({completedRecords.length} {completedRecords.length === 1 ? 'Year' : 'Years'} Settled)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  All obligations for these tax periods are fully settled. Outstanding balance: ₱0.00
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight tabular-nums">
                  ₱{completedTotalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 mb-4 border-b border-slate-800 text-xs sm:text-sm">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Selected Basic Tax:</p>
                <p className="font-bold text-base text-slate-100 tabular-nums mt-0.5">
                  ₱{selectedBasicTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Selected SEF (1%):</p>
                <p className="font-bold text-base text-slate-100 tabular-nums mt-0.5">
                  ₱{selectedSefTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Selected Penalties:</p>
                <p className="font-bold text-base text-rose-400 tabular-nums mt-0.5">
                  +₱{selectedPenalties.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Selected Discounts:</p>
                <p className="font-bold text-base text-emerald-400 tabular-nums mt-0.5">
                  -₱{selectedDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-slate-300 text-xs sm:text-sm uppercase tracking-wider font-bold">
                  Selected Scope Due ({selectedRecords.length} of {records.length} {records.length === 1 ? 'Period' : 'Periods'})
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedRecords.length < records.length ? 'Partial settlement based on sequential Arrears-First order' : 'Full outstanding liability settlement'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight tabular-nums">
                  ₱{selectedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Authorized Assessor Override Dialog Modal */}
      <Dialog open={editingField !== null} onOpenChange={(open) => !open && setEditingField(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <Pencil size={18} className="text-blue-600" />
              {editingField === 'ASSESSED_VALUE'
                ? `Historical Assessed Value (Physical RPTAR Input)`
                : `Authorized Assessor Adjustment (${editingRecord?.periodLabel ? `Period: ${editingRecord.periodLabel}` : `Year ${editingRecord?.year}`})`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editingField === 'ASSESSED_VALUE'
                ? `Input historical assessed valuation for period ${editingRecord?.periodLabel || editingRecord?.year} from physical RPTAR archive books. Basic Tax (1%) and SEF (1%) will recalculate automatically.`
                : `Manually modify populated ${editingField === 'BASIC_TAX' ? 'Basic Tax' : editingField === 'SEF_TAX' ? 'SEF Tax' : 'Discount Rate'}. Totals will recalculate immediately and a field-level audit record will be logged.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={15} className="text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Current System Calculated Value */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
              <span className="text-slate-600 font-medium">
                {editingField === 'ASSESSED_VALUE' ? 'Current Recorded Valuation:' : 'System Calculated Default:'}
              </span>
              <span className="font-bold text-slate-800 tabular-nums">
                {editingField === 'ASSESSED_VALUE'
                  ? editingRecord?.assessedValue && editingRecord.assessedValue > 0
                    ? `₱${editingRecord.assessedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    : 'Unset / Unassessed'
                  : editingField === 'DISCOUNT_RATE'
                    ? `${((editingRecord?.systemDiscountRate ?? 0) * 100).toFixed(2)}%`
                    : (() => {
                        const val = editingField === 'BASIC_TAX'
                          ? (editingRecord?.systemBasicTax ?? (editingRecord?.baseTax !== null && editingRecord?.baseTax !== undefined ? editingRecord.baseTax / 2 : null))
                          : (editingRecord?.systemSefTax ?? (editingRecord?.baseTax !== null && editingRecord?.baseTax !== undefined ? editingRecord.baseTax / 2 : null));
                        return val !== null && val !== undefined
                          ? `₱${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : 'Pending AV';
                      })()}
              </span>
            </div>

            {/* Editable Field */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                {editingField === 'ASSESSED_VALUE'
                  ? 'Historical Assessed Value (₱) *'
                  : `New Applied Value ${editingField === 'DISCOUNT_RATE' ? '(Percentage %)' : '(₱)'} *`}
              </label>
              <Input
                type="number"
                step={editingField === 'DISCOUNT_RATE' ? '0.1' : '1'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={editingField === 'ASSESSED_VALUE' ? 'e.g. 10000' : '0'}
                className="text-sm font-bold bg-white text-slate-900 tabular-nums"
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <Info size={12} />
                {editingField === 'ASSESSED_VALUE'
                  ? `Basic (1%) and SEF (1%) will be calculated across ${editingRecord?.yearsCovered?.length || 1} year(s).`
                  : editingField === 'DISCOUNT_RATE' 
                    ? 'Discount Amount will be derived from: (Basic Tax + SEF Tax) × Discount Rate' 
                    : 'Total Due will recalculate automatically from the new tax base.'}
              </p>
            </div>

            {/* Physical RPTAR Archive Reference (Volume / Page) */}
            {editingField === 'ASSESSED_VALUE' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                  Physical RPTAR Archive Reference (Volume, Folio, Page)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. RPTAR Vol. 14, Page 22, Line 4"
                  value={rptarRefInput}
                  onChange={(e) => setRptarRefInput(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}

            {/* Live Calculation Preview Card for Assessed Value */}
            {editingField === 'ASSESSED_VALUE' && !isNaN(parseFloat(editValue)) && parseFloat(editValue) > 0 && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
                <p className="font-bold text-emerald-900 text-[11px] uppercase tracking-wider">Live Assessment Preview</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <div>
                    <span className="text-slate-500">Basic Tax (1%):</span>{' '}
                    <strong className="text-slate-900">
                      ₱{(parseFloat(editValue) * 0.01 * (editingRecord?.yearsCovered?.length || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">SEF Tax (1%):</span>{' '}
                    <strong className="text-slate-900">
                      ₱{(parseFloat(editValue) * 0.01 * (editingRecord?.yearsCovered?.length || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Base Tax Total:</span>{' '}
                    <strong className="text-slate-900">
                      ₱{(parseFloat(editValue) * 0.02 * (editingRecord?.yearsCovered?.length || 1)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Penalty Rate:</span>{' '}
                    <strong className="text-slate-900">{((editingRecord?.penaltyRate ?? 0) * 100).toFixed(0)}%</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Mandatory Reason */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                Mandatory Statutory Reason *
              </label>
              <Input
                type="text"
                placeholder={editingField === 'ASSESSED_VALUE' ? 'e.g. Verified from physical RPTAR archive ledger card' : 'e.g. Certified Assessor adjustment per Ordinance 2026-04'}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="text-xs"
                required
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => setEditingField(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              size="sm" 
              onClick={handleSaveOverride}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
            >
              Apply & Recalculate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DelinquencyTable;