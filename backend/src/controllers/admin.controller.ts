import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import fs from 'fs';
import path from 'path';
import { getIO } from '../socket';

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbnails');

export class AdminController {
  private async verifySuperAdmin(req: Request, organizationId: string) {
    if (!req.user) throw ApiError.unauthorized();
    
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: req.user.id } },
    });

    if (!membership || (membership.role !== 'SUPER_ADMIN' && membership.role !== 'OWNER')) {
      throw ApiError.forbidden('Only Super Admins or Owners can access this area');
    }
    return membership;
  }

  getTrash = asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.params.organizationId as string;
    await this.verifySuperAdmin(req, organizationId);

    // Fetch all trashed items in this organization
    const tasks = await prisma.task.findMany({
      where: { 
        OR: [
          { project: { organizationId } },
          { list: { space: { organizationId } } }
        ],
        isDeleted: true 
      },
      include: { 
        deletedBy: { select: { firstName: true, lastName: true } },
        attachments: { select: { size: true } }
      },
      orderBy: { deletedAt: 'desc' }
    });

    const folders = await prisma.folder.findMany({
      where: { space: { organizationId }, isDeleted: true },
      include: { 
        deletedBy: { select: { firstName: true, lastName: true } },
        lists: {
          include: {
            tasks: {
              include: {
                attachments: { select: { size: true } }
              }
            }
          }
        }
      },
      orderBy: { deletedAt: 'desc' }
    });

    const lists = await prisma.list.findMany({
      where: { space: { organizationId }, isDeleted: true },
      include: { 
        deletedBy: { select: { firstName: true, lastName: true } },
        tasks: {
          include: {
            attachments: { select: { size: true } }
          }
        }
      },
      orderBy: { deletedAt: 'desc' }
    });

    const attachments = await prisma.attachment.findMany({
      where: { task: { OR: [ { project: { organizationId } }, { list: { space: { organizationId } } } ] }, isDeleted: true },
      include: { deletedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { deletedAt: 'desc' }
    });

    // Format attachments with image metadata for preview
    const formattedAttachments = attachments.map(att => {
      const isImage = att.mimeType.startsWith('image/');
      return {
        ...att,
        isImage,
        thumbnailUrl: isImage ? `/uploads/thumbnails/thumb_${att.filename}` : null
      };
    });

    res.json({
      success: true,
      data: {
        tasks,
        folders,
        lists,
        attachments: formattedAttachments
      }
    });
  });

  restoreItem = asyncHandler(async (req: Request, res: Response) => {
    const type = req.params.type as string;
    const id = req.params.id as string;
    const { organizationId } = req.body;
    await this.verifySuperAdmin(req, organizationId);

    switch (type) {
      case 'task':
        // Restore task and related soft-deleted entities (attachments + subtasks).
        // Note: Comments/activities are not soft-deleted in this schema.
        await prisma.$transaction(async (tx) => {
          const subtasks = await tx.task.findMany({
            where: { parentTaskId: id },
            select: { id: true },
          });
          const subtaskIds = subtasks.map((t) => t.id);
          const allTaskIds = [id, ...subtaskIds];

          await tx.task.update({
            where: { id },
            data: { isDeleted: false, deletedAt: null, deletedById: null },
          });

          if (subtaskIds.length > 0) {
            await tx.task.updateMany({
              where: { id: { in: subtaskIds } },
              data: { isDeleted: false, deletedAt: null, deletedById: null },
            });
          }

          await tx.attachment.updateMany({
            where: { taskId: { in: allTaskIds }, isDeleted: true },
            data: { isDeleted: false, deletedAt: null, deletedById: null },
          });
        });
        break;
      case 'folder':
        await prisma.folder.update({ where: { id }, data: { isDeleted: false, deletedAt: null, deletedById: null } });
        // NOTE: Restoring a folder currently does not auto-restore lists inside. 
        // User might want to selectively restore them.
        break;
      case 'list':
        await prisma.list.update({ where: { id }, data: { isDeleted: false, deletedAt: null, deletedById: null } });
        break;
      case 'attachment':
        await prisma.attachment.update({ where: { id }, data: { isDeleted: false, deletedAt: null, deletedById: null } });
        break;
      default:
        throw ApiError.badRequest('Invalid item type');
    }

    getIO().to(`org:${organizationId}`).emit('task:refresh');
    getIO().to(`org:${organizationId}`).emit('space:updated');
    getIO().to(`org:${organizationId}`).emit('dashboard:refresh');

    res.json({ success: true, message: 'Item restored' });
  });

  permanentDelete = asyncHandler(async (req: Request, res: Response) => {
    const type = req.params.type as string;
    const id = req.params.id as string;
    const { organizationId } = req.body;
    await this.verifySuperAdmin(req, organizationId);

    switch (type) {
      case 'task':
        await prisma.task.delete({ where: { id } });
        break;
      case 'folder':
        await prisma.folder.delete({ where: { id } });
        break;
      case 'list':
        await prisma.list.delete({ where: { id } });
        break;
      case 'attachment':
        const att = await prisma.attachment.findUnique({ where: { id } });
        if (att) {
          const filePath = path.join(UPLOAD_DIR, att.filename);
          const thumbPath = path.join(THUMB_DIR, `thumb_${att.filename}`);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
          await prisma.attachment.delete({ where: { id } });
        }
        break;
      default:
        throw ApiError.badRequest('Invalid item type');
    }

    getIO().to(`org:${organizationId}`).emit('task:refresh');
    getIO().to(`org:${organizationId}`).emit('space:updated');
    getIO().to(`org:${organizationId}`).emit('dashboard:refresh');

    res.json({ success: true, message: 'Item permanently deleted' });
  });

  bulkRestore = asyncHandler(async (req: Request, res: Response) => {
    const type = req.params.type as string;
    const { ids, organizationId } = req.body;
    await this.verifySuperAdmin(req, organizationId);

    if (!Array.isArray(ids)) throw ApiError.badRequest('IDs must be an array');

    const updateData = { isDeleted: false, deletedAt: null, deletedById: null };

    switch (type) {
      case 'task':
        // Restore tasks and any soft-deleted attachments under them.
        await prisma.$transaction(async (tx) => {
          await tx.task.updateMany({ where: { id: { in: ids } }, data: updateData });
          await tx.attachment.updateMany({
            where: { taskId: { in: ids }, isDeleted: true },
            data: updateData,
          });
        });
        break;
      case 'folder':
        await prisma.folder.updateMany({ where: { id: { in: ids } }, data: updateData });
        break;
      case 'list':
        await prisma.list.updateMany({ where: { id: { in: ids } }, data: updateData });
        break;
      case 'attachment':
        await prisma.attachment.updateMany({ where: { id: { in: ids } }, data: updateData });
        break;
      default:
        throw ApiError.badRequest('Invalid item type');
    }

    getIO().to(`org:${organizationId}`).emit('task:refresh');
    res.json({ success: true, message: `${ids.length} items restored` });
  });

  bulkPermanentDelete = asyncHandler(async (req: Request, res: Response) => {
    const type = req.params.type as string;
    const { ids, organizationId } = req.body;
    await this.verifySuperAdmin(req, organizationId);

    if (!Array.isArray(ids)) throw ApiError.badRequest('IDs must be an array');

    switch (type) {
      case 'task':
        await prisma.task.deleteMany({ where: { id: { in: ids } } });
        break;
      case 'folder':
        await prisma.folder.deleteMany({ where: { id: { in: ids } } });
        break;
      case 'list':
        await prisma.list.deleteMany({ where: { id: { in: ids } } });
        break;
      case 'attachment':
        const attachments = await prisma.attachment.findMany({ where: { id: { in: ids } } });
        for (const att of attachments) {
          const filePath = path.join(UPLOAD_DIR, att.filename);
          const thumbPath = path.join(THUMB_DIR, `thumb_${att.filename}`);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
        }
        await prisma.attachment.deleteMany({ where: { id: { in: ids } } });
        break;
      default:
        throw ApiError.badRequest('Invalid item type');
    }

    getIO().to(`org:${organizationId}`).emit('task:refresh');
    res.json({ success: true, message: `${ids.length} items permanently deleted` });
  });
}
