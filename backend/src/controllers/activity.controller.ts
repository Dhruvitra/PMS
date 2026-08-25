import { Request, Response } from 'express';
import { ActivityService } from '../services/activity.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

export class ActivityController {
  /** GET /tasks/:taskId/activities */
  getByTask = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { taskId } = req.params;
    const limit = parseInt(String(req.query.limit ?? '50'));
    const offset = parseInt(String(req.query.offset ?? '0'));

    const activities = await ActivityService.getByEntity('task', taskId as string, limit || 50, offset || 0);
    res.json({ success: true, data: activities });
  });

  /** GET /lists/:listId/activities */
  getByList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { listId } = req.params;
    const limit = parseInt(String(req.query.limit ?? '50'));
    const offset = parseInt(String(req.query.offset ?? '0'));

    const activities = await ActivityService.getByEntity('list', listId as string, limit || 50, offset || 0);
    res.json({ success: true, data: activities });
  });

  getByOrganization = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { orgId } = req.query;
    if (!orgId) throw ApiError.badRequest('Organization ID is required');

    const limit = parseInt(String(req.query.limit ?? '50'));
    const offset = parseInt(String(req.query.offset ?? '0'));

    const activities = await ActivityService.getByOrganization(orgId as string, limit || 50, offset || 0);
    res.json({ success: true, data: activities });
  });
}
