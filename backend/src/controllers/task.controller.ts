import { Request, Response } from 'express';
import { z } from 'zod';
import { TaskStatus, TaskPriority, Prisma, OrgRole } from '@prisma/client';
import { prisma } from '../config/database';
import { TaskService } from '../services/task.service';
import { ActivityService } from '../services/activity.service';
import { NotificationService } from '../services/notification.service';
import { getIO } from '../socket';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { stripHtml } from '../utils/string';

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  projectId: z.string().uuid().optional(),
  listId: z.string().uuid().optional(),
  isFavorite: z.boolean().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  timeEstimate: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  assigneeIds: z.array(z.string().uuid()).nullable().optional(),
  listId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).nullable().optional(),
});

const bulkUpdateSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
  data: z.object({
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    startDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    isFavorite: z.boolean().optional(),
    assigneeIds: z.array(z.string().uuid()).nullable().optional(),
    tagIds: z.array(z.string().uuid()).nullable().optional(),
  }),
});

const bulkDeleteSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1),
});

const statusesSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(200),
});

export class TaskController {
  private async verifyTaskAccess(task: any, userId: string, requiredRole?: OrgRole) {
    let organizationId: string | undefined;

    if (task.projectId && (task.project || (task.projectId && !task.listId))) {
      const proj = task.project || await prisma.project.findUnique({ where: { id: task.projectId }, select: { organizationId: true } });
      organizationId = proj?.organizationId;
    } else if (task.listId) {
      const list = task.list || await prisma.list.findUnique({
        where: { id: task.listId },
        include: { space: { select: { organizationId: true } } }
      });
      organizationId = list?.space?.organizationId;
    }

    if (!organizationId) {
      throw ApiError.forbidden('Task is not associated with any organization');
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: userId,
        },
      },
    });

    if (!membership) throw ApiError.forbidden('Not a member of this organization');

    if (requiredRole) {
      // HR sits low here deliberately — HR is scoped to Employee Tracking only and isn't meant to satisfy elevated task-permission checks.
      const roleWeights: Record<OrgRole, number> = { 'OWNER': 10, 'SUPER_ADMIN': 9, 'ADMIN': 8, 'MEMBER': 5, 'LIMITED_MEMBER': 3, 'HR': 2, 'GUEST': 1 };
      if (roleWeights[membership.role] < roleWeights[requiredRole]) {
        throw ApiError.forbidden(`Required role: ${requiredRole}`);
      }
    }
    return membership;
  }

  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = createSchema.parse(req.body);

    // Verify access to Target List/Project (Prioritize List in the new hierarchy)
    let organizationId: string | undefined;

    if (data.listId && data.listId.trim() !== '') {
      const list = await prisma.list.findUnique({
        where: { id: data.listId },
        include: { space: { select: { organizationId: true } } }
      });
      if (list) {
        organizationId = list.space.organizationId;
      }
    }

    if (!organizationId && data.projectId && data.projectId.trim() !== '') {
      const proj = await prisma.project.findUnique({
        where: { id: data.projectId },
        select: { organizationId: true }
      });
      if (proj) {
        organizationId = proj.organizationId;
      }
    }

    if (!organizationId) {
      throw ApiError.badRequest('Could not resolve organization from provided listId or projectId. Please ensure the target list or project exists.');
    }

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: req.user.id } },
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of the organization that owns this list/project.');
    }

    if (membership.role === 'GUEST' || membership.role === 'LIMITED_MEMBER') {
      throw ApiError.forbidden('You do not have permission to create tasks in this organization.');
    }

    const task = await TaskService.create({
      ...data,
      createdById: req.user.id,
    }) as any;

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: task.id,
      action: 'task.created',
      changes: { title: task.title },
    });

    try { getIO().emit('task:refresh'); } catch (e) { }

    if (task.assignees && task.assignees.length > 0) {
      await NotificationService.notifyTaskActivity(
        task.id,
        req.user.id,
        membership.role,
        task.title,
        `Task created and assigned: ${task.title}`
      );
    }

    res.status(201).json({ success: true, data: task });
  });

  getByProject = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { projectId } = req.params;
    const { status, priority, assigneeIds } = req.query;

    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      select: { organizationId: true },
    });
    if (!project) throw ApiError.notFound('Project not found');

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: project.organizationId, userId: req.user.id } },
    });
    if (!membership) throw ApiError.forbidden('Not a member of this organization');

    const tasks = await TaskService.getByProject(
      {
        projectId: projectId as string,
        status: status as TaskStatus | undefined,
        priority: priority as TaskPriority | undefined,
        assigneeIds: typeof assigneeIds === 'string' ? [assigneeIds] : assigneeIds as string[] | undefined,
      },
      req.user.id,
      membership.role
    );
    res.json({ success: true, data: tasks });
  });

  getByList = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { listId } = req.params;
    const { status, priority, assigneeIds } = req.query;

    const list = await prisma.list.findUnique({
      where: { id: listId as string },
      include: { space: { select: { organizationId: true } } },
    });
    if (!list) throw ApiError.notFound('List not found');

    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: list.space.organizationId, userId: req.user.id } },
    });
    if (!membership) throw ApiError.forbidden('Not a member of this organization');

    const tasks = await TaskService.getByProject(
      {
        listId: listId as string,
        status: status as TaskStatus | undefined,
        priority: priority as TaskPriority | undefined,
        assigneeIds: typeof assigneeIds === 'string' ? [assigneeIds] : assigneeIds as string[] | undefined,
      },
      req.user.id,
      membership.role
    );
    res.json({ success: true, data: tasks });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const task = await TaskService.getById(req.params.id as string, req.user.id);
    const membership = await this.verifyTaskAccess(task, req.user.id);

    // RBAC logic for Member visibility - Members can see all in the organization/list
    if (membership.role === 'LIMITED_MEMBER') {
      // Allow limited members to view any task in their organization 
      // This is needed so they can toggle favorite on tasks they have access to via the UI
      // Full task updates are still protected in the update method.
    }
    // GUEST is allowed to view (read-only)

    res.json({ success: true, data: task });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = updateSchema.parse(req.body);

    // Get current task state and verify access
    const before = await TaskService.getById(req.params.id as string, req.user.id);
    const membership = await this.verifyTaskAccess(before, req.user.id);

    if (membership.role === 'GUEST') {
      const updateFields = Object.keys(data);
      const isFavoriteUpdate = updateFields.length === 1 && updateFields[0] === 'isFavorite';
      if (!isFavoriteUpdate) {
        throw ApiError.forbidden('Guests can only toggle favorites on tasks');
      }
    }

    if (membership.role === 'LIMITED_MEMBER') {
      const isAssignee = before.assignees.some((a: any) => a.id === req.user?.id);
      const updateFields = Object.keys(data);
      const isFavoriteUpdate = updateFields.length === 1 && updateFields[0] === 'isFavorite';

      if (!isAssignee && !isFavoriteUpdate) {
        throw ApiError.forbidden('You can only update tasks you are assigned to or toggle favorites');
      }
    }

    const task = await TaskService.update(req.params.id as string, data, req.user.id);

    // Determine specific action and build changes object
    const changes: Record<string, unknown> = {};
    let action = 'task.updated';

    if (data.status !== undefined && data.status !== before.status) {
      action = 'task.status_changed';
      changes.status = { from: before.status, to: data.status };
      
      // Notify about status change
      await NotificationService.notifyTaskActivity(
        before.id,
        req.user.id,
        membership.role,
        before.title,
        `Changed status to ${data.status}`
      );
    }
    if (data.assigneeIds !== undefined) {
      action = 'task.assigned';
      const beforeNames = (before.assignees || []).map((a: any) => `${a.firstName} ${a.lastName}`).join(', ');
      const afterNames = (task.assignees || []).map((a: any) => `${a.firstName} ${a.lastName}`).join(', ');

      changes.assignees = {
        from: beforeNames || 'None',
        to: afterNames || 'None',
      };

      // Notify users who were added OR removed
      const beforeIds = new Set((before.assignees || []).map((a: any) => a.id));
      const afterIds = new Set((task.assignees || []).map((a: any) => a.id));

      const newAssignees = (task.assignees || []).filter((a: any) => !beforeIds.has(a.id));
      const removedAssignees = (before.assignees || []).filter((a: any) => !afterIds.has(a.id));

      if (newAssignees.length > 0) {
        const addedNames = newAssignees.map((a: any) => `${a.firstName} ${a.lastName}`).join(', ');
        await NotificationService.notifyTaskActivity(
          task.id,
          req.user.id,
          membership.role,
          task.title,
          `Assigned to: ${addedNames}`
        );
      }

      if (removedAssignees.length > 0) {
        const removedNames = removedAssignees.map((a: any) => `${a.firstName} ${a.lastName}`).join(', ');
        // Special: Directly notify the victims who were unassigned
        for (const unassigned of removedAssignees) {
          await NotificationService.create(
            unassigned.id,
            task.title,
            `You have been unassigned from: ${task.title}`,
            `/tasks/${task.id}`
          );
        }
        // Also notify admins/others about the removal
        await NotificationService.notifyTaskActivity(
          task.id,
          req.user.id,
          membership.role,
          task.title,
          `Unassigned: ${removedNames}`
        );
      }
    }
    if (data.title !== undefined && data.title !== before.title) {
      changes.title = { from: before.title, to: data.title };
    }
    if (data.description !== undefined && data.description !== before.description) {
      changes.description = { from: 'previous', to: 'updated' };
      
      // Notify about description update
      const cleanDesc = stripHtml(data.description);
      await NotificationService.notifyTaskActivity(
        task.id,
        req.user.id,
        membership.role,
        task.title,
        `Updated description: "${cleanDesc.substring(0, 50)}${cleanDesc.length > 50 ? '...' : ''}"`
      );
    }
    if (data.priority !== undefined && data.priority !== before.priority) {
      changes.priority = { from: before.priority, to: data.priority };
    }
    if (data.dueDate !== undefined) {
      const oldDate = before.dueDate ? new Date(before.dueDate).toISOString().split('T')[0] : null;
      const newDate = data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : null;
      if (oldDate !== newDate) {
        changes.dueDate = { from: oldDate, to: newDate };
      }
    }

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: task.id,
      action,
      changes: changes as Prisma.InputJsonValue,
    });

    try {
      getIO().emit('task:refresh');
      if (membership && membership.organizationId) {
        getIO().to(`org:${membership.organizationId}`).emit('task:updated', { taskId: (task as any)?.id || req.params.id });
      }
    } catch (e) { }

    res.json({ success: true, data: task });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const task = await TaskService.getById(req.params.id as string, req.user.id);
    const membership = await this.verifyTaskAccess(task, req.user.id, 'MEMBER');

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: task.id,
      action: 'task.deleted',
      changes: { title: task.title },
    });

    await TaskService.delete(req.params.id as string, req.user.id);
    try { 
      if (membership && membership.organizationId) {
        getIO().to(`org:${membership.organizationId}`).emit('task:refresh');
      } else {
        getIO().emit('task:refresh'); 
      }
    } catch (e) { }
    res.json({ success: true, message: 'Task deleted' });
  });

  bulkUpdate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { taskIds, data } = bulkUpdateSchema.parse(req.body);

    if (taskIds.length > 0) {
      const firstTask = await TaskService.getById(taskIds[0], req.user.id);
      const membership = await this.verifyTaskAccess(firstTask, req.user.id);

      if (membership.role === 'GUEST' || membership.role === 'LIMITED_MEMBER' || membership.role === 'MEMBER') {
        const allowedFields = ['status', 'isFavorite'];
        const attemptedFields = Object.keys(data);
        const isForbiddenUpdate = attemptedFields.some(f => !allowedFields.includes(f));
        if (isForbiddenUpdate) throw ApiError.forbidden('Only status updates allowed for this role');
      }
    }

    const result = await TaskService.bulkUpdate(taskIds, data);

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: taskIds[0],
      action: 'task.bulk_updated',
      changes: { count: result.updated, taskIds },
    });

    try { getIO().emit('task:refresh'); } catch (e) { }
    res.json({ success: true, data: result });
  });

  bulkDelete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { taskIds } = bulkDeleteSchema.parse(req.body);
    let membership;

    if (taskIds.length > 0) {
      const firstTask = await TaskService.getById(taskIds[0], req.user.id);
      membership = await this.verifyTaskAccess(firstTask, req.user.id, 'MEMBER');
    }

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: taskIds[0],
      action: 'task.bulk_deleted',
      changes: { count: taskIds.length, taskIds },
    });

    const result = await TaskService.bulkDelete(taskIds, req.user.id);
    try { 
      if (membership && membership.organizationId) {
        getIO().to(`org:${membership.organizationId}`).emit('task:refresh');
      } else {
        getIO().emit('task:refresh'); 
      }
    } catch (e) { }
    res.json({ success: true, data: result });
  });

  /** POST /tasks/statuses { taskIds: string[] } */
  getStatuses = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { taskIds } = statusesSchema.parse(req.body);

    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, isDeleted: false },
      select: { id: true, status: true },
    });

    const byId: Record<string, string> = {};
    for (const t of tasks) byId[t.id] = t.status;

    res.json({ success: true, data: byId });
  });

  getMyTasks = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { orgId } = req.query;
    const tasks = await TaskService.getAssignedToUser(req.user.id, orgId as string);
    res.json({ success: true, data: tasks });
  });

  getAllTasks = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { orgId } = req.query;

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: req.user.id },
      select: { role: true },
    });

    const roles = memberships.map(m => m.role);
    let highestRole: OrgRole = 'GUEST';
    if (roles.includes('OWNER')) highestRole = 'OWNER';
    else if (roles.includes('SUPER_ADMIN')) highestRole = 'SUPER_ADMIN';
    else if (roles.includes('ADMIN')) highestRole = 'ADMIN';
    else if (roles.includes('MEMBER')) highestRole = 'MEMBER';
    else if (roles.includes('LIMITED_MEMBER')) highestRole = 'LIMITED_MEMBER';

    const tasks = await TaskService.getAllTasks(req.user.id, highestRole, orgId as string);
    res.json({ success: true, data: tasks });
  });

  getFavorites = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const { orgId } = req.query;


    const tasks = await TaskService.getFavorites(req.user.id, orgId as string);
    res.json({ success: true, data: tasks });
  });
}
