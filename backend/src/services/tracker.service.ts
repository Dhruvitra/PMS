import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { WorkMode } from '@prisma/client';

const DEFAULT_LATE_THRESHOLD_MINUTES = 10;

// Heartbeats fire every ~30s while the desktop tracker is actually running. A session whose
// last heartbeat is older than this is treated as no longer live -- either it was closed, or it
// crashed/the PC shut down without a clean Punch Out and just hasn't been formally ended yet.
const LIVE_HEARTBEAT_WINDOW_MS = 2 * 60 * 1000;

// The server (and Postgres) run in UTC regardless of where the team is. Office hours are
// entered and reasoned about in IST (India Standard Time, UTC+5:30, no DST) since that's
// where this team is based -- so "10:00" means 10:00 IST, not 10:00 server time.
// If this product ever needs multi-timezone teams, this becomes a per-org setting instead.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export class TrackerService {
  /** Verifies the org membership exists and returns it, or throws. Same pattern used by dashboard.controller.ts. */
  static async requireMembership(organizationId: string, userId: string) {
    const membership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw ApiError.forbidden('You are not a member of this organization');
    return membership;
  }

  static async startSession(userId: string, organizationId: string, taskId?: string, workMode?: WorkMode) {
    await this.requireMembership(organizationId, userId);

    if (taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { project: { select: { organizationId: true } }, list: { include: { space: { select: { organizationId: true } } } } },
      });
      const taskOrgId = task?.project?.organizationId || task?.list?.space?.organizationId;
      if (!task || taskOrgId !== organizationId) {
        throw ApiError.badRequest('Task does not belong to this organization');
      }
    }

    // End any dangling previous session for this user first (e.g. app crashed, or the PC shut
    // down, without a clean Punch Out). Stamping endedAt as "now" would be wrong here -- if the
    // employee reopens the app a day (or more) later, that backdates the dangling session's span
    // to stretch across every day in between, and getEmployeeSummary matches sessions by whether
    // their [startedAt, endedAt] span *overlaps* the queried range -- so the same accumulated
    // hours get double-counted on every day that span now touches. lastHeartbeatAt is the last
    // moment we actually know activity was happening, so that's the correct cutoff.
    const dangling = await prisma.trackerSession.findMany({
      where: { userId, organizationId, endedAt: null },
      select: { id: true, lastHeartbeatAt: true },
    });
    await Promise.all(dangling.map(d =>
      prisma.trackerSession.update({ where: { id: d.id }, data: { endedAt: d.lastHeartbeatAt } })
    ));

    return prisma.trackerSession.create({
      data: { userId, organizationId, taskId, workMode: workMode || 'WFO' },
    });
  }

  /** Loads a session and verifies it belongs to userId, or throws. Every write below uses this. */
  private static async requireOwnedSession(sessionId: string, userId: string) {
    const session = await prisma.trackerSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw ApiError.notFound('Session not found');
    }
    if (session.endedAt) {
      throw ApiError.badRequest('This session has already ended');
    }
    return session;
  }

  static async heartbeat(sessionId: string, userId: string, activeSecondsDelta: number, idleSecondsDelta: number, inputActiveSecondsDelta: number = 0) {
    const session = await this.requireOwnedSession(sessionId, userId);
    return prisma.trackerSession.update({
      where: { id: session.id },
      data: {
        lastHeartbeatAt: new Date(),
        activeSeconds: { increment: Math.max(0, activeSecondsDelta) },
        idleSeconds: { increment: Math.max(0, idleSecondsDelta) },
        inputActiveSeconds: { increment: Math.max(0, Math.min(inputActiveSecondsDelta, activeSecondsDelta)) },
      },
    });
  }

  static async endSession(sessionId: string, userId: string) {
    const session = await this.requireOwnedSession(sessionId, userId);
    return prisma.trackerSession.update({
      where: { id: session.id },
      data: { endedAt: new Date() },
    });
  }

  static async getActiveSession(userId: string, organizationId: string) {
    return prisma.trackerSession.findFirst({
      where: { userId, organizationId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  static async addScreenshot(sessionId: string, userId: string, imageUrl: string) {
    const session = await this.requireOwnedSession(sessionId, userId);
    return prisma.trackerScreenshot.create({
      data: { sessionId: session.id, imageUrl },
    });
  }

  /** targetUserId omitted -- returns screenshots for all tracked users in the org. */
  static async getScreenshots(organizationId: string, targetUserId: string | undefined, startDate: Date, endDate: Date) {
    return prisma.trackerScreenshot.findMany({
      where: {
        session: {
          organizationId,
          ...(targetUserId ? { userId: targetUserId } : {}),
        },
        capturedAt: { gte: startDate, lte: endDate },
      },
      include: { session: { select: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } } },
      orderBy: { capturedAt: 'desc' },
    });
  }

  /** Deletes a screenshot, but only if it belongs to a session within this caller's organization. Returns the imageUrl so the caller can also remove the file from disk. */
  static async deleteScreenshot(organizationId: string, screenshotId: string): Promise<string> {
    const screenshot = await prisma.trackerScreenshot.findUnique({
      where: { id: screenshotId },
      include: { session: { select: { organizationId: true } } },
    });
    if (!screenshot || screenshot.session.organizationId !== organizationId) {
      throw ApiError.notFound('Screenshot not found');
    }
    await prisma.trackerScreenshot.delete({ where: { id: screenshotId } });
    return screenshot.imageUrl;
  }

  /** Session-level detail for one employee — the raw rows behind a "report", as opposed to the org-wide aggregate in getEmployeeSummary. */
  static async getUserSessions(organizationId: string, targetUserId: string, startDate: Date, endDate: Date) {
    return prisma.trackerSession.findMany({
      where: { organizationId, userId: targetUserId, startedAt: { gte: startDate, lte: endDate } },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  /** Owners manage Employee Tracking, they aren't an "employee" being tracked by it -- excluded from all listings below. */
  private static async getOwnerUserIds(organizationId: string): Promise<string[]> {
    const owners = await prisma.organizationMember.findMany({
      where: { organizationId, role: 'OWNER' },
      select: { userId: true },
    });
    return owners.map(o => o.userId);
  }

  static async getEmployeeSummary(organizationId: string, startDate: Date, endDate: Date) {
    const candidates = await prisma.trackerSession.findMany({
      where: {
        organizationId,
        startedAt: { lte: endDate },
        OR: [{ endedAt: null }, { endedAt: { gte: startDate } }],
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    // A still-open (endedAt: null) session with a stale heartbeat hasn't crossed startDate as
    // far as the query above knows -- endedAt: null always matches -- so without this it would
    // get pulled into every date range from its startedAt onward, inflating days with zero real
    // activity. Once its heartbeat has gone stale, treat it as having effectively ended at that
    // last heartbeat for range-matching purposes (this doesn't touch the DB -- only the next
    // startSession call, or a real Punch Out, actually closes it).
    const now = Date.now();
    const sessions = candidates.filter(s => {
      if (s.endedAt) return true;
      const isLive = now - s.lastHeartbeatAt.getTime() < LIVE_HEARTBEAT_WINDOW_MS;
      return isLive || s.lastHeartbeatAt >= startDate;
    });

    const byUser = new Map<string, {
      user: { id: string; firstName: string; lastName: string; avatarUrl: string | null };
      activeSeconds: number;
      idleSeconds: number;
      inputActiveSeconds: number;
      firstActivity: Date;
      lastActivity: Date;
      sessionCount: number;
    }>();

    for (const s of sessions) {
      const key = s.userId;
      const lastActivity = s.endedAt || s.lastHeartbeatAt;
      const existing = byUser.get(key);
      if (existing) {
        existing.activeSeconds += s.activeSeconds;
        existing.idleSeconds += s.idleSeconds;
        existing.inputActiveSeconds += s.inputActiveSeconds;
        existing.sessionCount += 1;
        if (s.startedAt < existing.firstActivity) existing.firstActivity = s.startedAt;
        if (lastActivity > existing.lastActivity) existing.lastActivity = lastActivity;
      } else {
        byUser.set(key, {
          user: s.user,
          activeSeconds: s.activeSeconds,
          idleSeconds: s.idleSeconds,
          inputActiveSeconds: s.inputActiveSeconds,
          firstActivity: s.startedAt,
          lastActivity,
          sessionCount: 1,
        });
      }
    }

    const rows = Array.from(byUser.values()).map(r => ({
      ...r,
      totalSeconds: r.activeSeconds + r.idleSeconds,
      // "% Active Minutes" -- coarse: fraction of total tracked time that wasn't idle
      activePercent: r.activeSeconds + r.idleSeconds > 0 ? Math.round((r.activeSeconds / (r.activeSeconds + r.idleSeconds)) * 100) : 0,
      // "% Active Seconds" -- fine-grained: of the active time, how much had real mouse/keyboard input that exact second
      inputActivePercent: r.activeSeconds > 0 ? Math.round((r.inputActiveSeconds / r.activeSeconds) * 100) : 0,
    }));

    const totalMembers = await prisma.organizationMember.count({ where: { organizationId, role: { not: 'OWNER' } } });

    return {
      rows: rows.sort((a, b) => b.totalSeconds - a.totalSeconds),
      totals: {
        activeSeconds: rows.reduce((sum, r) => sum + r.activeSeconds, 0),
        idleSeconds: rows.reduce((sum, r) => sum + r.idleSeconds, 0),
        employeesWorked: rows.length,
        totalMembers,
        notLogged: Math.max(0, totalMembers - rows.length),
      },
    };
  }

  static async getLateToday(organizationId: string) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { settings: true } });
    const settings = (org?.settings as any) || {};
    const officeStartTime: string | undefined = settings.officeStartTime; // e.g. "10:00"
    const lateThresholdMinutes: number = settings.lateThresholdMinutes ?? DEFAULT_LATE_THRESHOLD_MINUTES;

    if (!officeStartTime) {
      return { configured: false, officeStartTime: null, lateThresholdMinutes, lateMembers: [] };
    }

    const [h, m] = officeStartTime.split(':').map(Number);

    // "Today" as an IST wall-clock date, computed by shifting the current UTC instant by the
    // fixed IST offset and reading its UTC-calendar fields (a standard trick for fixed-offset,
    // no-DST zones). todayStartIst/cutoffIst are then shifted back to get the real UTC instants
    // to compare startedAt (stored in UTC) against.
    const nowShiftedToIst = new Date(Date.now() + IST_OFFSET_MS);
    const y = nowShiftedToIst.getUTCFullYear();
    const mo = nowShiftedToIst.getUTCMonth();
    const d = nowShiftedToIst.getUTCDate();

    const todayStartUtc = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0) - IST_OFFSET_MS);
    const cutoffUtc = new Date(Date.UTC(y, mo, d, h, m + lateThresholdMinutes, 0, 0) - IST_OFFSET_MS);

    const ownerIds = await this.getOwnerUserIds(organizationId);

    const todaysSessions = await prisma.trackerSession.findMany({
      where: { organizationId, startedAt: { gte: todayStartUtc }, userId: { notIn: ownerIds } },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { startedAt: 'asc' },
    });

    const firstSessionByUser = new Map<string, typeof todaysSessions[number]>();
    for (const s of todaysSessions) {
      if (!firstSessionByUser.has(s.userId)) firstSessionByUser.set(s.userId, s);
    }

    const lateMembers = Array.from(firstSessionByUser.values())
      .filter(s => s.startedAt > cutoffUtc)
      .map(s => ({ user: s.user, clockedInAt: s.startedAt }));

    return { configured: true, officeStartTime, lateThresholdMinutes, lateMembers };
  }

  static async getLeaderboard(organizationId: string, monthStart: Date, monthEnd: Date) {
    const summary = await this.getEmployeeSummary(organizationId, monthStart, monthEnd);
    return summary.rows
      .map(r => ({ user: r.user, activeSeconds: r.activeSeconds }))
      .sort((a, b) => b.activeSeconds - a.activeSeconds)
      .slice(0, 10);
  }

  /** Every non-Owner org member with whether their desktop tracker is live right now -- an open
   *  session (no endedAt) whose last heartbeat is recent. Heartbeats fire every ~30s, so a 2-minute
   *  window tolerates a couple missed beats before treating a crashed/closed app as offline. */
  static async getOrgTrackingStatus(organizationId: string) {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    const staleThreshold = new Date(Date.now() - LIVE_HEARTBEAT_WINDOW_MS);
    const openSessions = await prisma.trackerSession.findMany({
      where: { organizationId, endedAt: null, lastHeartbeatAt: { gte: staleThreshold } },
      select: { userId: true },
    });
    const trackingUserIds = new Set(openSessions.map(s => s.userId));

    return members.map(m => ({
      user: m.user,
      isTracking: trackingUserIds.has(m.userId),
    }));
  }
}
