import { prisma } from '../config/database';
import { OrganizationStatus } from '@prisma/client';
import { ApiError } from '../utils/ApiError';
import { EmailService } from './email.service';

export class PlatformAdminService {
  /** Every company on the platform, with plan, status, storage used, and member count -- the
   *  Companies list. Storage used sums Attachment.size + Comment.fileSize (the primary file per
   *  comment); it does NOT yet include extra files in Comment.attachments (a JSON array for
   *  multi-file comments), which would need per-row JSON parsing -- close enough for an overview,
   *  should be tightened up if/when Phase 4 (storage enforcement) needs exact numbers. */
  static async listCompanies() {
    const orgs = await prisma.organization.findMany({
      include: {
        plan: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const results = [];
    for (const org of orgs) {
      const taskFilter = {
        OR: [
          { project: { organizationId: org.id } },
          { list: { space: { organizationId: org.id } } },
        ],
      };
      const [attachmentSum, commentSum] = await Promise.all([
        prisma.attachment.aggregate({
          where: { isDeleted: false, task: taskFilter },
          _sum: { size: true },
        }),
        prisma.comment.aggregate({
          where: { task: taskFilter },
          _sum: { fileSize: true },
        }),
      ]);
      const storageUsedBytes = (attachmentSum._sum.size || 0) + (commentSum._sum.fileSize || 0);

      results.push({
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        plan: org.plan ? { id: org.plan.id, name: org.plan.name, storageLimitGB: org.plan.storageLimitGB } : null,
        freeAccessNote: org.freeAccessNote,
        memberCount: org._count.members,
        createdAt: org.createdAt,
        storageUsedBytes,
      });
    }
    return results;
  }

  static async updateStatus(orgId: string, status: OrganizationStatus) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw ApiError.notFound('Company not found');
    const updated = await prisma.organization.update({ where: { id: orgId }, data: { status } });

    // Newly activated from a non-active state (e.g. the manual-approval signup flow) -- let the
    // owner know they can log in now. Skip when it was already ACTIVE (no-op status "change").
    if (status === 'ACTIVE' && org.status !== 'ACTIVE') {
      const owner = await prisma.organizationMember.findFirst({
        where: { organizationId: orgId, role: 'OWNER' },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      });
      if (owner) {
        await EmailService.sendAccountApproved(owner.user.email, {
          firstName: owner.user.firstName,
          orgName: updated.name,
        });
      }
    }

    return updated;
  }

  /** Comps a company permanently -- same "unlimited/internal" mechanism Shreeji Software's own
   *  org already uses (planId: null), just applied manually to any org. note is purely for the
   *  platform admin's own record-keeping (e.g. "beta partner"), never shown to the company. */
  static async grantFreeAccess(orgId: string, note?: string) {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw ApiError.notFound('Company not found');
    return prisma.organization.update({
      where: { id: orgId },
      data: { planId: null, freeAccessNote: note ?? null, status: 'ACTIVE' },
    });
  }

  static async revertToPlan(orgId: string, planId: string) {
    const [org, plan] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!org) throw ApiError.notFound('Company not found');
    if (!plan) throw ApiError.badRequest('Invalid plan');
    return prisma.organization.update({
      where: { id: orgId },
      data: { planId, freeAccessNote: null },
    });
  }

  static async getGrowthStats() {
    const [totalCompanies, totalUsers, byStatus] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.organization.groupBy({ by: ['status'], _count: true }),
    ]);
    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) statusCounts[row.status] = row._count;
    return { totalCompanies, totalUsers, statusCounts };
  }
}
