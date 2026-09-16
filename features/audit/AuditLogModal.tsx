import React, { useState, useEffect } from 'react';
import { RptarAuditLog, Property } from '@/types';
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
import { History, Clock, UserCheck, FileText, AlertCircle } from 'lucide-react';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  property?: Property | null;
}

const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, property }) => {
  const [logs, setLogs] = useState<RptarAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setLoadError(null);
      const request = property && property.id
        ? api.getPropertyAudit(property.id)
        : api.getAllAuditLogs();

      request
        .then((res) => setLogs(res))
        .catch((err) =>
          setLoadError(err instanceof Error ? err.message : 'Failed to load audit trail.')
        )
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, property]);

  const getBadgeVariant = (actionType: string) => {
    switch (actionType) {
      case 'CLEARED':
      case 'DUES_CLEARED':
        return 'success';
      case 'CREATED':
        return 'default';
      case 'DELETED':
        return 'destructive';
      case 'UPDATED':
      case 'VALUATION_REVISED':
      default:
        return 'warning';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] p-0 flex flex-col overflow-hidden gap-0">
        {/* Modal Header */}
        <DialogHeader className="bg-slate-900 px-6 py-4 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-lg shrink-0">
              <History size={18} className="text-white" />
            </div>
            <div>
              <DialogTitle className="font-bold text-base leading-tight text-white">
                {property ? `RPTAR Revision Trail: ${property.tdNumber}` : 'System-Wide RPTAR Change Audit Trail'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                {property
                  ? `Chronological modifications for ${property.ownerName}`
                  : 'All recorded municipal property mutations and assessor attributions'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {loadError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>Failed to load audit trail: {loadError}</span>
            </div>
          )}
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">
              <Clock className="animate-spin h-6 w-6 mx-auto mb-2 text-blue-600" />
              <p>Loading audit timeline...</p>
            </div>
          ) : logs.length > 0 ? (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {logs.map((log) => (
                <div key={log.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-600 shadow-xs" />

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 hover:bg-blue-50/40 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={getBadgeVariant(log.action_type)} className="text-[10px] font-bold uppercase tracking-wider">
                          {log.action_type === 'CLEARED' || log.action_type === 'DUES_CLEARED' ? 'DUES CLEARED' : log.action_type}
                        </Badge>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {log.td_number}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(log.timestamp).toLocaleString('en-PH')}
                      </span>
                    </div>

                    {/* Change Details */}
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {log.details}
                    </p>

                    {/* Assessor Attribution Badge */}
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <UserCheck size={13} className="text-blue-600" />
                        <span>Assessor: {log.assessor_name}</span>
                      </div>
                      <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200">
                        Counter: {log.station_id || 'Main-HQ'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 italic">
              <FileText size={28} className="mx-auto mb-2 opacity-40" />
              <p>No audit log history recorded for this property yet.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="bg-slate-50 px-6 py-3 border-t border-slate-200 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AuditLogModal;
