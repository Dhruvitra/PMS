import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';

const WARNING_MINUTES = 20; // Show warning 20 minutes before auto-logout

export function WorkTimer() {
  const { isAuthenticated, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logoutRef = useRef(logout);

  // Keep logout ref current without triggering effect re-runs
  logoutRef.current = logout;

  useEffect(() => {
    if (!isAuthenticated) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    // Start work session if not already started
    if (!localStorage.getItem('workSessionStart')) {
      const savedLimit = localStorage.getItem('workHoursLimit');
      const limitHours = savedLimit ? parseInt(savedLimit, 10) : 9;
      localStorage.setItem('workSessionStart', Date.now().toString());
      localStorage.setItem('workHoursLimit', limitHours.toString());
    }

    // Only create interval once - don't restart on dependency changes
    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      const start = localStorage.getItem('workSessionStart');
      const limit = localStorage.getItem('workHoursLimit');
      if (!start || !limit) return;

      const startTime = parseInt(start, 10);
      const limitHours = parseInt(limit, 10);
      const elapsed = Date.now() - startTime;
      const limitMs = limitHours * 60 * 60 * 1000;
      const remaining = limitMs - elapsed;

      if (remaining <= 0) {
        // Time's up - auto logout
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setShowWarning(false);
        localStorage.removeItem('workSessionStart');
        logoutRef.current();
        return;
      }

      const remainingMin = Math.floor(remaining / 60000);
      const hours = Math.floor(remainingMin / 60);
      const mins = remainingMin % 60;
      setTimeLeft(`${hours}h ${mins}m`);

      // Show warning when 20 minutes or less remaining
      if (remainingMin <= WARNING_MINUTES) {
        setShowWarning(true);
      }
    }, 5000); // Check every 5 seconds instead of every 1 second

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isAuthenticated]); // Only depend on isAuthenticated - not on callbacks

  const handleLogoutNow = () => {
    setShowWarning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    localStorage.removeItem('workSessionStart');
    logoutRef.current();
  };

  if (!isAuthenticated || !showWarning) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm animate-bounce-once">
      <div className="bg-red-600 text-white rounded-lg shadow-2xl p-4 border border-red-700">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Work Session Ending Soon!</p>
            <p className="text-xs mt-1 text-red-100">
              Only <span className="font-bold text-white">{timeLeft}</span> remaining.
              Upload your work and complete tasks fast!
            </p>
            <p className="text-xs mt-1 text-red-200">
              You will be automatically logged out when time expires.
            </p>
          </div>
          <button
            onClick={() => setShowWarning(false)}
            className="shrink-0 text-red-200 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setShowWarning(false)}
            className="flex-1 text-xs px-3 py-1.5 bg-red-700 hover:bg-red-800 rounded font-medium"
          >
            Dismiss
          </button>
          <button
            onClick={handleLogoutNow}
            className="flex-1 text-xs px-3 py-1.5 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded font-medium"
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
}
