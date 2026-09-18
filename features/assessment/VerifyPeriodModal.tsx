import React, { useEffect, useState } from 'react';
import { TaxYearRecord } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle } from 'lucide-react';

export type VerificationModalStatus =
  | 'VERIFIED_SETTLED_EXTERNALLY'
  | 'VERIFIED_OUTSTANDING'
  | 'DISPUTED'
  | 'NOT_APPLICABLE';

export type VerificationEvidenceType =
  | 'OFFICIAL_RECEIPT'
  | 'ASSESSMENT_ROLL_AUDIT'
  | 'COURT_ORDER_AMNESTY'
  | 'PRIOR_REGISTRY_FOLIO';

export interface VerificationModalValue {
  status: VerificationModalStatus;
  evidenceType: VerificationEvidenceType;
  sourceReference: string;
  remarks: string;
}

interface VerifyPeriodModalProps {
  isOpen: boolean;
  records: TaxYearRecord[];
  onClose: () => void;
  onSubmit: (value: VerificationModalValue) => void;
  isSubmitting?: boolean;
}

const VerifyPeriodModal: React.FC<VerifyPeriodModalProps> = ({
  isOpen,
  records,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const [status, setStatus] = useState<VerificationModalStatus>('VERIFIED_SETTLED_EXTERNALLY');
  const [evidenceType, setEvidenceType] = useState<VerificationEvidenceType>('OFFICIAL_RECEIPT');
  const [sourceReference, setSourceReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStatus('VERIFIED_SETTLED_EXTERNALLY');
    setEvidenceType('OFFICIAL_RECEIPT');
    setSourceReference('');
    setRemarks('');
    setHasAttemptedSubmit(false);
  }, [isOpen, records]);

  const requiresReference = status === 'VERIFIED_SETTLED_EXTERNALLY';
  const requiresBasis = status === 'VERIFIED_OUTSTANDING' || status === 'DISPUTED';
  const hasReference = sourceReference.trim().length > 0;
  const hasRemarks = remarks.trim().length > 0;

  const isReferenceMissing = requiresReference && !hasReference;
  const isBasisMissing = requiresBasis && !hasReference && !hasRemarks;
  const isValid = !isReferenceMissing && !isBasisMissing;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    if (!isValid || isSubmitting) return;
    onSubmit({
      status,
      evidenceType,
      sourceReference: sourceReference.trim(),
      remarks: remarks.trim(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Verify Delinquency Period</DialogTitle>
          <DialogDescription>
            Record assessment or external settlement evidence. No payment is posted by this action.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <strong>{records.length}</strong> period{records.length === 1 ? '' : 's'} selected, oldest unresolved period first.
          </div>

          {hasAttemptedSubmit && !isValid && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Required Audit Documentation Missing</p>
                <p className="text-[11px] text-rose-700">
                  {isReferenceMissing
                    ? 'Official receipt or external document reference is required to verify external settlement under COA audit regulations.'
                    : 'A reference citation or operator justification remarks are required to substantiate this assessment action.'}
                </p>
              </div>
            </div>
          )}

          <label className="block space-y-1.5 text-sm font-medium">
            Verification status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as VerificationModalStatus)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={isSubmitting}
            >
              <option value="VERIFIED_SETTLED_EXTERNALLY">Settled externally</option>
              <option value="VERIFIED_OUTSTANDING">Outstanding liability confirmed</option>
              <option value="DISPUTED">Disputed</option>
              <option value="NOT_APPLICABLE">Not applicable</option>
            </select>
          </label>

          <label className="block space-y-1.5 text-sm font-medium">
            Evidence type
            <select
              value={evidenceType}
              onChange={(event) => setEvidenceType(event.target.value as VerificationEvidenceType)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={isSubmitting}
            >
              <option value="OFFICIAL_RECEIPT">External official receipt / AF-51 reference</option>
              <option value="ASSESSMENT_ROLL_AUDIT">Assessment roll audit</option>
              <option value="COURT_ORDER_AMNESTY">Court order / amnesty authority</option>
              <option value="PRIOR_REGISTRY_FOLIO">Prior registry folio citation</option>
            </select>
          </label>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">
              Reference or citation {requiresReference ? '(required)' : '(recommended)'}
            </label>
            <input
              value={sourceReference}
              onChange={(event) => setSourceReference(event.target.value)}
              placeholder="e.g. AF-51 OR #1029384, Folio 2024-042, Court Order #882"
              className={`h-9 w-full rounded-md border bg-background px-3 text-sm ${
                hasAttemptedSubmit && isReferenceMissing
                  ? 'border-rose-500 focus-visible:ring-rose-500/20'
                  : 'border-input'
              }`}
              disabled={isSubmitting}
            />
            {hasAttemptedSubmit && isReferenceMissing ? (
              <p className="text-[11px] text-rose-600 font-medium">
                Mandatory under COA audit rules: Enter official AF-51 receipt number or external reference.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                Documentary proof of settlement or reference citation.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">
              Operator remarks {requiresBasis && !hasReference ? '(required if reference is omitted)' : ''}
            </label>
            <textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={3}
              placeholder="Explain verification basis, dispute history, or statutory justification."
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                hasAttemptedSubmit && isBasisMissing
                  ? 'border-rose-500 focus-visible:ring-rose-500/20'
                  : 'border-input'
              }`}
              disabled={isSubmitting}
            />
            {hasAttemptedSubmit && isBasisMissing && (
              <p className="text-[11px] text-rose-600 font-medium">
                Provide operator justification or explanation to confirm outstanding liability or dispute.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Verification'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VerifyPeriodModal;
