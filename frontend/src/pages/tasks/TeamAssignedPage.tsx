import { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useSearchParams } from 'react-router';
import api from '../../services/api';
import { batchRequests } from '../../services/requestManager';
import { useSocket } from '../../hooks/useSocket';
import { Loading } from '../../components/ui/Loading';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { useAppSelector, useAppDispatch } from '../../store';
import {
  incrementUnread,
  resetUnread,
  fetchUnreadCounts,
} from '../../store/slices/messageSlice';
import type { Task } from '../../types';

const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#e11d48', '#0891b2', '#4f46e5', '#db2777',
];

function getAvatarColor(idx: number) {
  return AVATAR_COLORS[idx % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  if (!name) return 'U';
  return name.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase() || 'U';
}

interface MemberTasks {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  tasks: Task[];
}

const MemberAvatar = memo(({ name, idx, onlineUsers, userId, avatarUrl }: { name: string; idx: number; onlineUsers: Set<string>; userId: string; avatarUrl?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const color = getAvatarColor(idx);
  const initials = getInitials(name);

  useEffect(() => {
    if (ref.current && !avatarUrl) ref.current.style.backgroundColor = color;
  }, [color, avatarUrl]);

  return (
    <div className="relative">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shadow-sm shrink-0" />
      ) : (
        <div
          ref={ref}
          className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm"
        >
          {initials}
        </div>
      )}
      {onlineUsers.has(userId) && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 bg-green-500" />
      )}
    </div>
  );
});

export function TeamAssignedPage() {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const { unreadCounts } = useAppSelector(state => state.message);
  const { currentUser } = useAppSelector(state => state.user);
  const [memberTasks, setMemberTasks] = useState<MemberTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const userIdParam = searchParams.get('userId');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    dispatch(fetchUnreadCounts());
  }, [dispatch]);

  useEffect(() => {
    if (!socket) return;
    const handleOnlineList = (userIds: string[]) => setOnlineUsers(new Set(userIds));
    const handleUserOnline = (data: { userId: string }) => setOnlineUsers((prev) => new Set(prev).add(data.userId));
    const handleUserOffline = (data: { userId: string }) => {
      setOnlineUsers((prev) => { const next = new Set(prev); next.delete(data.userId); return next; });
    };
    const handleNewMessage = (msg: any) => {
      dispatch(incrementUnread(msg.senderId));
    };
    socket.on('users:online-list', handleOnlineList);
    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);
    socket.on('message:new', handleNewMessage);
    socket.emit('users:get-online-list');
    return () => {
      socket.off('users:online-list', handleOnlineList);
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
      socket.off('message:new', handleNewMessage);
    };
  }, [socket, dispatch]);

  const handleMessagesRead = useCallback((senderId: string) => {
    dispatch(resetUnread(senderId));
  }, [dispatch]);

  const abortRef = useRef<AbortController | null>(null);

  const loadTeamTasks = useCallback(async () => {
    // Cancel previous load
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);

      // Parallel: fetch orgs + all tasks at the same time
      const [orgRes, tasksRes] = await batchRequests([
        () => api.get<{ success: boolean; data: any[] }>('/organizations', { signal: controller.signal }),
        () => api.get<{ success: boolean; data: Task[] }>('/tasks/all', { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;

      const orgs = orgRes.data.data;
      const allTasks = tasksRes.data.data;

      // Parallel: fetch members for ALL orgs simultaneously
      const allUsersMap: Record<string, any> = {};
      const memberResults = await batchRequests(
        orgs.map((org: any) => () =>
          api.get<{ success: boolean; data: { user: any }[] }>(
            `/organizations/${org.id}/members`,
            { signal: controller.signal }
          ).catch(() => null)
        ) as any
      );
      if (controller.signal.aborted) return;

      (memberResults as any[]).forEach((res: any) => {
        if (res?.data?.data) {
          res.data.data.forEach((m: any) => { if (m.user) allUsersMap[m.user.id] = m.user; });
        }
      });

      const grouped: Record<string, MemberTasks> = {};
      Object.values(allUsersMap).forEach(user => {
        grouped[user.id] = {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          avatarUrl: user.avatarUrl,
          tasks: []
        };
      });

      for (const task of allTasks) {
        task.assignees?.forEach(assignee => { if (grouped[assignee.id]) grouped[assignee.id].tasks.push(task); });
      }

      const members = Object.values(grouped).sort((a, b) => {
        if (a.userId === currentUser?.id) return -1;
        if (b.userId === currentUser?.id) return 1;
        return 0;
      });

      setMemberTasks(members);
      if (members.length > 0) {
        if (userIdParam) setSelectedMember(userIdParam);
        else if (!selectedMember) {
          const firstOther = members.find((m) => m.userId !== currentUser?.id);
          setSelectedMember(firstOther ? firstOther.userId : members[0].userId);
        }
      }
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED') return;
      console.error('Failed to load team tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, userIdParam, selectedMember]);

  useEffect(() => {
    loadTeamTasks();
    return () => { abortRef.current?.abort(); };
  }, [loadTeamTasks]);

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      loadTeamTasks();
    }, 500);
  }, [loadTeamTasks]);

  // Separate socket effect for real-time task/team refresh
  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => {
      debouncedRefresh();
    };
    socket.on('task:updated', handleRefresh);
    socket.on('task:refresh', handleRefresh);
    socket.on('people:updated', handleRefresh);
    socket.on('org:member_added', handleRefresh);
    return () => {
      socket.off('task:updated', handleRefresh);
      socket.off('task:refresh', handleRefresh);
      socket.off('people:updated', handleRefresh);
      socket.off('org:member_added', handleRefresh);
    };
  }, [socket, currentUser?.id]);

  useEffect(() => { if (userIdParam) setSelectedMember(userIdParam); }, [userIdParam]);

  if (loading) return <Loading size="lg" />;

  const totalAllTasks = memberTasks.reduce((sum, m) => sum + m.tasks.length, 0);
  const totalDoneTasks = memberTasks.reduce((sum, m) => sum + m.tasks.filter((t) => t.status === 'COMPLETED').length, 0);
  const totalUnread = Object.values(unreadCounts).reduce((s, c) => s + c, 0);

  const selectedMemberData = selectedMember ? memberTasks.find((m) => m.userId === selectedMember) : null;
  const selectedIdx = selectedMember ? memberTasks.findIndex((m) => m.userId === selectedMember) : -1;

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 flex overflow-hidden">
      {!selectedMember && (
        <div className="flex-1 border-r border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden transition-all">
          <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Team Activity</h2>
                {totalUnread > 0 && <span className="px-1.5 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold">{totalUnread} new</span>}
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-bold text-gray-400">
              <span>{memberTasks.length} Members</span>
              <span>{totalAllTasks} Tasks</span>
              <span>{totalDoneTasks} Completed</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar">
            {memberTasks.map((member, idx) => (
              <div key={member.userId} className={`group rounded-xl border transition-all ${selectedMember === member.userId ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-indigo-100'}`}>
                <div className="p-3 flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedMember(member.userId); setSearchParams({ userId: member.userId }); }}>
                  <MemberAvatar name={member.name} idx={idx} onlineUsers={onlineUsers} userId={member.userId} avatarUrl={member.avatarUrl} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{member.userId === currentUser?.id ? 'Me (Personal)' : member.name}</p>
                      {(unreadCounts[member.userId] || 0) > 0 && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{member.tasks.length} tasks</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {selectedMember && selectedMemberData && (
        <div className="flex-1 flex flex-col min-w-0 relative bg-white dark:bg-gray-900 overflow-hidden">
          <ChatPanel
            currentUserId={currentUser?.id || ''}
            targetUser={{
              id: selectedMemberData.userId,
              name: selectedMemberData.name,
              email: selectedMemberData.email,
              avatarUrl: selectedMemberData.avatarUrl,
              colorIdx: selectedIdx
            }}
            onlineUsers={onlineUsers}
            onMessagesRead={handleMessagesRead}
            onBack={() => { setSelectedMember(null); setSearchParams({}); }}
          />
        </div>
      )}
    </div>
  );
}
