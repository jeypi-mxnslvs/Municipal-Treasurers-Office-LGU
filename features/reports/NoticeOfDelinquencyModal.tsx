import React, { useState, useMemo } from 'react';
import { Property, TaxYearRecord } from '@/types';
import { calculateTaxLiability } from '@/utils/taxLogic';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Printer,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
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
    const basicTotal = itemizedRows.reduce((sum, r) => sum + (r.totalDue / 2), 0);
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
    lines.push(',,,,,,,,,,,,,,,,,');
    lines.push(`,,,,,,,OR#,,,,,,Date:,"${new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}",,,`);
    lines.push(',,,,,,,,,,,,,,,,,');
    lines.push(`,,,,,,LAST PAYMENT:,${activeProperty.lastPaidYear} (Q${activeProperty.lastPaidQuarter || 4}),,,,,,,,,,`);
    lines.push(',"Notice is hereby served pursuant to the provision of Section 254, Republic Act No. 7160 (Local Government Code of 1991) the Real Property Tax for Calendar",,,,,,,,,,,,,,,,');
    lines.push(`"year ${activeProperty.lastPaidYear + 1} and the previous years, has been delinquent with respect to the figures below.",,,,,,,,,,,,,,,,,`);
    lines.push(',,,,,,,,,,,,,,,,,');
    lines.push('Tax Declaration No.,,Area,Assessed Value,Location,,Kind of Property,,,,Year,Unpaid Taxes,,Penalties/Discount,,Total Tax Delinquency,,');

    itemizedRows.forEach((r: TaxYearRecord) => {
      const yearLabel = r.periodLabel || String(r.year);
      const unpaidTaxes = r.baseTax / 2;
      const penaltyOrDiscount = (r.penaltyAmount - (r.discountAmount || 0)) / 2;
      const totalDelinquency = r.totalDue / 2;

      lines.push(
        `"${activeProperty.tdNumber}",,"${activeProperty.lotAreaSqm || 'N/A'}","${activeProperty.assessedValue}","${activeProperty.barangay}, Santa Rosa",,"${activeProperty.propertyClass}",,,,${yearLabel},${unpaidTaxes.toFixed(2)},,${penaltyOrDiscount.toFixed(2)},,${totalDelinquency.toFixed(2)},,`
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
            <Badge variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-300">
              Record {currentIndex + 1} of {properties.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {properties.length > 1 && (
              <div className="flex items-center gap-1 mr-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(prev - 1, 0))}
                  className="h-8 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  title="Previous Property"
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentIndex >= properties.length - 1}
                  onClick={() => setCurrentIndex(prev => Math.min(prev + 1, properties.length - 1))}
                  className="h-8 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  title="Next Property"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-8 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700 gap-1.5"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm"
            >
              <Printer size={14} />
              <span>Print Demand Notice</span>
            </Button>
          </div>
        </div>

        {/* Official Printable Statutory Notice Document */}
        <div className="p-8 sm:p-10 font-serif leading-relaxed text-slate-900 bg-white">
          {/* Header Section */}
          <div className="text-center space-y-1 pb-4 border-b-2 border-slate-800">
            <div className="flex justify-center items-center gap-3">
              <img
                src="/santa-rosa-seal.png"
                alt="Seal of Santa Rosa"
                className="w-16 h-16 object-contain"
              />
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold text-slate-600">
                  Republic of the Philippines
                </p>
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-700">
                  Province of Nueva Ecija
                </p>
                <h2 className="text-base sm:text-lg font-black tracking-tight uppercase text-slate-900 font-sans">
                  Municipality of Santa Rosa
                </h2>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Office of the Municipal Treasurer
                </p>
              </div>
            </div>

            <div className="pt-3">
              <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-slate-950 font-sans">
                Notice of Delinquency in the Payment of Real Property Tax
              </h1>
              <p className="text-[11px] font-sans font-medium text-slate-500">
                Issued pursuant to Section 254, Title II of Republic Act No. 7160 (Local Government Code of 1991)
              </p>
            </div>
          </div>

          {/* Notice Metadata */}
          <div className="flex justify-between items-center text-xs font-sans py-3 border-b border-slate-200">
            <div>
              <span className="font-bold text-slate-700">Effective Roll Billing Date: </span>
              <span className="font-mono text-slate-900">
                {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-700">Last Recorded Clearance: </span>
              <span className="font-mono font-bold text-emerald-800">
                Year {activeProperty.lastPaidYear} (Q{activeProperty.lastPaidQuarter || 4})
              </span>
            </div>
          </div>

          {/* Statutory Notice Demand Paragraph */}
          <div className="py-4 text-xs sm:text-sm text-justify space-y-2">
            <p>
              <strong>NOTICE IS HEREBY SERVED</strong> to the declared owner and/or person having legal interest in the real property
              described below that pursuant to <strong>Section 254 of Republic Act No. 7160</strong>, the Real Property Tax for Calendar
              Year <strong>{activeProperty.lastPaidYear + 1}</strong> and prior unpaid years has become delinquent with respect to the
              statutory liabilities itemized herein:
            </p>
          </div>

          {/* Property Master Summary Card */}
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
              <p className="text-[10px] text-slate-500 uppercase font-bold">Assessed Value</p>
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
                  const unpaidTaxes = isCleared ? 0 : r.baseTax / 2;
                  const penaltyOrDiscount = isCleared ? 0 : (r.penaltyAmount - (r.discountAmount || 0)) / 2;
                  const totalDelinquency = isCleared ? 0 : r.totalDue / 2;

                  return (
                    <tr key={idx} className={isDelinquent ? 'bg-amber-50/40' : ''}>
                      <td className="py-1.5 px-3 font-semibold text-slate-800">
                        {label}
                        {r.status === 'Cleared' && (
                          <span className="ml-2 text-[10px] font-normal text-emerald-600 font-sans">(Cleared)</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(unpaidTaxes)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(penaltyOrDiscount)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(totalDelinquency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-800 bg-slate-100/80 font-bold text-slate-900">
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right uppercase tracking-wider text-[11px]">
                    Basic Real Property Tax (1% General Fund):
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm font-bold text-slate-900">
                    {formatCurrency(totals.basic)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="py-1.5 px-3 text-right uppercase tracking-wider text-[11px]">
                    Special Education Fund (1% Local School Board):
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-sm font-bold text-slate-900">
                    {formatCurrency(totals.sef)}
                  </td>
                </tr>
                <tr className="bg-emerald-100/70 text-emerald-950 text-sm border-t border-emerald-300">
                  <td colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider font-extrabold">
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
                <p className="font-bold text-slate-900 uppercase">Revenue Collection Clerk</p>
                <p className="text-[10px] text-slate-500">Municipal Treasurer's Office</p>
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
