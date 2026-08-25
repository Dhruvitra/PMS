import { TrackingPageShell } from './TrackingPageShell';

const Icon = (
  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
  </svg>
);

const DOWNLOAD_URL = '/uploads/downloads/producteev-tracker-setup-1.1.3.exe';
const APP_VERSION = '1.1.3';
const FILE_SIZE_MB = 91;

function DownloadContent() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-lg w-full bg-white dark:bg-[#1E2530] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <rect x="2" y="4" width="20" height="14" rx="2" />
            <path strokeLinecap="round" d="M8 21h8M12 17v4" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Producteev Tracker for Windows</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Version {APP_VERSION} &middot; ~{FILE_SIZE_MB} MB &middot; Windows 10/11 (64-bit)
        </p>

        <a
          href={DOWNLOAD_URL}
          download
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
          </svg>
          Download for Windows
        </a>

        <div className="mt-8 text-left bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Setup</p>
          <p className="text-[13px] text-gray-600 dark:text-gray-300">1. Run the downloaded installer and follow the prompts.</p>
          <p className="text-[13px] text-gray-600 dark:text-gray-300">2. Windows may show a "Windows protected your PC" warning since this is an internal company app, not from the Microsoft Store — click <strong>More info</strong>, then <strong>Run anyway</strong>.</p>
          <p className="text-[13px] text-gray-600 dark:text-gray-300">3. Sign in with your regular Producteev Pro email and password.</p>
          <p className="text-[13px] text-gray-600 dark:text-gray-300">4. Pick what you're working on and click <strong>Start Tracking</strong> — the app keeps running in the background (system tray) even if you close the window.</p>
        </div>
      </div>
    </div>
  );
}

export function DownloadPage() {
  return (
    <TrackingPageShell
      title="Download"
      subtitle="Get the Producteev Pro time tracker for your team."
      icon={Icon}
      phaseNote=""
      requireFullAccess={false}
    >
      <DownloadContent />
    </TrackingPageShell>
  );
}
