import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm min-h-[44px]',
            'bg-white dark:bg-gray-800/60 text-gray-900 dark:text-white',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed dark:disabled:bg-gray-900',
            'hover:border-gray-300 dark:hover:border-gray-500',
            'dark:border-gray-700',
            'transition-all duration-200',
            'shadow-sm hover:shadow',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-500/15 hover:border-red-400',
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
        )}
        {error && <p className="mt-1.5 text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
