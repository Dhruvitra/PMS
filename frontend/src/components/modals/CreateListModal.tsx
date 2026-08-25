import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../ui/Toast';

interface CreateListModalProps {
  spaceId: string;
  folderId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateListModal({ spaceId, folderId, onClose, onSuccess }: CreateListModalProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      const payload: any = {
        name: name.trim(),
        spaceId
      };
      if (folderId) payload.folderId = folderId;

      const res = await api.post('/lists', payload);

      if (res.data.success) {
        success('List created successfully');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to create list');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-transparent dark:border-gray-800">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New List</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">List Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Backlog, Sprint 1, Client Work"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-transparent focus:bg-white dark:focus:bg-gray-950 focus:ring-2 focus:ring-indigo-500 rounded-xl transition-all text-gray-900 dark:text-white"
              autoFocus
            />
            {folderId && (
              <p className="mt-2 text-[11px] text-gray-400">
                This list will be created inside the selected folder.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {isSubmitting ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
