import React from 'react';

interface AvatarStackProps {
  users: Array<{
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showPlaceholder?: boolean;
  onRemove?: (userId: string) => void;
}

export function AvatarStack({ 
  users = [], 
  max = 3, 
  size = 'sm', 
  className = '',
  showPlaceholder = false,
  onRemove
}: AvatarStackProps) {
  const [brokenAvatars, setBrokenAvatars] = React.useState<Record<string, boolean>>({});

  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  const sizeClasses = {
    xs: 'w-4 h-4 text-[7px]',
    sm: 'w-6 h-6 text-[9px]',
    md: 'w-8 h-8 text-[11px]',
    lg: 'w-10 h-10 text-[13px]',
  };

  const iconSizes = {
    xs: 'w-2',
    sm: 'w-3',
    md: 'w-4',
    lg: 'w-5',
  };

  if (users.length === 0 && showPlaceholder) {
    return (
      <div className={`${sizeClasses[size]} rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-300 ${className}`}>
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
    );
  }

  if (users.length === 0) return null;

  return (
    <div className={`flex -space-x-1.5 hover:space-x-0.5 transition-all duration-300 group/stack ${className}`}>
      {visibleUsers.map((user) => (
        <div
          key={user.id}
          className="relative group/avatar shrink-0"
        >
          {(() => {
            const avatarUrl = (user.avatarUrl || '').trim();
            const showImage = !!avatarUrl && !brokenAvatars[user.id];
            return (
          <div
            className={`${sizeClasses[size]} rounded-full border-2 border-white dark:border-gray-900 ${showImage ? 'bg-gray-100 dark:bg-gray-800' : 'bg-gradient-to-br from-blue-500 to-purple-600'} flex items-center justify-center overflow-hidden shadow-sm transition-transform hover:scale-110 hover:z-10`}
            title={`${user.firstName} ${user.lastName}`}
          >
            {showImage ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={() => {
                  // If the image fails to load, fall back to initials.
                  // (Avoid DOM manipulation so React stays the source of truth.)
                  setBrokenAvatars(prev => (prev[user.id] ? prev : { ...prev, [user.id]: true }));
                }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  // Some providers return a 1x1 "blank" image as a default.
                  if (img.naturalWidth <= 1 && img.naturalHeight <= 1) {
                    setBrokenAvatars(prev => (prev[user.id] ? prev : { ...prev, [user.id]: true }));
                  }
                }}
              />
            ) : (
              <span className="font-black uppercase tracking-tighter text-white">
                {user.firstName ? user.firstName[0] : '?'}{user.lastName ? user.lastName[0] : ''}
              </span>
            )}
          </div>
            );
          })()}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(user.id);
              }}
              title="Remove Assignee"
              aria-label="Remove Assignee"
              className="absolute -top-1 -right-1 w-4 h-4 bg-gray-900/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all z-20 shadow-sm border border-white dark:border-gray-800"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              <span className="sr-only">Remove</span>
            </button>
          )}
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={`${sizeClasses[size]} rounded-full border-2 border-white dark:border-gray-900 bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 shadow-sm`}
        >
          <span className="font-black text-gray-600 dark:text-gray-300">+{remainingCount}</span>
        </div>
      )}
    </div>
  );
}
