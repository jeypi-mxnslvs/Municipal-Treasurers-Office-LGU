import React, { useState } from 'react';
import { Property, User } from '@/types';
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
import { Printer, ShieldCheck, Download, CheckCircle2 } from 'lucide-react';

interface TaxClearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
  currentUser: User | null;
  eligibility?: {
    isEligible: boolean;
    ineligibilityReasons: string[];
    outstandingTotal?: number;
    hasUnverifiedPeriods?: boolean;
    hasDisputedPeriods?: boolean;
    hasHistoricalGaps?: boolean;
  };
}

export const TaxClearanceModal: React.FC<TaxClearanceModalProps> = ({
  isOpen,
  onClose,
  property,
  currentUser,
  eligibility,
}) => {
  const [purpose, setPurpose] = useState('Transfer of Ownership / BIR CAR');
  const [customPurpose, setCustomPurpose] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  if (!property) return null;

  const fallbackReasons = [
    ...(property.isShellRecord ? ['Property is a shell record and requires Assessor verification.'] : []),
    ...(!property.pin?.trim() ? ['Property has no verified PIN.'] : []),
    ...(property.assessedValue <= 0 ? ['Property has no positive assessed value.'] : []),
  ];
  const eligibilityReasons = eligibility?.ineligibilityReasons || fallbackReasons;
  const isEligible = Boolean(eligibility?.isEligible) && eligibilityReasons.length === 0;

  const effectivePurpose = purpose === 'Other' ? customPurpose || 'General Reference' : purpose;
  const certificateDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const certificateId = `TC-${new Date().getFullYear()}-${String(property.id || 1000).padStart(5, '0')}`;

  const handlePrint = () => {
    if (!isEligible) return;
    window.print();
  };

  const handleExportCsv = () => {
    if (!isEligible) return;
    setIsExporting(true);
    try {
      const csvContent = [
        'MUNICIPALITY OF SANTA ROSA - OFFICE OF THE TREASURER',
        'CERTIFICATE OF REAL PROPERTY TAX CLEARANCE',
        `Certificate No:,${certificateId}`,
        `Date Issued:,${certificateDate}`,
        `Tax Declaration No:,${property.tdNumber}`,
        `PIN:,${property.pin || 'N/A'}`,
        `Declared Owner:,${property.ownerName}`,
        `Property Location:,${property.address} - ${property.barangay}`,
        `Classification:,${property.propertyClass}`,
        `Assessed Value:,PHP ${property.assessedValue.toLocaleString()}`,
        `Purpose:,${effectivePurpose}`,
        `Status:,FULLY CLEARED - NO OUTSTANDING DELINQUENCY`,
        `Verified By:,${currentUser?.name || 'Authorized Staff'} (${currentUser?.stationId || 'Desk'})`,
        `Approving Officer:,Myra V. Cunanan - Municipal Treasurer`,
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tax_Clearance_${property.tdNumber}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export tax clearance:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 border-slate-200 shadow-2xl bg-slate-50 print:p-0 print:border-none print:shadow-none print:bg-white print:max-w-none print:max-h-none">
        {/* Screen Header (Hidden on Print) */}
        <DialogHeader className="p-6 bg-slate-900 text-white flex flex-row items-center justify-between no-print shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-emerald-400" size={20} />
              <DialogTitle className="text-lg font-bold text-white">
                Certificate of Real Property Tax Clearance
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-400 mt-1">
              Official certification under RA 7160 Sec. 254 for parcels with zero liabilities
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isExporting}
              className="bg-slate-800 text-slate-200 hover:text-white border-slate-700 text-xs font-semibold gap-1.5"
            >
              <Download size={14} />
              Export CSV
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              disabled={!isEligible}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer size={14} />
              Print Certificate
            </Button>
          </div>
        </DialogHeader>

        {!isEligible && (
          <div className="mx-5 mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-bold">Ineligible for Tax Clearance</p>
            <p className="mt-1 text-xs">Certification remains blocked until all statutory and archival conditions are satisfied.</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
              {eligibilityReasons.length > 0 ? eligibilityReasons.map((reason) => <li key={reason}>{reason}</li>) : <li>Authoritative eligibility result is required before issuance.</li>}
            </ul>
          </div>
        )}

        {/* Configuration Controls (Hidden on Print) */}
         <div className="p-5 bg-white border-b border-slate-200 text-xs space-y-3 no-print">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                Purpose of Clearance
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-800 focus:outline-emerald-600"
              >
                <option value="Transfer of Ownership / BIR CAR">Transfer of Ownership / BIR CAR</option>
                <option value="Bank Loan / Mortgage Requirement">Bank Loan / Mortgage Requirement</option>
                <option value="Building / Construction Permit">Building / Construction Permit</option>
                <option value="Business Permit Renewal">Business Permit Renewal</option>
                <option value="General Reference / Personal Record">General Reference / Personal Record</option>
                <option value="Other">Other (Specify below)</option>
              </select>
            </div>

            {purpose === 'Other' && (
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                  Specify Purpose
                </label>
                <input
                  type="text"
                  value={customPurpose}
                  onChange={(e) => setCustomPurpose(e.target.value)}
                  placeholder="e.g. Legal Proceeding"
                  className="w-full h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-800 focus:outline-emerald-600"
                />
              </div>
            )}
          </div>
        </div>

        {/* Certificate Body (High-Fidelity Printable Document) */}
        <div className="p-8 sm:p-12 bg-white print:p-8 m-4 sm:m-6 rounded-2xl border border-slate-200 shadow-xs print:m-0 print:border-none print:shadow-none print:rounded-none">
          {/* Municipal Header */}
          <div className="text-center pb-6 border-b-2 border-emerald-900/40 relative">
            <div className="flex justify-center items-center gap-4 mb-2">
              <img
                src="/santa-rosa-seal.png"
                alt="Santa Rosa Municipal Seal"
                className="w-16 h-16 object-contain"
              />
            </div>
            <p className="text-[11px] uppercase tracking-widest font-serif text-slate-600">Republic of the Philippines</p>
            <p className="text-[11px] uppercase tracking-widest font-serif text-slate-600">Province of Nueva Ecija</p>
            <h2 className="text-base font-serif font-bold uppercase text-slate-900 tracking-wider mt-0.5">
              Municipality of Santa Rosa
            </h2>
            <p className="text-xs font-serif font-semibold text-emerald-900 mt-1 uppercase tracking-wider">
              Office of the Municipal Treasurer
            </p>
          </div>

          {/* Certificate Title */}
          <div className="text-center py-8">
            <h1 className="text-xl sm:text-2xl font-serif font-extrabold uppercase tracking-wide text-slate-950 underline underline-offset-8 decoration-emerald-800/60">
              Tax Clearance Certificate
            </h1>
            <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mt-2">
              Certificate Reference: {certificateId}
            </p>
          </div>

          {/* Certification Body */}
          <div className="space-y-6 text-sm text-slate-800 leading-relaxed font-serif">
            <p className="text-justify indent-8">
              <strong>TO WHOM IT MAY CONCERN:</strong>
            </p>

            <p className="text-justify indent-8">
              THIS IS TO CERTIFY that according to the official Real Property Tax Account Register (RPTAR) records
              and assessment rolls on file in this Office, the real property described below has been verified with 
              <strong> ZERO OUTSTANDING DELINQUENCY</strong> as of calendar date <strong>{certificateDate}</strong>:
            </p>

            {/* Property Specification Box */}
            <div className="my-6 p-5 rounded-xl border border-slate-300 bg-slate-50/60 print:bg-transparent print:border-slate-400 space-y-2.5 text-xs font-sans">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Tax Declaration No.</span>
                  <span className="font-bold text-slate-900 font-mono text-xs">{property.tdNumber}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">PIN</span>
                  <span className="font-mono text-slate-900 text-xs">{property.pin || 'N/A'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Classification</span>
                  <Badge variant="outline" className="text-[10px] font-semibold">{property.propertyClass}</Badge>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Assessed Value</span>
                  <span className="font-bold text-emerald-900 font-mono text-xs">₱{property.assessedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Declared Owner</span>
                  <span className="font-bold text-slate-900">{property.ownerName}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Location / Barangay</span>
                  <span className="text-slate-800">{property.address}, {property.barangay}, Santa Rosa, Nueva Ecija</span>
                </div>
              </div>
            </div>

            <p className="text-justify indent-8">
              This certification is issued upon the request of the interested party for the purpose of:
              {' '}<strong>{effectivePurpose}</strong>.
            </p>

            <p className="text-justify indent-8">
              Issued this <strong>{new Date().getDate()}</strong> day of <strong>{new Date().toLocaleDateString('en-US', { month: 'long' })}, {new Date().getFullYear()}</strong> at the Office of the Municipal Treasurer, Municipality of Santa Rosa, Province of Nueva Ecija, Philippines.
            </p>
          </div>

          {/* Signatory Block */}
          <div className="mt-16 pt-6 grid grid-cols-2 gap-8 text-xs font-sans">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Verified & Prepared by:</p>
              <div className="mt-8 border-t border-slate-400 pt-1 w-48">
                <p className="font-bold text-slate-900">{currentUser?.name || 'Revenue Assessment Clerk'}</p>
                <p className="text-[10px] text-slate-600">{currentUser?.role || 'Assessor'} • {currentUser?.stationId || 'Assessment Desk'}</p>
              </div>
            </div>

            <div className="text-right flex flex-col items-end">
              <p className="text-[10px] uppercase font-bold text-slate-500">Approved by:</p>
              <div className="mt-8 border-t border-slate-400 pt-1 w-56 text-center">
                <p className="font-bold text-slate-900 uppercase">Myra V. Cunanan</p>
                <p className="text-[10px] text-slate-600">Municipal Treasurer</p>
              </div>
            </div>
          </div>
        </div>

        {/* Screen Footer (Hidden on Print) */}
        <DialogFooter className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center no-print">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <CheckCircle2 size={15} className="text-emerald-600" />
            Statutory verification complete under RA 7160
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
