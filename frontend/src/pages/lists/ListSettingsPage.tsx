import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { StatusSettings } from '../../components/status';
import { Loading } from '../../components/ui/Loading';

interface ListData {
  id: string;
  name: string;
  color: string | null;
  spaceId: string;
}

export function ListSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const socket = useSocket();
  const [list, setList] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);

  // useCallback so the function reference is stable and can be safely used
  // inside useEffect dependency arrays without causing infinite loops.
  const loadList = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: ListData }>(`/lists/${id}`);
      setList(res.data.data);
    } catch (err) {
      console.error('Failed to load list:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial fetch
  useEffect(() => {
    loadList();
  }, [loadList]);

  // WebSocket — fast real-time refresh on any list / space / status change
  useEffect(() => {
    if (!socket) return;

    let debounceTimer: ReturnType<typeof setTimeout>;
    const handleUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadList, 300);
    };

    socket.on('list:updated', handleUpdate);
    socket.on('space:updated', handleUpdate);
    socket.on('status:updated', handleUpdate);  // catches custom-status saves

    return () => {
      clearTimeout(debounceTimer);
      socket.off('list:updated', handleUpdate);
      socket.off('space:updated', handleUpdate);
      socket.off('status:updated', handleUpdate);
    };
  }, [socket, loadList]);

  if (loading) return <Loading size="lg" />;

  if (!list) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-12">
        List not found
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 sm:px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-900 dark:text-white font-medium">{list.name}</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-500 dark:text-gray-400">Settings</span>

        {/* Live indicator */}
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* Status Settings */}
      <StatusSettings listId={list.id} listName={list.name} />
    </div>
  );
}
