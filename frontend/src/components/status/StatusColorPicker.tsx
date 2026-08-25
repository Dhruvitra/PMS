import { cn } from '../../utils/cn';

const COLOR_GRID = [
  // Row 1 - Grays & Neutrals
  '#d1d5db', '#9ca3af', '#6b7280', '#4b5563',
  // Row 2 - Blues
  '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb',
  // Row 3 - Greens
  '#86efac', '#4ade80', '#22c55e', '#16a34a',
  // Row 4 - Yellows & Oranges
  '#fde68a', '#fbbf24', '#f59e0b', '#f97316',
  // Row 5 - Reds & Pinks
  '#fca5a5', '#f87171', '#ef4444', '#dc2626',
  // Row 6 - Purples & Teals
  '#c4b5fd', '#a78bfa', '#8b5cf6', '#06b6d4',
];

interface StatusColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function StatusColorPicker({ value, onChange }: StatusColorPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5 p-2">
      {COLOR_GRID.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'w-7 h-7 rounded-md border-2 transition-all hover:scale-110',
            value === color
              ? 'border-gray-900 dark:border-white ring-1 ring-gray-900 dark:ring-white scale-110'
              : 'border-transparent hover:border-gray-400 dark:hover:border-gray-500'
          )}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  );
}
