import { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { TrackerService } from '../services/tracker.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const startSchema = z.object({
  organizationId: z.string(),
  taskId: z.string().optional(),
  workMode: z.enum(['WFO', 'WFH']).optional(),
});

const heartbeatSchema = z.object({
  activeSeconds: z.number().min(0).max(300), // one heartbeat covers at most a few minutes
  idleSeconds: z.number().min(0).max(300),
  inputActiveSeconds: z.number().min(0).max(300).optional(),
});

function parseDateRange(req: Request) {
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate as string) : new Date(new Date().setHours(0, 0, 0, 0));
  const end = endDate ? new Date(endDate as string) : new Date();
  return { start, end };
}

export class TrackerController {
  startSession = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = startSchema.parse(req.body);
    const session = await TrackerService.startSession(req.user.id, body.organizationId, body.taskId, body.workMode as any);
    res.status(201).json({ success: true, data: session });
  });

  heartbeat = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = heartbeatSchema.parse(req.body);
    const session = await TrackerService.heartbeat(req.params.id as string, req.user.id, body.activeSeconds, body.idleSeconds, body.inputActiveSeconds ?? 0);
    res.json({ success: true, data: session });
  });

  endSession = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const session = await TrackerService.endSession(req.params.id as string, req.user.id);
    res.json({ success: true, data: session });
  });

  getActiveSession = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    const session = await TrackerService.getActiveSession(req.user.id, orgId);
    res.json({ success: true, data: session });
  });

  /** Self-scoped: any org member can see their OWN sessions for a range — no elevated role needed, this is their own data. */
  getMySessions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    await TrackerService.requireMembership(orgId, req.user.id);
    const { start, end } = parseDateRange(req);
    const sessions = await TrackerService.getUserSessions(orgId, req.user.id, start, end);
    res.json({ success: true, data: sessions });
  });

  uploadScreenshot = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!req.file) throw ApiError.badRequest('No screenshot uploaded');
    const imageUrl = `/uploads/screenshots/${req.file.filename}`;
    const screenshot = await TrackerService.addScreenshot(req.params.id as string, req.user.id, imageUrl);
    res.status(201).json({ success: true, data: screenshot });
  });

  getScreenshots = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    const targetUserId = req.query.userId as string | undefined;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    await TrackerService.requireMembership(orgId, req.user.id);
    const { start, end } = parseDateRange(req);
    const screenshots = await TrackerService.getScreenshots(orgId, targetUserId || undefined, start, end);
    res.json({ success: true, data: screenshots });
  });

  deleteScreenshot = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    const membership = await TrackerService.requireMembership(orgId, req.user.id);
    if (!['HR', 'OWNER', 'SUPER_ADMIN'].includes(membership.role)) {
      throw ApiError.forbidden('This action requires one of the following roles: HR, OWNER, SUPER_ADMIN');
    }
    const imageUrl = await TrackerService.deleteScreenshot(orgId, req.params.id as string);

    // imageUrl looks like "/uploads/screenshots/<filename>.png"
    const filename = path.basename(imageUrl);
    const filePath = path.join(__dirname, '../../uploads/screenshots', filename);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') console.error('Failed to remove screenshot file:', err);
    });

    res.json({ success: true, data: { deleted: true } });
  });

  getUserSessions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    const targetUserId = req.query.userId as string;
    if (!orgId || !targetUserId) throw ApiError.badRequest('orgId and userId are required');
    await TrackerService.requireMembership(orgId, req.user.id);
    const { start, end } = parseDateRange(req);
    const sessions = await TrackerService.getUserSessions(orgId, targetUserId, start, end);
    res.json({ success: true, data: sessions });
  });

  getSummary = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    await TrackerService.requireMembership(orgId, req.user.id);
    const { start, end } = parseDateRange(req);
    const summary = await TrackerService.getEmployeeSummary(orgId, start, end);
    res.json({ success: true, data: summary });
  });

  getLateToday = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    await TrackerService.requireMembership(orgId, req.user.id);
    const result = await TrackerService.getLateToday(orgId);
    res.json({ success: true, data: result });
  });

  getLeaderboard = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    await TrackerService.requireMembership(orgId, req.user.id);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = now;
    const leaderboard = await TrackerService.getLeaderboard(orgId, monthStart, monthEnd);
    res.json({ success: true, data: leaderboard });
  });

  getTrackingStatus = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;
    if (!orgId) throw ApiError.badRequest('orgId is required');
    await TrackerService.requireMembership(orgId, req.user.id);
    const status = await TrackerService.getOrgTrackingStatus(orgId);
    res.json({ success: true, data: status });
  });
}
