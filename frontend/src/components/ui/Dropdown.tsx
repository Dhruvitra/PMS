import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

/**
 * Reusable Dropdown component with smooth glassmorphism styling
 */
export function Dropdown({ trigger, children, className, align = 'right' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Handle alignment classes
  const alignmentClass =
    align === 'right' ? 'right-0' :
      align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0';

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer inline-flex w-full">
        {trigger}
      </div>

      {open && (
        <div
          className={cn(
            "absolute top-full mt-2 z-[90] min-w-[200px] rounded-xl shadow-xl overflow-hidden glass-card animate-scale-in dropdown-enter",
            alignmentClass,
            className
          )}
          onClick={(e) => {
            // Close dropdown when a child button/link is clicked
            if ((e.target as HTMLElement).tagName.toLowerCase() === 'button' ||
              (e.target as HTMLElement).tagName.toLowerCase() === 'a') {
              setOpen(false);
            }
          }}
        >
          <div className="py-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

// Optional helper components for Dropdown Items
interface DropdownItemProps {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  danger?: boolean;
}

export function DropdownItem({ onClick, children, className, icon, danger }: DropdownItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors",
        danger
          ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700",
        className
      )}
    >
      {icon && <span className={danger ? "text-red-500" : "text-gray-400 dark:text-gray-500"}>{icon}</span>}
      {children}
    </button>
  );
}
