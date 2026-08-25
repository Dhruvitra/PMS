import { Request, Response } from 'express';
import { z } from 'zod';
import { ListService } from '../services/list.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { prisma } from '../config/database';
import { getIO } from '../socket';

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  spaceId: z.string().uuid(),
  folderId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  position: z.number().int().min(0).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

const reorderSchema = z.object({
  listIds: z.array(z.string().uuid()),
});

export class ListController {
  private async verifyListAccess(spaceId: string, userId: string) {
    const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { organizationId: true } });
    if (!space) throw ApiError.notFound('Space not found');

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: space.organizationId, userId } },
    });
    if (!membership) throw ApiError.forbidden('Not a member of this organization');
    return membership;
  }

  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = createSchema.parse(req.body);
    const membership = await this.verifyListAccess(data.spaceId, req.user.id);
    const list = await ListService.create(data, req.user.id, membership.role);
    res.status(201).json({ success: true, data: list });
  });

  getBySpace = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const membership = await this.verifyListAccess(req.params.spaceId as string, req.user.id);
    const lists = await ListService.getBySpace(req.params.spaceId as string, req.user.id, membership.role);
    res.json({ success: true, data: lists });
  });

  getByFolder = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const folder = await prisma.folder.findUnique({ where: { id: req.params.folderId as string }, select: { spaceId: true } });
    if (!folder) throw ApiError.notFound('Folder not found');

    const membership = await this.verifyListAccess(folder.spaceId, req.user.id);
    const lists = await ListService.getByFolder(req.params.folderId as string, req.user.id, membership.role);
    res.json({ success: true, data: lists });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const list = await ListService.getById(req.params.id as string);
    res.json({ success: true, data: list });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = updateSchema.parse(req.body);
    const listBefore = await ListService.getById(req.params.id as string);
    const membership = await this.verifyListAccess(listBefore.spaceId, req.user.id);

    const list = await ListService.update(req.params.id as string, data, req.user.id, membership.role);
    res.json({ success: true, data: list });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const list = await ListService.getById(req.params.id as string);
    const membership = await this.verifyListAccess(list.spaceId, req.user.id);

    await ListService.delete(req.params.id as string, req.user.id, membership.role);
    
    if (membership && membership.organizationId) {
      getIO().to(`org:${membership.organizationId}`).emit('space:updated');
      getIO().to(`org:${membership.organizationId}`).emit('task:refresh');
      getIO().to(`org:${membership.organizationId}`).emit('dashboard:refresh');
    }

    res.json({ success: true, message: 'List deleted' });
  });

  reorder = asyncHandler(async (req: Request, res: Response) => {
    const { listIds } = reorderSchema.parse(req.body);
    await ListService.reorder(listIds);
    res.json({ success: true, message: 'Lists reordered' });
  });
}
