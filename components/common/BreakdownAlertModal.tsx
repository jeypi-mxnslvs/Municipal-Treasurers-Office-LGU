/**
 * LGU Treasury Connect — Breakdown Alert Modal
 *
 * Accessible, rich error/policy dialog that replaces all native browser
 * `window.alert()` calls. Renders with severity-specific color schemes,
 * statutory guidance for Treasury staff, and a collapsible technical trace.
 *
 * Severity levels:
 *  - 'error'    → API / database failure (rose)
 *  - 'warning'  → Non-fatal advisory (amber)
 *  - 'policy'   → Governance / security rule violation (violet)
 *  - 'info'     → Informational confirmation (blue)
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldAlert, Info, ChevronDown, ChevronUp, XCircle } from 'lucide-react';

export type AlertSeverity = 'error' | 'warning' | 'policy' | 'info';

export interface BreakdownAlertAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
}

export interface BreakdownAlertProps {
  isOpen: boolean;
  onClose: () => void;
  severity: AlertSeverity;
  title: string;
  /** Human-readable summary for Treasury staff */
  summary: string;
  /** Optional statutory/operational context paragraph */
  guidance?: string;
  /** Raw technical error string for support — shown in collapsible */
  technicalDetail?: string;
  /** Extra action buttons beside the default Dismiss */
  actions?: BreakdownAlertAction[];
}

// ─── Severity Config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  error: {
    icon: XCircle,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-600',
    headerBg: 'bg-rose-50 border-b border-rose-200',
    titleColor: 'text-rose-900',
    badgeBg: 'bg-rose-100 text-rose-700 border-rose-200',
    summaryColor: 'text-slate-700',
    technicalBg: 'bg-rose-50 border border-rose-200',
    dismissVariant: 'outline' as const,
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    headerBg: 'bg-amber-50 border-b border-amber-200',
    titleColor: 'text-amber-900',
    badgeBg: 'bg-amber-100 text-amber-700 border-amber-200',
    summaryColor: 'text-slate-700',
    technicalBg: 'bg-amber-50 border border-amber-200',
    dismissVariant: 'outline' as const,
  },
  policy: {
    icon: ShieldAlert,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    headerBg: 'bg-violet-50 border-b border-violet-200',
    titleColor: 'text-violet-900',
    badgeBg: 'bg-violet-100 text-violet-700 border-violet-200',
    summaryColor: 'text-slate-700',
    technicalBg: 'bg-violet-50 border border-violet-200',
    dismissVariant: 'outline' as const,
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    headerBg: 'bg-blue-50 border-b border-blue-200',
    titleColor: 'text-blue-900',
    badgeBg: 'bg-blue-100 text-blue-700 border-blue-200',
    summaryColor: 'text-slate-700',
    technicalBg: 'bg-blue-50 border border-blue-200',
    dismissVariant: 'outline' as const,
  },
} satisfies Record<AlertSeverity, object>;

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  error: 'System Error',
  warning: 'Warning',
  policy: 'Security Policy',
  info: 'Information',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const BreakdownAlertModal: React.FC<BreakdownAlertProps> = ({
  isOpen,
  onClose,
  severity,
  title,
  summary,
  guidance,
  technicalDetail,
  actions = [],
}) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;

  const handleClose = () => {
    setIsDetailOpen(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg p-0 flex flex-col overflow-hidden gap-0 border-slate-200 shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className={`px-6 py-5 ${cfg.headerBg}`}>
          <div className="flex items-start gap-4">
            <div className={`p-2.5 ${cfg.iconBg} rounded-xl shrink-0 mt-0.5`}>
              <Icon size={20} className={cfg.iconColor} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${cfg.badgeBg}`}>
                  {SEVERITY_LABEL[severity]}
                </span>
              </div>
              <DialogTitle className={`text-sm font-bold leading-snug ${cfg.titleColor}`}>
                {title}
              </DialogTitle>
              <DialogDescription className="sr-only">{summary}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 flex-1 bg-white">
          {/* Summary */}
          <p className={`text-sm leading-relaxed ${cfg.summaryColor}`}>
            {summary}
          </p>

          {/* Statutory / Operational Guidance */}
          {guidance && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[12px] text-slate-600 leading-relaxed">
              <p className="font-semibold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">
                Guidance
              </p>
              {guidance}
            </div>
          )}

          {/* Collapsible Technical Breakdown */}
          {technicalDetail && (
            <div>
              <button
                type="button"
                onClick={() => setIsDetailOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                {isDetailOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {isDetailOpen ? 'Hide' : 'Show'} technical details
              </button>
              {isDetailOpen && (
                <div className={`mt-2 p-3 rounded-xl ${cfg.technicalBg}`}>
                  <pre className="text-[10px] font-mono text-slate-600 whitespace-pre-wrap break-all leading-relaxed">
                    {technicalDetail}
                  </pre>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {new Date().toLocaleString('en-PH', {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-row justify-end gap-2 shrink-0">
          {actions.map((action, i) => (
            <Button
              key={i}
              type="button"
              variant={action.variant ?? 'default'}
              size="sm"
              onClick={() => {
                action.onClick();
                handleClose();
              }}
              className="text-xs font-semibold"
            >
              {action.label}
            </Button>
          ))}
          <Button
            type="button"
            variant={cfg.dismissVariant}
            size="sm"
            onClick={handleClose}
            className="text-xs font-semibold"
          >
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BreakdownAlertModal;
