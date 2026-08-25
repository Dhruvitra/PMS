import { Request, Response } from 'express';
import { z } from 'zod';
import { StatusType } from '@prisma/client';
import { StatusService } from '../services/status.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  type: z.nativeEnum(StatusType),
  position: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  type: z.nativeEnum(StatusType).optional(),
  position: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  statusIds: z.array(z.string().uuid()),
});

export class StatusController {
  /** GET /lists/:id */
  getList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { prisma } = await import('../config/database');
    const list = await prisma.list.findUnique({
      where: { id: req.params.id as string },
      include: { statuses: { orderBy: { position: 'asc' } } },
    });
    if (!list) throw ApiError.notFound('List not found');
    res.json({ success: true, data: list });
  });

  /** GET /lists/:listId/statuses */
  getByList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const statuses = await StatusService.getByList(req.params.listId as string);
    res.json({ success: true, data: statuses });
  });

  /** POST /lists/:listId/statuses */
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = createSchema.parse(req.body);
    const status = await StatusService.create({
      ...data,
      listId: req.params.listId as string,
    });
    res.status(201).json({ success: true, data: status });
  });

  /** PATCH /statuses/:id */
  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = updateSchema.parse(req.body);
    const status = await StatusService.update(req.params.id as string, data);
    res.json({ success: true, data: status });
  });

  /** DELETE /statuses/:id */
  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await StatusService.delete(req.params.id as string);
    res.json({ success: true, message: 'Status deleted' });
  });

  /** PUT /lists/:listId/statuses/reorder */
  reorder = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { statusIds } = reorderSchema.parse(req.body);
    const statuses = await StatusService.reorder(req.params.listId as string, statusIds);
    res.json({ success: true, data: statuses });
  });

  /** POST /lists/:listId/statuses/defaults */
  createDefaults = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const statuses = await StatusService.createDefaults(req.params.listId as string);
    res.status(201).json({ success: true, data: statuses });
  });
}
