import { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { useOrgRole } from '../../hooks/useOrgRole';
import { useToast } from '../ui/Toast';
import { Avatar } from '../ui/Avatar';
import api from '../../services/api';
import { updateCurrentOrg } from '../../store/slices/organizationSlice';

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  technology: string | null;
}

const PRESET_MINUTES = [3, 5, 10, 15, 20, 30, 45, 60];

export function TrackerSettings() {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.organization.currentOrg);
  const { isOwner, isSuperAdmin, isAdmin } = useOrgRole();
  const { success: showSuccess, error: showError } = useToast();

  const [autoBreakMinutes, setAutoBreakMinutes] = useState<number | string>(
    currentOrg?.settings?.autoBreakMinutes ?? 10
  );
  const [memberOverrides, setMemberOverrides] = useState<Record<string, number>>(
    currentOrg?.settings?.memberAutoBreakOverrides ?? {}
  );

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const canManage = isOwner || isSuperAdmin || isAdmin;

  // Load org settings
  useEffect(() => {
    if (currentOrg) {
      setAutoBreakMinutes(currentOrg.settings?.autoBreakMinutes ?? 10);
      setMemberOverrides(currentOrg.settings?.memberAutoBreakOverrides ?? {});
    }
  }, [currentOrg]);

  // Load team members
  useEffect(() => {
    async function loadMembers() {
      if (!currentOrg?.id) return;
      try {
        const res = await api.get<{ success: boolean; data: TeamMember[] }>('/users/all', {
          params: { orgId: currentOrg.id }
        });
        if (res.data.success) {
          setMembers(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load members for tracker settings:', err);
      } finally {
        setMembersLoading(false);
      }
    }
    loadMembers();
  }, [currentOrg?.id]);

  const handleMemberOverrideChange = (userId: string, value: string | number) => {
    if (value === '' || value === null) {
      setMemberOverrides((prev) => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
      return;
    }

    const num = Math.max(1, Math.min(240, Number(value)));
    if (!isNaN(num)) {
      setMemberOverrides((prev) => ({
        ...prev,
        [userId]: num
      }));
    }
  };

  const handleRemoveOverride = (userId: string) => {
    setMemberOverrides((prev) => {
      const updated = { ...prev };
      delete updated[userId];
      return updated;
    });
  };

  const handleSave = async () => {
    if (!currentOrg) return;
    const defaultMins = Math.max(1, Math.min(240, Number(autoBreakMinutes) || 10));
    setSaving(true);
    try {
      const res = await api.patch(`/organizations/${currentOrg.id}`, {
        settings: {
          ...currentOrg.settings,
          autoBreakMinutes: defaultMins,
          memberAutoBreakOverrides: memberOverrides
        }
      });

      if (res.data.success) {
        dispatch(updateCurrentOrg(res.data.data));
        setSaved(true);
        showSuccess('Auto-break customized time settings saved successfully!');
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      showError('Failed to update tracker settings');
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.technology && m.technology.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!currentOrg) return null;

  const defaultMinsDisplay = Number(autoBreakMinutes) || 10;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ─── SECTION 1: Organization Default Custom Minutes ─── */}
      <section className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏢</span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Default Workspace Auto-Break Time
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Enter any customized number of minutes for the company-wide inactivity auto-break threshold.
            </p>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border border-indigo-100 dark:border-indigo-800/50">
            {canManage ? 'Admin & Super Admin' : 'Read Only'}
          </span>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                Enter Custom Time (in Minutes)
              </label>

              {/* Direct Number Input */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-[200px]">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={autoBreakMinutes}
                    onChange={(e) => setAutoBreakMinutes(e.target.value)}
                    disabled={!canManage}
                    placeholder="e.g. 10"
                    className="w-full pl-4 pr-12 py-3 text-lg font-black bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-60 shadow-sm"
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs font-bold text-gray-400 pointer-events-none">
                    mins
                  </span>
                </div>

                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  (1 to 240 mins)
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="mt-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 ml-1">
                  Quick Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAutoBreakMinutes(m)}
                      disabled={!canManage}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                        Number(autoBreakMinutes) === m
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 ml-1 leading-relaxed">
                If an employee does not touch keyboard or mouse for <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{defaultMinsDisplay} minutes</strong>, Producteev Tracker will automatically trigger an Auto-Break.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                <span>✍️</span>
                <span>Direct Custom Minutes Support</span>
              </div>
              <p className="text-xs text-indigo-950/80 dark:text-indigo-200/80 leading-relaxed">
                You can enter any exact number (e.g. 7, 12, 18, 25 minutes). You can also set different custom minutes for specific employees below.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: Member-Specific Custom Number Entry ─── */}
      <section className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">👥</span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Team Member Custom Number Entry
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Enter individual custom minutes for each employee ({members.length} team members).
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search team member..."
              className="w-full px-3.5 py-2 text-xs font-semibold bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="p-6">
          {membersLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400">
              No team members found matching your search.
            </div>
          ) : (
            <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
              {filteredMembers.map((member) => {
                const currentOverride = memberOverrides[member.id];
                const isCustom = currentOverride !== undefined && currentOverride !== null;

                return (
                  <div
                    key={member.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCustom
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/60'
                        : 'bg-gray-50/60 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        firstName={member.firstName}
                        lastName={member.lastName}
                        avatarUrl={member.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                            {member.firstName} {member.lastName}
                          </span>
                          {isCustom ? (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                              Custom: {currentOverride} mins
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">
                              Default: {defaultMinsDisplay} mins
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">
                          {member.email} {member.technology ? `• ${member.technology}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Member Custom Number Input */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative w-28">
                        <input
                          type="number"
                          min={1}
                          max={240}
                          value={isCustom ? currentOverride : ''}
                          onChange={(e) => handleMemberOverrideChange(member.id, e.target.value)}
                          disabled={!canManage}
                          placeholder={`${defaultMinsDisplay}`}
                          className="w-full pl-3 pr-10 py-1.5 text-xs font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:opacity-60 shadow-sm"
                        />
                        <span className="absolute right-2.5 top-2 text-[10px] font-bold text-gray-400 pointer-events-none">
                          mins
                        </span>
                      </div>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOverride(member.id)}
                          disabled={!canManage}
                          className="px-2 py-1.5 text-[11px] font-bold text-gray-400 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-all"
                          title="Reset to Workspace Default"
                        >
                          ✕ Reset
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {canManage && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {Object.keys(memberOverrides).length} member(s) have customized auto-break minutes.
              </span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer"
              >
                {saved ? '✓ Saved All Settings!' : saving ? 'Saving…' : 'Save Custom Times'}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
