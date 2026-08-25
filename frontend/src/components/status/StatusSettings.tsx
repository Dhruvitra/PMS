import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { StatusEditor, type StatusItem, type StatusType } from './StatusEditor';
import { StatusColorPicker } from './StatusColorPicker';
import { cn } from '../../utils/cn';

interface StatusSettingsProps {
  listId: string;
  listName?: string;
  onClose?: () => void;
}

export function StatusSettings({ listId, listName, onClose }: StatusSettingsProps) {
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New status form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newType, setNewType] = useState<StatusType>('OPEN');
  const [adding, setAdding] = useState(false);
  const [showNewColorPicker, setShowNewColorPicker] = useState(false);
  const newColorRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fetchStatuses = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<{ success: boolean; data: StatusItem[] }>(
        `/lists/${listId}/statuses`
      );
      setStatuses(res.data.data);
    } catch {
      setError('Failed to load statuses');
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // WebSocket — auto-refresh when statuses change in real time
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    let t: ReturnType<typeof setTimeout>;
    const handleRefresh = () => {
      clearTimeout(t);
      t = setTimeout(fetchStatuses, 300);
    };
    socket.on('list:updated', handleRefresh);
    socket.on('status:updated', handleRefresh);
    socket.on('space:updated', handleRefresh);
    return () => {
      clearTimeout(t);
      socket.off('list:updated', handleRefresh);
      socket.off('status:updated', handleRefresh);
      socket.off('space:updated', handleRefresh);
    };
  }, [socket, fetchStatuses]);

  // Close new color picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newColorRef.current && !newColorRef.current.contains(e.target as Node)) {
        setShowNewColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleUpdate = async (id: string, data: Partial<Pick<StatusItem, 'name' | 'color' | 'type'>>) => {
    // Optimistic update
    setStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
    try {
      await api.patch(`/statuses/${id}`, data);
    } catch {
      fetchStatuses(); // Revert on error
    }
  };

  const handleDelete = async (id: string) => {
    const prev = statuses;
    setStatuses((s) => s.filter((st) => st.id !== id));
    try {
      await api.delete(`/statuses/${id}`);
    } catch {
      setStatuses(prev); // Revert on error
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await api.post<{ success: boolean; data: StatusItem }>(
        `/lists/${listId}/statuses`,
        { name: newName.trim(), color: newColor, type: newType }
      );
      setStatuses((prev) => [...prev, res.data.data]);
      setNewName('');
      setNewColor('#3b82f6');
      setNewType('OPEN');
      setShowAddForm(false);
    } catch {
      setError('Failed to add status');
    } finally {
      setAdding(false);
    }
  };

  const handleCreateDefaults = async () => {
    try {
      const res = await api.post<{ success: boolean; data: StatusItem[] }>(
        `/lists/${listId}/statuses/defaults`
      );
      setStatuses(res.data.data);
    } catch {
      setError('Failed to create default statuses');
    }
  };

  // Drag & drop reorder
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = async (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...statuses];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    setStatuses(reordered);
    setDragIndex(null);
    setDragOverIndex(null);

    try {
      await api.put(`/lists/${listId}/statuses/reorder`, {
        statusIds: reordered.map((s) => s.id),
      });
    } catch {
      fetchStatuses(); // Revert on error
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const totalTasks = statuses.reduce((sum, s) => sum + s._count.tasks, 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Status Settings
              {listName && (
                <span className="text-gray-400 dark:text-gray-500 font-normal">
                  &mdash; {listName}
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {statuses.length} status{statuses.length !== 1 ? 'es' : ''} &middot; {totalTasks} total task{totalTasks !== 1 ? 's' : ''}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-5 mt-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="ml-2 hover:text-red-800 dark:hover:text-red-300">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : statuses.length === 0 ? (
          /* Empty state */
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No statuses configured</p>
            <button
              onClick={handleCreateDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Default Statuses
            </button>
          </div>
        ) : (
          /* Status list */
          <div className="space-y-2">
            {statuses.map((status, index) => (
              <div
                key={status.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'transition-all',
                  dragOverIndex === index && dragIndex !== null && dragIndex !== index
                    ? 'border-t-2 border-t-indigo-400 pt-1'
                    : ''
                )}
              >
                <StatusEditor
                  status={status}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  isDragging={dragIndex === index}
                />
              </div>
            ))}
          </div>
        )}

        {/* Add new status */}
        <div className="mt-4">
          {showAddForm ? (
            <form
              onSubmit={handleAdd}
              className="border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg p-4 bg-indigo-50/50 dark:bg-indigo-900/10 animate-fade-in"
            >
              <div className="flex items-center gap-3 mb-3">
                {/* Color picker */}
                <div ref={newColorRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowNewColorPicker(!showNewColorPicker)}
                    className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-700 shadow-sm hover:scale-110 transition-transform"
                    style={{ backgroundColor: newColor }}
                  />
                  {showNewColorPicker && (
                    <div className="absolute top-8 left-0 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 animate-scale-in">
                      <StatusColorPicker
                        value={newColor}
                        onChange={(c) => {
                          setNewColor(c);
                          setShowNewColorPicker(false);
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Name input */}
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Status name"
                  className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  autoFocus
                  maxLength={50}
                />

                {/* Type selector */}
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as StatusType)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none focus:border-indigo-500"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewName('');
                  }}
                  className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !newName.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {adding ? 'Adding...' : 'Add Status'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
