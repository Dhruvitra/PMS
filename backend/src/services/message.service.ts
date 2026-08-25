import { prisma } from '../config/database';

export class MessageService {
  static async getConversation(userId1: string, userId2: string, limit = 50, before?: string) {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });

    return messages.reverse();
  }

  static async sendMessage(
    senderId: string, 
    receiverId: string, 
    text?: string, 
    imageUrl?: string,
    fileUrl?: string,
    fileName?: string,
    fileType?: string,
    fileSize?: number
  ) {
    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        text: text || null,
        imageUrl: imageUrl || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        fileSize: fileSize || null,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });

    const { getIO } = require('../socket');
    getIO().to(`user:${receiverId}`).emit('message:new', message);

    return message;
  }

  static async getRecentChats(userId: string) {
    // Get distinct users this user has chatted with, with latest message
    const sent = await prisma.message.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });

    const received = await prisma.message.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const chatUserIds = new Set<string>();
    sent.forEach((m) => chatUserIds.add(m.receiverId));
    received.forEach((m) => chatUserIds.add(m.senderId));

    const chats = [];
    for (const otherId of chatUserIds) {
      const lastMessage = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: otherId },
            { senderId: otherId, receiverId: userId },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      const user = await prisma.user.findUnique({
        where: { id: otherId },
        select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
      });

      if (user && lastMessage) {
        chats.push({ user, lastMessage });
      }
    }

    chats.sort((a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime());
    return chats;
  }

  static async getUnreadCounts(userId: string) {
    const results = await prisma.message.groupBy({
      by: ['senderId'],
      where: {
        receiverId: userId,
        readAt: null,
      },
      _count: { id: true },
    });

    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.senderId] = r._count.id;
    }
    return counts;
  }

  static async markAsRead(receiverId: string, senderId: string) {
    await prisma.message.updateMany({
      where: {
        senderId,
        receiverId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    // Also mark DM-linked notifications as read for this user
    await prisma.notification.updateMany({
      where: {
        userId: receiverId,
        title: 'New Message',
        link: { contains: `userId=${senderId}` },
        isRead: false,
      },
      data: { isRead: true },
    });

    const { getIO } = require('../socket');
    const io = getIO();
    // Notify the sender that their messages were read
    io.to(`user:${senderId}`).emit('messages:read-receipt', { readBy: receiverId });
    // Notify the receiver (current user) on other tabs to clear their unread badge for this sender
    io.to(`user:${receiverId}`).emit('messages:read-receipt', { readBy: receiverId, senderId });
  }

  static async clearConversation(userId: string, otherUserId: string) {
    const result = await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
    });
    return result.count;
  }

  static async deleteMessages(userId: string, messageIds: string[]) {
    // Only delete messages where the user is sender or receiver
    const result = await prisma.message.deleteMany({
      where: {
        id: { in: messageIds },
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
    });
    return result.count;
  }
}
