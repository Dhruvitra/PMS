import { Request, Response } from 'express';
import { z } from 'zod';
import { OrgRole } from '@prisma/client';
import { OrganizationService } from '../services/organization.service';
import { InvitationService } from '../services/invitation.service';
import { TaskService } from '../services/task.service';
import { MessageService } from '../services/message.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../socket';
import { prisma } from '../config/database';

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  settings: z.record(z.unknown()).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(OrgRole).optional(),
});

export class OrganizationController {
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = createSchema.parse(req.body);
    const org = await OrganizationService.create({
      ...data,
      ownerId: req.user.id,
    });
    res.status(201).json({ success: true, data: org });
  });

  getMyOrgs = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgs = await OrganizationService.getByUserId(req.user.id);
    res.json({ success: true, data: orgs });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const org = await OrganizationService.getById(req.params.id as string);
    res.json({ success: true, data: org });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const data = updateSchema.parse(req.body);
    const org = await OrganizationService.update(req.params.id as string, data);
    res.json({ success: true, data: org });
  });

  addMember = asyncHandler(async (req: Request, res: Response) => {
    const data = addMemberSchema.parse(req.body);
    const member = await OrganizationService.addMember(
      req.params.id as string,
      data.userId,
      data.role
    );

    try {
      getIO().to(`org:${req.params.id}`).emit('org:member_added', { organizationId: req.params.id, member });
      getIO().to(`user:${data.userId}`).emit('org:membership_updated', { organizationId: req.params.id });
    } catch (e) { }

    res.status(201).json({ success: true, data: member });
  });

  removeMember = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    await OrganizationService.removeMember(id, userId);

    try {
      getIO().to(`org:${id}`).emit('org:member_removed', { organizationId: id, userId });
      getIO().to(`user:${userId}`).emit('org:membership_updated', { organizationId: id });
    } catch (e) { }

    res.json({ success: true, message: 'Member removed' });
  });

  getMembers = asyncHandler(async (req: Request, res: Response) => {
    const members = await OrganizationService.listMembers(req.params.id as string);
    res.json({ success: true, data: members });
  });

  updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const { role } = z.object({ role: z.nativeEnum(OrgRole) }).parse(req.body);


    const member = await OrganizationService.updateMemberRole(id, userId, role);

    try {
      getIO().to(`org:${id}`).emit('org:role_changed', { organizationId: id, userId, role });
      getIO().to(`user:${userId}`).emit('org:membership_updated', { organizationId: id });
    } catch (e) { }

    res.json({ success: true, data: member });
  });

  getInvitations = asyncHandler(async (req: Request, res: Response) => {
    const invits = await InvitationService.listInvites(req.params.id as string);
    res.json({ success: true, data: invits });
  });
  
  delete = asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params.id as string;
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId: req.user!.id } }
    });
    
    if (!membership || (membership.role !== OrgRole.OWNER && membership.role !== OrgRole.SUPER_ADMIN)) {
      throw ApiError.forbidden('Only organization owners or super admins can delete the workspace');
    }

    await OrganizationService.delete(orgId);
    
    try {
      getIO().to(`org:${orgId}`).emit('org:deleted', { organizationId: orgId });
    } catch { }

    res.json({ success: true, message: 'Organization deleted successfully' });
  });

  initialize = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const orgId = req.query.orgId as string;

    const organizations = await OrganizationService.getByUserId(req.user.id);

    let currentOrg = organizations.find(o => o.id === orgId);
    if (!currentOrg && organizations.length > 0) {
      currentOrg = organizations[0];
    }

    const resolvedOrgId = currentOrg?.id;

    const [spaces, favorites, assigned, members, unreadCounts] = await Promise.all([
      resolvedOrgId ? import('../services/space.service').then(s => s.SpaceService.getByUser(req.user!.id, resolvedOrgId)) : [],
      resolvedOrgId ? TaskService.getFavorites(req.user.id, resolvedOrgId) : [],
      resolvedOrgId ? TaskService.getAssignedToUser(req.user.id, resolvedOrgId) : [],
      resolvedOrgId ? OrganizationService.listMembers(resolvedOrgId) : [],
      MessageService.getUnreadCounts(req.user.id)
    ]);

    res.json({
      success: true,
      data: {
        organizations,
        currentOrg: currentOrg ? { ...currentOrg, role: (currentOrg as any).role || 'MEMBER' } : null,
        spaces,
        favorites,
        assigned,
        members,
        unreadCounts
      }
    });
  });

  uploadLogo = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded');
    const id = req.params.id as string;
    
    // Get current org to preserve other settings
    const currentOrg = await OrganizationService.getById(id);
    const existingSettings = (currentOrg.settings as any) || {};

    const logoUrl = `/uploads/avatars/${req.file.filename}`;
    
    const org = await OrganizationService.update(id, {
      settings: { ...existingSettings, logoUrl }
    });
    
    res.json({ success: true, data: org });
  });
}
