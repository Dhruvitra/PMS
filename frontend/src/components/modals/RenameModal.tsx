import { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../ui/Toast';

interface RenameModalProps {
  type: 'Space' | 'Folder' | 'List' | 'Organization';
  initialTitle: string;
  id: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RenameModal({ type, initialTitle, id, onClose, onSuccess }: RenameModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success: showSuccess, error: showError } = useToast();

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title === initialTitle) {
      if (!title.trim()) showError('Name cannot be empty');
      else onClose();
      return;
    }

    try {
      setIsSubmitting(true);
      const endpoint = type === 'Space' ? `/spaces/${id}` : 
                       type === 'Folder' ? `/folders/${id}` : 
                       type === 'List' ? `/lists/${id}` : 
                       `/organizations/${id}`;
      const res = await api.patch(endpoint, { name: title.trim() });

      if (res.data.success) {
        showSuccess(`${type} renamed to "${title.trim()}"`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      showError(err.response?.data?.message || `Failed to rename ${type.toLowerCase()}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in border border-indigo-100 dark:border-indigo-900/30">
        <form onSubmit={handleRename} className="p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Rename {type}</h3>

          <div className="mb-6">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 ml-1">
              New Name
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition text-gray-900 dark:text-white"
              autoFocus
              placeholder={`Enter ${type.toLowerCase()} name...`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : `Save Changes`}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
