import React, { useState, useMemo } from 'react';
import { Property, TaxYearRecord } from '@/types';
import { calculateTaxLiability } from '@/utils/taxLogic';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Printer,
  Download,
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

  const handleExportCsv = () => {
    if (!activeProperty || !assessmentResult) return;

    const lines: string[] = [];
    lines.push('REPUBLIC OF THE PHILIPPINES,,,,,,,,,,,,,,,,,');
    lines.push('PROVINCE OF NUEVA ECIJA,,,,,,,,,,,,,,,,,');
    lines.push('Office of the Treasurer - Municipality of Santa Rosa,,,,,,,,,,,,,,,,,');
    lines.push(',,,,,,,,,,,,,,,,,');
    lines.push('NOTICE OF DELINQUENCY IN THE PAYMENT OF REAL PROPERTY TAX (RA 7160 SEC. 254),,,,,,,,,,,,,,,,,');
    lines.push(`,,,,,,,Notice Ref:,"NOD-${activeProperty.tdNumber}-${new Date().getFullYear()}",,Date:,"${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}",,,`);
    lines.push(',,,,,,,,,,,,,,,,,');
    lines.push(`,,,,,,LAST VERIFIED SETTLEMENT:,${activeProperty.lastPaidYear} (Q${activeProperty.lastPaidQuarter || 4}),,,,,,,,,,`);
    lines.push(',"Notice is hereby served pursuant to the provision of Section 254, Republic Act No. 7160 (Local Government Code of 1991) the Real Property Tax for Calendar",,,,,,,,,,,,,,,,');
    lines.push(`"year ${activeProperty.lastPaidYear + 1} and the previous years, has been delinquent with respect to the figures below.",,,,,,,,,,,,,,,,,`);
    lines.push(',,,,,,,,,,,,,,,,,');
    lines.push('Tax Declaration No.,,Area,Assessed Value,Location,,Kind of Property,,,,Year,Unpaid Taxes,,Penalties/Discount,,Total Tax Delinquency,,');

    itemizedRows.forEach((r: TaxYearRecord) => {
      const yearLabel = r.periodLabel || String(r.year);
      const isPending = Boolean(r.isMissingValuation || r.isUnverifiedHistorical || r.totalDue === null);
      const unpaidTaxes = isPending || r.baseTax === null ? 'Pending RPTAR' : (r.baseTax / 2).toFixed(2);
      const penaltyOrDiscount = isPending || r.penaltyAmount === null ? 'Pending RPTAR' : ((r.penaltyAmount - (r.discountAmount || 0)) / 2).toFixed(2);
      const totalDelinquency = isPending || r.totalDue === null ? 'Pending RPTAR' : (r.totalDue / 2).toFixed(2);
      const assessedValStr = isPending
        ? 'Pending RPTAR'
        : (r.assessedValue ?? activeProperty.assessedValue).toFixed(2);

      lines.push(
        `"${activeProperty.tdNumber}",,"${activeProperty.lotAreaSqm || 'N/A'}","${assessedValStr}","${activeProperty.barangay}, Santa Rosa",,"${activeProperty.propertyClass}",,,,${yearLabel},${unpaidTaxes},,${penaltyOrDiscount},,${totalDelinquency},,`
      );
    });

    lines.push(',,,,,,,,,,,,,,,,,');
    lines.push(`,,,,,,,,,,,,,BASIC,,${totals.basic.toFixed(2)},,`);
    lines.push(`,,,,,,,,,,,,,SEF,,${totals.sef.toFixed(2)},,`);
    lines.push(`,,,,,,,,,,,,,TOTAL,,${totals.grandTotal.toFixed(2)},,`);
    lines.push(',,,,,,,,,,,,,,,,,');
    lines.push('Prepared by:,,,,,,,Received by:,,,,,,Approved by:,,,');
    lines.push('Revenue Collection Clerk,,,,,,,Signature over printed name & Date,,,,,,Myra V. Cunanan,,,');
    lines.push(',,,,,,,,,,,,,Municipal Treasurer,,,');

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Notice_of_Delinquency_${activeProperty.tdNumber}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              onClick={handleExportCsv}
              className="h-8 px-3 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 gap-1 text-xs"
            >
              <Download size={14} />
              Export CSV
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
        <div id="printable-notice" className="p-8 sm:p-12 print:p-6 bg-white max-w-[850px] mx-auto text-slate-900 leading-tight">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-4">
            <p className="text-[11px] uppercase tracking-widest text-slate-600 font-semibold font-sans">Republic of the Philippines</p>
            <p className="text-[11px] uppercase tracking-widest text-slate-600 font-semibold font-sans">Province of Nueva Ecija</p>
            <h1 className="text-base font-extrabold tracking-tight uppercase text-slate-900 mt-0.5">
              Municipality of Santa Rosa
            </h1>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mt-0.5">
              Office of the Municipal Treasurer
            </p>
            <div className="mt-3 inline-block bg-slate-900 text-white px-4 py-1 text-xs font-bold uppercase tracking-widest rounded-sm">
              Notice of Delinquency in the Payment of Real Property Tax
            </div>
            <p className="text-[10px] text-slate-500 mt-1 italic">
              Pursuant to Section 254, Republic Act No. 7160 (Local Government Code of 1991)
            </p>
          </div>

          {/* Date and Reference Bar */}
          <div className="flex justify-between items-center text-xs font-sans my-3 text-slate-700">
            <div>
              <span className="font-bold text-slate-900">Notice Ref Date: </span>
              {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            <div>
              <span className="font-bold text-slate-900">Last Verified Settlement Baseline: </span>
              <span className="font-mono font-semibold text-emerald-900">
                {activeProperty.lastPaidYear} (Quarter {activeProperty.lastPaidQuarter || 4})
              </span>
            </div>
          </div>

          {/* Statutory Formal Notice Salutation */}
          <div className="my-3 text-xs leading-relaxed text-slate-800 font-sans text-justify">
            <p>
              <strong>NOTICE IS HEREBY SERVED</strong> that pursuant to the provisions of Section 254 of Republic Act No. 7160,
              otherwise known as the <em>Local Government Code of 1991</em>, the Real Property Tax due and payable for calendar
              year <strong>{activeProperty.lastPaidYear + 1}</strong> and prior delinquent calendar years has become delinquent
              with respect to the real property declared under your name as itemized below:
            </p>
          </div>

          {/* Property Assessment Summary Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-sans grid grid-cols-2 sm:grid-cols-4 gap-3 my-2">
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Tax Declaration No.</p>
              <p className="font-mono font-bold text-slate-900">{activeProperty.tdNumber}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">PIN / Cadastral Lot</p>
              <p className="font-mono text-slate-800">{activeProperty.pin || 'Cadastral Lot Verified'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Kind / Class</p>
              <p className="font-semibold text-slate-800">{activeProperty.propertyClass}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Base Assessed Value</p>
              <p className="font-mono font-bold text-emerald-900">
                ₱{activeProperty.assessedValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Declared Owner</p>
              <p className="font-bold text-slate-900">{activeProperty.ownerName}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[10px] text-slate-500 uppercase font-bold">Location</p>
              <p className="text-slate-800">{activeProperty.address}, {activeProperty.barangay}, Santa Rosa, N.E.</p>
            </div>
          </div>

          {/* Itemized Delinquency Roll Table */}
          <div className="my-4 border border-slate-300 rounded-lg overflow-hidden text-xs font-sans">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[11px]">
                  <th className="py-2 px-3">Assessment Era / Roll Period</th>
                  <th className="py-2 px-3 text-right">Assessed Value (AV)</th>
                  <th className="py-2 px-3 text-right">Unpaid Taxes (1% Fund Base)</th>
                  <th className="py-2 px-3 text-right">Penalties / Discounts</th>
                  <th className="py-2 px-3 text-right">Total Delinquency (Per Fund)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {itemizedRows.map((r: TaxYearRecord, idx: number) => {
                  const label = r.periodLabel || String(r.year);
                  const isDelinquent = r.status === 'Delinquent';
                  const isCleared = r.status === 'Cleared';
                  const isPending = Boolean(r.isMissingValuation || r.isUnverifiedHistorical || r.totalDue === null);
                  const unpaidTaxes = isCleared || isPending || r.baseTax === null ? undefined : r.baseTax / 2;
                  const penaltyOrDiscount = isCleared || isPending || r.penaltyAmount === null ? undefined : (r.penaltyAmount - (r.discountAmount || 0)) / 2;
                  const totalDelinquency = isCleared || isPending || r.totalDue === null ? undefined : r.totalDue / 2;

                  return (
                    <tr key={idx} className={isDelinquent ? 'bg-amber-50/40' : ''}>
                      <td className="py-1.5 px-3 font-semibold text-slate-800">
                        {label}
                        {r.status === 'Cleared' && (
                          <span className="ml-2 text-[10px] font-normal text-emerald-600 font-sans">(Cleared)</span>
                        )}
                        {r.isMissingValuation && (
                          <span className="ml-2 text-[10px] font-semibold text-amber-700 font-sans bg-amber-100 px-1 py-0.5 rounded">
                            {r.isUnverifiedHistorical ? '⚠️ Prior Historical (RPTAR)' : '⚠️ RPTAR Req.'}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                        {r.isMissingValuation ? (
                          <span className="text-amber-700 italic font-sans text-[10px]">Pending RPTAR</span>
                        ) : (
                          formatCurrency(r.assessedValue ?? activeProperty.assessedValue)
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                        {r.isMissingValuation ? (
                          <span className="text-slate-400 italic text-[10px]">--</span>
                        ) : (
                          formatCurrency(unpaidTaxes)
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                        {r.isMissingValuation ? (
                          <span className="text-slate-400 italic text-[10px]">--</span>
                        ) : (
                          formatCurrency(penaltyOrDiscount)
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
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
              <tfoot className="border-t-2 border-slate-800 bg-slate-100/80 font-bold text-slate-900">
                <tr>
                  <td colSpan={4} className="py-2 px-3 text-right uppercase tracking-wider text-[11px]">
                    Basic Real Property Tax (1% General Fund):
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm font-bold text-slate-900">
                    {formatCurrency(totals.basic)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-1.5 px-3 text-right uppercase tracking-wider text-[11px]">
                    Special Education Fund (1% Local School Board):
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-sm font-bold text-slate-900">
                    {formatCurrency(totals.sef)}
                  </td>
                </tr>
                <tr className="bg-emerald-100/70 text-emerald-950 text-sm border-t border-emerald-300">
                  <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider font-extrabold">
                    Grand Total Tax Delinquency Payable:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-extrabold text-base text-emerald-950">
                    ₱{totals.grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Statutory Legal Remedies Clause (RA 7160 Sec. 254 / 256) */}
          <div className="p-3.5 my-4 bg-slate-50 border border-slate-300 rounded-xl text-[11px] text-justify space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 font-sans">
              <ShieldAlert size={14} className="text-amber-700 shrink-0" />
              <span>STATUTORY REMEDIES FOR COLLECTION OF REAL PROPERTY TAX (RA 7160)</span>
            </div>
            <p className="text-slate-700 leading-normal font-sans">
              Pursuant to <strong>Sections 254 and 256 of Title II, Book II of Republic Act No. 7160</strong>, notice is hereby
              given that failure to pay the delinquent tax and surcharge within the statutory demand period will compel the
              Municipal Treasurer to enforce remedies simultaneously or consecutively, including:
              (1) <strong>Administrative levy on the real property</strong> subject to the tax lien;
              (2) <strong>Distraint of personal property</strong>; or
              (3) <strong>Public auction sale</strong> of the delinquent property to satisfy the lien, interest, and costs of sale.
            </p>
          </div>

          {/* Official Signatories Section (SSOT 2.9.5) */}
          <div className="pt-8 grid grid-cols-3 gap-6 text-center font-sans text-xs">
            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-8">Prepared by:</p>
              <div className="border-t border-slate-700 pt-1">
                <p className="font-bold text-slate-900 uppercase">Assessment & Verification Officer</p>
                <p className="text-[10px] text-slate-500">Municipal Assessor / Treasurer's Office</p>
              </div>
            </div>

            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-8">Received by:</p>
              <div className="border-t border-slate-700 pt-1">
                <p className="font-bold text-slate-900 uppercase">Taxpayer / Authorized Rep.</p>
                <p className="text-[10px] text-slate-500">Signature over printed name & Date</p>
              </div>
            </div>

            <div>
              <p className="text-slate-500 text-[10px] uppercase font-bold mb-8">Approved by:</p>
              <div className="border-t border-slate-700 pt-1">
                <p className="font-black text-slate-900 uppercase">Myra V. Cunanan</p>
                <p className="text-[10px] font-bold text-emerald-900 uppercase">Municipal Treasurer</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
