import { Request, Response } from 'express';
import { z } from 'zod';
import { TagService } from '../services/tag.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string(),
  organizationId: z.string().uuid(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
});

export class TagController {
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.query;
    if (!organizationId) throw ApiError.badRequest('organizationId is required');
    const tags = await TagService.getByOrganization(organizationId as string);
    res.json({ success: true, data: tags });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const data = createSchema.parse(req.body);
    const tag = await TagService.create(data);
    res.status(201).json({ success: true, data: tag });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const data = updateSchema.parse(req.body);
    const tag = await TagService.update(req.params.id as string, data);
    res.json({ success: true, data: tag });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await TagService.delete(req.params.id as string);
    res.json({ success: true, message: 'Tag deleted' });
  });
}
