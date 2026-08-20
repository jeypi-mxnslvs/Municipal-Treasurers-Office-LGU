import React, { useState, useEffect } from 'react';
import { RptarAuditLog, Property } from '../types';
import { api } from '../services/api';
import { History, X, Clock, UserCheck, ShieldCheck, FileText, ArrowRight } from 'lucide-react';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  property?: Property | null;
}

const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose, property }) => {
  const [logs, setLogs] = useState<RptarAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      if (property && property.id) {
        api.getPropertyAudit(property.id)
          .then(res => setLogs(res))
          .finally(() => setIsLoading(false));
      } else {
        api.getAllAuditLogs()
          .then(res => setLogs(res))
          .finally(() => setIsLoading(false));
      }
    }
  }, [isOpen, property]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <History size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">
                {property ? `RPTAR Revision Trail: ${property.tdNumber}` : 'System-Wide RPTAR Change Audit Trail'}
              </h2>
              <p className="text-xs text-slate-400">
                {property ? `Chronological modifications for ${property.ownerName}` : 'All recorded municipal property mutations and assessor attributions'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
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
                        <span className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] uppercase flex items-center gap-1 ${log.action_type === 'DUES_CLEARED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            log.action_type === 'CREATED' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                              log.action_type === 'DELETED' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                          {log.action_type === 'DUES_CLEARED' ? 'DUES CLEARED' : log.action_type}
                        </span>
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
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogModal;
