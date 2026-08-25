import React, { type ReactNode } from 'react';

// ─── Illustrations ───────────────────────────────────────────────
const illustrations = {
  tasks: (
    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 80 80">
      <rect x="12" y="16" width="56" height="48" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M12 28h56" stroke="currentColor" strokeWidth="2" />
      <path d="M26 40l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 dark:text-indigo-500" />
      <path d="M26 52h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  search: (
    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 80 80">
      <circle cx="34" cy="34" r="18" stroke="currentColor" strokeWidth="2" />
      <path d="M48 48l14 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M28 30h12M28 36h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  notifications: (
    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 80 80">
      <path d="M40 16c-10 0-18 8-18 18v10l-4 6h44l-4-6V34c0-10-8-18-18-18z" stroke="currentColor" strokeWidth="2" />
      <path d="M34 54a6 6 0 0012 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="52" cy="24" r="6" className="text-indigo-400 dark:text-indigo-500" stroke="currentColor" strokeWidth="2" fill="currentColor" opacity="0.3" />
    </svg>
  ),
  projects: (
    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 80 80">
      <path d="M14 22a4 4 0 014-4h16l4 4h24a4 4 0 014 4v30a4 4 0 01-4 4H18a4 4 0 01-4-4V22z" stroke="currentColor" strokeWidth="2" />
      <path d="M30 40h20M30 48h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  generic: (
    <svg className="w-20 h-20 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 80 80">
      <rect x="16" y="20" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M28 36h24M28 44h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle cx="40" cy="28" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  ),
};

// ─── Component ───────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: keyof typeof illustrations;
  customIcon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon = 'generic',
  customIcon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 animate-fade-in ${className}`}>
      {/* Illustration */}
      <div className="mb-5 animate-float">
        {customIcon || illustrations[icon]}
      </div>

      {/* Text */}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs mb-5">{description}</p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Preset empty states ─────────────────────────────────────────

export function EmptyTasks({ onCreateTask }: { onCreateTask?: () => void }) {
  return (
    <EmptyState
      icon="tasks"
      title="No tasks yet"
      description="Create your first task to start tracking your work."
      action={onCreateTask ? { label: 'Create task', onClick: onCreateTask } : undefined}
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon="search"
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try a different search term.`}
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon="notifications"
      title="All caught up!"
      description="You have no new notifications. We'll let you know when something happens."
    />
  );
}

export function EmptyProjects({ onCreateProject }: { onCreateProject?: () => void }) {
  return (
    <EmptyState
      icon="projects"
      title="No projects yet"
      description="Create a project to organize your tasks and collaborate with your team."
      action={onCreateProject ? { label: 'Create project', onClick: onCreateProject } : undefined}
    />
  );
}
