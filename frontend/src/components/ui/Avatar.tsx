const SIZE_CLASSES: Record<string, string> = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-9 h-9 text-[12px]',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-lg',
};

interface AvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  ring?: boolean;
  className?: string;
}

/** Consistent avatar everywhere in the app: real photo if set, otherwise a gradient
 *  circle with initials (first letter of first + last name) -- never a plain flat color. */
export function Avatar({ firstName, lastName, avatarUrl, size = 'sm', ring = false, className = '' }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const ringClass = ring ? 'ring-2 ring-white dark:ring-gray-900' : '';
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClass} rounded-full object-cover shrink-0 ${ringClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold flex items-center justify-center shrink-0 ${ringClass} ${className}`}
    >
      {initials}
    </div>
  );
}
