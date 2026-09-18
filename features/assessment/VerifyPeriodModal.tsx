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

  useEffect(() => {
    if (!isOpen) return;
    setStatus('VERIFIED_SETTLED_EXTERNALLY');
    setEvidenceType('OFFICIAL_RECEIPT');
    setSourceReference('');
    setRemarks('');
  }, [isOpen, records]);

  const requiresReference = status === 'VERIFIED_SETTLED_EXTERNALLY';
  const requiresBasis = status === 'VERIFIED_OUTSTANDING' || status === 'DISPUTED';
  const isValid = sourceReference.trim().length > 0 || (!requiresReference && !requiresBasis && remarks.trim().length > 0);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
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

          <label className="block space-y-1.5 text-sm font-medium">
            Reference or citation {requiresReference ? '(required)' : ''}
            <input
              value={sourceReference}
              onChange={(event) => setSourceReference(event.target.value)}
              placeholder="AF-51 number, folio, order, or assessment reference"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={isSubmitting}
            />
          </label>

          <label className="block space-y-1.5 text-sm font-medium">
            Operator remarks {requiresBasis ? '(reference or remarks required)' : ''}
            <textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={4}
              placeholder="Explain verification basis, dispute, or exception."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={isSubmitting}
            />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Verification'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VerifyPeriodModal;
