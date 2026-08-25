import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[150] bg-amber-500 text-white px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg animate-fade-in-up">
      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 12h.01" />
      </svg>
      <span className="text-sm font-medium">
        You're offline. Changes will sync when connection is restored.
      </span>
      <button
        onClick={() => window.location.reload()}
        className="ml-2 px-3 py-1 text-xs font-semibold bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
