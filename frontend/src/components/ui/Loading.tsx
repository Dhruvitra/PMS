import { cn } from '../../utils/cn';

// ─── Spinner ─────────────────────────────────────────────────────
interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const sizeStyles = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-[3px]',
};

export function Loading({ size = 'md', className, text }: LoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-8', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-gray-200 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400',
          sizeStyles[size]
        )}
      />
      {text && (
        <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse-soft">{text}</p>
      )}
    </div>
  );
}

// ─── Button Spinner ──────────────────────────────────────────────
export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin h-4 w-4', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Loading Overlay (for modals / sections) ─────────────────────
export function LoadingOverlay({ text }: { text?: string }) {
  return (
    <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 border-[3px] border-gray-200 border-t-indigo-600 dark:border-gray-700 dark:border-t-indigo-400 rounded-full animate-spin" />
        {text && <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>}
      </div>
    </div>
  );
}

// ─── Skeleton Loaders ────────────────────────────────────────────

/** Card skeleton for dashboard/project cards */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-100 dark:border-gray-800 p-5 space-y-3', className)}>
      <div className="h-4 w-3/4 rounded-md animate-shimmer" />
      <div className="h-3 w-1/2 rounded-md animate-shimmer" />
      <div className="h-3 w-2/3 rounded-md animate-shimmer" />
    </div>
  );
}

/** Row skeleton for task lists / tables */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', className)}>
      <div className="h-4 w-4 rounded-full animate-shimmer shrink-0" />
      <div className="flex-1 h-3 rounded-md animate-shimmer" />
      <div className="h-3 w-16 rounded-md animate-shimmer" />
    </div>
  );
}

/** Task list skeleton with header + rows */
export function SkeletonTaskList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="h-3 w-3 rounded-full animate-shimmer" />
        <div className="h-4 w-24 rounded-md animate-shimmer" />
        <div className="h-4 w-6 rounded-md animate-shimmer" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800">
          <div className="h-4 w-4 rounded animate-shimmer shrink-0" />
          <div className={cn("h-3 rounded-md animate-shimmer", i % 3 === 0 ? "w-[65%]" : i % 3 === 1 ? "w-[80%]" : "w-[45%]")} />
          <div className="ml-auto flex items-center gap-2">
            <div className="h-5 w-16 rounded-full animate-shimmer" />
            <div className="h-5 w-5 rounded-full animate-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Dashboard stats skeleton */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="h-10 w-10 rounded-xl animate-shimmer" />
            <div className="h-3 w-12 rounded-md animate-shimmer" />
          </div>
          <div className="h-7 w-16 rounded-md animate-shimmer mb-1" />
          <div className="h-3 w-20 rounded-md animate-shimmer" />
        </div>
      ))}
    </div>
  );
}

/** Sidebar navigation skeleton */
export function SkeletonSidebar() {
  return (
    <div className="space-y-2 px-3 py-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="h-4 w-4 rounded animate-shimmer shrink-0" />
          <div className={cn("h-3 rounded-md animate-shimmer", i % 2 === 0 ? "w-[75%]" : "w-[55%]")} />
        </div>
      ))}
    </div>
  );
}

/** Activity stream skeleton */
export function SkeletonActivity({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full animate-shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded-md animate-shimmer" />
              <div className="h-2 w-20 rounded-sm animate-shimmer opacity-50" />
            </div>
          </div>
          <div className="space-y-2 pl-11">
            <div className="h-3 w-full rounded-md animate-shimmer" />
            <div className="h-3 w-[85%] rounded-md animate-shimmer" />
          </div>
          <div className="flex items-center gap-4 pl-11 pt-2 border-t border-gray-50 dark:border-gray-800/50">
            <div className="h-3 w-8 rounded animate-shimmer" />
            <div className="h-3 w-8 rounded animate-shimmer" />
            <div className="ml-auto h-3 w-12 rounded animate-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

