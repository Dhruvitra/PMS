import { useState, useRef, useEffect } from 'react';
import { useAppSelector } from '../../store';
import api from '../../services/api';
import type { OrgRole } from '../../types';

type RoleType = 'Member' | 'Limited Member' | 'Guest' | 'Admin' | 'Super Admin' | 'Owner' | 'HR';

const ROLES: { type: RoleType; label: string; description: string; badge?: string; disabled?: boolean }[] = [
  {
    type: 'Admin',
    label: 'Admin',
    description: 'Full workspace access. Can manage members but cannot create new spaces.'
  },
  {
    type: 'Member',
    label: 'Member',
    description: 'Can access assigned items in your Workspace.'
  },
  {
    type: 'Limited Member',
    label: 'Limited Member',
    badge: 'TASK COLLABORATOR',
    description: 'Can only access tasks explicitly assigned to them.'
  },
  {
    type: 'Guest',
    label: 'Guest',
    description: "Read-only access to items shared with them."
  },
  {
    type: 'HR',
    label: 'HR',
    badge: 'EMPLOYEE TRACKING',
    description: 'Can only access the Employee Tracking section (summary, screenshots, reports).'
  }
];

export function InviteModal({ onClose }: { onClose: () => void }) {
  const [addedEmails, setAddedEmails] = useState<string[]>([]);
  const [currentEmailInput, setCurrentEmailInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleType>('Member');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [completedInvites, setCompletedInvites] = useState<any[]>([]);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);

  // Handle clicking outside the custom dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(event.target as Node)
      ) {
        setIsRoleDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddEmail = (emailStr: string) => {
    const trimmed = emailStr.trim();
    if (!trimmed) return;

    // Basic email validation (optional but good)
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isValid) {
      setError('Please enter a valid email address');
      return;
    }

    if (!addedEmails.includes(trimmed)) {
      setAddedEmails(prev => [...prev, trimmed]);
    }
    setCurrentEmailInput('');
    setError('');
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setAddedEmails(prev => prev.filter(e => e !== emailToRemove));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      handleAddEmail(currentEmailInput);
    } else if (e.key === 'Backspace' && currentEmailInput === '' && addedEmails.length > 0) {
      // Remove last email if pressing backspace on empty input
      handleRemoveEmail(addedEmails[addedEmails.length - 1]);
    }
  };

  const handleSendInvites = async () => {
    const finalEmailList = [...addedEmails];
    if (currentEmailInput.trim()) {
      finalEmailList.push(currentEmailInput.trim());
    }

    if (finalEmailList.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    if (!currentOrg) {
      setError('No active workspace found');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const roleMap: Record<RoleType, OrgRole> = {
        'Owner': 'OWNER',
        'Super Admin': 'SUPER_ADMIN',
        'Admin': 'ADMIN',
        'Member': 'MEMBER',
        'Limited Member': 'LIMITED_MEMBER',
        'Guest': 'GUEST',
        'HR': 'HR'
      };

      const promises = finalEmailList.map(email =>
        api.post<{ success: boolean; data: any }>(`/organizations/${currentOrg.id}/invitations`, {
          email,
          role: roleMap[selectedRole]
        })
      );

      const results = await Promise.all(promises);
      const invites = results.map(r => r.data.data);

      setCompletedInvites(invites);
      setSuccess(`Successfully invited ${finalEmailList.length} person(s)`);
      setAddedEmails([]);
      setCurrentEmailInput('');
      // Don't auto-close if we want to show links
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (token: string, inviteId: string) => {
    const url = `${window.location.origin}/register?token=${token}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedInviteId(inviteId);
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const currentRoleDetails = ROLES.find(r => r.type === selectedRole)!;

  if (completedInvites.length > 0) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white dark:bg-[#1E2530] rounded-xl shadow-2xl w-[480px] border dark:border-gray-800 animate-scale-in p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invites Sent!</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Emails have been sent to the invited members.</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-6 mb-2">Registration Links:</p>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {completedInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="min-w-0 mr-3">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{invite.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">{invite.role}</p>
                    {invite.emailStatus?.sent === true && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">✓ Email sent</span>
                    )}
                    {invite.emailStatus?.sent === false && (
                      <span
                        title={invite.emailStatus?.error || 'Email delivery failed'}
                        className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded"
                      >⚠ Email failed — share link manually</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(invite.token, invite.id)}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded transition-all shrink-0 ${copiedInviteId === invite.id
                      ? 'bg-emerald-500 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                >
                  {copiedInviteId === invite.id ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-full mt-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white text-sm font-bold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      {/* Dark overlay backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white dark:bg-[#1E2530] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.7)] w-[480px] font-sans border border-transparent dark:border-gray-800 animate-scale-in">

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invite people</h2>
          <button
            onClick={onClose}
            title="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 pt-4 space-y-5">

          {/* Email Input Section */}
          <div className="relative">
            <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Invite by email
            </label>

            {/* Pill Container (acts as input visual) */}
            <div
              className={`flex flex-wrap items-center gap-2 p-2 min-h-[46px] bg-white dark:bg-transparent border ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} focus-within:border-[#7B3FF2] dark:focus-within:border-[#7B3FF2] rounded-lg focus-within:ring-1 focus-within:ring-[#7B3FF2] transition-colors cursor-text`}
              onClick={() => document.getElementById('email-input')?.focus()}
            >
              {addedEmails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap"
                >
                  {email}
                  <button
                    type="button"
                    title="Remove"
                    onClick={(e) => { e.stopPropagation(); handleRemoveEmail(email); }}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 -mr-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}

              <input
                id="email-input"
                type="text"
                value={currentEmailInput}
                onChange={(e) => {
                  setCurrentEmailInput(e.target.value);
                  setError('');
                }}
                onKeyDown={handleInputKeyDown}
                placeholder={addedEmails.length === 0 ? "Email, comma separated..." : ""}
                className="flex-1 min-w-[120px] bg-transparent outline-none border-none p-0 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0"
                autoFocus
              />
            </div>

            {error && <p className="text-red-500 text-xs mt-1.5 font-medium">{error}</p>}
            {success && <p className="text-emerald-500 text-xs mt-1.5 font-medium">{success}</p>}

            {/* Dropdown for Add Email Suggestion (mirrors the screenshot) */}
            {currentEmailInput.trim() !== '' && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1E2530] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)] border border-gray-100 dark:border-gray-700 overflow-hidden z-20">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur
                    handleAddEmail(currentEmailInput);
                  }}
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

          {/* Info Banner */}
          <div className="bg-[#eeedff] dark:bg-indigo-900/20 text-[#292D34] dark:text-indigo-200 p-3.5 rounded-lg text-[13px] flex items-center gap-1.5">
            <span className="font-medium text-gray-600 dark:text-indigo-300">Invite members for</span>
            <span className="font-bold text-gray-900 dark:text-indigo-100">FREE.</span>
            <span className="font-medium text-gray-600 dark:text-indigo-300">You have 2 seats available.</span>
          </div>

          {/* Role Dropdown Section */}
          <div className="relative">
            <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Invite as
            </label>

            <button
              ref={dropdownButtonRef}
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 border border-transparent dark:border-gray-700 rounded-lg transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-200/60 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight">
                    {currentRoleDetails.label}
                  </span>
                  <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRoleDropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                  </svg>
                </div>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 max-w-[320px] truncate">
                  {currentRoleDetails.description}
                </p>
              </div>
            </button>

            {/* Custom Interactive Dropdown Menu */}
            {isRoleDropdownOpen && (
              <div
                ref={dropdownRef}
                className="absolute top-10 left-0 w-[432px] bg-white dark:bg-[#1E2530] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.7)] border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-fade-in-up"
              >
                <div className="py-2">
                  {ROLES.map((role) => {
                    const isSelected = selectedRole === role.type;
                    return (
                      <button
                        key={role.type}
                        disabled={role.disabled}
                        onClick={() => {
                          setSelectedRole(role.type);
                          setIsRoleDropdownOpen(false);
                        }}
                        className={`
                          w-full px-5 py-2.5 flex flex-col items-start transition-colors
                          ${role.disabled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          }
                        `}
                      >
                        <div className="w-full flex justify-between items-center mb-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold text-gray-900 dark:text-white">
                              {role.label}
                            </span>
                            {role.badge && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                                {role.badge}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <svg className="w-4 h-4 text-[#7B3FF2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 text-left leading-relaxed">
                          {role.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Footer Action */}
                <div className="border-t border-gray-100 dark:border-gray-800 p-2">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors">
                    <span className="text-gray-400 dark:text-gray-500 text-base font-bold">+</span>
                    Add custom role
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 pt-2 flex justify-end gap-3 items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[14px] font-bold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSendInvites}
            disabled={loading || !!success}
            className={`px-5 py-2.5 bg-[#7B3FF2] hover:bg-[#682EE0] text-white text-[14px] font-bold rounded-lg shadow-sm transition-colors duration-200 flex items-center gap-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending...
              </>
            ) : (
              'Send invite request'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
