import React, { useState, useEffect } from 'react';
import { OfficialReceipt, User } from '@/types';
import { api } from '@/services/api';
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
import { Input } from '@/components/ui/input';
import { Printer, CheckCircle2, Building, Ban, ShieldAlert, Lock, AlertTriangle, ArrowLeft, FileText } from 'lucide-react';

interface ClearanceModalProps {
  isOpen?: boolean;
  receipt: OfficialReceipt | null;
  onClose: () => void;
  onStayOnProperty?: () => void;
  onReturnToDashboard?: () => void;
  currentUser?: User | null;
  onReceiptVoided?: (receiptNo: string) => void;
}

const OfficialReceiptModal: React.FC<ClearanceModalProps> = ({
  isOpen = true,
  receipt,
  onClose,
  onStayOnProperty,
  onReturnToDashboard,
  currentUser,
  onReceiptVoided,
}) => {
  const [activeReceipt, setActiveReceipt] = useState<OfficialReceipt | null>(receipt);

  // Voiding Workflow State
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isSubmittingVoid, setIsSubmittingVoid] = useState(false);

  useEffect(() => {
    setActiveReceipt(receipt);
  }, [receipt]);

  if (!isOpen || !activeReceipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExecuteVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      setVoidError('A valid cancellation reason is required under COA regulations.');
      return;
    }
    if (!adminPassword.trim()) {
      setVoidError('Supervisor password confirmation is required.');
      return;
    }

    setIsSubmittingVoid(true);
    setVoidError(null);

    try {
      // 1. Re-authenticate administrator
      const isValid = await api.verifyPassword(currentUser?.username || 'admin', adminPassword);
      if (!isValid) {
        setVoidError('Incorrect administrator password. Authorization rejected.');
        return;
      }

      // 2. Execute void transaction
      await api.voidReceipt({
        receiptNo: activeReceipt.receiptNo,
        reason: voidReason.trim(),
        authorizedBy: currentUser?.name || 'Treasury Administrator',
        stationId: currentUser?.stationId || 'Main-HQ',
      });

      // 3. Update local receipt state
      setActiveReceipt((prev) =>
        prev
          ? {
              ...prev,
              status: 'VOIDED',
              voidReason: voidReason.trim(),
              voidedBy: currentUser?.name || 'Treasury Administrator',
              voidedAt: new Date().toISOString(),
            }
          : null
      );

      setIsVoidModalOpen(false);
      setVoidReason('');
      setAdminPassword('');
      onReceiptVoided?.(activeReceipt.receiptNo);
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : 'Failed to void receipt.');
    } finally {
      setIsSubmittingVoid(false);
    }
  };

  const records = activeReceipt.itemizedRecords || [];
  const totalPaid = activeReceipt.summary?.totalPaid || 0;
  const basicTotal = activeReceipt.summary?.basicTax || 0;
  const sefTotal = activeReceipt.summary?.sefTax || 0;
  const penaltyTotal = activeReceipt.summary?.penalty || 0;
  const discountTotal = activeReceipt.summary?.discount || 0;
  const isVoided = activeReceipt.status === 'VOIDED';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[95vh] p-0 flex flex-col overflow-hidden gap-0 border-slate-300 shadow-2xl print:max-w-none print:max-h-none print:border-none print:shadow-none print:bg-white print:p-0 print:m-0">
          {/* Modal Top Actions (Hidden in Print) */}
          <DialogHeader className="bg-slate-900 text-white px-6 py-3.5 flex flex-row items-center justify-between no-print border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded-lg shrink-0 ${isVoided ? 'bg-red-600' : 'bg-emerald-600'}`}>
                {isVoided ? <Ban className="h-4 w-4 text-white" /> : <CheckCircle2 className="h-4 w-4 text-white" />}
              </div>
              <div>
                <DialogTitle className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                  <span>Real Property Tax Clearance</span>
                  {isVoided ? (
                    <Badge variant="destructive" className="text-[10px] font-mono uppercase">
                      VOIDED
                    </Badge>
                  ) : (
                    <Badge variant="success" className="text-[10px] font-mono uppercase">
                      ISSUED
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400">
                  Official Accountable Form No. 51 Tax Ledger Slip
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 mr-6">
              {currentUser?.role === 'Admin' && !isVoided && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsVoidModalOpen(true)}
                  className="text-xs font-bold rounded-xl gap-1.5"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Void Receipt (COA)
                </Button>
              )}
              <Button
                type="button"
                onClick={handlePrint}
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-sm gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print Clearance Slip
              </Button>
            </div>
          </DialogHeader>

          {/* Printable Clearance Slip */}
          <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1 print:p-0 print:bg-white">
            <div
              id="printable-receipt"
              className={`p-6 bg-white text-slate-900 font-sans border-2 shadow-sm print:border print:m-0 print:p-4 ${
                isVoided ? 'border-red-600' : 'border-slate-800'
              }`}
            >
              {/* VOIDED Banner */}
              {isVoided && (
                <div className="bg-red-50 border-2 border-red-600 p-3 mb-4 rounded-lg text-center">
                  <div className="text-red-700 font-extrabold text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                    <Ban className="h-4 w-4" />
                    *** OFFICIAL RECEIPT VOIDED & CANCELLED (COA AUDIT) ***
                  </div>
                  <div className="text-red-600 text-xs mt-1 space-x-2">
                    <span><strong>Reason:</strong> {activeReceipt.voidReason || 'Supervisory Cancellation'}</span>
                    <span>•</span>
                    <span><strong>Authorized By:</strong> {activeReceipt.voidedBy || 'Administrator'}</span>
                    <span>•</span>
                    <span><strong>Date Voided:</strong> {activeReceipt.voidedAt ? new Date(activeReceipt.voidedAt).toLocaleString('en-PH') : 'Recorded'}</span>
                  </div>
                </div>
              )}

              {/* Spreadsheet Header Block */}
              <div className={`border p-3 text-center mb-0 ${isVoided ? 'border-red-600 bg-red-50/50' : 'border-slate-800 bg-slate-100'}`}>
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
                    <span className="font-bold text-slate-600 uppercase text-[10px]">
                      Accountable Form No. 51 Ref:
                    </span>
                    <span className={`font-mono font-black text-xs ${isVoided ? 'text-red-600 line-through' : 'text-blue-900'}`}>
                      {activeReceipt.receiptNo}
                    </span>
                  </div>
                  <div className="p-2 flex justify-between">
                    <span className="font-bold text-slate-600 uppercase text-[10px]">
                      Date & Time Issued:
                    </span>
                    <span className="font-mono font-semibold text-slate-800 text-[11px]">
                      {new Date(activeReceipt.date).toLocaleString('en-PH')}
                    </span>
                  </div>
                </div>

                {/* Property Details Matrix */}
                <div className="grid grid-cols-2 divide-x divide-slate-800 border-b border-slate-800">
                  <div className="p-2 bg-slate-50/60">
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">
                      Tax Declaration No. (TDN):
                    </span>
                    <span className="font-mono font-black text-slate-900 text-xs">
                      {activeReceipt.property.tdNumber}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50/60">
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">
                      Property Index No. (PIN):
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {activeReceipt.property.pin || 'NOT SPECIFIED'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-slate-800 border-b border-slate-800">
                  <div className="p-2">
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">
                      Declared Owner:
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {activeReceipt.property.ownerName}
                    </span>
                  </div>
                  <div className="p-2">
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">
                      Location of Property:
                    </span>
                    <span className="font-medium text-slate-800 text-xs">
                      {activeReceipt.property.address}, Brgy. {activeReceipt.property.barangay}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-slate-800">
                  <div className="p-2 bg-slate-50/60">
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">
                      Classification:
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {activeReceipt.property.propertyClass}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50/60 flex justify-between items-center">
                    <span className="font-bold text-slate-500 uppercase text-[10px]">
                      Assessed Valuation:
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      ₱{activeReceipt.property.assessedValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Itemized Table Breakdown */}
              <div className="mt-3 border border-slate-800 overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-800 text-[10px] font-black uppercase text-slate-800 tracking-wider">
                      <th className="py-1.5 px-3 text-left border-r border-slate-800">Tax Period / Year</th>
                      <th className="py-1.5 px-3 text-right border-r border-slate-800">Basic Tax (1%)</th>
                      <th className="py-1.5 px-3 text-right border-r border-slate-800">SEF Tax (1%)</th>
                      <th className="py-1.5 px-3 text-right border-r border-slate-800">Penalty (2%/mo)</th>
                      <th className="py-1.5 px-3 text-right border-r border-slate-800">Discount</th>
                      <th className="py-1.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {records.map((rec, idx) => (
                      <tr key={rec.periodLabel ? `${rec.periodLabel}-${idx}` : `${rec.year}-${idx}`} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-bold border-r border-slate-800 text-slate-900">
                          {rec.periodLabel || rec.year}
                        </td>
                        <td className="py-1.5 px-3 text-right border-r border-slate-800">
                          ₱{((rec.basicTax ?? rec.baseTax / 2) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-3 text-right border-r border-slate-800">
                          ₱{((rec.sefTax ?? rec.baseTax / 2) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-3 text-right border-r border-slate-800 text-red-600">
                          {(rec.penaltyAmount || 0) > 0 ? `₱${rec.penaltyAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-right border-r border-slate-800 text-emerald-600">
                          {(rec.discountAmount || 0) > 0 ? `-₱${rec.discountAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-right font-black text-slate-900">
                          ₱{rec.totalDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-800 text-[11px]">
                      <td className="py-2 px-3 border-r border-slate-800 font-sans font-black uppercase text-[10px]">
                        Grand Totals:
                      </td>
                      <td className="py-2 px-3 text-right border-r border-slate-800 font-mono">
                        ₱{basicTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-slate-800 font-mono">
                        ₱{sefTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-slate-800 font-mono text-red-600">
                        ₱{penaltyTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right border-r border-slate-800 font-mono text-emerald-600">
                        ₱{discountTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-sm bg-slate-200">
                        ₱{totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Legal Certification Matrix */}
              <div className="mt-3 p-3 border border-slate-800 bg-slate-50 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700 uppercase">Compliance Verification:</span>
                  <Badge
                    variant={isVoided ? 'destructive' : 'success'}
                    className="font-extrabold text-[10px] rounded uppercase"
                  >
                    {isVoided ? 'STATUS: CANCELLED / VOIDED (COA)' : 'STATUS: OFFICIALLY CLEARED (RA 7160)'}
                  </Badge>
                </div>
                <p className="mt-1 text-[10px] text-slate-600 leading-snug">
                  {isVoided
                    ? 'This Official Receipt has been revoked by the Municipal Treasury Supervisor under Commission on Audit (COA) cancellation protocols. Historical tax liability has been reverted.'
                    : 'This document certifies that statutory Real Property Tax liabilities and Special Education Fund (SEF) levies for the periods listed above have been audited and officially updated as CLEARED in the municipal tax ledger.'}
                </p>
              </div>

              {/* Signature Matrix */}
              <div className="mt-3 border border-slate-800 grid grid-cols-2 divide-x divide-slate-800 text-xs">
                <div className="p-3 bg-white">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-5">Assessed & Recorded By:</p>
                  <div className="border-b border-slate-800 pb-0.5 mb-1 font-bold text-slate-900 text-center font-mono">
                    {activeReceipt.postedBy}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center uppercase font-medium">Assessor / Clearance Officer</p>
                </div>

                <div className="p-3 bg-white">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-5">Approved & Certified By:</p>
                  <div className="border-b border-slate-800 pb-0.5 mb-1 font-bold text-slate-900 text-center uppercase">
                    OFFICE OF THE MUNICIPAL TREASURER
                  </div>
                  <p className="text-[10px] text-slate-500 text-center uppercase font-medium">Municipality of Santa Rosa</p>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <DialogFooter className="bg-slate-100 px-6 py-3 border-t border-slate-300 flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 no-print shrink-0">
            <p className="text-[11px] text-slate-500 font-medium text-center sm:text-left">
              Clearance recorded. Choose your next action:
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onStayOnProperty || onClose}
                className="px-4 py-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FileText size={14} className="text-emerald-700" />
                Stay on this Property (TD)
              </Button>
              <Button
                type="button"
                onClick={onReturnToDashboard || onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                Back to Masterlist Dashboard
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supervisory Void Authorization Dialog */}
      <Dialog open={isVoidModalOpen} onOpenChange={setIsVoidModalOpen}>
        <DialogContent className="max-w-md p-6 bg-white rounded-2xl shadow-2xl border-slate-200">
          <DialogHeader className="space-y-2">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-1">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Authorize Receipt Void (COA Protocol)
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 leading-relaxed">
              Voiding an Official Receipt rolls back the property's tax dues in the ledger. Under COA rules, this action is immutable and permanently logged.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecuteVoid} className="space-y-4 mt-2">
            {voidError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{voidError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Official Receipt Number
              </label>
              <Input
                value={activeReceipt.receiptNo}
                disabled
                className="bg-slate-100 font-mono text-sm font-bold text-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Reason for Cancellation (Mandatory)
              </label>
              <Input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g., Wrong property valuation applied / Dishonored check"
                className="text-sm"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Supervisor Password Confirmation
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVoidModalOpen(false)}
                disabled={isSubmittingVoid}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmittingVoid || !voidReason.trim() || !adminPassword.trim()}
              >
                {isSubmittingVoid ? 'Authorizing Void...' : 'Execute Supervisory Void'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OfficialReceiptModal;
