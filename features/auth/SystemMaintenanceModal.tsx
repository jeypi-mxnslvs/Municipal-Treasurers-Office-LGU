import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api';
import { MaintenancePropertyCandidate, TestMasterlistPurgePreview, User } from '@/types';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

const CONFIRMATION = 'CONFIRM-PURGE-MASTERLIST';

interface Props { isOpen: boolean; onClose: () => void; currentUser: User; }

const SystemMaintenanceModal: React.FC<Props> = ({ isOpen, onClose, currentUser }) => {
  const [candidates, setCandidates] = useState<MaintenancePropertyCandidate[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [candidateIds, setCandidateIds] = useState<number[]>([]);
  const [preview, setPreview] = useState<TestMasterlistPurgePreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [approvalReference, setApprovalReference] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMessage(null); setPreview(null); setSelected([]); setConfirmation(''); setPassword('');
    void api.getMaintenancePropertyCandidates().then(setCandidates).catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load property candidates.'));
  }, [isOpen]);

  const toggleBatch = (id: number) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const loadPreview = async () => {
    setBusy(true); setMessage(null);
    try { setPreview(await api.previewTestMasterlistPurge(candidateIds)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Preview failed.'); } finally { setBusy(false); }
  };
  const classify = async () => {
    if (currentUser.role !== 'SystemMaintenance') { setMessage('Only System Maintenance accounts may classify test data.'); return; }
    setBusy(true); setMessage(null);
    try {
      const valid = await api.verifyPassword(currentUser.username, password);
      if (!valid) throw new Error('Password authorization failed.');
      const result = await api.classifyTestImportBatches({ propertyIds: candidateIds, reason, authorizedBy: currentUser.name, authorizedRole: currentUser.role, approvalReference });
      setMessage(`${result.classifiedCount} property record(s) classified as test data. Run validation again before purge.`);
      setCandidates(await api.getMaintenancePropertyCandidates());
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Classification failed.'); } finally { setBusy(false); }
  };
  const purge = async () => {
    if (currentUser.role !== 'SystemMaintenance') { setMessage('Only System Maintenance accounts may purge test data.'); return; }
    if (confirmation !== CONFIRMATION) { setMessage(`Type ${CONFIRMATION} exactly.`); return; }
    if (!preview || preview.propertyCount === 0) { setMessage('Run preview and select a non-empty approved test batch.'); return; }
    setBusy(true); setMessage(null);
    try {
      const valid = await api.verifyPassword(currentUser.username, password);
      if (!valid) throw new Error('Password authorization failed.');
      const result = await api.purgeTestMasterlist({ propertyIds: candidateIds, confirmation, reason, authorizedBy: currentUser.name, authorizedRole: currentUser.role, approvalReference });
      setMessage(`Purge completed. Properties: ${result.propertyCount}; verifications: ${result.verificationCount}; row outcomes: ${result.rowOutcomeCount}.`);
      setPreview(null); setSelected([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Purge failed.'); } finally { setBusy(false); }
  };

  return <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="text-amber-600" /> System Maintenance</DialogTitle><DialogDescription>Allowlisted test-data purge only. Real or uncertain records must be archived, not purged.</DialogDescription></DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900"><AlertTriangle size={16} className="inline mr-2" />Protected: users, schedules, market values, security audit logs, and RPTAR audit logs.</div>
        <label className="block font-semibold">All active property candidates ({candidates.length})</label>
        <div className="max-h-48 overflow-auto rounded border p-2 space-y-1">{candidates.map((candidate) => <label key={candidate.id} className="flex gap-2"><input type="checkbox" checked={selected.includes(candidate.id)} onChange={() => toggleBatch(candidate.id)} />#{candidate.id} — {candidate.tdNumber} — {candidate.ownerName} — {candidate.barangay} — AV ₱{candidate.assessedValue.toLocaleString()} {candidate.importBatchId ? `(batch ${candidate.importBatchId})` : '(legacy/unlinked)'}</label>)}</div>
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setCandidateIds(selected)} disabled={busy || selected.length === 0}>Build selected scope</Button><Button type="button" variant="outline" onClick={classify} disabled={busy || candidateIds.length === 0}>Classify selected as test</Button><Button type="button" variant="outline" onClick={loadPreview} disabled={busy || candidateIds.length === 0}>Validate purge scope</Button></div>
        {preview && <div className="rounded border bg-slate-50 p-3">Validated scope: <strong>{preview.propertyCount}</strong> properties, <strong>{preview.verificationCount}</strong> verifications, <strong>{preview.rowOutcomeCount}</strong> row outcomes.</div>}
        <Input placeholder="Treasurer approval reference" value={approvalReference} onChange={(e) => setApprovalReference(e.target.value)} />
        <Input placeholder="Mandatory reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Input placeholder={CONFIRMATION} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        <Input type="password" placeholder="System Maintenance password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {message && <p className="rounded bg-slate-100 p-2 text-xs">{message}</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button><Button type="button" className="bg-rose-700 hover:bg-rose-800" disabled={busy || !preview} onClick={purge}>Purge Approved Test Data</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
};

export default SystemMaintenanceModal;
