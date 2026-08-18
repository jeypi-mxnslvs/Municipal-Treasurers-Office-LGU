import React, { useState, useEffect } from 'react';
import { TaxYearRecord, TaxSummary } from '../types';
import { AlertCircle, CheckCircle2, Tag, Calendar, CheckSquare, Layers, Sparkles } from 'lucide-react';

interface DelinquencyTableProps {
  records: TaxYearRecord[];
  summary?: TaxSummary;
  grandTotal: number;
  onSelectionChange?: (selected: TaxYearRecord[], subtotal: number) => void;
}

const DelinquencyTable: React.FC<DelinquencyTableProps> = ({ 
  records, 
  summary, 
  grandTotal,
  onSelectionChange 
}) => {
  // Store selected index range (from index 0 up to selectedMaxIndex inclusive)
  const [selectedMaxIndex, setSelectedMaxIndex] = useState<number>(records.length - 1);

  // Default to selecting all records whenever new records load
  useEffect(() => {
    setSelectedMaxIndex(records.length - 1);
  }, [records]);

  // Compute selected subset
  const selectedRecords = records.slice(0, selectedMaxIndex + 1);
  const selectedSubtotal = selectedRecords.reduce((sum, r) => sum + (r.totalDue || 0), 0);
  const selectedBasicTax = selectedRecords.reduce((sum, r) => sum + (r.basicTax || (r.baseTax / 2) || 0), 0);
  const selectedSefTax = selectedRecords.reduce((sum, r) => sum + (r.sefTax || (r.baseTax / 2) || 0), 0);
  const selectedPenalties = selectedRecords.reduce((sum, r) => sum + (r.penaltyAmount || 0), 0);
  const selectedDiscounts = selectedRecords.reduce((sum, r) => sum + (r.discountAmount || 0), 0);

  // Notify parent component of selection updates
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedRecords, selectedSubtotal);
    }
  }, [selectedMaxIndex, records]);

  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-100 mb-4">
          <CheckCircle2 size={32} className="text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Account Fully Cleared</h3>
        <p className="text-slate-500 text-sm mt-1">This property is paid up to date with zero delinquent liabilities.</p>
      </div>
    );
  }

  // Quick Scope Helpers
  const handleSelectOneQuarter = () => {
    setSelectedMaxIndex(0);
  };

  const handleSelectOneYear = () => {
    if (records.length === 0) return;
    const firstYear = records[0].year;
    // Find last index of the same year
    let maxIdx = 0;
    for (let i = 0; i < records.length; i++) {
      if (records[i].year === firstYear) {
        maxIdx = i;
      } else {
        break;
      }
    }
    setSelectedMaxIndex(maxIdx);
  };

  const handleSelectAll = () => {
    setSelectedMaxIndex(records.length - 1);
  };

  const handleCheckboxClick = (index: number) => {
    setSelectedMaxIndex(index);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in-up">
      {/* Header & Sequential Scope Selector */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-blue-600" />
            <h3 className="text-slate-800 font-bold text-sm">
              Sequential Statement of Account (RA 7160 Arrears-First)
            </h3>
          </div>
          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full flex items-center gap-1">
            <Calendar size={12} /> {records.length} Total Periods Owed
          </span>
        </div>

        {/* 1-Click Scope Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/70 text-xs">
          <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px] mr-1">
            Payment Scope:
          </span>
          <button
            type="button"
            onClick={handleSelectOneQuarter}
            className={`px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1 ${
              selectedMaxIndex === 0 
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <CheckSquare size={13} />
            Pay Next 1 Quarter
          </button>

          <button
            type="button"
            onClick={handleSelectOneYear}
            className={`px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1 ${
              selectedMaxIndex > 0 && selectedMaxIndex < records.length - 1 && records[selectedMaxIndex].year === records[0].year
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Layers size={13} />
            Pay 1 Full Year ({records[0].year})
          </button>

          <button
            type="button"
            onClick={handleSelectAll}
            className={`px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1 ${
              selectedMaxIndex === records.length - 1
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={13} />
            Pay All Dues (Full Settlement)
          </button>
        </div>
      </div>
      
      {/* Itemized Table */}
      <div className="overflow-x-auto flex-grow">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-100/75">
            <tr>
              <th scope="col" className="px-3 py-2.5 text-center font-bold text-slate-500 uppercase tracking-wider w-12">Select</th>
              <th scope="col" className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider">Tax Period</th>
              <th scope="col" className="px-4 py-2.5 text-left font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-4 py-2.5 text-right font-bold text-slate-500 uppercase tracking-wider">Basic (1%)</th>
              <th scope="col" className="px-4 py-2.5 text-right font-bold text-slate-500 uppercase tracking-wider">SEF (1%)</th>
              <th scope="col" className="px-4 py-2.5 text-right font-bold text-slate-500 uppercase tracking-wider">
                Penalty <span className="text-slate-400 font-normal">(Rate)</span>
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-bold text-slate-500 uppercase tracking-wider">Discount</th>
              <th scope="col" className="px-4 py-2.5 text-right font-bold text-slate-500 uppercase tracking-wider">Subtotal Due</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {records.map((record, idx) => {
              const isSelected = idx <= selectedMaxIndex;
              const isDelinquent = record.status === 'Delinquent';
              const hasDiscount = Boolean(record.discountAmount && record.discountAmount > 0);

              return (
                <tr 
                  key={idx} 
                  onClick={() => handleCheckboxClick(idx)}
                  className={`transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/50 hover:bg-blue-50/80 font-medium' : 'opacity-40 hover:opacity-75 bg-slate-50/30'
                  }`}
                >
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleCheckboxClick(idx)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900 font-mono">
                    {record.year} {record.quarter ? `• Q${record.quarter}` : ''}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      isDelinquent 
                        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                        : record.status === 'Current'
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-right font-mono">
                    ₱{(record.basicTax || (record.baseTax / 2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-right font-mono">
                    ₱{(record.sefTax || (record.baseTax / 2)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-mono">
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
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-mono">
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
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-900 font-bold text-right font-mono text-sm">
                    ₱{record.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
              Selected Scope Due ({selectedRecords.length} of {records.length} Quarters)
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
    </div>
  );
};

export default DelinquencyTable;