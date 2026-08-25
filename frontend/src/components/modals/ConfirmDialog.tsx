import { useEffect } from 'react';

export type ConfirmDialogTone = 'danger' | 'default';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmDialogTone;
  isBusy?: boolean;
  /** Shown on the confirm button while `isBusy` (defaults by tone). */
  busyLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  tone = 'danger',
  isBusy = false,
  busyLabel,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const defaultBusy =
    tone === 'danger' ? 'Deleting...' : 'Please wait...';

  const confirmClasses =
    tone === 'danger'
      ? 'bg-red-500 hover:bg-red-600 text-white'
      : 'bg-indigo-500 hover:bg-indigo-600 text-white';

  return (
    <div
      className="fixed inset-0 z-[450] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[360px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="px-5 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-60"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isBusy}
              className={`px-5 py-2 rounded-lg font-semibold disabled:opacity-60 ${confirmClasses}`}
            >
              {isBusy ? (busyLabel ?? defaultBusy) : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

