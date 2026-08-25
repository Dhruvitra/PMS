import React, { useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import { Modal } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  return (
    <Modal open={open} onClose={onCancel} className="max-w-md">
      <div className="p-6">
        {/* Icon */}
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4',
          variant === 'danger'
            ? 'bg-red-100 dark:bg-red-900/30'
            : 'bg-indigo-100 dark:bg-indigo-900/30'
        )}>
          {variant === 'danger' ? (
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {message}
        </p>
      </div>

      <div className="flex items-center gap-3 px-6 pb-6">
        <button
          ref={cancelRef}
          onClick={onCancel}
          disabled={loading}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50 shadow-md',
            variant === 'danger'
              ? 'bg-red-600 hover:bg-red-700 shadow-red-500/30'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'
          )}
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
