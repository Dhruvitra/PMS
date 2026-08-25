import { Request, Response } from 'express';
import { z } from 'zod';
import { PlatformAdminService } from '../services/platform-admin.service';
import { SystemMetricsService } from '../services/system-metrics.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const statusSchema = z.object({
  status: z.enum(['PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED', 'REJECTED']),
});

const grantFreeAccessSchema = z.object({
  note: z.string().optional(),
});

const revertToPlanSchema = z.object({
  planId: z.string().min(1),
});

export class PlatformAdminController {
  listCompanies = asyncHandler(async (_req: Request, res: Response) => {
    const companies = await PlatformAdminService.listCompanies();
    res.json({ success: true, data: companies });
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.id as string;
    if (!orgId) throw ApiError.badRequest('Company ID is required');
    const { status } = statusSchema.parse(req.body);
    const org = await PlatformAdminService.updateStatus(orgId, status);
    res.json({ success: true, data: org });
  });

  grantFreeAccess = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.id as string;
    if (!orgId) throw ApiError.badRequest('Company ID is required');
    const { note } = grantFreeAccessSchema.parse(req.body);
    const org = await PlatformAdminService.grantFreeAccess(orgId, note);
    res.json({ success: true, data: org });
  });

  revertToPlan = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.id as string;
    if (!orgId) throw ApiError.badRequest('Company ID is required');
    const { planId } = revertToPlanSchema.parse(req.body);
    const org = await PlatformAdminService.revertToPlan(orgId, planId);
    res.json({ success: true, data: org });
  });

  getGrowthStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await PlatformAdminService.getGrowthStats();
    res.json({ success: true, data: stats });
  });

  getServerHealth = asyncHandler(async (_req: Request, res: Response) => {
    const snapshot = await SystemMetricsService.getSnapshot();
    res.json({ success: true, data: snapshot });
  });
}
