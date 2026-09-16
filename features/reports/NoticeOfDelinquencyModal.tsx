import React, { useState, useMemo } from 'react';
import { Property, TaxYearRecord } from '@/types';
import { calculateTaxLiability } from '@/utils/taxLogic';
import {
  downloadWordDoc,
  downloadNoticeOfDelinquencyXls,
} from '@/utils/documentExport';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Printer,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  X
} from 'lucide-react';

interface NoticeOfDelinquencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  initialIndex?: number;
}

const formatCurrency = (val: number | undefined): string => {
  if (val === undefined || val === null || isNaN(val) || val === 0) return ' -   ';
  return `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const NoticeOfDelinquencyModal: React.FC<NoticeOfDelinquencyModalProps> = ({
  isOpen,
  onClose,
  properties,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Sync index if initialIndex changes
  React.useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const activeProperty = properties[currentIndex] || null;

  // Calculate delinquent rolls for active property
  const assessmentResult = useMemo(() => {
    if (!activeProperty) return null;
    return calculateTaxLiability(activeProperty);
  }, [activeProperty]);

  // Aggregate itemized table records (Single Fund 1% base per SSOT Section 2.9)
  const itemizedRows = useMemo(() => {
    if (!assessmentResult) return [];
    return assessmentResult.records;
  }, [assessmentResult]);

  // Accountable totals (SSOT Section 2.9.4):
  // BASIC: sum of table column (1% base + penalty/discount)
  // SEF: identical amount (1% base + penalty/discount)
  // TOTAL: BASIC + SEF = 2 * BASIC
  const totals = useMemo(() => {
    if (!itemizedRows || itemizedRows.length === 0) {
      return { basic: 0, sef: 0, grandTotal: 0 };
    }
    const basicTotal = itemizedRows
      .filter((r) => !r.isUnverifiedHistorical && r.totalDue !== null)
      .reduce((sum, r) => sum + ((r.totalDue ?? 0) / 2), 0);
    const sefTotal = basicTotal;
    const grandTotal = basicTotal + sefTotal;
    return {
      basic: Math.round(basicTotal * 100) / 100,
      sef: Math.round(sefTotal * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100
    };
  }, [itemizedRows]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportXls = () => {
    if (!activeProperty || !assessmentResult) return;
    downloadNoticeOfDelinquencyXls(activeProperty, itemizedRows, totals);
  };


  const handleExportWord = () => {
    if (!activeProperty || !assessmentResult) return;
    downloadWordDoc({
      documentTitle: 'Notice of Delinquency in the Payment of Real Property Tax',
      subTitle: 'Pursuant to Section 254, Republic Act No. 7160 (Local Government Code of 1991)',
      property: activeProperty,
      records: itemizedRows,
      totals,
      filename: `Notice_of_Delinquency_${activeProperty.tdNumber}.doc`,
      isNoticeOfDelinquency: true,
    });
  };

  if (!isOpen || !activeProperty) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border border-slate-300 shadow-2xl bg-white text-slate-900">
        {/* Navigation & Action Bar (Hidden in Print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-3.5 flex flex-wrap justify-between items-center gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">
              Notice of Delinquency (RA 7160 Sec. 254)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {properties.length > 1 && (
              <div className="flex items-center gap-1 mr-2 text-xs text-slate-400">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="h-8 px-2 bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="px-2">
                  {currentIndex + 1} of {properties.length}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === properties.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(properties.length - 1, prev + 1))}
                  className="h-8 px-2 bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportXls}
              className="h-8 px-3 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 gap-1.5 text-xs font-bold rounded-xl shadow-sm cursor-pointer"
              title="Export canonical Santa Rosa COMPUTATION.xls spreadsheet"
            >
              <FileSpreadsheet size={14} className="text-emerald-400" />
              Export Excel (.xls)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportWord}
              className="h-8 px-3 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 gap-1 text-xs"
            >
              <FileText size={14} className="text-blue-400" />
              Export Word (.doc)
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="h-8 px-3 bg-emerald-600 text-white hover:bg-emerald-500 gap-1 text-xs shadow-sm"
            >
              <Printer size={14} />
              Print Notice
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 px-2 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X size={16} />
            </Button>
          </div>
        </div>

        {/* Printable Notice Sheet (Styled strictly after LGU Santa Rosa AF Form) */}
        <div id="printable-notice" className="p-8 sm:p-12 print:p-0 bg-white max-w-[850px] mx-auto text-slate-900 leading-tight">
          {/* Header */}
          <div className="text-center border-b-2 border-black pb-3 mb-3">
            <p className="text-[11px] uppercase tracking-widest text-slate-700 font-semibold font-sans">Republic of the Philippines</p>
            <p className="text-[11px] uppercase tracking-widest text-slate-700 font-semibold font-sans">Province of Nueva Ecija</p>
            <h1 className="text-base font-extrabold tracking-tight uppercase text-black mt-0.5">
              Municipality of Santa Rosa
            </h1>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-900 print:text-black mt-0.5">
              Office of the Municipal Treasurer
            </p>
            <div className="mt-2.5 inline-block bg-slate-900 print:bg-white text-white print:text-black border border-black px-4 py-1 text-xs font-bold uppercase tracking-widest rounded-none">
              Notice of Delinquency in the Payment of Real Property Tax
            </div>
            <p className="text-[10px] text-slate-600 print:text-black mt-1 italic">
              Pursuant to Section 254, Republic Act No. 7160 (Local Government Code of 1991)
            </p>
          </div>

          {/* Date and Reference Bar */}
          <div className="flex justify-between items-center text-xs font-sans my-2.5 text-slate-800 print:text-black">
            <div>
              <span className="font-bold text-black">Notice Ref Date: </span>
              {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div>
              <span className="font-bold text-black">Last Recorded Payment: </span>
              <span className="font-mono font-bold text-emerald-950 print:text-black">
                {activeProperty.lastPaidYear} (Quarter {activeProperty.lastPaidQuarter || 4})
              </span>
            </div>
          </div>

          {/* Statutory Formal Notice Salutation */}
          <div className="my-2.5 text-xs leading-relaxed text-black font-sans text-justify">
            <p>
              <strong>NOTICE IS HEREBY SERVED</strong> that pursuant to the provisions of Section 254 of Republic Act No. 7160,
              otherwise known as the <em>Local Government Code of 1991</em>, the Real Property Tax due and payable for calendar
              year <strong>{activeProperty.lastPaidYear + 1}</strong> and prior delinquent calendar years has become delinquent
              with respect to the real property declared under your name as itemized below:
            </p>
          </div>

          {/* Property Assessment Summary Card */}
          <div className="border border-black p-3 text-xs font-sans grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-2.5 bg-slate-50/50 print:bg-white">
            <div>
              <p className="text-[9.5pt] text-slate-600 print:text-black uppercase font-bold text-[9px]">Tax Declaration No.</p>
              <p className="font-mono font-bold text-black text-xs">{activeProperty.tdNumber}</p>
            </div>
            <div>
              <p className="text-[9.5pt] text-slate-600 print:text-black uppercase font-bold text-[9px]">PIN / Cadastral Lot</p>
              <p className="font-mono text-black text-xs">{activeProperty.pin || 'Cadastral Lot Verified'}</p>
            </div>
            <div>
              <p className="text-[9.5pt] text-slate-600 print:text-black uppercase font-bold text-[9px]">Kind / Class</p>
              <p className="font-semibold text-black text-xs">{activeProperty.propertyClass}</p>
            </div>
            <div>
              <p className="text-[9.5pt] text-slate-600 print:text-black uppercase font-bold text-[9px]">Base Assessed Value</p>
              <p className="font-mono font-bold text-emerald-950 print:text-black text-xs">
                ₱{activeProperty.assessedValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-[9.5pt] text-slate-600 print:text-black uppercase font-bold text-[9px]">Declared Owner</p>
              <p className="font-bold text-black text-xs">{activeProperty.ownerName}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[9.5pt] text-slate-600 print:text-black uppercase font-bold text-[9px]">Location</p>
              <p className="text-black text-xs">{activeProperty.address}, {activeProperty.barangay}, Santa Rosa, N.E.</p>
            </div>
          </div>

          {/* Itemized Delinquency Roll Table */}
          <div className="my-3 border border-black overflow-hidden text-xs font-sans">
            <table className="w-full text-left border-collapse border border-black">
              <thead>
                <tr className="bg-slate-100 print:bg-white text-black font-bold border-b border-black text-[11px]">
                  <th className="py-1.5 px-2.5 border border-black">Assessment Era / Roll Period</th>
                  <th className="py-1.5 px-2.5 text-right border border-black">Assessed Value (AV)</th>
                  <th className="py-1.5 px-2.5 text-right border border-black">Unpaid Taxes (1% Fund Base)</th>
                  <th className="py-1.5 px-2.5 text-right border border-black">Penalties / Discounts</th>
                  <th className="py-1.5 px-2.5 text-right border border-black">Total Delinquency (Per Fund)</th>
                </tr>
              </thead>
              <tbody>
                {itemizedRows.map((r: TaxYearRecord, idx: number) => {
                  const label = r.periodLabel || String(r.year);
                  const isCleared = r.status === 'Cleared';
                  const isPending = Boolean(r.isMissingValuation || r.isUnverifiedHistorical || r.totalDue === null);
                  const unpaidTaxes = isCleared || isPending || r.baseTax === null ? undefined : r.baseTax / 2;
                  const penaltyOrDiscount = isCleared || isPending || r.penaltyAmount === null ? undefined : (r.penaltyAmount - (r.discountAmount || 0)) / 2;
                  const totalDelinquency = isCleared || isPending || r.totalDue === null ? undefined : r.totalDue / 2;

                  return (
                    <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50 print:bg-white' : 'bg-white'}>
                      <td className="py-1.5 px-2.5 font-semibold text-black border border-black">
                        {label}
                        {r.status === 'Cleared' && (
                          <span className="ml-2 text-[10px] font-normal text-slate-600 print:text-black font-sans">(Cleared)</span>
                        )}
                        {r.isMissingValuation && (
                          <span className="ml-2 text-[10px] font-semibold text-amber-900 print:text-black font-sans">
                            {r.isUnverifiedHistorical ? '[Prior Historical]' : '[RPTAR Req.]'}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono text-black border border-black">
                        {r.isMissingValuation ? (
                          <span className="text-slate-600 print:text-black italic font-sans text-[10px]">Pending RPTAR</span>
                        ) : (
                          formatCurrency(r.assessedValue ?? activeProperty.assessedValue)
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono text-black border border-black">
                        {r.isMissingValuation ? (
                          <span className="text-slate-400 italic text-[10px]">--</span>
                        ) : (
                          formatCurrency(unpaidTaxes)
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono text-black border border-black">
                        {r.isMissingValuation ? (
                          <span className="text-slate-400 italic text-[10px]">--</span>
                        ) : (
                          formatCurrency(penaltyOrDiscount)
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-bold text-black border border-black">
                        {r.isMissingValuation ? (
                          <span className="text-slate-400 italic text-[10px]">--</span>
                        ) : (
                          formatCurrency(totalDelinquency)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-black bg-slate-100/80 print:bg-white font-bold text-black">
                <tr>
                  <td colSpan={4} className="py-1.5 px-2.5 text-right uppercase tracking-wider text-[11px] border border-black">
                    Basic Real Property Tax (1% General Fund):
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono text-xs font-bold text-black border border-black">
                    {formatCurrency(totals.basic)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-1.5 px-2.5 text-right uppercase tracking-wider text-[11px] border border-black">
                    Special Education Fund (1% Local School Board):
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono text-xs font-bold text-black border border-black">
                    {formatCurrency(totals.sef)}
                  </td>
                </tr>
                <tr className="bg-slate-200/90 print:bg-white text-black text-xs border-t-2 border-black">
                  <td colSpan={4} className="py-2 px-2.5 text-right uppercase tracking-wider font-extrabold border border-black">
                    Grand Total Tax Delinquency Payable:
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono font-extrabold text-sm text-black border border-black">
                    ₱{totals.grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Statutory Legal Remedies Clause (RA 7160 Sec. 254 / 256) */}
          <div className="p-3 my-3 border border-black text-[10px] text-justify space-y-1 bg-slate-50/50 print:bg-white">
            <div className="flex items-center gap-1.5 font-bold text-black font-sans">
              <ShieldAlert size={13} className="text-black shrink-0" />
              <span>STATUTORY REMEDIES FOR COLLECTION OF REAL PROPERTY TAX (RA 7160)</span>
            </div>
            <p className="text-black leading-normal font-sans">
              Pursuant to <strong>Sections 254 and 256 of Title II, Book II of Republic Act No. 7160</strong>, notice is hereby
              given that failure to pay the delinquent tax and surcharge within the statutory demand period will compel the
              Municipal Treasurer to enforce remedies simultaneously or consecutively, including:
              (1) <strong>Administrative levy on the real property</strong> subject to the tax lien;
              (2) <strong>Distraint of personal property</strong>; or
              (3) <strong>Public auction sale</strong> of the delinquent property to satisfy the lien, interest, and costs of sale.
            </p>
          </div>

          {/* Official Signatories Section (SSOT 2.9.5) */}
          <div className="pt-6 grid grid-cols-3 gap-6 text-center font-sans text-xs">
            <div>
              <p className="text-slate-700 print:text-black text-[10px] uppercase font-bold mb-6">Prepared by:</p>
              <div className="border-t border-black pt-1">
                <p className="font-bold text-black uppercase">Revenue Collection Clerk</p>
                <p className="text-[10px] text-slate-600 print:text-black">Municipal Treasurer's Office</p>
              </div>
            </div>

            <div>
              <p className="text-slate-700 print:text-black text-[10px] uppercase font-bold mb-6">Received by:</p>
              <div className="border-t border-black pt-1">
                <p className="font-bold text-black uppercase">Taxpayer / Authorized Rep.</p>
                <p className="text-[10px] text-slate-600 print:text-black">Signature over printed name & Date</p>
              </div>
            </div>

            <div>
              <p className="text-slate-700 print:text-black text-[10px] uppercase font-bold mb-6">Approved by:</p>
              <div className="border-t border-black pt-1">
                <p className="font-black text-black uppercase">Myra V. Cunanan</p>
                <p className="text-[10px] font-bold text-black uppercase">Municipal Treasurer</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
