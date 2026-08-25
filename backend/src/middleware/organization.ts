import { Request, Response, NextFunction } from 'express';
import { OrgRole } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

/**
 * Middleware that checks if the authenticated user belongs to the organization
 * specified by :id or :organizationId param. Attaches the membership to req.orgMember.
 */
export const requireOrgMembership = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }

  const orgId = (req.params.organizationId || req.params.id || req.query.orgId || req.query.organizationId) as string | undefined;
  if (!orgId) {
    throw ApiError.badRequest('Organization ID is required');
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: req.user.id,
      },
    },
  });

  if (!membership) {
    throw ApiError.forbidden('You are not a member of this organization');
  }

  req.orgMember = membership;
  next();
};

/**
 * Middleware factory for task/project create & update routes.
 * Resolves organizationId from params, body, or query,
 * then checks if the user has one of the allowed roles.
 */
export const requireRoleForCreate = (...allowedRoles: OrgRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    let organizationId: string | undefined = (req.params.organizationId || req.query.organizationId || req.query.orgId) as string | undefined;

    // 1. Direct organizationId in body
    if (!organizationId && req.body?.organizationId) {
      organizationId = req.body.organizationId as string;
    }
    // 2. Resolve from body IDs
    else if (!organizationId && (req.body?.projectId || req.body?.spaceId || req.body?.folderId || req.body?.listId)) {
      if (req.body.projectId) {
        const p = await prisma.project.findUnique({ where: { id: req.body.projectId as string }, select: { organizationId: true } });
        organizationId = p?.organizationId;
      } else if (req.body.spaceId) {
        const s = await prisma.space.findUnique({ where: { id: req.body.spaceId as string }, select: { organizationId: true } });
        organizationId = s?.organizationId;
      } else if (req.body.folderId) {
        const f = await prisma.folder.findUnique({ where: { id: req.body.folderId as string }, include: { space: { select: { organizationId: true } } } });
        organizationId = f?.space.organizationId;
      } else if (req.body.listId) {
        const l = await prisma.list.findUnique({ where: { id: req.body.listId as string }, include: { space: { select: { organizationId: true } } } });
        organizationId = l?.space.organizationId;
      }
    }

    // 3. Resolve from param IDs (for update/delete/sub-resources)
    if (!organizationId) {
      const id = (req.params.id || req.params.taskId || req.params.projectId || req.params.spaceId || req.params.folderId || req.params.listId) as string;
      if (id) {
        if (req.baseUrl.includes('tasks') || req.params.taskId) {
          const t = await prisma.task.findUnique({
            where: { id },
            include: {
              project: { select: { organizationId: true } },
              list: { include: { space: { select: { organizationId: true } } } }
            }
          });
          organizationId = t?.project?.organizationId || t?.list?.space?.organizationId;
        } else if (req.baseUrl.includes('projects') || req.params.projectId) {
          const p = await prisma.project.findUnique({ where: { id }, select: { organizationId: true } });
          organizationId = p?.organizationId;
        } else if (req.baseUrl.includes('spaces') || req.params.spaceId || (req.baseUrl.includes('spaces') && req.params.id)) {
          const sid = (req.params.spaceId || req.params.id) as string;
          const s = await prisma.space.findUnique({ where: { id: sid }, select: { organizationId: true } });
          organizationId = s?.organizationId;
        } else if (req.baseUrl.includes('folders') || req.params.folderId) {
          const folderIdStr = (req.params.folderId || id) as string;
          const f = await prisma.folder.findUnique({ where: { id: folderIdStr }, include: { space: { select: { organizationId: true } } } });
          organizationId = f?.space?.organizationId;
        } else if (req.baseUrl.includes('lists') || req.params.listId) {
          const listIdStr = (req.params.listId || id) as string;
          const l = await prisma.list.findUnique({ where: { id: listIdStr }, include: { space: { select: { organizationId: true } } } });
          organizationId = l?.space?.organizationId;
        }
      }
    }

    // 4. Resolve from bulk taskIds in body (for bulk update/delete)
    if (!organizationId && req.body?.taskIds && Array.isArray(req.body.taskIds) && req.body.taskIds.length > 0) {
      const taskId = req.body.taskIds[0];
      const t = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          project: { select: { organizationId: true } },
          list: { include: { space: { select: { organizationId: true } } } }
        }
      });
      organizationId = t?.project?.organizationId || t?.list?.space?.organizationId;
    }

    if (!organizationId) {
      throw ApiError.badRequest('Unable to determine organization for this action');
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of this organization');
    }

    const rolesToCheck = Array.from(new Set([...allowedRoles, OrgRole.OWNER, OrgRole.SUPER_ADMIN]));

    if (!rolesToCheck.includes(membership.role as OrgRole)) {
      throw ApiError.forbidden(
        `This action requires one of the following roles: ${rolesToCheck.join(', ')}`
      );
    }

    req.orgMember = membership;
    next();
  };
};

/**
 * Middleware factory that checks if the user has one of the required roles.
 * Must be used after requireOrgMembership.
 */
export const requireOrgRole = (...allowedRoles: OrgRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.orgMember) {
      return next(ApiError.forbidden('Organization membership not verified'));
    }

    const rolesToCheck = Array.from(new Set([...allowedRoles, OrgRole.OWNER, OrgRole.SUPER_ADMIN]));

    if (!rolesToCheck.includes(req.orgMember.role as OrgRole)) {
      return next(
        ApiError.forbidden(
          `This action requires one of the following roles: ${rolesToCheck.join(', ')}`
        )
      );
    }

    next();
  };
};

/**
 * Middleware that checks if the user has access to a specific resource (Space, Folder, List).
 * OWNER and ADMIN bypass these checks.
 * MEMBERS and others must be assigned to the resource or have a task in it.
 */
export const requireResourceAccess = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) throw ApiError.unauthorized();

  const spaceId = (req.params.spaceId || (req.baseUrl.includes('spaces') ? req.params.id : undefined)) as string;
  const folderId = (req.params.folderId || (req.baseUrl.includes('folders') ? req.params.id : undefined)) as string;
  const listId = (req.params.listId || (req.baseUrl.includes('lists') ? req.params.id : undefined)) as string;

  // 1. Resolve Organization ID to check Org Role
  let organizationId: string | null = null;
  if (spaceId) {
    const s = await prisma.space.findUnique({ where: { id: spaceId }, select: { organizationId: true } });
    organizationId = s?.organizationId || null;
  } else if (folderId) {
    const f = await prisma.folder.findUnique({ where: { id: folderId }, include: { space: { select: { organizationId: true } } } });
    organizationId = f?.space.organizationId || null;
  } else if (listId) {
    const l = await prisma.list.findUnique({ where: { id: listId }, include: { space: { select: { organizationId: true } } } });
    organizationId = l?.space.organizationId || null;
  }

  if (!organizationId) {
    // If we can't resolve org, we can't check org roles, but we might still check resource roles.
    // But usually orgId is needed for membership checks.
    return next();
  }

  const orgMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: req.user.id } }
  });

  if (!orgMembership) throw ApiError.forbidden('Not a member of this organization');

  // OWNER, SUPER_ADMIN and ADMIN see everything
  if (orgMembership.role === 'OWNER' || orgMembership.role === 'SUPER_ADMIN' || orgMembership.role === 'ADMIN') {
    return next();
  }

  // GUEST is read-only
  if (orgMembership.role === 'GUEST' && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    throw ApiError.forbidden('Guests have read-only access');
  }

  // Check granular access
  const userId = req.user.id;

  if (listId) {
    const isMember = await prisma.listMember.findUnique({ where: { listId_userId: { listId, userId } } });
    if (isMember) return next();

    // Check task assignment in this list
    const hasTask = await prisma.task.findFirst({
      where: { listId, assignees: { some: { id: userId } } }
    });
    if (hasTask) return next();

    throw ApiError.forbidden('You do not have access to this list');
  }

  if (folderId) {
    const isMember = await prisma.folderMember.findUnique({ where: { folderId_userId: { folderId, userId } } });
    if (isMember) return next();

    // Check list memberships inside this folder
    const hasListAccess = await prisma.listMember.findFirst({
      where: { list: { folderId }, userId }
    });
    if (hasListAccess) return next();

    throw ApiError.forbidden('You do not have access to this folder');
  }

  if (spaceId) {
    const isMember = await prisma.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
    if (isMember) return next();

    // Check nested access (folders, lists, tasks)
    const hasAccess = await prisma.space.findFirst({
      where: {
        id: spaceId,
        OR: [
          { folders: { some: { members: { some: { userId } } } } },
          { folders: { some: { lists: { some: { members: { some: { userId } } } } } } },
          { lists: { some: { members: { some: { userId } } } } },
          { lists: { some: { tasks: { some: { assignees: { some: { id: userId } } } } } } },
          { folders: { some: { lists: { some: { tasks: { some: { assignees: { some: { id: userId } } } } } } } } }
        ]
      }
    });

    if (hasAccess) return next();

    throw ApiError.forbidden('You do not have access to this space');
  }

  next();
};
