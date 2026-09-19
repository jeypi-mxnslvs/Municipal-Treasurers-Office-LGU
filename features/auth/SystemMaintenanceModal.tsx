import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/services/api';
import { CsvImportBatch, MaintenancePropertyCandidate, TestMasterlistPurgePreview, User } from '@/types';
import { AlertTriangle, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';

const CONFIRMATION = 'CONFIRM-PURGE-MASTERLIST';

interface Props { isOpen: boolean; onClose: () => void; currentUser: User; }

const SystemMaintenanceModal: React.FC<Props> = ({ isOpen, onClose, currentUser }) => {
  const [candidates, setCandidates] = useState<MaintenancePropertyCandidate[]>([]);
  const [batches, setBatches] = useState<CsvImportBatch[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [candidateIds, setCandidateIds] = useState<number[]>([]);
  const [preview, setPreview] = useState<TestMasterlistPurgePreview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [approvalReference, setApprovalReference] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedBatches, setExpandedBatches] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMessage(null); setPreview(null); setSelected([]); setConfirmation(''); setPassword('');
    void Promise.all([api.getMaintenancePropertyCandidates(), api.getImportBatches()])
      .then(([propertyCandidates, importBatches]) => { setCandidates(propertyCandidates); setBatches(importBatches); })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to load maintenance scope.'));
  }, [isOpen]);

  const toggleProperty = (id: number) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleImport = (batchId: number) => {
    const ids = candidates.filter((candidate) => candidate.importBatchId === batchId).map((candidate) => candidate.id);
    setSelected((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]);
  };
  const matchesSearch = (candidate: MaintenancePropertyCandidate) => `${candidate.tdNumber} ${candidate.ownerName} ${candidate.barangay}`.toLowerCase().includes(search.trim().toLowerCase());
  const toggleExpanded = (batchId: number) => setExpandedBatches((current) => current.includes(batchId) ? current.filter((id) => id !== batchId) : [...current, batchId]);
  const importedCandidates = candidates.filter((candidate) => candidate.importBatchId);
  const unlinkedCandidates = candidates.filter((candidate) => !candidate.importBatchId && matchesSearch(candidate));
  const toggleUnlinked = () => {
    const ids = candidates.filter((candidate) => !candidate.importBatchId).map((candidate) => candidate.id);
    setSelected((current) => ids.every((id) => current.includes(id)) ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]);
  };
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
      const scope = [...new Set(candidateIds)];
      const result = await api.classifyTestImportBatches({ propertyIds: scope, reason, authorizedBy: currentUser.name, authorizedRole: currentUser.role, approvalReference });
      setMessage(`${result.classifiedCount} property record(s) classified as test data. Run validation again before purge.`);
      const refreshed = await api.getMaintenancePropertyCandidates();
      setCandidates(refreshed);
      setCandidateIds(scope.filter((id) => refreshed.some((candidate) => candidate.id === id)));
      setPreview(null);
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
      const scope = [...new Set(candidateIds)];
      const result = await api.purgeTestMasterlist({ propertyIds: scope, confirmation, reason, authorizedBy: currentUser.name, authorizedRole: currentUser.role, approvalReference });
      setMessage(`Purge completed. Properties: ${result.propertyCount}; verifications: ${result.verificationCount}; row outcomes: ${result.rowOutcomeCount}.`);
       setPreview(null); setSelected([]); setCandidateIds([]);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Purge failed.'); } finally { setBusy(false); }
  };

  return <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="text-amber-600" /> System Maintenance</DialogTitle><DialogDescription>Allowlisted test-data purge only. Real or uncertain records must be archived, not purged.</DialogDescription></DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900"><AlertTriangle size={16} className="inline mr-2" />Protected: users, schedules, market values, security audit logs, and RPTAR audit logs.</div>
         <Input placeholder="Search individual TD, owner, or Barangay" value={search} onChange={(e) => setSearch(e.target.value)} />
         <div className="max-h-64 overflow-auto rounded border p-2 space-y-3">
           {batches.map((batch) => {
             const batchCandidates = importedCandidates.filter((candidate) => candidate.importBatchId === batch.id);
             const visibleBatchCandidates = batchCandidates.filter(matchesSearch);
             if (!visibleBatchCandidates.length) return null;
             const selectedCount = batchCandidates.filter((candidate) => selected.includes(candidate.id)).length;
             const allSelected = batchCandidates.length > 0 && selectedCount === batchCandidates.length;
             const expanded = expandedBatches.includes(Number(batch.id));
             return <div key={batch.id} className="rounded border p-2"><div className="flex items-center gap-2"><button type="button" className="rounded p-1 hover:bg-slate-100" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${batch.filename}`} onClick={() => toggleExpanded(Number(batch.id))}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button><input type="checkbox" checked={allSelected} onChange={() => toggleImport(Number(batch.id))} aria-label={`Select all TDs in ${batch.filename}`} /><span className="font-semibold">📁 {batch.filename}</span><span className="text-xs text-slate-500">({batchCandidates.length} TDs{batch.createdAt ? ` • Imported ${new Date(batch.createdAt).toLocaleDateString()}` : ''})</span><span className="ml-auto text-xs font-medium">[{selectedCount}/{batchCandidates.length}]</span></div>{expanded && <div className="ml-9 mt-1 space-y-1">{visibleBatchCandidates.map((candidate) => <label key={candidate.id} className="flex gap-2 text-xs"><input type="checkbox" checked={selected.includes(candidate.id)} onChange={() => toggleProperty(candidate.id)} />TD {candidate.tdNumber} | {candidate.ownerName} | {candidate.barangay}</label>)}</div>}</div>;
           })}
           {unlinkedCandidates.length > 0 && <div className="rounded border border-amber-300 p-2"><div className="flex items-center gap-2"><input type="checkbox" checked={unlinkedCandidates.length > 0 && unlinkedCandidates.every((candidate) => selected.includes(candidate.id))} onChange={toggleUnlinked} /><p className="font-semibold text-amber-800">Unlinked TDs ({unlinkedCandidates.length})</p><span className="ml-auto text-xs font-medium">[{unlinkedCandidates.filter((candidate) => selected.includes(candidate.id)).length}/{unlinkedCandidates.length}]</span></div><div className="mt-1 space-y-1">{unlinkedCandidates.map((candidate) => <label key={candidate.id} className="flex gap-2 text-xs"><input type="checkbox" checked={selected.includes(candidate.id)} onChange={() => toggleProperty(candidate.id)} />TD {candidate.tdNumber} | {candidate.ownerName} | {candidate.barangay}</label>)}</div></div>}
         </div>
         <p className="text-xs text-slate-600">Selected TDs: {selected.length}. Import master ticks select every TD currently linked to that import. Individual search handles precise exceptions.</p>
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
