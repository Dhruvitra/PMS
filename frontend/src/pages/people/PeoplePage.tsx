import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useOutletContext } from 'react-router';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { useAppSelector } from '../../store';
import type { User } from '../../types';
import api from '../../services/api';
import { Loading } from '../../components/ui/Loading';
import { useSocket } from '../../hooks/useSocket';
import { useOrgRole } from '../../hooks/useOrgRole';
import { InviteModal } from '../../components/workspace/InviteModal';
import { useToast } from '../../components/ui/Toast';
import SpaceAccessModal from '../../components/modals/SpaceAccessModal';
import type { RootState } from '../../store';
import { Avatar } from '../../components/ui/Avatar';

interface Person {
  id: string;
  user: User;
  role: string;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  invitedBy: {
    firstName: string;
    lastName: string;
  };
}

const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#e11d48', '#0891b2', '#4f46e5', '#db2777',
];

function getColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function PeoplePage() {
  const socket = useSocket();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'pending'>('members');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [members, setMembers] = useState<Person[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const userIdParam = searchParams.get('userId');

  const currentOrg = useAppSelector(state => state.organization.currentOrg);
  const { isAdmin, canManagePeople, canRequestScreen } = useOrgRole();
  const { success: showSuccess, error: showError } = useToast();
  const currentUserId = useAppSelector((state: RootState) => state.user.currentUser?.id);

  const { setMonitoringUser } = useOutletContext<{
    setMonitoringUser: (user: any) => void;
  }>();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (currentOrg) {
        const res = await api.get<{ success: boolean; data: Person[] }>(`/organizations/${currentOrg.id}/members`);
        if (res?.data?.success && Array.isArray(res.data.data)) {
          setMembers(res.data.data);
        }

        if (canManagePeople) {
          const invRes = await api.get<{ success: boolean; data: Invitation[] }>(`/organizations/${currentOrg.id}/invitations`);
          if (invRes?.data?.success) setInvitations(invRes.data.data);
        }
      }
    } catch (err) {
      console.error('Failed to load people data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, canManagePeople]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const handleOnlineList = (ids: string[]) => setOnlineUsers(new Set(ids));
    const handleOnline = (d: { userId: string }) => setOnlineUsers((p) => new Set(p).add(d.userId));
    const handleOffline = (d: { userId: string }) => setOnlineUsers((p) => { const n = new Set(p); n.delete(d.userId); return n; });
    const handleMemberUpdate = () => loadData();
    const handleClickOutside = () => setActiveMenuId(null);

    socket.on('users:online-list', handleOnlineList);
    socket.on('user:online', handleOnline);
    socket.on('user:offline', handleOffline);
    socket.on('people:updated', handleMemberUpdate);
    socket.on('org:member_added', handleMemberUpdate);
    socket.on('org:member_removed', handleMemberUpdate);
    document.addEventListener('click', handleClickOutside);
    socket.emit('users:get-online-list');

    return () => {
      socket.off('users:online-list', handleOnlineList);
      socket.off('user:online', handleOnline);
      socket.off('user:offline', handleOffline);
      socket.off('people:updated', handleMemberUpdate);
      socket.off('org:member_added', handleMemberUpdate);
      socket.off('org:member_removed', handleMemberUpdate);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [socket, loadData]);

  const copyInviteLink = (invite: Invitation) => {
    const url = `${window.location.origin}/register?token=${invite.token}`;
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
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevokeInvite = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      await api.delete(`/invitations/${id}`);
      setInvitations(prev => prev.filter(inv => inv.id !== id));
      showSuccess('Invitation revoked');
    } catch (err) { showError('Failed to revoke'); }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    if (!currentOrg) return;
    try {
      await api.patch(`/organizations/${currentOrg.id}/members/${memberId}`, { role });
      showSuccess(`Role updated to ${role}`);
      loadData();
    } catch (err) { showError('Failed to update role'); }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!currentOrg) return;
    if (!window.confirm('Remove this member?')) return;
    try {
      await api.delete(`/organizations/${currentOrg.id}/members/${memberUserId}`);
      showSuccess('Member removed');
      loadData();
    } catch (err) { showError('Failed to remove member'); }
  };

  const roleOrder: Record<string, number> = {
    'OWNER': 1,
    'SUPER_ADMIN': 1,
    'ADMIN': 2,
    'MEMBER': 3,
    'LIMITED_MEMBER': 4,
    'GUEST': 5
  };

  const filteredMembers = members.filter(m => {
    const q = search.toLowerCase();
    const fullName = `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.toLowerCase();
    return fullName.includes(q) || (m.user?.email || '').toLowerCase().includes(q);
  }).sort((a, b) => {
    const orderA = roleOrder[a.role] || 99;
    const orderB = roleOrder[b.role] || 99;
    return orderA - orderB;
  });

  const filteredInvites = invitations.filter(inv => (inv.email || '').toLowerCase().includes(search.toLowerCase()));

  const activeChatMember = userIdParam ? members.find(m => m.user.id === userIdParam) : null;
  const chatTargetUser = useMemo(() => {
    if (!activeChatMember) return null;
    return {
      id: activeChatMember.user.id,
      name: `${activeChatMember.user.firstName} ${activeChatMember.user.lastName}`,
      email: activeChatMember.user.email,
      avatarUrl: activeChatMember.user.avatarUrl || undefined,
      colorIdx: members.indexOf(activeChatMember)
    };
  }, [activeChatMember, members]);

  const handleMessagesRead = useCallback(() => { }, []);
  const handleChatBack = useCallback(() => setSearchParams({}), [setSearchParams]);

  if (loading && members.length === 0) return <Loading size="lg" />;

  if (userIdParam && chatTargetUser && currentUserId) {
    return (
      <ChatPanel
        currentUserId={currentUserId}
        targetUser={chatTargetUser}
        onlineUsers={onlineUsers}
        onMessagesRead={handleMessagesRead}
        onBack={handleChatBack}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-[#0F1116] overflow-hidden font-sans">
      <div className="bg-white dark:bg-gray-800/20 px-4 sm:px-8 pt-5 sm:pt-8 border-b border-gray-100 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">People</h1>
            {canManagePeople && (
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                Invite
              </button>
            )}
          </div>
          <div className="relative w-full sm:w-72">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800/40 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-xl border border-transparent focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
        <div className="flex gap-4 sm:gap-8 overflow-x-auto scrollbar-none">
          <button onClick={() => setActiveTab('members')} className={`pb-3 text-xs sm:text-sm font-black transition-colors relative uppercase tracking-widest shrink-0 ${activeTab === 'members' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
            Members ({members.length})
            {activeTab === 'members' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
          </button>
          {canManagePeople && (
            <button onClick={() => setActiveTab('pending')} className={`pb-3 text-xs sm:text-sm font-black transition-colors relative uppercase tracking-widest shrink-0 ${activeTab === 'pending' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              Pending ({invitations.length})
              {activeTab === 'pending' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-4 lg:p-6 pb-48 custom-scrollbar">
        {/* Desktop View: Wide Table */}
        <div className="hidden lg:block bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-visible">
          <div className="w-full">
            <table className="w-full text-left border-collapse min-w-[1200px] table-fixed">
              <thead>
                <tr className="border-t-2 border-[#ff4136] bg-gray-50/50 dark:bg-gray-800/40">
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-[25%]">Name</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-[8%] text-center">User ID</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-[18%]">Email</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-[9%]">Role</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-[9%]">Last active</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-[9%]">Invited by</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-[9%]">Invited on</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-[13%] text-center">Stats</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] w-[10%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {activeTab === 'members' && canManagePeople && (
                  <tr onClick={() => setIsInviteModalOpen(true)} className="hover:bg-indigo-50/20 cursor-pointer group transition-colors">
                    <td colSpan={9} className="px-5 py-4">
                      <div className="flex items-center gap-3 text-indigo-600 font-bold text-xs uppercase tracking-widest">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        </div>
                        + Invite New Team Member
                      </div>
                    </td>
                  </tr>
                )}

                <>
                  {activeTab === 'members' ? filteredMembers.map(member => {
                    const isOnline = onlineUsers.has(member.user.id);
                    const isOwnEntry = member.user.id === currentUserId;
                    const isUntouchable = member.role === 'SUPER_ADMIN' || member.role === 'OWNER';

                    return (
                      <motion.tr key={member.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar firstName={member.user.firstName} lastName={member.user.lastName} avatarUrl={member.user.avatarUrl} size="md" />
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => setSearchParams({ userId: member.user.id })}>{member.user.firstName} {member.user.lastName}</p>
                                {isOwnEntry && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      document.getElementById('user-avatar-upload')?.click();
                                    }}
                                    className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800"
                                    title="Update Photo"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {member.user.technology && <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none">{member.user.technology}</p>}
                                {isOwnEntry && <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 px-1 rounded font-black uppercase tracking-tighter">You</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <code className="text-[10px] font-mono font-bold bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">
                            #{member.user.id.slice(0, 8)}
                          </code>
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">{member.user.email}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest uppercase ${(member.role === 'ADMIN' || member.role === 'OWNER' || member.role === 'SUPER_ADMIN') ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' : 'bg-gray-50 dark:bg-gray-900 text-gray-400'}`}>{member.role}</span>
                        </td>
                        <td className="px-5 py-4 text-[11px] font-bold text-gray-400">Just now</td>
                        <td className="px-5 py-4 text-[11px] font-bold text-gray-400">-</td>
                        <td className="px-5 py-4 text-[11px] font-bold text-gray-400 whitespace-nowrap">{new Date(member.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-3 text-[10px] text-gray-400 font-black uppercase">
                            <div className="text-center"><p className="text-gray-900 dark:text-white leading-none mb-1">{member.user._count?.listMemberships || 0}</p><p className="scale-75 origin-top">Lists</p></div>
                            <div className="w-[1px] h-4 bg-gray-100 dark:bg-gray-800" />
                            <div className="text-center"><p className="text-gray-900 dark:text-white leading-none mb-1">{member.user._count?.assignedTasks || 0}</p><p className="scale-75 origin-top">Tasks</p></div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isOwnEntry && isOnline && canRequestScreen && (
                              <button
                                onClick={() => setMonitoringUser({
                                  id: member.user.id,
                                  name: `${member.user.firstName} ${member.user.lastName}`,
                                  initials: `${member.user.firstName[0]}${member.user.lastName[0]}`.toUpperCase(),
                                  color: getColor(member.user.id)
                                })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm shrink-0"
                                title="Request Screen Monitoring"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <rect x="2" y="3" width="20" height="14" rx="2" />
                                  <path d="M8 21h8M12 17v4" />
                                </svg>
                                LIVE
                              </button>
                            )}
                          <div className="relative">
                            {!isUntouchable && !isOwnEntry && canManagePeople && (
                              <>
                                <button
                                  title="Admin Options"
                                  onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === member.id ? null : member.id); }}
                                  className={`p-1.5 rounded-lg transition-colors ${activeMenuId === member.id ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                                </button>

                                {activeMenuId === member.id && (
                                  <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-[#1E2530] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-gray-100 dark:border-gray-800 py-2 z-[100] animate-scale-in origin-top-right backdrop-blur-xl overflow-hidden">
                                    <div className="px-4 py-2 mb-1 border-b border-gray-50 dark:border-gray-800/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin Options</div>

                                    {/* Manage Access: For lower roles */}
                                    {member.role === 'MEMBER' && (
                                      <button onClick={() => { setSelectedUser(member.user); setIsSpaceModalOpen(true); setActiveMenuId(null); }} className="w-full px-4 py-2.5 text-left text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                                        Manage Access
                                      </button>
                                    )}

                                    <div className="px-4 py-1.5 mt-1 border-t border-gray-50 dark:border-gray-800/50 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Change Role to:</div>
                                    <div className="px-2 space-y-0.5">
                                      {['ADMIN', 'MEMBER', 'LIMITED_MEMBER', 'GUEST', 'HR'].filter(r => r !== member.role).map(r => (
                                        <button key={r} onClick={() => { handleUpdateRole(member.user.id, r); setActiveMenuId(null); }} className="w-full text-left px-2 py-1.5 text-[12px] font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-all">{r.replace('_', ' ')}</button>
                                      ))}
                                    </div>

                                    {(member.role === 'ADMIN' || member.role === 'MEMBER' || member.role === 'LIMITED_MEMBER' || member.role === 'GUEST' || member.role === 'HR') && (
                                      <>
                                        <div className="my-1 border-t border-gray-50 dark:border-gray-800/50" />
                                        <button onClick={() => handleRemoveMember(member.user.id)} className="w-full text-left px-4 py-2.5 text-[13px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all">
                                          Remove from Team
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  }) : filteredInvites.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shadow-inner">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          </div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{inv.email}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold text-gray-400">-</td>
                      <td className="px-5 py-4 text-xs font-bold text-gray-400">{inv.email}</td>
                      <td className="px-5 py-4"><span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{inv.role}</span></td>
                      <td className="px-5 py-4 text-[11px] font-black text-amber-500 uppercase tracking-tighter">Pending</td>
                      <td className="px-5 py-4 text-[11px] font-bold text-gray-400">{inv.invitedBy?.firstName}</td>
                      <td className="px-5 py-4 text-[11px] font-bold text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-4"></td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => copyInviteLink(inv)} className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest">{copiedId === inv.id ? 'Copied!' : 'Copy Link'}</button>
                          <button onClick={() => handleRevokeInvite(inv.id)} className="text-[10px] font-black text-red-500 hover:text-red-600 hover:underline uppercase tracking-widest">Revoke</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View: High-End Cards */}
        <div className="lg:hidden space-y-4 pb-20">
          <>
            {activeTab === 'members' ? filteredMembers.map(member => {
              const isOnline = onlineUsers.has(member.user.id);
              const count = member.user._count;
              const isUntouchable = member.role === 'SUPER_ADMIN' || member.role === 'OWNER';
              const isOwnEntry = member.user.id === currentUserId;

              return (
                <motion.div
                  key={member.id} layout
                  className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50"
                  onClick={() => setSearchParams({ userId: member.user.id })}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <Avatar firstName={member.user.firstName} lastName={member.user.lastName} avatarUrl={member.user.avatarUrl} size="md" />
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{member.user.firstName} {member.user.lastName}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400 truncate tracking-tight">{member.user.email}</p>
                        <span className="text-[9px] font-mono text-gray-400">#{member.user.id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-gray-50 dark:bg-gray-900 rounded text-[9px] font-black text-gray-500 uppercase tracking-widest">{member.role}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-gray-700/50">
                    <div className="flex gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                      <div><span className="text-gray-900 dark:text-white">{count?.folderMemberships || 0}</span> Folders</div>
                      <div><span className="text-gray-900 dark:text-white">{count?.assignedTasks || 0}</span> Tasks</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isUntouchable && !isOwnEntry && canManagePeople && (
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === member.id ? null : member.id); }} className="p-1 px-3 bg-gray-50 dark:bg-gray-900 text-gray-400 rounded-lg text-xs font-black">OPTIONS</button>
                          {activeMenuId === member.id && (
                            <div className="absolute right-0 bottom-full mb-2 w-52 bg-white dark:bg-[#1E2530] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 py-2 z-[100] animate-scale-in origin-bottom-right backdrop-blur-xl overflow-hidden">
                              <div className="px-4 py-2 mb-1 border-b border-gray-50 dark:border-gray-800/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin Options</div>

                              {member.role === 'MEMBER' && (
                                <button onClick={() => { setSelectedUser(member.user); setIsSpaceModalOpen(true); setActiveMenuId(null); }} className="w-full text-left px-4 py-2.5 text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
                                  Manage Access
                                </button>
                              )}

                              <div className="px-4 py-1.5 mt-1 border-t border-gray-50 dark:border-gray-800/50 text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Change Role:</div>
                              <div className="px-2 space-y-0.5">
                                {['ADMIN', 'MEMBER', 'LIMITED_MEMBER', 'GUEST', 'HR'].filter(r => r !== member.role).map(r => (
                                  <button key={r} onClick={() => { handleUpdateRole(member.user.id, r); setActiveMenuId(null); }} className="w-full text-left px-4 py-2 text-[12px] font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">{r}</button>
                                ))}
                              </div>

                              {(member.role === 'ADMIN' || member.role === 'MEMBER' || member.role === 'LIMITED_MEMBER' || member.role === 'GUEST' || member.role === 'HR') && (
                                <>
                                  <div className="my-1 border-t border-gray-50 dark:border-gray-800/50" />
                                  <button onClick={() => handleRemoveMember(member.user.id)} className="w-full text-left px-4 py-2 text-[12px] font-bold text-red-500 hover:bg-red-50">Remove</button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            }) : filteredInvites.map(inv => (
              <div key={inv.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-black text-gray-900 dark:text-white truncate">{inv.email}</p>
                  <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded text-[9px] font-black uppercase tracking-widest">{inv.role}</span>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <button onClick={() => copyInviteLink(inv)} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-lg text-xs font-bold uppercase tracking-widest">{copiedId === inv.id ? 'Copied!' : 'Copy invite link'}</button>
                  <button onClick={() => handleRevokeInvite(inv.id)} className="text-[10px] font-black text-red-400 uppercase tracking-widest">Revoke</button>
                </div>
              </div>
            ))}
          </>
        </div>
      </div>

      {isInviteModalOpen && <InviteModal onClose={() => setIsInviteModalOpen(false)} />}
      {currentOrg && <SpaceAccessModal open={isSpaceModalOpen} onClose={() => setIsSpaceModalOpen(false)} user={selectedUser} organizationId={currentOrg.id} />}
    </div>
  );
}
