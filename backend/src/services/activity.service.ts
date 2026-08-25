import { prisma } from '../config/database';
import type { Prisma } from '@prisma/client';

interface LogActivityInput {
  orgId?: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes?: Prisma.InputJsonValue;
  mentions?: string[];
  isPrivate?: boolean;
}

export class ActivityService {
  static async log(input: LogActivityInput) {
    return prisma.activity.create({
      data: {
        orgId: input.orgId,
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        changes: input.changes || {},
        // @ts-ignore - Fields will exist after successful prisma generate
        mentions: input.mentions || [],
        // @ts-ignore
        isPrivate: input.isPrivate || false
      },
    });
  }

  static async getByEntity(entityType: string, entityId: string, limit = 50, offset = 0) {
    // Note: Showing ALL activities as per user request "remove for @ people comment to show all"
    return prisma.activity.findMany({
      where: { entityType, entityId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  static async getByListTasks(listId: string, limit = 50, offset = 0) {
    return prisma.activity.findMany({
      where: {
        entityType: 'task',
        entityId: {
          in: await prisma.task.findMany({
            where: { listId },
            select: { id: true },
          }).then(tasks => tasks.map(t => t.id)),
        },
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  static async getByOrganization(orgId: string, limit = 50, offset = 0) {
    return prisma.activity.findMany({
      where: { orgId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  static async deleteByCommentId(commentId: string) {
    return prisma.activity.deleteMany({
      where: {
        changes: {
          path: ['commentId'],
          equals: commentId,
        },
      },
    });
  }
}
