import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.query;
  const where: any = { userId: req.user!.id };
  if (orgId) where.organizationId = orgId as string;

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: notifications });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const result = await prisma.notification.updateMany({
    where: { id: id as string, userId },
    data: { isRead: true },
  });

  if (result.count === 0) {
    res.status(404).json({ success: false, error: 'Notification not found' });
    return;
  }

  try {
    const { getIO } = require('../socket');
    getIO().to(`user:${userId}`).emit('notification:read_sync', { id });
  } catch (e) { }

  res.json({ success: true });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { orgId } = req.query;
  const where: any = { userId, isRead: false };
  if (orgId) where.organizationId = orgId as string;

  await prisma.notification.updateMany({
    where,
    data: { isRead: true },
  });

  try {
    const { getIO } = require('../socket');
    getIO().to(`user:${userId}`).emit('notification:read_all_sync');
  } catch (e) { }

  res.json({ success: true });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = req.query;
  const where: any = { userId: req.user!.id, isRead: false };
  if (orgId) where.organizationId = orgId as string;

  const count = await prisma.notification.count({
    where,
  });
  res.json({ success: true, data: { count } });
});

export const markTaskAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user!.id;
  
  await prisma.notification.updateMany({
    where: { 
      userId, 
      isRead: false,
      link: { contains: taskId as string }
    },
    data: { isRead: true },
  });
  
  try {
    const { getIO } = require('../socket');
    getIO().to(`user:${userId}`).emit('notification:task_read_sync', { taskId });
  } catch (e) { }
  
  res.json({ success: true });
});
