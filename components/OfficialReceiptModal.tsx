import React from 'react';
import { OfficialReceipt } from '../types';
import { Printer, X, CheckCircle2, FileSpreadsheet, ShieldCheck, Building } from 'lucide-react';

interface ClearanceModalProps {
  isOpen?: boolean;
  receipt: OfficialReceipt | null;
  onClose: () => void;
}

const OfficialReceiptModal: React.FC<ClearanceModalProps> = ({ isOpen = true, receipt, onClose }) => {
  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const records = receipt.itemizedRecords || [];
  const totalPaid = receipt.summary?.totalPaid || 0;
  const basicTotal = receipt.summary?.basicTax || 0;
  const sefTotal = receipt.summary?.sefTax || 0;
  const penaltyTotal = receipt.summary?.penalty || 0;
  const discountTotal = receipt.summary?.discount || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-300 flex flex-col max-h-[95vh]">
        {/* Modal Top Actions (Hidden in Print) */}
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between no-print border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1 bg-emerald-600 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">Real Property Tax Clearance Issued</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
            >
              <Printer className="h-4 w-4" />
              Print Excel Clearance Slip
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
              title="Close modal and return to dashboard"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Excel / Spreadsheet-Style Printable Clearance Slip */}
        <div className="p-6 overflow-y-auto bg-slate-50/50">
          <div id="printable-receipt" className="p-6 bg-white text-slate-900 font-sans border-2 border-slate-800 shadow-sm print:border print:m-0 print:p-4">

            {/* Spreadsheet Header Block */}
            <div className="border border-slate-800 bg-slate-100 p-3 text-center mb-0">
              <div className="flex items-center justify-center gap-2 mb-0.5">
                <Building className="h-5 w-5 text-slate-800 print:hidden" />
                <h2 className="font-black text-sm uppercase tracking-widest text-slate-900">
                  REPUBLIC OF THE PHILIPPINES
                </h2>
              </div>
              <p className="text-[11px] font-bold text-slate-700 uppercase">
                OFFICE OF THE MUNICIPAL TREASURER & ASSESSOR
              </p>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 mt-1 bg-white border border-slate-800 py-0.5 inline-block px-4">
                OFFICIAL REAL PROPERTY TAX CLEARANCE SLIP & LEDGER
              </h3>
            </div>

            {/* Metadata Grid (Excel 2x2 Matrix) */}
            <div className="border-x border-b border-slate-800 text-xs">
              <div className="grid grid-cols-2 divide-x divide-slate-800 border-b border-slate-800 bg-white">
                <div className="p-2 flex justify-between">
                  <span className="font-bold text-slate-600 uppercase text-[10px]">Clearance Ref No:</span>
                  <span className="font-mono font-black text-blue-900 text-xs">{receipt.receiptNo}</span>
                </div>
                <div className="p-2 flex justify-between">
                  <span className="font-bold text-slate-600 uppercase text-[10px]">Date & Time Issued:</span>
                  <span className="font-mono font-semibold text-slate-800 text-[11px]">{new Date(receipt.date).toLocaleString('en-PH')}</span>
                </div>
              </div>

              {/* Property Details Matrix */}
              <div className="grid grid-cols-2 divide-x divide-slate-800 border-b border-slate-800">
                <div className="p-2 flex justify-between bg-white">
                  <span className="font-bold text-slate-600 uppercase text-[10px]">Declared Owner:</span>
                  <span className="font-black uppercase text-slate-900">{receipt.property.ownerName}</span>
                </div>
                <div className="p-2 flex justify-between bg-white">
                  <span className="font-bold text-slate-600 uppercase text-[10px]">Tax Declaration (TD):</span>
                  <span className="font-mono font-bold text-slate-900">{receipt.property.tdNumber}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-800 border-b border-slate-800">
                <div className="p-2 flex justify-between bg-white">
                  <span className="font-bold text-slate-600 uppercase text-[10px]">Property Location:</span>
                  <span className="font-semibold text-slate-800 truncate ml-2">{receipt.property.address}, Brgy. {receipt.property.barangay}</span>
                </div>
                <div className="p-2 flex justify-between bg-white">
                  <span className="font-bold text-slate-600 uppercase text-[10px]">Cadastral PIN:</span>
                  <span className="font-mono font-medium text-slate-700">{receipt.property.pin || '024-05-001-00-000'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-800">
                <div className="p-2 flex justify-between bg-white">
                  <span className="font-bold text-slate-600 uppercase text-[10px]">Classification:</span>
                  <span className="font-bold text-slate-800">{receipt.property.propertyClass}</span>
                </div>
                <div className="p-2 flex justify-between bg-white">
                  <span className="font-bold text-slate-600 uppercase text-[10px]">Taxable Assessed Value:</span>
                  <span className="font-mono font-black text-slate-900">₱{receipt.property.assessedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Itemized Ledger Table (Excel Grid Format) */}
            <div className="mt-3 border border-slate-800 text-[11px] overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-slate-200/90 text-slate-800 border-b border-slate-800 divide-x divide-slate-800 font-black uppercase text-[10px]">
                    <th className="py-1.5 px-2 text-left w-24">Tax Period</th>
                    <th className="py-1.5 px-2 text-right">Basic (1%)</th>
                    <th className="py-1.5 px-2 text-right">SEF (1%)</th>
                    <th className="py-1.5 px-2 text-center w-20">Delay</th>
                    <th className="py-1.5 px-2 text-right">Penalty</th>
                    <th className="py-1.5 px-2 text-right">Discount</th>
                    <th className="py-1.5 px-2 text-right w-28">Amount Cleared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {records.map((rec, i) => (
                    <tr key={i} className="divide-x divide-slate-800 bg-white hover:bg-slate-50 font-mono">
                      <td className="py-1 px-2 font-bold font-sans text-slate-900 whitespace-nowrap">
                        {rec.year} {rec.quarter ? `• Q${rec.quarter}` : ''}
                      </td>
                      <td className="py-1 px-2 text-right text-slate-700">
                        ₱{(rec.basicTax || (rec.baseTax / 2) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-2 text-right text-slate-700">
                        ₱{(rec.sefTax || (rec.baseTax / 2) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-2 text-center text-slate-500 font-sans text-[10px]">
                        {rec.monthsDelayed ? `${rec.monthsDelayed} mos` : '—'}
                      </td>
                      <td className="py-1 px-2 text-right font-medium">
                        {rec.penaltyAmount ? `+₱${rec.penaltyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '₱0.00'}
                      </td>
                      <td className="py-1 px-2 text-right font-medium">
                        {rec.discountAmount ? `-₱${rec.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="py-1 px-2 text-right font-black text-slate-900">
                        ₱{rec.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* Totals Row */}
                  <tr className="bg-slate-100 divide-x divide-slate-800 border-t-2 border-slate-800 font-bold text-[11px]">
                    <td className="py-1.5 px-2 text-slate-900 uppercase font-extrabold font-sans">
                      TOTALS:
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-800">
                      ₱{basicTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-800">
                      ₱{sefTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-center text-slate-400 font-sans text-[10px]">
                      —
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      +₱{penaltyTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      -₱{discountTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-black text-slate-900 text-xs border-b-4 border-double border-slate-900">
                      ₱{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Certification Statement */}
            <div className="mt-3 p-2.5 border border-slate-800 bg-slate-50 text-[11px] text-slate-800">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700 uppercase">Compliance Verification:</span>
                <span className="px-2 py-0.2 font-extrabold text-[10px] rounded uppercase">
                  STATUS: OFFICIALLY CLEARED (RA 7160)
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-600 leading-snug">
                This document certifies that statutory Real Property Tax liabilities and Special Education Fund (SEF) levies for the periods listed above have been audited and officially updated as <strong>CLEARED</strong> in the municipal tax ledger.
              </p>
            </div>

            {/* Excel Signature Matrix */}
            <div className="mt-3 border border-slate-800 grid grid-cols-2 divide-x divide-slate-800 text-xs">
              <div className="p-3 bg-white">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-5">Assessed & Recorded By:</p>
                <div className="border-b border-slate-800 pb-0.5 mb-1 font-bold text-slate-900 text-center font-mono">
                  {receipt.postedBy}
                </div>
                <p className="text-[10px] text-slate-500 text-center uppercase font-medium">Assessor / Clearance Officer</p>
              </div>

              <div className="p-3 bg-white">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-5">Approved & Certified By:</p>
                <div className="border-b border-slate-800 pb-0.5 mb-1 font-bold text-slate-900 text-center uppercase">
                  OFFICE OF THE MUNICIPAL TREASURER'S OFFICE
                </div>
                <p className="text-[10px] text-slate-500 text-center uppercase font-medium">Local Government Unit</p>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Bottom Actions (Hidden in Print) */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-300 flex justify-end gap-2.5 no-print">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
          >
            Done & Back to Masterlist
          </button>
        </div>
      </div>
    </div>
  );
};

export default OfficialReceiptModal;
