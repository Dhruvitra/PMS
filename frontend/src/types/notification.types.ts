export interface Notification {
  id: string;
  userId: string;
  organizationId?: string | null;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
  senderAvatarUrl?: string | null;
}
