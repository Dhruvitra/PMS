import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import { useAppDispatch } from '../../store';
import { setCurrentOrg } from '../../store/slices/organizationSlice';
import { OrgRole } from '../../types';

const MANAGE_OPTIONS = [
  { name: 'Creative & Design', icon: '🎨' },
  { name: 'Operations', icon: '⚙️' },
  { name: 'Startup', icon: '🚀' },
  { name: 'Support', icon: '📞' },
  { name: 'Finance & Accounting', icon: '💰' },
  { name: 'Personal Use', icon: '🏠' },
  { name: 'Marketing', icon: '📈' },
  { name: 'Software Development', icon: '💻' },
  { name: 'IT', icon: '🛠️' },
  { name: 'Professional Services', icon: '🤝' },
  { name: 'HR & Recruiting', icon: '👥' },
  { name: 'PMO', icon: '📋' },
  { name: 'Sales & CRM', icon: '🤝' },
  { name: 'Other', icon: '✨' }
];


export function CreateWorkspacePage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentUser } = useAuth();
  const { success: showSuccess, error: showError } = useToast();

  const [step, setStep] = useState(1);
  const [, setUseCase] = useState('');
  const [management, setManagement] = useState<string[]>([]);
  const [addedEmails, setAddedEmails] = useState<string[]>([]);
  const [currentEmailInput, setCurrentEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [selectedApps, setSelectedApps] = useState<string[]>(['Priorities', 'Tags']);
  const [workspaceName, setWorkspaceName] = useState('');
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleManagementOption = (option: string) => {
    if (management.includes(option)) {
      setManagement(management.filter(m => m !== option));
    } else {
      setManagement([...management, option]);
    }
  };

  const handleAddEmail = (emailStr: string) => {
    const trimmed = emailStr.trim();
    if (!trimmed) return;
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isValid) { setEmailError('Please enter a valid email address'); return; }
    if (!addedEmails.includes(trimmed)) setAddedEmails(prev => [...prev, trimmed]);
    setCurrentEmailInput('');
    setEmailError('');
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setAddedEmails(prev => prev.filter(e => e !== emailToRemove));
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      handleAddEmail(currentEmailInput);
    } else if (e.key === 'Backspace' && currentEmailInput === '' && addedEmails.length > 0) {
      handleRemoveEmail(addedEmails[addedEmails.length - 1]);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      showError('Please enter a workspace name');
      return;
    }

    try {
      setIsSubmitting(true);
      const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

      const payload = {
        name: workspaceName,
        slug: slug || `ws-${Date.now()}`
      };

      const res = await api.post('/organizations', payload);

      if (res.data.success) {
        const orgId = res.data.data?.id;

        // Automatically create one Space for the workspace
        if (orgId) {
          try {
            await api.post('/spaces', {
              name: workspaceName,
              color: '#6366F1', // Premium Indigo
              organizationId: orgId
            });
          } catch (spaceErr) {
            console.error('Failed to create space:', spaceErr);
          }
        }

        // Send invite emails
        if (orgId && addedEmails.length > 0) {
          const invitePromises = addedEmails.map(email =>
            api.post(`/organizations/${orgId}/invitations`, {
              email,
              role: 'MEMBER'
            }).catch(() => null)
          );
          await Promise.all(invitePromises);
        }

        // Sync with Redux & Session for instant Hot Reload effect
        dispatch(setCurrentOrg({ org: res.data.data, role: 'OWNER' as OrgRole }));

        showSuccess(`Workspace "${workspaceName}" ready!`);
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to create workspace');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ProgressBar = () => (
    <div className="w-full mt-10">
      <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-black dark:bg-white transition-all duration-300"
          {...{ style: { width: `${(step / 5) * 100}%` } }}
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex flex-col font-sans backdrop-blur-sm animate-fade-in">
      {/* Top Banner */}
      <div className="bg-white/95 dark:bg-gray-950/95 border-b border-gray-200 dark:border-gray-800 py-2.5 px-4 flex justify-between items-center relative shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 min-w-0">
          <svg className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline truncate">Creating a new Workspace? Keep in mind info can't be transferred across Workspaces.</span>
          <span className="sm:hidden text-xs">New Workspace</span>
        </div>
        <button
          onClick={() => navigate('/app')}
          className="ml-3 shrink-0 px-4 py-1.5 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded text-sm text-gray-700 dark:text-gray-300 font-medium transition"
        >
          Go back
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto custom-scrollbar">
        <div className="bg-white dark:bg-gray-900 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.5)] w-full max-w-3xl overflow-hidden relative border border-transparent dark:border-gray-800">

          {/* Subtle Top Gradient */}
          <div className="absolute top-0 left-0 right-0 h-1" {...{ style: { background: 'linear-gradient(90deg, #fd1d1d, #4286f4, #00b4db)' } }} />

          <div className="p-5 sm:p-8 pb-8 sm:pb-10 min-h-[500px] flex flex-col relative text-gray-900 dark:text-white">

            {/* Header: Logo & User Welcome */}
            <div className="flex justify-between items-center mb-10 sm:mb-16">
              <div className="flex items-center gap-2">
                {/* Mock Logo */}
                <div className="flex items-center justify-center w-7 h-7 relative">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-indigo-600">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="url(#paint0_linear)" />
                    <defs>
                      <linearGradient id="paint0_linear" x1="2" y1="7" x2="22" y2="7" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#F8312F" />
                        <stop offset="0.5" stopColor="#7B2CBF" />
                        <stop offset="1" stopColor="#00A8E8" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <span className="ml-2 font-bold text-gray-900 dark:text-white text-xl tracking-tight">Producteev</span>
                </div>
              </div>
              <div className="text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base">
                Welcome, {currentUser ? currentUser.firstName : 'User'}!
              </div>
            </div>

            {/* Steps Content */}
            <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">

              {/* STEP 1 */}
              {step === 1 && (
                <div className="animate-fade-in-up mt-4 sm:mt-8 flex flex-col items-center">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6 sm:mb-8 text-center tracking-tight">How will you use this Workspace?</h2>

                  <div className="grid grid-cols-1 gap-6 w-full max-w-sm">
                    <button
                      onClick={() => { setUseCase('Work'); setStep(2); }}
                      className="px-8 py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg shadow-xl transition-all hover:scale-[1.02] active:scale-98 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">⚡</span>
                        <div className="text-left">
                          <div className="font-bold">Fast Setup</div>
                          <div className="text-xs opacity-60 font-normal">Ready in seconds.</div>
                        </div>
                      </div>
                      <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    </button>

                    <div className="flex items-center gap-4 px-4">
                      <div className="h-[1px] flex-1 bg-gray-100 dark:bg-gray-800" />
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-widest leading-none">or choose use case</span>
                      <div className="h-[1px] flex-1 bg-gray-100 dark:bg-gray-800" />
                    </div>

                    <div className="flex gap-3 justify-center">
                      {['Work', 'Personal', 'School'].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => { setUseCase(opt); setStep(2); }}
                          className="px-5 py-3 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-gray-300 transition-all text-gray-600 dark:text-gray-400 font-bold bg-white dark:bg-gray-800 text-[10px] uppercase tracking-wider"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="animate-fade-in-up flex flex-col h-full">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6 sm:mb-8">What would you like to manage?</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-auto">
                    {MANAGE_OPTIONS.map((opt) => {
                      const selected = management.includes(opt.name);
                      return (
                        <button
                          key={opt.name}
                          onClick={() => toggleManagementOption(opt.name)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-sm font-medium ${selected
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-lg scale-[1.02]'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                        >
                          <span className="text-xl">{opt.icon}</span>
                          <span className="truncate">{opt.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8">
                    <ProgressBar />
                    <div className="flex justify-between mt-6">
                      <button onClick={() => setStep(1)} className="px-5 py-2 text-gray-600 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                        &lt; Back
                      </button>
                      <button onClick={() => setStep(3)} className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition">
                        Next &gt;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="animate-fade-in-up flex flex-col h-full">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Invite people to your Workspace:</h2>

                  {/* Pill-based email input */}
                  <div className="relative mb-4">
                    <div
                      className={`flex flex-wrap items-center gap-2 p-2 min-h-[50px] bg-white dark:bg-gray-800 border ${emailError ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
                        } focus-within:border-purple-500 dark:focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/30 rounded transition-all cursor-text`}
                      onClick={() => document.getElementById('step3-email-input')?.focus()}
                    >
                      {addedEmails.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap"
                        >
                          {email}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRemoveEmail(email); }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Remove Email"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                      <input
                        id="step3-email-input"
                        type="text"
                        value={currentEmailInput}
                        onChange={(e) => { setCurrentEmailInput(e.target.value); setEmailError(''); }}
                        onKeyDown={handleEmailKeyDown}
                        placeholder={addedEmails.length === 0 ? 'Enter email addresses...' : ''}
                        className="flex-1 min-w-[180px] bg-transparent outline-none border-none p-1 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0"
                        autoFocus
                      />
                    </div>

                    {emailError && <p className="text-red-500 text-xs mt-1.5 font-medium">{emailError}</p>}

                    {/* Add email dropdown suggestion */}
                    {currentEmailInput.trim() !== '' && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)] border border-gray-100 dark:border-gray-700 overflow-hidden z-20">
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); handleAddEmail(currentEmailInput); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                        >
                          <div className="w-5 h-5 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <span className="text-[13px] text-gray-600 dark:text-gray-300 font-medium break-all">
                            Add {currentEmailInput}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded text-sm font-medium mb-auto self-start border border-green-100 dark:border-green-800/50">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    Don't do it alone - Invite your team to get started 200% faster.
                  </div>

                  <div className="mt-8">
                    <ProgressBar />
                    <div className="flex justify-between mt-6">
                      <button onClick={() => setStep(2)} className="px-5 py-2 text-gray-600 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                        &lt; Back
                      </button>
                      <button
                        onClick={() => {
                          if (addedEmails.length === 0 && currentEmailInput.trim() === '') {
                            setShowSkipModal(true);
                          } else {
                            if (currentEmailInput.trim()) handleAddEmail(currentEmailInput);
                            setStep(4);
                          }
                        }}
                        className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition"
                      >
                        {addedEmails.length > 0 || currentEmailInput.trim() ? 'Next >' : 'Skip >'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: ClickApps (Missing Page 4) */}
              {step === 4 && (
                <div className="animate-fade-in-up flex flex-col h-full">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Enhance your experience.</h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm">Which ClickApps would you like to enable?</p>

                  <div className="grid grid-cols-2 gap-3 mb-auto">
                    {[
                      { name: 'Priorities', icon: '⚡', desc: 'Classify tasks by importance' },
                      { name: 'Sprints', icon: '🏃', desc: 'Manage your work in time slots' },
                      { name: 'Time Tracking', icon: '⏱️', desc: 'Record how long tasks take' },
                      { name: 'Custom Fields', icon: '📑', desc: 'Add unique data to your tasks' },
                      { name: 'Dependencies', icon: '🔗', desc: 'Link related tasks together' },
                      { name: 'Tags', icon: '🏷️', desc: 'Add simple keywords to tasks' }
                    ].map((app) => (
                      <button
                        key={app.name}
                        onClick={() => {
                          if (selectedApps.includes(app.name)) {
                            setSelectedApps(selectedApps.filter(a => a !== app.name));
                          } else {
                            setSelectedApps([...selectedApps, app.name]);
                          }
                        }}
                        className={`p-4 flex items-start gap-4 rounded-xl border text-left transition-all ${selectedApps.includes(app.name)
                          ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500/50'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                      >
                        <div className="text-2xl">{app.icon}</div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">{app.name}</div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{app.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-8">
                    <ProgressBar />
                    <div className="flex justify-between mt-6">
                      <button onClick={() => setStep(3)} className="px-5 py-2 text-gray-600 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                        &lt; Back
                      </button>
                      <button onClick={() => setStep(5)} className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition">
                        Next &gt;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Name Workspace */}
              {step === 5 && (
                <div className="animate-fade-in-up flex flex-col h-full">
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Lastly, what would you like to name your Workspace?</h2>
                  <div className="mb-2">
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder={`${currentUser?.firstName || 'User'}'s Workspace`}
                      className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-auto">Try the name of your company or organization.</p>

                  <div className="mt-8">
                    <ProgressBar />
                    <div className="flex justify-between mt-6">
                      <button
                        onClick={() => {
                          if (addedEmails.length === 0) setStep(3);
                          else setStep(4);
                        }}
                        className="px-5 py-2 text-gray-600 dark:text-gray-400 font-medium border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                        disabled={isSubmitting}
                      >
                        &lt; Back
                      </button>
                      <button
                        onClick={handleCreateWorkspace}
                        disabled={isSubmitting || !workspaceName.trim()}
                        className="px-6 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? 'Creating...' : 'Finish ✓'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Skip Modal */}
      {showSkipModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.7)] max-w-md w-full p-6 animate-scale-in border border-transparent dark:border-gray-800">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Skip without inviting</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              People that invite others to collaborate in Producteev are 4x more successful.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowSkipModal(false)}
                className="flex-1 py-2.5 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-medium rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowSkipModal(false); setStep(5); }}
                className="flex-1 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition"
              >
                Skip step
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
