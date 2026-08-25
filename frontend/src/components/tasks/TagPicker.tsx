import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Tag } from '../../types/task.types';
import { cn } from '../../utils/cn';

interface TagPickerProps {
  organizationId: string;
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onTagCreated?: (tag: Tag) => void;
}

const TAG_COLORS = [
  '#f472b6', // pink
  '#22c55e', // green
  '#84cc16', // light green
  '#2dd4bf', // teal
  '#0ea5e9', // sky blue
  '#6366f1', // indigo
  '#a855f7', // purple
  '#f87171', // red
  '#fb923c', // orange
  '#facc15', // yellow
  '#94a3b8', // blue-gray
];

/* ── Helper Components ── */

function TagPill({ color, name }: { color: string; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.backgroundColor = `${color}15`;
      ref.current.style.color = color;
    }
  }, [color]);

  return (
    <div
      ref={ref}
      className="flex-1 flex items-center gap-2 px-2 py-1 rounded-full text-[13px] font-medium"
    >
      <ColorDot color={color} />
      <span className="truncate">{name}</span>
    </div>
  );
}

function ColorDot({ color }: { color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.style.backgroundColor = color;
  }, [color]);
  return <div ref={ref} className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" />;
}

function ColorOption({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.style.backgroundColor = color;
  }, [color]);
  return (
    <button
      ref={ref}
      onClick={onClick}
      className={cn(
        "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
        active ? "border-gray-400 shadow-sm" : "border-transparent"
      )}
      title={`Select color ${color}`}
    />
  );
}

export function TagPicker({ organizationId, selectedTagIds, onToggleTag, onTagCreated }: TagPickerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreating && searchInputRef.current) searchInputRef.current.focus();
  }, [isCreating]);


  const fetchTags = async () => {
    try {
      const res = await api.get(`/tags?organizationId=${organizationId}`);
      setTags(res.data.data);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) fetchTags();
  }, [organizationId]);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const res = await api.post('/tags', {
        name: newTagName.trim(),
        color: newTagColor,
        organizationId,
      });
      const newTag = res.data.data;
      setTags([...tags, newTag]);
      setIsCreating(false);
      setNewTagName('');
      if (onTagCreated) onTagCreated(newTag);
      // Automatically toggle the newly created tag
      onToggleTag(newTag.id);
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
  };

  const filteredTags = tags.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-[280px] bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
      {/* Search */}
      <div className="p-2 border-b border-gray-50 dark:border-gray-700/50">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full text-[13px] px-2.5 py-1.5 border border-indigo-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-400 bg-transparent dark:text-gray-200 placeholder-gray-400"
            autoFocus
            title="Search tags"
          />
        </div>
      </div>

      {/* Tag List */}
      <div className="max-h-[240px] overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
        {loading ? (
          <div className="px-4 py-2 text-xs text-gray-400">Loading tags...</div>
        ) : filteredTags.length === 0 && !isCreating ? (
          <div className="px-4 py-3 text-center">
            <p className="text-xs text-gray-400 mb-2">No tags found</p>
            <button
              onClick={() => { setIsCreating(true); setNewTagName(search); }}
              className="text-xs text-indigo-500 hover:underline font-medium"
            >
              Create "{search}"
            </button>
          </div>
        ) : (
          filteredTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <div
                key={tag.id}
                className="group flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                onClick={() => onToggleTag(tag.id)}
              >
                {/* Checkbox */}
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                  isSelected 
                    ? "bg-gray-400 border-gray-400" 
                    : "border-gray-300 dark:border-gray-600"
                )}>
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>

                <TagPill color={tag.color} name={tag.name} />

                {/* Edit Icon */}
                <button 
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
                  title="Edit tag"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add Tag Row */}
      <div className="p-2 border-t border-gray-50 dark:border-gray-700/50 bg-gray-50/30 dark:bg-gray-800/30">
        {isCreating ? (
          <div className="space-y-2 p-1">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name"
              className="w-full text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded focus:border-indigo-400 outline-none bg-white dark:bg-gray-800 dark:text-gray-200"
              autoFocus
              title="New tag name"
            />
            <div className="flex flex-wrap gap-1.5 py-1">
              {TAG_COLORS.map(c => (
                <ColorOption
                  key={c}
                  color={c}
                  active={newTagColor === c}
                  onClick={() => setNewTagColor(c)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="flex-1 px-3 py-1 bg-indigo-500 text-white text-[11px] font-bold rounded hover:bg-indigo-600 disabled:opacity-50 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[11px] font-bold rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-400 hover:bg-gray-500 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add tag
          </button>
        )}
      </div>
    </div>
  );
}
