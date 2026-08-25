import React from 'react';
import { Monitor, ShieldOff, Check, X } from 'lucide-react';

interface ScreenRequestPromptProps {
  adminName: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const ScreenRequestPrompt: React.FC<ScreenRequestPromptProps> = ({ adminName, onAccept, onDecline }) => {
  return (
    <div className="fixed bottom-8 right-8 z-[200] w-96 bg-white dark:bg-[#1E2530] rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-indigo-100 dark:border-indigo-900/30 overflow-hidden animate-slide-up">
      <div className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 shrink-0">
            <Monitor size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-black text-gray-900 dark:text-white mb-1">Live Monitoring Request</h3>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
              <span className="font-bold text-indigo-500">{adminName}</span> is requesting to monitor your screen for real-time collaboration.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={onDecline}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-100 dark:border-gray-800 text-[11px] font-black text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all uppercase tracking-widest"
          >
            <ShieldOff size={14} />
            Decline
          </button>
          <button 
            onClick={onAccept}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 text-white text-[11px] font-black hover:bg-indigo-500 transition-all uppercase tracking-widest shadow-lg shadow-indigo-900/20"
          >
            <Check size={14} />
            Accept
          </button>
        </div>
      </div>
      <div className="bg-gray-50 dark:bg-black/20 px-6 py-3 flex items-center justify-center gap-2 border-t border-gray-100 dark:border-gray-800/50">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">End-to-End Encrypted Session</span>
      </div>
    </div>
  );
};
