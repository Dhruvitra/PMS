import { Request, Response } from 'express';
import { z } from 'zod';
import { SpaceService } from '../services/space.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const createSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  organizationId: z.string().uuid(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
});

export class SpaceController {
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = createSchema.parse(req.body);
    const space = await SpaceService.create({
      ...data,
      createdById: req.user.id,
    });
    res.status(201).json({ success: true, data: space });
  });

  getByOrganization = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId } = req.params;
    const spaces = await SpaceService.getByOrganization(organizationId as string);
    res.json({ success: true, data: spaces });
  });

  getByUser = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { orgId } = req.query;
    const spaces = await SpaceService.getByUser(req.user.id, orgId as string);
    res.json({ success: true, data: spaces });
  });

  getByUserId = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = req.params;
    const memberships = await SpaceService.getUserMembershipsInOrg(organizationId as string, userId as string);
    res.json({ success: true, data: memberships.map(m => m.spaceId) });
  });

  setUserSpaces = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = req.params;
    const { spaceIds } = z.object({ spaceIds: z.array(z.string().uuid()) }).parse(req.body);
    await SpaceService.setUserSpacesInOrg(organizationId as string, userId as string, spaceIds);
    res.json({ success: true, message: 'User spaces updated' });
  });

  getUserGranularMemberships = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = req.params;
    const memberships = await SpaceService.getUserGranularMemberships(organizationId as string, userId as string);
    res.json({ success: true, data: memberships });
  });

  setUserGranularMemberships = asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, userId } = req.params;
    const schema = z.object({
      spaceIds: z.array(z.string().uuid()),
      folderIds: z.array(z.string().uuid()),
      listIds: z.array(z.string().uuid())
    });
    const data = schema.parse(req.body);
    if (!req.user) throw ApiError.unauthorized();
    const memberships = await SpaceService.setUserGranularMemberships(organizationId as string, userId as string, data, req.user.id);
    res.json({ success: true, data: memberships });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const space = await SpaceService.getById(req.params.id as string);
    res.json({ success: true, data: space });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const data = updateSchema.parse(req.body);
    const space = await SpaceService.update(req.params.id as string, data);
    res.json({ success: true, data: space });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await SpaceService.delete(req.params.id as string);
    res.json({ success: true, message: 'Space deleted' });
  });

  // Membership management
  addMember = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);
    const member = await SpaceService.addMember(req.params.id as string, userId);
    res.status(201).json({ success: true, data: member });
  });

  removeMember = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    await SpaceService.removeMember(req.params.id as string, userId as string);
    res.json({ success: true, message: 'Member removed from space' });
  });

  listMembers = asyncHandler(async (req: Request, res: Response) => {
    const members = await SpaceService.listMembers(req.params.id as string);
    res.json({ success: true, data: members });
  });

  syncMembers = asyncHandler(async (req: Request, res: Response) => {
    const { userIds } = z.object({ userIds: z.array(z.string().uuid()) }).parse(req.body);
    const members = await SpaceService.setMembers(req.params.id as string, userIds);
    res.json({ success: true, data: members });
  });

  getStats = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const stats = await SpaceService.getSpaceStats(req.params.id as string, req.user.id);
    res.json({ success: true, data: stats });
  });

  getTasks = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { filter = 'all' } = req.query;
    const tasks = await SpaceService.getSpaceTasks(req.params.id as string, filter as string, req.user.id);
    res.json({ success: true, data: tasks });
  });
}
