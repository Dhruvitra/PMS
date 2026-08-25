import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ProjectStatus } from '@prisma/client';
import { ProjectService } from '../services/project.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../socket';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  organizationId: z.string().uuid(),
  spaceId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  spaceId: z.string().uuid().nullable().optional(),
});

export class ProjectController {
  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = createSchema.parse(req.body);
    const project = await ProjectService.create({
      ...data,
      createdById: req.user.id,
    });
    res.status(201).json({ success: true, data: project });
  });

  getByOrganization = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { organizationId } = req.params;

    const membership = await prisma.organizationMember.findUnique({
      where: { 
        organizationId_userId: { 
          organizationId: organizationId as string, 
          userId: req.user.id 
        } 
      },
    });
    if (!membership) throw ApiError.forbidden('Not a member of this organization');

    const projects = await ProjectService.getByOrganization(
      organizationId as string,
      req.user.id,
      membership.role
    );
    res.json({ success: true, data: projects });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const project = await ProjectService.getById(req.params.id as string);

    // Resolve membership for role check
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) throw ApiError.forbidden('Not a member of this organization');

    // RBAC logic
    if (membership.role === 'MEMBER') {
      // Check if project has any tasks assigned to this user
      const hasAssignedTasks = await prisma.task.count({
        where: {
          projectId: project.id,
          assignees: { some: { id: req.user.id } }
        }
      });
      if (hasAssignedTasks === 0) throw ApiError.forbidden('You do not have access to this project');
    } else if (membership.role === 'LIMITED_MEMBER' || membership.role === 'GUEST') {
      throw ApiError.forbidden('You do not have access to projects');
    }

    res.json({ success: true, data: project });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = updateSchema.parse(req.body);
    
    // Resolve project to find organizationId
    const projectBefore = await ProjectService.getById(req.params.id as string);
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: projectBefore.organizationId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) throw ApiError.forbidden('Not a member of this organization');

    const project = await ProjectService.update(req.params.id as string, data, membership.role);
    res.json({ success: true, data: project });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    
    // Resolve project to find organizationId
    const projectBefore = await ProjectService.getById(req.params.id as string);
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: projectBefore.organizationId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) throw ApiError.forbidden('Not a member of this organization');

    await ProjectService.delete(req.params.id as string, membership.role, req.user.id);

    if (membership && membership.organizationId) {
      getIO().to(`org:${membership.organizationId}`).emit('space:updated');
      getIO().to(`org:${membership.organizationId}`).emit('task:refresh');
      getIO().to(`org:${membership.organizationId}`).emit('dashboard:refresh');
    }

    res.json({ success: true, message: 'Project deleted' });
  });
}
