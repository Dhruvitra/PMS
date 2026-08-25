import { useState, useRef, useEffect } from 'react';
import { StatusColorPicker } from './StatusColorPicker';
import { cn } from '../../utils/cn';

export type StatusType = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export interface StatusItem {
  id: string;
  name: string;
  color: string;
  type: StatusType;
  position: number;
  _count: { tasks: number };
}

const TYPE_LABELS: Record<StatusType, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  CLOSED: 'Closed',
};

const TYPE_ICONS: Record<StatusType, string> = {
  OPEN: 'M12 8v4l3 3',
  IN_PROGRESS: 'M13 10V3L4 14h7v7l9-11h-7z',
  CLOSED: 'M5 13l4 4L19 7',
};

interface StatusEditorProps {
  status: StatusItem;
  onUpdate: (id: string, data: Partial<Pick<StatusItem, 'name' | 'color' | 'type'>>) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function StatusEditor({
  status,
  onUpdate,
  onDelete,
  isDragging,
  dragHandleProps,
}: StatusEditorProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(status.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setShowTypeMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== status.name) {
      onUpdate(status.id, { name: trimmed });
    } else {
      setName(status.name);
    }
    setEditing(false);
  };

  const canDelete = status._count.tasks === 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all group',
        isDragging
          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
      )}
    >
      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className="cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
        </svg>
      </div>

      {/* Color dot + picker */}
      <div ref={colorRef} className="relative">
        <button
          type="button"
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-700 shadow-sm hover:scale-110 transition-transform"
          style={{ backgroundColor: status.color }}
          title="Change color"
        />
        {showColorPicker && (
          <div className="absolute top-8 left-0 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 animate-scale-in">
            <StatusColorPicker
              value={status.color}
              onChange={(color) => {
                onUpdate(status.id, { color });
                setShowColorPicker(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') {
                setName(status.name);
                setEditing(false);
              }
            }}
            className="w-full text-sm font-medium bg-transparent border-b border-indigo-500 outline-none py-0.5 text-gray-900 dark:text-white"
            maxLength={50}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 truncate block text-left w-full"
          >
            {status.name}
          </button>
        )}
      </div>

      {/* Task count badge */}
      <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums shrink-0">
        {status._count.tasks} task{status._count.tasks !== 1 ? 's' : ''}
      </span>

      {/* Type selector */}
      <div ref={typeRef} className="relative">
        <button
          type="button"
          onClick={() => setShowTypeMenu(!showTypeMenu)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
            status.type === 'OPEN' && 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
            status.type === 'IN_PROGRESS' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
            status.type === 'CLOSED' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
          )}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d={TYPE_ICONS[status.type]} />
          </svg>
          {TYPE_LABELS[status.type]}
        </button>
        {showTypeMenu && (
          <div className="absolute top-8 right-0 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[140px] animate-scale-in">
            {(Object.keys(TYPE_LABELS) as StatusType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onUpdate(status.id, { type });
                  setShowTypeMenu(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-700',
                  status.type === type && 'bg-gray-50 dark:bg-gray-700 font-medium'
                )}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d={TYPE_ICONS[type]} />
                </svg>
                <span className="text-gray-700 dark:text-gray-300">{TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={() => canDelete && onDelete(status.id)}
        disabled={!canDelete}
        className={cn(
          'p-1 rounded transition-colors',
          canDelete
            ? 'text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
            : 'text-gray-200 dark:text-gray-700 cursor-not-allowed'
        )}
        title={canDelete ? 'Delete status' : `Cannot delete: ${status._count.tasks} task(s) using this status`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
