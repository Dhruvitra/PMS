import { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { ActivityItem } from './ActivityItem';
import { useSocket } from '../../hooks/useSocket';

interface ActivityUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface Activity {
  id: string;
  orgId: string | null;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown>;
  createdAt: string;
  user: ActivityUser;
}

interface Props {
  taskId: string;
  refreshKey?: number;
  onImagePreview?: (url: string, name: string) => void;
  onReply?: (activity: Activity) => void;
}

function groupByDate(activities: Activity[]): Record<string, Activity[]> {
  const groups: Record<string, Activity[]> = {};
  for (const a of activities) {
    const date = new Date(a.createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    } else {
      key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }
  return groups;
}

export function ActivityTimeline({ taskId, refreshKey, onImagePreview, onReply }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const socket = useSocket();

  const loadActivities = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await api.get<{ success: boolean; data: Activity[] }>(`/tasks/${taskId}/activities`);
      setActivities(res.data.data);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities, refreshKey]);

  // Real-time socket logic
  useEffect(() => {
    if (!socket || !taskId) return;

    const handleRealtimeUpdate = (data: any) => {
      // If the notification refers to this task, refresh the timeline
      if (data.link === `/tasks/${taskId}` || (data.message && data.message.includes(taskId))) {
        loadActivities(true);
      }
    };

    const handleTaskUpdate = (data?: any) => {
      // Refresh if the event is for this specific task, or is a global broadcast
      if (!data?.taskId || data.taskId === taskId) {
        loadActivities(true);
      }
    };

    socket.on('notification:new', handleRealtimeUpdate);
    socket.on('task:updated', handleTaskUpdate);
    socket.on('task:refresh', handleTaskUpdate);

    return () => {
      socket.off('notification:new', handleRealtimeUpdate);
      socket.off('task:updated', handleTaskUpdate);
      socket.off('task:refresh', handleTaskUpdate);
    };
  }, [socket, taskId, loadActivities]);

  if (loading) return <div className="flex justify-center p-4"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  const groups = groupByDate(activities);

  return (
    <div className="space-y-8 relative">
      {isRefreshing && (
        <div className="absolute top-0 right-0">
          <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}
      {Object.entries(groups).map(([date, items]) => (
        <div key={date} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">{date}</span>
            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
          </div>
          <div className="space-y-1">
            {items.map((activity) => (
              <ActivityItem 
                key={activity.id} 
                activity={activity} 
                onImagePreview={onImagePreview}
                onRefresh={() => loadActivities(true)}
                onReply={onReply}
              />
            ))}
          </div>
        </div>
      ))}
      {activities.length === 0 && (
        <div className="text-center py-12 px-4 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
          <p className="text-gray-400 text-sm font-medium">No activity yet. Be the first to start the conversation!</p>
        </div>
      )}
    </div>
  );
}
