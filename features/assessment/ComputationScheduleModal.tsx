import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react';
import { api } from '@/services/api';
import type { ComputationScheduleVersion, User } from '@/types';
import { parseComputationWorkbook } from '@/utils/computationWorkbook';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ComputationScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

const sha256 = async (bytes: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
};

const toDateInput = (value: string): string => value || new Date().toISOString().slice(0, 10);

export default function ComputationScheduleModal({ isOpen, onClose, currentUser }: ComputationScheduleModalProps) {
  const [schedules, setSchedules] = useState<ComputationScheduleVersion[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [scheduleName, setScheduleName] = useState('Official computation schedule');
  const [authorityReference, setAuthorityReference] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(toDateInput(''));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [parsed, setParsed] = useState<ComputationScheduleVersion | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadSchedules = async () => {
    try {
      setSchedules(await api.getComputationSchedules());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load computation schedules.');
    }
  };

  useEffect(() => {
    if (isOpen && currentUser?.role === 'Admin') void loadSchedules();
  }, [isOpen, currentUser?.role]);

  const handleFile = async (selected: File | null) => {
    setFile(selected);
    setParsed(null);
    setErrors([]);
    setMessage('');
    if (!selected) return;
    try {
      const bytes = await selected.arrayBuffer();
      const workbook = parseComputationWorkbook(bytes, selected.name);
      const rows = workbook.sheets.flatMap((sheet) => sheet.rows.map((row) => ({
        periodLabel: row.periodLabel,
        startYear: row.startYear,
        endYear: row.endYear,
        basicTaxRate: row.baseTaxRate,
        penaltyRate: row.adjustment === 'PENALTY' ? row.adjustmentRate : undefined,
        discountRate: row.adjustment === 'DISCOUNT' ? row.adjustmentRate : undefined,
        discountType: row.adjustment === 'DISCOUNT' ? 'SCHEDULED' : undefined,
        sourceSheet: row.sourceSheet,
        sourceRow: row.sourceRow,
        sourceFormula: row.sourceCells.map((cell) => `${cell.address}:${cell.formula}`).join(' | '),
      })));
      const workbookErrors = workbook.sheets.flatMap((sheet) => sheet.errors);
      setErrors(workbookErrors);
      if (rows.length === 0 || workbookErrors.length > 0) return;
      setParsed({
        scheduleName,
        authorityReference,
        sourceFilename: selected.name,
        sourceFileHash: await sha256(bytes),
        status: 'DRAFT',
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        uploadedBy: currentUser?.username || String(currentUser?.id || ''),
        rows,
      });
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Unable to parse computation workbook.']);
    }
  };

  const refreshParsedMetadata = () => {
    if (!parsed) return;
    setParsed({ ...parsed, scheduleName, authorityReference, effectiveFrom, effectiveTo: effectiveTo || undefined });
  };

  const saveDraft = async () => {
    if (!parsed || !authorityReference.trim()) {
      setMessage('Authority or ordinance reference is required before saving.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api.createComputationSchedule({ ...parsed, scheduleName, authorityReference, effectiveFrom, effectiveTo: effectiveTo || undefined });
      setMessage('Draft saved. It cannot affect calculations until separately activated.');
      await loadSchedules();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save draft.');
    } finally {
      setBusy(false);
    }
  };

  const activate = async (schedule: ComputationScheduleVersion) => {
    if (!schedule.id || !currentUser?.username) return;
    setBusy(true);
    setMessage('');
    try {
      await api.activateComputationSchedule(schedule.id, currentUser.username);
      setMessage(`Schedule ${schedule.authorityReference} activated and prior overlapping active schedules superseded.`);
      await loadSchedules();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to activate schedule.');
    } finally {
      setBusy(false);
    }
  };

  if (currentUser?.role !== 'Admin') return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /> Computation Schedule Registry</DialogTitle>
          <DialogDescription>Upload official policy input as immutable draft. Spreadsheet formulas are parsed as evidence, never executed.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium">Schedule name<input className="mt-1 w-full rounded border p-2" value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} /></label>
          <label className="text-sm font-medium">Authority / ordinance reference<input className="mt-1 w-full rounded border p-2" value={authorityReference} onChange={(event) => setAuthorityReference(event.target.value)} /></label>
          <label className="text-sm font-medium">Effective from<input type="date" className="mt-1 w-full rounded border p-2" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label>
          <label className="text-sm font-medium">Effective to (optional)<input type="date" className="mt-1 w-full rounded border p-2" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} /></label>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed p-4 text-sm">
          <Upload className="h-5 w-5" />
          <span>{file ? file.name : 'Choose official .xlsx or .xls workbook'}</span>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0] || null)} />
        </label>

        {parsed && (
          <div className="rounded border p-3">
            <div className="mb-2 flex items-center justify-between"><strong>Parsed preview</strong><Badge variant="secondary">{parsed.rows.length} rules</Badge></div>
            <div className="max-h-48 overflow-auto text-xs">
              {parsed.rows.map((row, index) => <div key={`${row.periodLabel}-${index}`} className="grid grid-cols-5 gap-2 border-b py-1"><span>{row.periodLabel}</span><span>{row.startYear}-{row.endYear}</span><span>Basic {row.basicTaxRate ?? '—'}</span><span>Penalty {row.penaltyRate ?? '—'}</span><span>Discount {row.discountRate ?? '—'}</span></div>)}
            </div>
            <Button className="mt-3" onClick={refreshParsedMetadata} variant="outline">Refresh metadata</Button>
          </div>
        )}

        {errors.length > 0 && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Import blocked</div>{errors.map((error) => <div key={error}>{error}</div>)}</div>}
        {message && <div className="rounded bg-slate-100 p-3 text-sm">{message}</div>}

        <div className="rounded border p-3">
          <h3 className="mb-2 font-semibold">Version history</h3>
          {schedules.length === 0 && <p className="text-sm text-slate-500">No registered schedules.</p>}
          {schedules.map((schedule) => <div key={schedule.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm"><div><div className="font-medium">{schedule.scheduleName} <Badge variant="outline">{schedule.status}</Badge></div><div>{schedule.authorityReference} · {schedule.effectiveFrom}{schedule.effectiveTo ? ` to ${schedule.effectiveTo}` : ' onward'} · {schedule.sourceFilename}</div></div>{schedule.status !== 'ACTIVE' && schedule.status !== 'SUPERSEDED' && <Button size="sm" disabled={busy} onClick={() => void activate(schedule)}><CheckCircle2 className="mr-1 h-4 w-4" /> Activate</Button>}</div>)}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button disabled={!parsed || errors.length > 0 || busy} onClick={() => void saveDraft()}><FileSpreadsheet className="mr-1 h-4 w-4" /> Save draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
