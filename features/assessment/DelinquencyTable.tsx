import React, { useState, useEffect, useRef } from 'react';
import { TaxYearRecord, TaxSummary, Property, User } from '@/types';
import { AlertCircle, CheckCircle2, Tag, Calendar, CheckSquare, Layers, Sparkles, Pencil, Info } from 'lucide-react';
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
  summary?: TaxSummary;
  grandTotal?: number;
  canEdit?: boolean;
  property?: Property | null;
  currentUser?: User | null;
  onSelectionChange?: (selected: TaxYearRecord[], subtotal: number) => void;
}

type EditableField = 'BASIC_TAX' | 'SEF_TAX' | 'DISCOUNT_RATE';

const DelinquencyTable: React.FC<DelinquencyTableProps> = ({ 
  records: initialRecords, 
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

  // Store selected index range (from index 0 up to selectedMaxIndex inclusive)
  const [selectedMaxIndex, setSelectedMaxIndex] = useState<number>(records.length - 1);

  // Default to selecting all records whenever new records load
  useEffect(() => {
    setSelectedMaxIndex(records.length - 1);
  }, [records.length]);

  // Compute selected subset
  const selectedRecords = React.useMemo(
    () => records.slice(0, selectedMaxIndex + 1),
    [records, selectedMaxIndex]
  );
  const selectedSubtotal = React.useMemo(
    () => selectedRecords.reduce((sum, r) => sum + (r.totalDue || 0), 0),
    [selectedRecords]
  );
  const selectedBasicTax = selectedRecords.reduce((sum, r) => sum + (r.basicTax || (r.baseTax / 2) || 0), 0);
  const selectedSefTax = selectedRecords.reduce((sum, r) => sum + (r.sefTax || (r.baseTax / 2) || 0), 0);
  const selectedPenalties = selectedRecords.reduce((sum, r) => sum + (r.penaltyAmount || 0), 0);
  const selectedDiscounts = selectedRecords.reduce((sum, r) => sum + (r.discountAmount || 0), 0);

  // Modal state for manual assessor override
  const [editingRecord, setEditingRecord] = useState<TaxYearRecord | null>(null);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState<string>('');
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

  if (records.length === 0) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Account Fully Cleared</h3>
          <p className="text-slate-500 text-sm mt-1">This property is paid up to date with zero delinquent liabilities.</p>
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

    if (field === 'BASIC_TAX') {
      setEditValue(String(record.basicTax ?? (record.baseTax / 2)));
    } else if (field === 'SEF_TAX') {
      setEditValue(String(record.sefTax ?? (record.baseTax / 2)));
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

    let finalBasicTax = editingRecord.basicTax ?? (editingRecord.baseTax / 2);
    let finalSefTax = editingRecord.sefTax ?? (editingRecord.baseTax / 2);
    let finalDiscountRate = editingRecord.discountRate ?? 0;
    let originalValue = 0;
    let newValue = 0;

    if (editingField === 'BASIC_TAX') {
      originalValue = editingRecord.systemBasicTax ?? (editingRecord.baseTax / 2);
      newValue = numericVal;
      finalBasicTax = numericVal;
    } else if (editingField === 'SEF_TAX') {
      originalValue = editingRecord.systemSefTax ?? (editingRecord.baseTax / 2);
      newValue = numericVal;
      finalSefTax = numericVal;
    } else if (editingField === 'DISCOUNT_RATE') {
      originalValue = editingRecord.systemDiscountRate ?? 0;
      newValue = numericVal / 100;
      finalDiscountRate = numericVal / 100;
    }

    // Recalculate derived fields
    const appliedBaseTax = Math.round((finalBasicTax + finalSefTax) * 100) / 100;
    const discountAmount = Math.round(appliedBaseTax * finalDiscountRate * 100) / 100;
    const totalDue = Math.max(0, Math.round((appliedBaseTax + editingRecord.penaltyAmount - discountAmount) * 100) / 100);

    const updatedRecord: TaxYearRecord = {
      ...editingRecord,
      basicTax: finalBasicTax,
      sefTax: finalSefTax,
      baseTax: appliedBaseTax,
      discountRate: finalDiscountRate,
      discountAmount,
      totalDue,
      isManuallyEdited: true,
      editReason: editReason.trim(),
    };

    // Update state
    setRecords(prev => prev.map(r => r.year === editingRecord.year ? updatedRecord : r));

    // Log individual field-level audit record
    if (property?.tdNumber) {
      await api.logFieldOverrideAudit({
        propertyId: property.id,
        tdNumber: property.tdNumber,
        taxYear: editingRecord.year,
        fieldChanged: editingField,
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
      <div className="p-4 border-b border-slate-200 bg-slate-50/80 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-emerald-600" />
            <h3 className="text-slate-800 font-bold text-sm">
              Sequential Statement of Account (RA 7160 Arrears-First)
            </h3>
          </div>
          <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
            <Calendar size={12} /> {records.length} {records.length === 1 ? 'Tax Year Owed' : 'Tax Years Owed'}
          </Badge>
        </div>

        {/* 1-Click Scope Buttons */}
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
            Pay Oldest Year ({records[0].year})
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
              Pay All Dues ({records.length} Years)
            </Button>
          )}
        </div>
      </div>
      
      {/* Itemized Table */}
      <div className="overflow-x-auto flex-grow">
        <Table className="text-xs">
          <TableHeader className="bg-slate-100/75">
            <TableRow>
              <TableHead className="w-12 text-center font-bold text-slate-600 uppercase tracking-wider">Select</TableHead>
              <TableHead className="font-bold text-slate-600 uppercase tracking-wider">Tax Period</TableHead>
              <TableHead className="font-bold text-slate-600 uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-right font-bold text-slate-600 uppercase tracking-wider">Basic Tax (1%)</TableHead>
              <TableHead className="text-right font-bold text-slate-600 uppercase tracking-wider">SEF Tax (1%)</TableHead>
              <TableHead className="text-right font-bold text-slate-600 uppercase tracking-wider">
                Penalty <span className="text-slate-400 font-normal">(Rate)</span>
              </TableHead>
              <TableHead className="text-right font-bold text-slate-600 uppercase tracking-wider">Discount Rate</TableHead>
              <TableHead className="text-right font-bold text-slate-600 uppercase tracking-wider">Net Amount Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {records.map((record, idx) => {
              const isSelected = idx <= selectedMaxIndex;
              const isDelinquent = record.status === 'Delinquent';
              const hasDiscount = Boolean(record.discountAmount && record.discountAmount > 0);

              const isBasicOverridden = record.systemBasicTax !== undefined && record.basicTax !== record.systemBasicTax;
              const isSefOverridden = record.systemSefTax !== undefined && record.sefTax !== record.systemSefTax;
              const isDiscountOverridden = record.systemDiscountRate !== undefined && record.discountRate !== record.systemDiscountRate;

              return (
                <TableRow 
                  key={idx} 
                  onClick={() => handleCheckboxClick(idx)}
                  className={`transition-colors cursor-pointer ${
                    isSelected ? 'bg-emerald-50/40 hover:bg-emerald-50/60 font-medium' : 'opacity-40 hover:opacity-75 bg-slate-50/20'
                  }`}
                >
                  <TableCell className="text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleCheckboxClick(idx)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                  </TableCell>

                  <TableCell className="whitespace-nowrap font-bold text-slate-900 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span>{record.year} {record.quarter ? `• Q${record.quarter}` : ''}</span>
                      {record.isManuallyEdited && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-300 font-bold" title={record.editReason || 'Assessor adjusted'}>
                          Overridden
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="whitespace-nowrap">
                    {isDelinquent ? (
                      <Badge variant="destructive" className="text-[11px] font-semibold bg-rose-100 text-rose-700 border-rose-200">
                        {record.status}
                      </Badge>
                    ) : record.status === 'Current' ? (
                      <Badge variant="default" className="text-[11px] font-semibold bg-blue-100 text-blue-700 border-blue-200">
                        {record.status}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 border-emerald-200">
                        {record.status}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Basic Tax with Default vs Applied */}
                  <TableCell className="whitespace-nowrap text-right font-mono">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <span className={`font-bold ${isBasicOverridden ? 'text-amber-700 underline decoration-dotted' : 'text-slate-800'}`}>
                          ₱{(record.basicTax ?? (record.baseTax / 2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(record, 'BASIC_TAX', e)}
                            className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                            title="Manually adjust Basic Tax"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Default: ₱{(record.systemBasicTax ?? (record.baseTax / 2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </TableCell>

                  {/* SEF Tax with Default vs Applied */}
                  <TableCell className="whitespace-nowrap text-right font-mono">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <span className={`font-bold ${isSefOverridden ? 'text-amber-700 underline decoration-dotted' : 'text-slate-800'}`}>
                          ₱{(record.sefTax ?? (record.baseTax / 2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(record, 'SEF_TAX', e)}
                            className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                            title="Manually adjust SEF Tax"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Default: ₱{(record.systemSefTax ?? (record.baseTax / 2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </TableCell>

                  {/* Penalty */}
                  <TableCell className="whitespace-nowrap text-right font-mono">
                    {record.penaltyAmount > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-rose-600 font-semibold">
                          +₱{record.penaltyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {(record.penaltyRate * 100).toFixed(0)}% ({record.monthsDelayed} mos)
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">₱0.00</span>
                    )}
                  </TableCell>

                  {/* Discount Rate & Derived Amount */}
                  <TableCell className="whitespace-nowrap text-right font-mono">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1">
                        <span className={`font-semibold flex items-center gap-0.5 ${isDiscountOverridden ? 'text-amber-700 underline decoration-dotted' : (hasDiscount ? 'text-emerald-600' : 'text-slate-400')}`}>
                          {hasDiscount && <Tag size={10} />}
                          {((record.discountRate ?? 0) * 100).toFixed(2)}%
                        </span>
                        {canEdit && !isDelinquent && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(record, 'DISCOUNT_RATE', e)}
                            className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                            title="Manually adjust Discount Rate"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {hasDiscount 
                          ? `-₱${(record.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : (isDelinquent ? '0% Delinquent' : `Default: ${((record.systemDiscountRate ?? 0) * 100).toFixed(0)}%`)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Net Total Due */}
                  <TableCell className="whitespace-nowrap text-slate-900 font-bold text-right font-mono text-sm">
                    ₱{record.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Selected Scope Dynamic Summary Footer */}
      <div className="bg-slate-900 text-white p-5 border-t border-slate-800">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-3 mb-3 border-b border-slate-800 text-xs">
          <div>
            <p className="text-slate-400">Selected Basic Tax:</p>
            <p className="font-mono font-bold text-sm text-slate-200">
              ₱{selectedBasicTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Selected SEF (1%):</p>
            <p className="font-mono font-bold text-sm text-slate-200">
              ₱{selectedSefTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Selected Penalties:</p>
            <p className="font-mono font-bold text-sm text-rose-400">
              +₱{selectedPenalties.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Selected Discounts:</p>
            <p className="font-mono font-bold text-sm text-emerald-400">
              -₱{selectedDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
              Selected Scope Due ({selectedRecords.length} of {records.length} {records.length === 1 ? 'Year' : 'Years'})
            </span>
            <p className="text-[11px] text-slate-400">
              {selectedRecords.length < records.length ? 'Partial settlement based on sequential Arrears-First order' : 'Full outstanding liability settlement'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tracking-tight">
              ₱{selectedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Authorized Assessor Override Dialog Modal */}
      <Dialog open={editingField !== null} onOpenChange={(open) => !open && setEditingField(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <Pencil size={18} className="text-blue-600" />
              Authorized Assessor Adjustment (Year {editingRecord?.year})
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Manually modify populated {editingField === 'BASIC_TAX' ? 'Basic Tax' : editingField === 'SEF_TAX' ? 'SEF Tax' : 'Discount Rate'}. Totals will recalculate immediately and a field-level audit record will be logged.
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
              <span className="text-slate-600 font-medium">System Calculated Default:</span>
              <span className="font-mono font-bold text-slate-800">
                {editingField === 'DISCOUNT_RATE'
                  ? `${((editingRecord?.systemDiscountRate ?? 0) * 100).toFixed(2)}%`
                  : `₱${(editingField === 'BASIC_TAX' ? editingRecord?.systemBasicTax : editingRecord?.systemSefTax ?? (editingRecord?.baseTax ? editingRecord.baseTax / 2 : 0))?.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              </span>
            </div>

            {/* Editable Field */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                New Applied Value {editingField === 'DISCOUNT_RATE' ? '(Percentage %)' : '(₱)'} *
              </label>
              <Input
                type="number"
                step={editingField === 'DISCOUNT_RATE' ? '0.1' : '1'}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="font-mono text-sm font-bold bg-white text-slate-900"
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <Info size={12} />
                {editingField === 'DISCOUNT_RATE' 
                  ? 'Discount Amount will be derived from: (Basic Tax + SEF Tax) × Discount Rate' 
                  : 'Total Due will recalculate automatically from the new tax base.'}
              </p>
            </div>

            {/* Mandatory Reason */}
            <div>
              <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">
                Mandatory Statutory Reason *
              </label>
              <Input
                type="text"
                placeholder="e.g. Certified Assessor reduction per Ordinance 2026-04"
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