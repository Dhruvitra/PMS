import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { OrgRole } from '@prisma/client';
import { NotificationService } from './notification.service';
import { stripHtml } from '../utils/string';

export class CommentService {
  static async create(
    taskId: string,
    userId: string,
    text: string,
    role: OrgRole,
    fileData?: {
      imageUrl?: string | null;
      fileUrl?: string | null;
      fileName?: string | null;
      fileType?: string | null;
      fileSize?: number | null;
      attachments?: Array<{ fileUrl: string; fileName: string; fileType: string; fileSize: number }>;
    },
    options?: { mentions?: string[] }
  ) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw ApiError.notFound('Task not found');

    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId,
        text,
        ...fileData,
        // @ts-ignore
        mentions: options?.mentions || [],
        // @ts-ignore
        isPrivate: false, // Per user request: "remove for @ people comment to show all"
      } as any,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    }) as any;

    // Notify activity - Strip HTML from notification message
    const cleanText = stripHtml(text || '');

    // Always notify task activity to everyone (no privacy filtering)
    await NotificationService.notifyTaskActivity(
      taskId,
      userId,
      role,
      task.title,
      `${comment.user.firstName} commented: "${cleanText.substring(0, 50)}${cleanText.length > 50 ? '...' : ''}"`
    );

    // Also send direct notifications to mentioned people for emphasis
    if (options?.mentions && options.mentions.length > 0) {
      for (const mentionedId of options.mentions) {
        if (mentionedId === userId) continue;
        await NotificationService.create(
          mentionedId,
          task.title,
          `${comment.user.firstName} mentioned you: "${cleanText.substring(0, 50)}${cleanText.length > 50 ? '...' : ''}"`,
          `/tasks/${taskId}`
        );
      }
    }

    return comment;
  }

  static async getByTask(taskId: string) {
    // Return ALL comments for this task
    return prisma.comment.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Owner/Admin/Super Admin can moderate and delete any comment in their org; everyone else
   *  (Member, Limited Member, Guest, etc.) can only delete their own. */
  static async delete(id: string, userId: string) {
    const comment = await prisma.comment.findUnique({
      where: { id },
      include: { task: { include: { project: true, list: { include: { space: true } } } } },
    });
    if (!comment) throw ApiError.notFound('Comment not found');

    if (comment.userId !== userId) {
      const organizationId = comment.task.project?.organizationId || comment.task.list?.space?.organizationId;
      const membership = organizationId
        ? await prisma.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId, userId } },
        })
        : null;
      const canModerate = membership && (['OWNER', 'ADMIN', 'SUPER_ADMIN'] as OrgRole[]).includes(membership.role);
      if (!canModerate) throw ApiError.forbidden('Not your comment');
    }

    await prisma.comment.delete({ where: { id } });
  }

  static async update(id: string, userId: string, text: string) {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) throw ApiError.notFound('Comment not found');
    if (comment.userId !== userId) throw ApiError.forbidden('Not your comment');
    return prisma.comment.update({
      where: { id },
      data: { text },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  static async removeAttachment(commentId: string, userId: string, fileUrl: string) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } }) as any;
    if (!comment) throw ApiError.notFound('Comment not found');
    if (comment.userId !== userId) throw ApiError.forbidden('Not your comment');

    const currentAttachments: Array<{ fileUrl: string; fileName: string; fileType: string; fileSize: number }> =
      Array.isArray(comment.attachments) ? comment.attachments : [];

    const isPrimary = comment.fileUrl && comment.fileUrl === fileUrl;
    const nextAttachments = currentAttachments.filter((a) => a?.fileUrl !== fileUrl);
    const removedFromExtra = nextAttachments.length !== currentAttachments.length;

    if (!isPrimary && !removedFromExtra) {
      // Nothing to remove (idempotent)
      return comment;
    }

    // If primary is removed, promote the first extra (if any) to primary.
    let nextPrimary: any = null;
    let remaining = nextAttachments;
    if (isPrimary && nextAttachments.length > 0) {
      nextPrimary = nextAttachments[0];
      remaining = nextAttachments.slice(1);
    }

    const data: any = {
      attachments: remaining.length > 0 ? remaining : null,
    };

    if (isPrimary) {
      if (nextPrimary) {
        data.fileUrl = nextPrimary.fileUrl;
        data.fileName = nextPrimary.fileName;
        data.fileType = nextPrimary.fileType;
        data.fileSize = nextPrimary.fileSize;
        // Keep imageUrl in sync with fileUrl if it was an image
        data.imageUrl = nextPrimary.fileType?.startsWith('image/') ? nextPrimary.fileUrl : null;
      } else {
        data.fileUrl = null;
        data.fileName = null;
        data.fileType = null;
        data.fileSize = null;
        data.imageUrl = null;
      }
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    }) as any;

    return updated;
  }
}
