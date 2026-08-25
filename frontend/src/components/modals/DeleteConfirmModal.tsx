import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../ui/Toast';

interface DeleteConfirmModalProps {
  type: 'Space' | 'Folder' | 'List' | 'Organization';
  title: string;
  id: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteConfirmModal({ type, title, id, onClose, onSuccess }: DeleteConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const { success, error } = useToast();

  const requiresTypedConfirmation = type === 'Organization';
  const isConfirmed = !requiresTypedConfirmation || confirmText.toLowerCase() === 'delete';

  const handleDelete = async () => {
    if (!isConfirmed) return;
    try {
      setIsSubmitting(true);
      const endpoint = type === 'Space' ? `/spaces/${id}` : 
                       type === 'Folder' ? `/folders/${id}` : 
                       type === 'List' ? `/lists/${id}` : 
                       `/organizations/${id}`;
      const res = await api.delete(endpoint);

      if (res.data.success) {
        success(`${type} "${title}" deleted successfully`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      error(err.response?.data?.message || `Failed to delete ${type.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in border border-red-100 dark:border-red-900/30">
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete {type}?</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Are you sure you want to delete <span className="font-bold text-gray-700 dark:text-gray-300">"{title}"</span>?
            {type !== 'List' && ` All nested items within this ${type.toLowerCase()} will be permanently removed.`}
            This action cannot be undone.
          </p>

          {requiresTypedConfirmation && (
            <div className="mb-5">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                Type <span className="font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">delete</span> to confirm
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type delete here..."
                className="w-full px-4 py-2.5 text-sm font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-gray-400 placeholder:font-normal"
                autoFocus
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={handleDelete}
              disabled={isSubmitting || !isConfirmed}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600"
            >
              {isSubmitting ? 'Deleting...' : `Yes, Delete ${type}`}
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
