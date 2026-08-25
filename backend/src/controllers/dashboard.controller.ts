import { Request, Response } from 'express';
import { TaskService } from '../services/task.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { prisma } from '../config/database';
import { cacheAside, CacheKeys } from '../utils/cache';

export class DashboardController {
  getStats = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const userId = req.user.id;

    // 1. Resolve organization context
    const { orgId: queryOrgId } = req.query;
    let orgId = queryOrgId as string;
    let role: any;

    if (orgId) {
      const membership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId } }
      });
      if (!membership) throw ApiError.notFound('Organization membership not found');
      role = membership.role;
    } else {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId }
      });
      if (!membership) throw ApiError.notFound('No active organization found');
      orgId = membership.organizationId;
      role = membership.role;
    }

    const isOwner = role === 'OWNER' || role === 'SUPER_ADMIN';
    const isAdmin = role === 'ADMIN';

    // ── RBAC Logic ──

    // Folder Count Filter
    const folderWhere: any = isOwner 
      ? { space: { organizationId: orgId } }
      : { space: { organizationId: orgId, members: { some: { userId } } } };

    // Build org scope using indexed IDs (avoid deep join filters on tasks)
    const accessibleSpaceIds = !isOwner && !isAdmin
      ? (await prisma.space.findMany({
          where: { organizationId: orgId, members: { some: { userId } } },
          select: { id: true },
        })).map(s => s.id)
      : null;

    const [orgProjectIds, orgListIds] = await Promise.all([
      prisma.project.findMany({
        where: isOwner || isAdmin
          ? { organizationId: orgId }
          : { organizationId: orgId, spaceId: { in: accessibleSpaceIds || [] } },
        select: { id: true },
      }).then(rows => rows.map(r => r.id)),
      prisma.list.findMany({
        where: isOwner || isAdmin
          ? { space: { organizationId: orgId } }
          : { spaceId: { in: accessibleSpaceIds || [] } },
        select: { id: true },
      }).then(rows => rows.map(r => r.id)),
    ]);

    // Task Count Filter (scoped to org using projectId/listId)
    let taskWhere: any = {
      isDeleted: false,
      OR: [
        { projectId: { in: orgProjectIds } },
        { listId: { in: orgListIds } },
      ],
    };

    if (!isOwner && !isAdmin) {
      // Members only see their own assigned tasks
      taskWhere.assignees = { some: { id: userId } };
    }

    const listWhere: any = isOwner
      ? { space: { organizationId: orgId } }
      : { space: { organizationId: orgId, members: { some: { userId } } } };

    const openStatuses = ['OPEN', 'PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'REJECTED'];
    const completedStatuses = ['COMPLETED', 'CLOSED', 'ACCEPTED'];
    const unassignedWhere: any = {
      ...taskWhere,
      status: { in: openStatuses as any },
      assignees: { none: {} },
    };

    const [folderCount, assignedTaskCount, completedTaskCount, memberCount, recentTasks, members, unreadNotifCount, listCount, unassignedOpenTaskCount, unassignedOpenTasksPreview] = await cacheAside(
      CacheKeys.dashboardStats(`${userId}:${orgId}`),
      () => Promise.all([
        prisma.folder.count({ where: folderWhere }),
        prisma.task.count({ where: taskWhere }),
        prisma.task.count({
          where: {
            ...taskWhere,
            status: { in: completedStatuses as any },
          }
        }),
        prisma.organizationMember.count({ where: { organizationId: orgId } }),

        // Feed - passing orgId to get scoped tasks
        TaskService.getAllTasks(userId, role as any, orgId, 10),

        prisma.organizationMember.findMany({
          where: { organizationId: orgId },
          take: 10,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),

        // Inbox Notification count - scoped to org
        prisma.notification.count({
          where: {
            userId,
            isRead: false,
            organizationId: orgId || null,
          } as any,
        }),

        // List count
        prisma.list.count({ where: listWhere }),

        // Unassigned open task count + preview
        prisma.task.count({ where: unassignedWhere }),
        prisma.task.findMany({
          where: unassignedWhere,
          select: { id: true, title: true, status: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        }),
      ]),
      60 // 1 minute cache
    );

    res.json({
      success: true,
      data: {
        projectCount: folderCount, // Folders Scoped
        listCount, // Lists Scoped
        taskCount: assignedTaskCount, // Tasks Scoped
        completedTaskCount,
        unassignedOpenTaskCount,
        memberCount, // Global Org Count
        unreadNotifCount, // Inbox Feed Count
        recentTasks: recentTasks.slice(0, 5),
        unassignedOpenTasksPreview,
        members: members.map(m => ({
          id: m.user.id,
          name: `${m.user.firstName} ${m.user.lastName}`,
          avatarUrl: m.user.avatarUrl
        }))
      },
    });
  });

  getDueTasks = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const userId = req.user.id;

    const { orgId: queryOrgId } = req.query;
    let orgId = queryOrgId as string;
    let role: any;

    if (orgId) {
      const membership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId } }
      });
      if (!membership) throw ApiError.notFound('Organization membership not found');
      role = membership.role;
    } else {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId }
      });
      if (!membership) throw ApiError.notFound('No active organization found');
      orgId = membership.organizationId;
      role = membership.role;
    }

    const isAdminLevel = role === 'OWNER' || role === 'SUPER_ADMIN' || role === 'ADMIN';

    // Due tasks: tasks with a dueDate that is today or overdue, not completed/closed
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const baseWhere: any = {
      dueDate: { lte: endOfToday },
      status: { notIn: ['COMPLETED', 'CLOSED', 'ACCEPTED'] },
      OR: [
        { project: { organizationId: orgId } },
        { list: { space: { organizationId: orgId } } }
      ]
    };

    if (!isAdminLevel) {
      // MEMBER, LIMITED_MEMBER, GUEST: only see their own assigned due tasks
      baseWhere.assignees = { some: { id: userId } };
    }

    const dueTasks = await prisma.task.findMany({
      where: baseWhere,
      include: {
        assignees: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
        project: { select: { id: true, name: true } },
        list: { select: { id: true, name: true, space: { select: { id: true, name: true } } } },
        tags: { select: { id: true, name: true, color: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    });

    res.json({
      success: true,
      data: {
        dueTasks,
        isAdminLevel,
        role,
      },
    });
  });

  getChartData = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const userId = req.user.id;

    const { orgId: queryOrgId } = req.query;
    let orgId = queryOrgId as string;
    let role: any;

    if (orgId) {
      const membership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId } }
      });
      if (!membership) throw ApiError.notFound('Organization membership not found');
      role = membership.role;
    } else {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId }
      });
      if (!membership) throw ApiError.notFound('No active organization found');
      orgId = membership.organizationId;
      role = membership.role;
    }

    const isAdminLevel = role === 'OWNER' || role === 'SUPER_ADMIN' || role === 'ADMIN';

    const orgTaskFilter: any = {
      OR: [
        { project: { organizationId: orgId } },
        { list: { space: { organizationId: orgId } } }
      ]
    };

    if (!isAdminLevel) {
      orgTaskFilter.assignees = { some: { id: userId } };
    }

    // 1. Workload by Status
    const allTasks = await prisma.task.findMany({
      where: orgTaskFilter,
      select: { status: true, assignees: { select: { id: true, firstName: true, lastName: true } } }
    });

    const statusCounts: Record<string, number> = {};
    for (const t of allTasks) {
      const s = t.status || 'OPEN';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    const workloadByStatus = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    // 2. Total Tasks by Assignee
    const assigneeTotalMap: Record<string, { name: string; count: number }> = {};
    for (const t of allTasks) {
      for (const a of t.assignees) {
        const key = a.id;
        if (!assigneeTotalMap[key]) {
          assigneeTotalMap[key] = { name: `${a.firstName} ${a.lastName}`.trim(), count: 0 };
        }
        assigneeTotalMap[key].count++;
      }
    }
    const totalTasksByAssignee = Object.values(assigneeTotalMap)
      .map(a => ({ name: a.name, value: a.count }))
      .sort((a, b) => b.value - a.value);

    // 3. Open Tasks by Assignee (status not COMPLETED/CLOSED/ACCEPTED)
    const openStatuses = ['OPEN', 'PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'REJECTED'];
    const openTasks = allTasks.filter(t => openStatuses.includes(t.status || 'OPEN'));
    const assigneeOpenMap: Record<string, { name: string; count: number }> = {};
    for (const t of openTasks) {
      for (const a of t.assignees) {
        const key = a.id;
        if (!assigneeOpenMap[key]) {
          assigneeOpenMap[key] = { name: `${a.firstName} ${a.lastName}`.trim(), count: 0 };
        }
        assigneeOpenMap[key].count++;
      }
    }
    const openTasksByAssignee = Object.values(assigneeOpenMap)
      .map(a => ({ name: a.name, Tasks: a.count }))
      .sort((a, b) => b.Tasks - a.Tasks);

    res.json({
      success: true,
      data: {
        workloadByStatus,
        totalTasksByAssignee,
        openTasksByAssignee,
      }
    });
  });

  /** Return task list filtered by chart segment (status or assignee name) */
  getChartTasks = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const userId = req.user.id;

    const { orgId: queryOrgId, chartType, filterValue } = req.query;
    if (!chartType || !filterValue) throw ApiError.badRequest('chartType and filterValue are required');

    let orgId = queryOrgId as string;
    let role: any;

    if (orgId) {
      const membership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId } }
      });
      if (!membership) throw ApiError.notFound('Organization membership not found');
      role = membership.role;
    } else {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId }
      });
      if (!membership) throw ApiError.notFound('No active organization found');
      orgId = membership.organizationId;
      role = membership.role;
    }

    const isAdminLevel = role === 'OWNER' || role === 'SUPER_ADMIN' || role === 'ADMIN';

    const orgTaskFilter: any = {
      OR: [
        { project: { organizationId: orgId } },
        { list: { space: { organizationId: orgId } } }
      ]
    };

    if (!isAdminLevel) {
      orgTaskFilter.assignees = { some: { id: userId } };
    }

    const type = String(chartType);
    const value = String(filterValue);

    // Fetch all org tasks with full includes (same base filter as getChartData)
    const allTasks = await prisma.task.findMany({
      where: orgTaskFilter,
      include: {
        assignees: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
        project: { select: { id: true, name: true } },
        list: { select: { id: true, name: true, space: { select: { id: true, name: true } } } },
        tags: { select: { id: true, name: true, color: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Filter in code to match exactly what the chart shows
    let tasks: typeof allTasks;

    if (type === 'workloadByStatus') {
      tasks = allTasks.filter(t => (t.status || 'OPEN') === value);
    } else if (type === 'totalTasksByAssignee') {
      tasks = allTasks.filter(t =>
        t.assignees.some(a => `${a.firstName} ${a.lastName}`.trim() === value)
      );
    } else if (type === 'openTasksByAssignee') {
      const openStatuses = ['OPEN', 'PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'REJECTED'];
      tasks = allTasks.filter(t =>
        openStatuses.includes(t.status || 'OPEN') &&
        t.assignees.some(a => `${a.firstName} ${a.lastName}`.trim() === value)
      );
    } else {
      tasks = [];
    }

    res.json({
      success: true,
      data: { tasks: tasks.slice(0, 200), total: tasks.length },
    });
  });
}
