import { prisma } from '../config/database';

type OrgRole = 'OWNER' | 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER' | 'GUEST' | 'LIMITED_MEMBER';

export class SearchService {
  /**
   * Look up the caller's role in the given org (returns null when orgId is absent
   * or the user is not a member of that org).
   */
  private static async getOrgRole(userId: string, orgId?: string): Promise<OrgRole | null> {
    if (!orgId) return null;
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      select: { role: true },
    });
    return (membership?.role as OrgRole) ?? null;
  }

  /**
   * Build the Prisma `where` fragment that limits tasks based on the caller's role.
   *
   * - OWNER / SUPER_ADMIN / ADMIN  → all tasks in the org (no extra restriction)
   * - MEMBER                       → only tasks in lists the user is a ListMember of
   * - GUEST / LIMITED_MEMBER       → only tasks directly assigned to the user
   * - no org context               → original broad check (org membership)
   */
  private static buildTaskWhere(
    userId: string,
    orgId: string | undefined,
    role: OrgRole | null,
    titleFilter?: { contains: string; mode: 'insensitive' }
  ) {
    let roleScope: object;

    if (role === 'OWNER' || role === 'SUPER_ADMIN' || role === 'ADMIN') {
      // Admins see every task in the org — filter directly by orgId (no membership join needed)
      roleScope = orgId
        ? {
            OR: [
              { project: { organizationId: orgId } },
              { list: { space: { organizationId: orgId } } },
            ],
          }
        : {
            OR: [
              { project: { organization: { members: { some: { userId } } } } },
              { list: { space: { organization: { members: { some: { userId } } } } } },
            ],
          };
    } else if (role === 'MEMBER') {
      // Only tasks in lists the user is explicitly a list-member of
      roleScope = { list: { members: { some: { userId } } } };
    } else if (role === 'GUEST' || role === 'LIMITED_MEMBER') {
      // Only tasks directly assigned to the user
      roleScope = { assignees: { some: { id: userId } } };
    } else {
      // No org context — fall back to broad org-membership check
      roleScope = {
        OR: [
          { project: { organization: { members: { some: { userId } } } } },
          { list: { space: { organization: { members: { some: { userId } } } } } },
        ],
      };
    }

    return {
      ...(titleFilter ? { title: titleFilter } : {}),
      ...roleScope,
      isDeleted: false,
    };
  }

  /**
   * Build the Prisma `where` fragment that limits lists based on role.
   *
   * - MEMBER                       → only lists the user is explicitly a ListMember of
   * - GUEST / LIMITED_MEMBER       → no lists (caller must short-circuit to [])
   * - OWNER / SUPER_ADMIN / ADMIN  → all lists in the org
   */
  private static buildListWhere(
    userId: string,
    role: OrgRole | null,
    nameFilter?: { contains: string; mode: 'insensitive' },
    orgId?: string
  ) {
    let scope: object;
    if (role === 'OWNER' || role === 'SUPER_ADMIN' || role === 'ADMIN') {
      scope = orgId
        ? { space: { organizationId: orgId } }
        : { space: { organization: { members: { some: { userId } } } } };
    } else if (role === 'MEMBER') {
      scope = { members: { some: { userId } } };
    } else {
      scope = { space: { organization: { members: { some: { userId } } } } };
    }

    return {
      ...(nameFilter ? { name: nameFilter } : {}),
      ...scope,
      isDeleted: false,
    };
  }

  static async search(userId: string, query: string, orgId?: string) {
    const q = query.trim();
    if (!q) return this.getRecent(userId, orgId);

    const role = await this.getOrgRole(userId, orgId);
    const isRestricted = role === 'GUEST' || role === 'LIMITED_MEMBER';
    const isMember = role === 'MEMBER';

    const titleFilter = { contains: q, mode: 'insensitive' as const };
    const nameFilter  = { contains: q, mode: 'insensitive' as const };

    const [tasks, projects, organizations, folders, lists, attachments] = await Promise.all([
      // Tasks — role-scoped, no limit (return all matching tasks)
      prisma.task.findMany({
        where: this.buildTaskWhere(userId, orgId, role, titleFilter),
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          projectId: true,
          updatedAt: true,
          project: { select: { id: true, name: true } },
          list: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // Projects — hidden for MEMBER / GUEST / LIMITED_MEMBER
      (isRestricted || isMember)
        ? Promise.resolve([] as any[])
        : prisma.project.findMany({
            where: {
              name: nameFilter,
              organization: { members: { some: { userId } } },
              isDeleted: false,
            },
            select: {
              id: true, name: true, status: true, description: true,
              updatedAt: true, _count: { select: { tasks: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          }),

      // Organizations — hidden for MEMBER / GUEST / LIMITED_MEMBER
      (isRestricted || isMember)
        ? Promise.resolve([] as any[])
        : prisma.organization.findMany({
            where: { name: nameFilter, members: { some: { userId } } },
            select: { id: true, name: true, slug: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),

      // Folders — same visibility as lists (GUEST/LIMITED see none)
      isRestricted
        ? Promise.resolve([] as any[])
        : prisma.folder.findMany({
            where: {
              name: nameFilter,
              space: { organization: { members: { some: { userId } } } },
              isDeleted: false,
            },
            select: {
              id: true, name: true, color: true, spaceId: true,
              updatedAt: true, space: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          }),

      // Lists — GUEST/LIMITED see none; MEMBER sees only their assigned lists; others see all
      isRestricted
        ? Promise.resolve([] as any[])
        : prisma.list.findMany({
            where: this.buildListWhere(userId, role, nameFilter, orgId),
            select: {
              id: true, name: true, color: true, spaceId: true,
              updatedAt: true, space: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          }),

      // Attachments — hidden for GUEST / LIMITED_MEMBER
      isRestricted
        ? Promise.resolve([] as any[])
        : prisma.attachment.findMany({
            where: {
              originalName: nameFilter,
              task: orgId
                ? { OR: [{ project: { organizationId: orgId } }, { list: { space: { organizationId: orgId } } }] }
                : { OR: [{ project: { organization: { members: { some: { userId } } } } }, { list: { space: { organization: { members: { some: { userId } } } } } }] },
              isDeleted: false,
            },
            select: {
              id: true, originalName: true, mimeType: true, size: true,
              taskId: true, createdAt: true, task: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
    ]);

    return { tasks, projects, organizations, folders, lists, attachments };
  }

  static async getRecent(userId: string, orgId?: string) {
    const role = await this.getOrgRole(userId, orgId);
    const isRestricted = role === 'GUEST' || role === 'LIMITED_MEMBER';
    const isMember = role === 'MEMBER';

    const [tasks, projects, organizations, folders, lists, attachments] = await Promise.all([
      // Tasks — role-scoped, no limit (return all matching tasks)
      prisma.task.findMany({
        where: this.buildTaskWhere(userId, orgId, role),
        select: {
          id: true, title: true, status: true, priority: true,
          projectId: true, updatedAt: true,
          project: { select: { id: true, name: true } },
          list: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // Projects — hidden for MEMBER / GUEST / LIMITED_MEMBER
      (isRestricted || isMember)
        ? Promise.resolve([] as any[])
        : prisma.project.findMany({
            where: {
              ...(orgId ? { organizationId: orgId } : { organization: { members: { some: { userId } } } }),
              isDeleted: false,
            },
            select: {
              id: true, name: true, status: true, description: true,
              updatedAt: true, _count: { select: { tasks: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          }),

      // Organizations — hidden for MEMBER / GUEST / LIMITED_MEMBER
      (isRestricted || isMember)
        ? Promise.resolve([] as any[])
        : prisma.organization.findMany({
            where: orgId ? { id: orgId } : { members: { some: { userId } } },
            select: { id: true, name: true, slug: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),

      // Folders — hidden for GUEST / LIMITED_MEMBER
      isRestricted
        ? Promise.resolve([] as any[])
        : prisma.folder.findMany({
            where: {
              ...(orgId ? { space: { organizationId: orgId } } : { space: { organization: { members: { some: { userId } } } } }),
              isDeleted: false,
            },
            select: {
              id: true, name: true, color: true, spaceId: true,
              updatedAt: true, space: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          }),

      // Lists — GUEST/LIMITED see none; MEMBER sees only their assigned lists; others see all
      isRestricted
        ? Promise.resolve([] as any[])
        : prisma.list.findMany({
            where: this.buildListWhere(userId, role, undefined, orgId),
            select: {
              id: true, name: true, color: true, spaceId: true,
              updatedAt: true, space: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          }),

      // Attachments — hidden for GUEST / LIMITED_MEMBER
      isRestricted
        ? Promise.resolve([] as any[])
        : prisma.attachment.findMany({
            where: {
              task: orgId
                ? { OR: [{ project: { organizationId: orgId } }, { list: { space: { organizationId: orgId } } }] }
                : { OR: [{ project: { organization: { members: { some: { userId } } } } }, { list: { space: { organization: { members: { some: { userId } } } } } }] },
              isDeleted: false,
            },
            select: {
              id: true, originalName: true, mimeType: true, size: true,
              taskId: true, createdAt: true, task: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
    ]);

    return { tasks, projects, organizations, folders, lists, attachments };
  }
}

