import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

export class TimeEntryService {
  /** Start a new timer – only one active timer per user */
  static async start(taskId: string, userId: string, description?: string) {
    // Check task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw ApiError.notFound('Task not found');

    // Ensure no other active timer for this user
    const active = await prisma.timeEntry.findFirst({
      where: { userId, endTime: null, startTime: { not: null } },
    });
    if (active) {
      throw ApiError.conflict('You already have an active timer. Stop it first.');
    }

    return prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        startTime: new Date(),
        description,
      },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Stop an active timer and calculate duration */
  static async stop(id: string, userId: string) {
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw ApiError.notFound('Time entry not found');
    if (entry.userId !== userId) throw ApiError.forbidden('Not your time entry');
    if (entry.endTime) throw ApiError.badRequest('Timer already stopped');
    if (!entry.startTime) throw ApiError.badRequest('This is a manual entry, not a timer');

    const endTime = new Date();
    const durationSeconds = Math.round((endTime.getTime() - entry.startTime.getTime()) / 1000);

    return prisma.timeEntry.update({
      where: { id },
      data: { endTime, durationSeconds },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Get all time entries for a task */
  static async getByTask(taskId: string) {
    return prisma.timeEntry.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get all time entries across the platform (for admin tracking) */
  static async getAll() {
    return prisma.timeEntry.findMany({
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Update a time entry (manual edit) */
  static async update(
    id: string,
    userId: string,
    input: { description?: string; durationSeconds?: number; startTime?: string; endTime?: string }
  ) {
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw ApiError.notFound('Time entry not found');
    if (entry.userId !== userId) throw ApiError.forbidden('Not your time entry');

    const data: Record<string, unknown> = {};
    if (input.description !== undefined) data.description = input.description;
    if (input.durationSeconds !== undefined) {
      if (input.durationSeconds < 0) throw ApiError.badRequest('Duration cannot be negative');
      data.durationSeconds = input.durationSeconds;
    }
    if (input.startTime) {
      const start = new Date(input.startTime);
      if (input.endTime) {
        const end = new Date(input.endTime);
        if (end <= start) throw ApiError.badRequest('End time must be after start time');
        data.startTime = start;
        data.endTime = end;
        data.durationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
      } else {
        data.startTime = start;
      }
    } else if (input.endTime) {
      const end = new Date(input.endTime);
      if (entry.startTime && end <= entry.startTime) {
        throw ApiError.badRequest('End time must be after start time');
      }
      data.endTime = end;
      if (entry.startTime) {
        data.durationSeconds = Math.round((end.getTime() - entry.startTime.getTime()) / 1000);
      }
    }

    return prisma.timeEntry.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Delete a time entry */
  static async delete(id: string) {
    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) throw ApiError.notFound('Time entry not found');

    await prisma.timeEntry.delete({ where: { id } });
  }

  /** Get the current user's active timer */
  static async getActive(userId: string) {
    return prisma.timeEntry.findFirst({
      where: { userId, endTime: null, startTime: { not: null } },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Create a manual time entry (no start/stop if duration provided, or with start/stop) */
  static async createManual(
    taskId: string,
    userId: string,
    durationSeconds?: number,
    description?: string,
    startTime?: string,
    endTime?: string
  ) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw ApiError.notFound('Task not found');
    
    let finalDuration = durationSeconds || 0;
    let finalStart: Date | undefined;
    let finalEnd: Date | undefined;

    if (startTime && endTime) {
      finalStart = new Date(startTime);
      finalEnd = new Date(endTime);
      if (finalEnd <= finalStart) throw ApiError.badRequest('End time must be after start time');
      finalDuration = Math.round((finalEnd.getTime() - finalStart.getTime()) / 1000);
    }

    if (finalDuration <= 0) throw ApiError.badRequest('Duration must be positive');

    return prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        durationSeconds: finalDuration,
        description,
        startTime: finalStart,
        endTime: finalEnd,
      },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
