import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { AttachmentService } from '../services/attachment.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { prisma } from '../config/database';
import { getIO } from '../socket';

export class AttachmentController {
  upload = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!req.file) throw ApiError.badRequest('No file uploaded');

    const taskId = req.params.taskId as string;
    const filePath = req.file.path;

    // "Basic virus scanning" simulate
    const content = fs.readFileSync(filePath);
    if (content.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      fs.unlinkSync(filePath);
      throw ApiError.badRequest('Virus detected in file!');
    }

    // Generate thumbnail for images
    if (req.file.mimetype.startsWith('image/')) {
      const thumbPath = path.join(path.dirname(filePath), 'thumb_' + req.file.filename);
      await sharp(filePath)
        .resize(200, 200, { fit: 'inside' })
        .toFile(thumbPath);
    }

    const taskForOrg = await prisma.task.findUnique({ where: { id: taskId }, include: { list: { select: { space: { select: { organizationId: true } } } }, project: { select: { organizationId: true } } } });
    const orgId = (taskForOrg as any)?.list?.space?.organizationId || (taskForOrg as any)?.project?.organizationId;
    const membership = orgId ? await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: req.user.id } }
    }) : null;

    const attachment = await AttachmentService.create({
      filename: req.file.filename,
      originalName: req.body.path || req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      taskId,
      uploadedById: req.user.id,
    }, membership?.role || 'GUEST');



    res.status(201).json({ success: true, data: attachment });
  });

  getByTask = asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const attachments = await AttachmentService.getByTask(taskId);
    res.json({ success: true, data: attachments });
  });

  /** GET /attachments/:id/download */
  download = asyncHandler(async (req: Request, res: Response) => {
    const attachment = await AttachmentService.getById(req.params.id as string);
    const filePath = AttachmentService.getFilePath(attachment.filename);

    if (!fs.existsSync(filePath)) {
      throw ApiError.notFound('File not found on server');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Length', attachment.size.toString());

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });

  rename = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { originalName } = req.body as { originalName?: string };
    const updated = await AttachmentService.rename(req.params.id as string, originalName || '', req.user.id);
    res.json({ success: true, data: updated });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id as string },
      include: {
        task: {
          include: {
            list: { select: { space: { select: { organizationId: true } } } },
            project: { select: { organizationId: true } }
          }
        }
      }
    });

    await AttachmentService.delete(req.params.id as string, req.user.id);

    if (attachment && attachment.task) {
      const orgId = (attachment.task as any).list?.space?.organizationId || (attachment.task as any).project?.organizationId;
      if (orgId) {
        getIO().to(`org:${orgId}`).emit('task:refresh');
        getIO().to(`org:${orgId}`).emit('dashboard:refresh');
      }
    }

    res.json({ success: true, message: 'Attachment deleted' });
  });
}
