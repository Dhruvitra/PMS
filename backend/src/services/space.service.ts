import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { getIO } from '../socket';
import { NotificationService } from './notification.service';

interface CreateSpaceInput {
  name: string;
  color?: string;
  organizationId: string;
  createdById: string;
}

interface UpdateSpaceInput {
  name?: string;
  color?: string;
}

export class SpaceService {
  static async create(input: CreateSpaceInput) {
    const result = await prisma.space.create({
      data: {
        name: input.name,
        color: input.color,
        organizationId: input.organizationId,
        createdById: input.createdById,
        members: {
          create: { userId: input.createdById }
        },
        projects: {
          create: {
            name: 'General',
            description: 'Default project for ' + input.name,
            organizationId: input.organizationId,
            createdById: input.createdById,
          }
        }
      },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        organization: { select: { id: true, name: true, slug: true } },
        projects: {
          include: {
            _count: { select: { tasks: true } },
          },
        },
        folders: {
          orderBy: { position: 'asc' },
          include: {
            lists: {
              orderBy: { position: 'asc' },
              include: { _count: { select: { tasks: true } } },
            },
          },
        },
        lists: {
          where: { folderId: null },
          orderBy: { position: 'asc' },
          include: { _count: { select: { tasks: true } } },
        },
        _count: { select: { projects: true, folders: true, lists: true } },
      },
    });

    try {
      getIO().to(`org:${input.organizationId}`).emit('space:updated', { organizationId: input.organizationId });
    } catch { }

    return result;
  }

  static async getByOrganization(organizationId: string) {
    return prisma.space.findMany({
      where: { organizationId },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        projects: {
          include: {
            _count: { select: { tasks: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        folders: {
          orderBy: { position: 'asc' },
          include: {
            lists: {
              orderBy: { position: 'asc' },
              include: { _count: { select: { tasks: true } } },
            },
          },
        },
        lists: {
          where: { folderId: null },
          orderBy: { position: 'asc' },
          include: { _count: { select: { tasks: true } } },
        },
        _count: { select: { projects: true, folders: true, lists: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async getByUser(userId: string, orgId?: string) {
    // 1. Get memberships for the user
    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId,
        ...(orgId ? { organizationId: orgId } : {})
      },
      select: { organizationId: true, role: true },
    });

    console.log(`[SpaceService] Found ${memberships.length} memberships for user ${userId} (orgId: ${orgId})`);

    if (memberships.length === 0) return [];

    // 2. Separate admin/owner org IDs from limited member org IDs
    const adminOrgIds: string[] = [];
    const limitedOrgIds: string[] = [];

    for (const membership of memberships) {
      if (membership.role === 'ADMIN' || membership.role === 'OWNER' || membership.role === 'SUPER_ADMIN') {
        adminOrgIds.push(membership.organizationId);
      } else {
        limitedOrgIds.push(membership.organizationId);
      }
    }

    const spaceInclude = {
      createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      organization: { select: { id: true, name: true, slug: true } },
      projects: {
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
      folders: {
        orderBy: { position: 'asc' as const },
        include: {
          lists: {
            orderBy: { position: 'asc' as const },
            include: { _count: { select: { tasks: true } } },
          },
        },
      },
      lists: {
        where: { folderId: null },
        orderBy: { position: 'asc' as const },
        include: { _count: { select: { tasks: true } } },
      },
      _count: { select: { projects: true, folders: true, lists: true } },
    };

    // 3. Batch query for admin orgs (all spaces in those orgs)
    const queries: Promise<any[]>[] = [];

    if (adminOrgIds.length > 0) {
      queries.push(
        prisma.space.findMany({
          where: { organizationId: { in: adminOrgIds } },
          include: spaceInclude,
          orderBy: { createdAt: 'asc' },
        })
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    // 4. Batch query for limited orgs (only spaces user has access to)
    if (limitedOrgIds.length > 0) {
      queries.push(
        prisma.space.findMany({
          where: {
            organizationId: { in: limitedOrgIds },
            OR: [
              { members: { some: { userId } } },
              { folders: { some: { members: { some: { userId } } } } },
              { folders: { some: { lists: { some: { members: { some: { userId } } } } } } },
              { lists: { some: { members: { some: { userId } } } } }
            ],
          },
          include: {
            ...spaceInclude,
            folders: {
              where: {
                OR: [
                  { members: { some: { userId } } },
                  { lists: { some: { members: { some: { userId } } } } }
                ]
              },
              orderBy: { position: 'asc' },
              include: {
                lists: {
                  where: { members: { some: { userId } } },
                  orderBy: { position: 'asc' },
                  include: { _count: { select: { tasks: true } } },
                },
              },
            },
            lists: {
              where: { folderId: null, members: { some: { userId } } },
              orderBy: { position: 'asc' },
              include: { _count: { select: { tasks: true } } },
            },
          },
          orderBy: { createdAt: 'asc' },
        })
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    const [adminSpaces, limitedSpaces] = await Promise.all(queries);
    return [...adminSpaces, ...limitedSpaces];
  }

  static async getById(id: string) {
    const space = await prisma.space.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        organization: { select: { id: true, name: true, slug: true } },
        folders: {
          include: {
            lists: true
          }
        },
        lists: {
          where: { folderId: null }
        },
        members: true,
        projects: {
          include: {
            createdBy: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
            _count: { select: { tasks: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { projects: true, folders: true, lists: true } },
      },
    });

    if (!space) {
      throw ApiError.notFound('Space not found');
    }

    return space;
  }

  static async update(id: string, input: UpdateSpaceInput) {
    const space = await prisma.space.findUnique({ where: { id } });
    if (!space) {
      throw ApiError.notFound('Space not found');
    }

    const result = await prisma.space.update({
      where: { id },
      data: input,
      include: {
        createdBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        projects: {
          include: {
            _count: { select: { tasks: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { projects: true } },
      },
    });

    try {
      getIO().to(`org:${result.organizationId}`).emit('space:updated', { organizationId: result.organizationId });
    } catch { }

    return result;
  }

  static async delete(id: string) {
    const space = await prisma.space.findUnique({ where: { id } });
    if (!space) {
      throw ApiError.notFound('Space not found');
    }

    // Nullify spaceId on all projects in this space before deleting
    await prisma.project.updateMany({
      where: { spaceId: id },
      data: { spaceId: null },
    });

    await prisma.space.delete({ where: { id } });

    try {
      getIO().to(`org:${space.organizationId}`).emit('space:updated', { organizationId: space.organizationId });
    } catch { }
  }

  // Membership management
  static async addMember(spaceId: string, userId: string) {
    return prisma.spaceMember.upsert({
      where: { spaceId_userId: { spaceId, userId } },
      update: {},
      create: { spaceId, userId },
    });
  }

  static async removeMember(spaceId: string, userId: string) {
    return prisma.spaceMember.deleteMany({
      where: { spaceId, userId },
    });
  }

  static async listMembers(spaceId: string) {
    return prisma.spaceMember.findMany({
      where: { spaceId },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
  }

  static async setMembers(spaceId: string, userIds: string[]) {
    return prisma.$transaction(async (tx) => {
      // 1. Remove members not in the new list
      await tx.spaceMember.deleteMany({
        where: {
          spaceId,
          userId: { notIn: userIds },
        },
      });

      // 2. Add new members
      const promises = userIds.map((userId) =>
        tx.spaceMember.upsert({
          where: { spaceId_userId: { spaceId, userId } },
          update: {},
          create: { spaceId, userId },
        })
      );
      await Promise.all(promises);

      const result = await tx.spaceMember.findMany({
        where: { spaceId },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      });

      // Fetch orgId for emission
      const space = await tx.space.findUnique({ where: { id: spaceId }, select: { organizationId: true } });
      if (space) {
        try {
          getIO().to(`org:${space.organizationId}`).emit('space:updated', { organizationId: space.organizationId });
          getIO().to(`org:${space.organizationId}`).emit('people:updated', { organizationId: space.organizationId });
        } catch { }
      }

      return result;
    });
  }
  static async getUserMembershipsInOrg(organizationId: string, userId: string) {
    return prisma.spaceMember.findMany({
      where: {
        userId,
        space: { organizationId }
      },
      select: { spaceId: true }
    });
  }

  static async setUserSpacesInOrg(organizationId: string, userId: string, spaceIds: string[]) {
    return prisma.$transaction(async (tx) => {
      // 1. Remove all existing memberships in this organization
      await tx.spaceMember.deleteMany({
        where: {
          userId,
          space: { organizationId }
        }
      });

      // 2. Add new memberships
      if (spaceIds.length > 0) {
        await tx.spaceMember.createMany({
          data: spaceIds.map(spaceId => ({
            userId,
            spaceId
          }))
        });
      }

      return this.getUserMembershipsInOrg(organizationId, userId);
    });
  }

  static async getUserGranularMemberships(organizationId: string, userId: string) {
    const spaces = await prisma.spaceMember.findMany({
      where: { userId, space: { organizationId } },
      select: { spaceId: true, role: true }
    });

    const folders = await prisma.folderMember.findMany({
      where: { userId, folder: { space: { organizationId } } },
      select: { folderId: true, role: true }
    });

    const lists = await prisma.listMember.findMany({
      where: { userId, list: { space: { organizationId } } },
      select: { listId: true, role: true }
    });

    return {
      spaceIds: spaces.map(s => s.spaceId),
      folderIds: folders.map(f => f.folderId),
      listIds: lists.map(l => l.listId),
      spaceAdmins: spaces.filter(s => s.role === 'ADMIN').map(s => s.spaceId),
      folderAdmins: folders.filter(f => f.role === 'ADMIN').map(f => f.folderId),
      listAdmins: lists.filter(l => l.role === 'ADMIN').map(l => l.listId),
    };
  }

  static async setUserGranularMemberships(
    organizationId: string,
    userId: string,
    data: {
      spaceIds: string[],
      folderIds: string[],
      listIds: string[],
      spaceAdmins?: string[],
      folderAdmins?: string[],
      listAdmins?: string[]
    },
    actorId: string
  ) {
    // Fetch existing memberships to identify what's new
    const existing = await this.getUserGranularMemberships(organizationId, userId);
    const newSpaces = data.spaceIds.filter(id => !existing.spaceIds.includes(id));
    const newFolders = data.folderIds.filter(id => !existing.folderIds.includes(id));
    const newLists = data.listIds.filter(id => !existing.listIds.includes(id));

    return prisma.$transaction(async (tx) => {
      // 1. Update Spaces
      await tx.spaceMember.deleteMany({
        where: { userId, space: { organizationId } }
      });
      if (data.spaceIds.length > 0) {
        await tx.spaceMember.createMany({
          data: data.spaceIds.map(spaceId => ({
            userId,
            spaceId,
            role: (data.spaceAdmins || []).includes(spaceId) ? 'ADMIN' : 'MEMBER'
          }))
        });
      }

      // 2. Update Folders
      await tx.folderMember.deleteMany({
        where: { userId, folder: { space: { organizationId } } }
      });
      if (data.folderIds.length > 0) {
        await tx.folderMember.createMany({
          data: data.folderIds.map(folderId => ({
            userId,
            folderId,
            role: (data.folderAdmins || []).includes(folderId) ? 'ADMIN' : 'MEMBER'
          }))
        });
      }

      // 3. Update Lists
      await tx.listMember.deleteMany({
        where: { userId, list: { space: { organizationId } } }
      });
      if (data.listIds.length > 0) {
        await tx.listMember.createMany({
          data: data.listIds.map(listId => ({
            userId,
            listId,
            role: (data.listAdmins || []).includes(listId) ? 'ADMIN' : 'MEMBER'
          }))
        });
      }

      // --- NOTIFICATIONS ---
      const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { firstName: true, lastName: true } });
      const actorName = actor ? `${actor.firstName} ${actor.lastName}` : 'An Admin';

      if (newSpaces.length > 0) {
        const spaces = await prisma.space.findMany({ where: { id: { in: newSpaces } }, select: { name: true } });
        const names = spaces.map(s => s.name).join(', ');
        await NotificationService.notifyUser(userId, actorId, 'New Space Access', `${actorName} assigned you to: ${names}`, undefined, organizationId);
      }

      if (newFolders.length > 0) {
        const folders = await prisma.folder.findMany({ where: { id: { in: newFolders } }, select: { name: true } });
        const names = folders.map(f => f.name).join(', ');
        await NotificationService.notifyUser(userId, actorId, 'New Folder Access', `${actorName} assigned you to folder(s): ${names}`, undefined, organizationId);
      }

      if (newLists.length > 0) {
        const lists = await prisma.list.findMany({ where: { id: { in: newLists } }, select: { name: true, id: true } });
        const names = lists.map(l => l.name).join(', ');
        await NotificationService.notifyUser(userId, actorId, 'New List Assignment', `${actorName} assigned you to list: ${names}`, `/lists/${lists[0].id}`, organizationId);
      }

      return this.getUserGranularMemberships(organizationId, userId);
    });
  }

  static async getSpaceStats(spaceId: string, userId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);

    const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { organizationId: true } });
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: space?.organizationId || '', userId } }
    });

    const baseWhere: any = {
      OR: [
        { list: { spaceId } },
        { project: { spaceId } }
      ]
    };

    // Filter by list membership if not admin
    if (membership?.role !== 'ADMIN' && membership?.role !== 'OWNER' && membership?.role !== 'SUPER_ADMIN') {
      baseWhere.AND = [
        {
          OR: [
            { project: { spaceId } }, // Projects are currently open if space is open
            { list: { members: { some: { userId } } } }
          ]
        }
      ];
    }

    const [active, completed, dueToday, late, all, starred] = await Promise.all([
      // Active: OPEN, PENDING, IN_PROGRESS, IN_REVIEW
      prisma.task.count({
        where: {
          ...baseWhere,
          status: { in: ['OPEN', 'PENDING', 'IN_PROGRESS', 'IN_REVIEW'] }
        }
      }),
      // Completed: COMPLETED, ACCEPTED, CLOSED
      prisma.task.count({
        where: {
          ...baseWhere,
          status: { in: ['COMPLETED', 'ACCEPTED', 'CLOSED'] }
        }
      }),
      // Due Today
      prisma.task.count({
        where: {
          ...baseWhere,
          dueDate: {
            gte: todayStart,
            lt: tomorrowStart
          }
        }
      }),
      // Late: Past due date and not completed
      prisma.task.count({
        where: {
          ...baseWhere,
          dueDate: { lt: todayStart },
          status: { notIn: ['COMPLETED', 'ACCEPTED', 'CLOSED'] }
        }
      }),
      // All
      prisma.task.count({ where: baseWhere }),
      // Starred: Favorited by the current user
      prisma.task.count({
        where: {
          ...baseWhere,
          favoritedBy: { some: { id: userId } }
        }
      })
    ]);

    return { active, completed, dueToday, late, all, starred };
  }

  static async getSpaceTasks(spaceId: string, filter: string, userId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);

    const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { organizationId: true } });
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: space?.organizationId || '', userId } }
    });

    const baseWhere: any = {
      OR: [
        { list: { spaceId } },
        { project: { spaceId } }
      ]
    };

    // Filter by list membership if not admin
    if (membership?.role !== 'ADMIN' && membership?.role !== 'OWNER' && membership?.role !== 'SUPER_ADMIN') {
      baseWhere.AND = [
        {
          OR: [
            { project: { spaceId } },
            { list: { members: { some: { userId } } } }
          ]
        }
      ];
    }

    switch (filter) {
      case 'active':
        baseWhere.status = { in: ['OPEN', 'PENDING', 'IN_PROGRESS', 'IN_REVIEW'] };
        break;
      case 'completed':
        baseWhere.status = { in: ['COMPLETED', 'ACCEPTED', 'CLOSED'] };
        break;
      case 'dueToday':
        baseWhere.dueDate = { gte: todayStart, lt: tomorrowStart };
        break;
      case 'late':
        baseWhere.dueDate = { lt: todayStart };
        baseWhere.status = { notIn: ['COMPLETED', 'ACCEPTED', 'CLOSED'] };
        break;
      case 'all':
        // no additional filters
        break;
      case 'starred':
        baseWhere.favoritedBy = { some: { id: userId } };
        break;
      default:
        break;
    }

    const tasks = await prisma.task.findMany({
      where: baseWhere as any,
      include: {
        assignees: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        tags: { select: { id: true, name: true, color: true } },
        favoritedBy: { where: { id: userId } },
        project: { select: { id: true, name: true } }
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });

    return tasks.map(t => ({
      ...t,
      isFavorite: (t as any).favoritedBy.length > 0
    }));
  }
}
