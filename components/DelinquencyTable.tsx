import React, { useState, useEffect, useRef } from 'react';
import { TaxYearRecord, TaxSummary } from '../types';
import { AlertCircle, CheckCircle2, Tag, Calendar, CheckSquare, Layers, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

interface DelinquencyTableProps {
  records: TaxYearRecord[];
  summary?: TaxSummary;
  grandTotal?: number;
  onSelectionChange?: (selected: TaxYearRecord[], subtotal: number) => void;
}

const DelinquencyTable: React.FC<DelinquencyTableProps> = ({ 
  records, 
  summary: _summary, 
  grandTotal: _grandTotal,
  onSelectionChange 
}) => {
  // Store selected index range (from index 0 up to selectedMaxIndex inclusive)
  const [selectedMaxIndex, setSelectedMaxIndex] = useState<number>(records.length - 1);

  // Default to selecting all records whenever new records load
  useEffect(() => {
    setSelectedMaxIndex(records.length - 1);
  }, [records]);

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
              <TableHead className="text-right font-bold text-slate-600 uppercase tracking-wider">Basic (1%)</TableHead>
              <TableHead className="text-right font-bold text-slate-600 uppercase tracking-wider">SEF (1%)</TableHead>
              <TableHead className="text-right font-bold text-slate-600 uppercase tracking-wider">
                Penalty <span className="text-slate-400 font-normal">(Rate)</span>
              </TableHead>
              <TableHead className="text-right font-bold text-slate-600 uppercase tracking-wider">Discount</TableHead>
              <TableHead className="text-right font-bold text-slate-600 uppercase tracking-wider">Subtotal Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {records.map((record, idx) => {
              const isSelected = idx <= selectedMaxIndex;
              const isDelinquent = record.status === 'Delinquent';
              const hasDiscount = Boolean(record.discountAmount && record.discountAmount > 0);

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
                    {record.year} {record.quarter ? `• Q${record.quarter}` : ''}
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
                  <TableCell className="whitespace-nowrap text-slate-600 text-right font-mono">
                    ₱{(record.basicTax || (record.baseTax / 2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-600 text-right font-mono">
                    ₱{(record.sefTax || (record.baseTax / 2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
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
                  <TableCell className="whitespace-nowrap text-right font-mono">
                    {hasDiscount ? (
                      <div className="flex flex-col items-end">
                        <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                          <Tag size={10} /> -₱{record.discountAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-emerald-600">
                          {((record.discountRate || 0) * 100).toFixed(0)}% Prompt Disc.
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
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
    </Card>
  );
};

export default DelinquencyTable;