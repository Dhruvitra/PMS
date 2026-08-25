import { ReactNode } from 'react';
import { useOrgRole } from '../../hooks/useOrgRole';

export function PayrollPageShell({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children?: ReactNode;
}) {
  const { canAccessPayroll } = useOrgRole();

  if (!canAccessPayroll) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2 font-sans">Access Denied</h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium">This area is reserved for Owners and HR.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto p-3 sm:p-4 md:p-8 font-sans flex flex-col scroll-smooth custom-scrollbar">
      <div className="mb-4 sm:mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 md:gap-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-1 sm:mb-2 italic">{title}</h1>
          <p className="text-gray-500 dark:text-gray-400 font-bold uppercase text-[10px] sm:text-[11px] tracking-widest">{subtitle}</p>
        </div>
        <div className="bg-white/80 dark:bg-[#1E2530] px-4 sm:px-6 py-3 sm:py-4 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl backdrop-blur flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 shrink-0">
            {icon}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
