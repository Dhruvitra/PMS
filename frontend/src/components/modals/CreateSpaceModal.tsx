import { useState } from 'react';
import { useAppSelector } from '../../store';
import api from '../../services/api';
import { useToast } from '../ui/Toast';

interface CreateSpaceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateSpaceModal({ onClose, onSuccess }: CreateSpaceModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error } = useToast();
  const currentOrg = useAppSelector(state => state.organization.currentOrg);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentOrg) return;

    try {
      setIsSubmitting(true);
      const res = await api.post('/spaces', {
        name: name.trim(),
        color,
        organizationId: currentOrg.id
      });

      if (res.data.success) {
        success(`Space "${name.trim()}" created successfully in ${currentOrg.name}`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to create space');
    } finally {
      setIsSubmitting(false);
    }
  };

  const COLORS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', 
    '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4'
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-indigo-100 dark:border-indigo-900/30">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/10">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Create New Space</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mt-0.5">In {currentOrg?.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" title="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2.5 block ml-0.5">Space Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering, Marketing, Roadmap"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500 rounded-xl transition-all text-gray-900 dark:text-white shadow-sm placeholder-gray-400 dark:placeholder-gray-600"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 block ml-0.5">Pick a Color</label>
            <div className="flex flex-wrap gap-2.5">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-all scale-hover ${color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-lg' : 'opacity-80 hover:opacity-100 shadow-sm'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xl shadow-indigo-500/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {isSubmitting ? 'Creating...' : 'Create Space'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
