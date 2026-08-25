import { useState, useEffect, useCallback, createContext, useContext, useRef, useMemo, type ReactNode } from 'react';

// ─── Types ───────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, opts?: { duration?: number; action?: { label: string; onClick: () => void } }) => void;
  success: (message: string) => void;
  error: (message: string, opts?: { action?: { label: string; onClick: () => void } }) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─── Icons ───────────────────────────────────────────────────────
const ICONS: Record<ToastType, ReactNode> = {
  success: (
    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const BG_STYLES: Record<ToastType, string> = {
  success: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30',
  error: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30',
  warning: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30',
  info: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30',
};

// ─── Single Toast Item ───────────────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    const dur = toast.duration ?? (toast.type === 'error' ? 6000 : 4000);
    timerRef.current = setTimeout(dismiss, dur);
    return () => clearTimeout(timerRef.current);
  }, [toast.duration, toast.type, dismiss]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm max-w-sm w-full transition-all duration-200 ${BG_STYLES[toast.type]} ${
        exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-slide-in-right'
      }`}
    >
      <div className="shrink-0 mt-0.5">{ICONS[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => { toast.action!.onClick(); dismiss(); }}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, opts?: { duration?: number; action?: { label: string; onClick: () => void } }) => {
    const id = `toast-${++idRef.current}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, ...opts }]);
  }, []);

  const value: ToastContextValue = useMemo(() => ({
    toast: addToast,
    success: (msg: string) => addToast('success', msg),
    error: (msg: string, opts?: { action?: { label: string; onClick: () => void } }) => addToast('error', msg, opts),
    warning: (msg: string) => addToast('warning', msg),
    info: (msg: string) => addToast('info', msg),
    dismiss,
  }), [addToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
