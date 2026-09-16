/**
 * LGU Treasury Connect — Unified Toast Notification System
 *
 * A lightweight, context-based toast stack that unifies:
 *  1. The existing live sync toast (WebSocket RPTAR mutations)
 *  2. New operational success/info/warning notifications
 *
 * Design intentionally matches the existing syncToast visual language
 * in App.tsx (dark slate card, bottom-right, auto-dismiss).
 *
 * Usage:
 *   // Wrap app in <ToastProvider>
 *   const { showToast } = useToast();
 *   showToast({ type: 'success', title: 'Property saved', message: 'RPTAR record committed.' });
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, Bell, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'info' | 'warning' | 'sync';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  /** Author attribution — used for sync toasts */
  author?: string;
  /** Duration in ms before auto-dismiss. Default: 4500 */
  duration?: number;
}

export interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Toast Icon & Color Config ────────────────────────────────────────────────

const TOAST_CONFIG: Record<
  ToastType,
  { icon: React.ElementType; iconBg: string; iconColor: string; ring: string }
> = {
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-emerald-600',
    iconColor: 'text-white',
    ring: 'ring-1 ring-emerald-500/30',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-600',
    iconColor: 'text-white',
    ring: 'ring-1 ring-blue-500/30',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-500',
    iconColor: 'text-white',
    ring: 'ring-1 ring-amber-500/30',
  },
  sync: {
    icon: Bell,
    iconBg: 'bg-emerald-600',
    iconColor: 'text-white',
    ring: 'ring-1 ring-emerald-500/30',
  },
};

// ─── Single Toast Card ────────────────────────────────────────────────────────

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const cfg = TOAST_CONFIG[toast.type];
  const Icon = cfg.icon;
  const isSync = toast.type === 'sync';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        flex items-start gap-3 bg-slate-900 text-white px-4 py-3.5
        rounded-2xl shadow-2xl border border-slate-700 max-w-sm w-full
        text-xs animate-fade-in-up ${cfg.ring}
      `}
    >
      <div className={`p-2 ${cfg.iconBg} rounded-xl shrink-0 mt-0.5 ${isSync ? 'animate-pulse' : ''}`}>
        <Icon size={15} className={cfg.iconColor} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-100 leading-snug truncate">{toast.title}</p>
        {toast.message && (
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{toast.message}</p>
        )}
        {toast.author && (
          <p className="text-[10px] text-slate-500 mt-0.5">By: {toast.author}</p>
        )}
      </div>

      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="text-slate-500 hover:text-slate-200 transition-colors shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// ─── Toast Stack (Renderer) ───────────────────────────────────────────────────

const ToastStack: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2.5 items-end pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: ToastItem = { ...toast, id };

      setToasts((prev) => {
        // Cap stack at 4 toasts; remove oldest if over limit
        const next = [...prev, item];
        return next.length > 4 ? next.slice(next.length - 4) : next;
      });

      const duration = toast.duration ?? 4500;
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  // Clean up all timers on unmount
  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>.');
  }
  return ctx;
}
