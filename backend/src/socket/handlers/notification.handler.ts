import { Server, Socket } from 'socket.io';

export function registerNotificationHandlers(_io: Server, socket: Socket): void {
  socket.on('notification:read', (notificationId: string) => {
    // Mark notification as read — to be implemented with notification model
    console.log(`Notification ${notificationId} marked as read by ${socket.id}`);
  });
}
