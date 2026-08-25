import { Request, Response } from 'express';
import { z } from 'zod';
import { CommentService } from '../services/comment.service';
import { TaskService } from '../services/task.service';
import { ActivityService } from '../services/activity.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { prisma } from '../config/database';

const attachmentPartSchema = z.object({
  fileUrl: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
});

const createSchema = z.object({
  text: z.string().optional().default(''),
  imageUrl: z.string().optional().nullable(),
  fileUrl: z.string().optional().nullable(),
  fileName: z.string().optional().nullable(),
  fileType: z.string().optional().nullable(),
  fileSize: z.number().optional().nullable(),
  attachments: z.array(attachmentPartSchema).optional(),
  mentions: z.array(z.string()).optional(),
  exclusiveMention: z.boolean().optional(),
});

const removeAttachmentSchema = z.object({
  fileUrl: z.string().min(1),
});

const updateSchema = z.object({
  text: z.string(),
});

export class CommentController {
  /** POST /tasks/:taskId/comments */
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const taskId = req.params.taskId as string;
    const { text, imageUrl, fileUrl, fileName, fileType, fileSize, attachments, mentions } = createSchema.parse(req.body);

    const task = await TaskService.getById(taskId, req.user.id);
    const organizationId = task.project?.organizationId || ((task as any).list?.space?.organizationId);

    if (!organizationId) throw ApiError.badRequest('Unable to resolve organization for task');

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: req.user.id
        }
      }
    });

    if (!membership) throw ApiError.forbidden('Not a member of this organization');
    if (membership.role === 'GUEST') throw ApiError.forbidden('Guests cannot add comments');

    const fileData = {
      imageUrl,
      fileUrl,
      fileName,
      fileType,
      fileSize,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };
    const comment = await CommentService.create(taskId, req.user.id, text || '', membership.role, fileData, { mentions });

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: taskId,
      action: 'comment.created',
      changes: { 
        commentId: comment.id, 
        text,
        fileUrl: comment.fileUrl,
        fileName: comment.fileName,
        fileType: comment.fileType,
        fileSize: comment.fileSize,
        attachmentCount: Array.isArray((comment as any).attachments) ? (comment as any).attachments.length : 0,
      },
      mentions: mentions || [],
      isPrivate: false
    });

    try {
      import('../socket').then(({ getIO }) => {
        getIO().emit('task:refresh');
        if (organizationId) {
          getIO().to(`org:${organizationId}`).emit('task:updated', { taskId });
        }
      });
    } catch (e) { }

    res.status(201).json({ success: true, data: comment });
  });

  /** GET /tasks/:taskId/comments */
  getByTask = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const taskId = req.params.taskId as string;
    const comments = await CommentService.getByTask(taskId);
    res.json({ success: true, data: comments });
  });

  /** DELETE /comments/:id */
  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const commentId = req.params.id as string;
    await CommentService.delete(commentId, req.user.id);
    await ActivityService.deleteByCommentId(commentId);
    
    res.json({ success: true, message: 'Comment deleted' });
  });

  /** PATCH /comments/:id { text } */
  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const commentId = req.params.id as string;
    const { text } = updateSchema.parse(req.body);
    const updated = await CommentService.update(commentId, req.user.id, text);
    res.json({ success: true, data: updated });
  });

  /** PATCH /comments/:id/attachments { fileUrl } */
  removeAttachment = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const commentId = req.params.id as string;
    const { fileUrl } = removeAttachmentSchema.parse(req.body);

    const updated = await CommentService.removeAttachment(commentId, req.user.id, fileUrl);
    res.json({ success: true, data: updated });
  });
}
