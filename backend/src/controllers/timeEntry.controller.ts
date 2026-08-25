import { Request, Response } from 'express';
import { z } from 'zod';
import { TimeEntryService } from '../services/timeEntry.service';
import { ActivityService } from '../services/activity.service';
import { TaskService } from '../services/task.service';
import { NotificationService } from '../services/notification.service';
import { UserService } from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

const startSchema = z.object({
  description: z.string().optional(),
});

const manualSchema = z.object({
  durationSeconds: z.number().int().positive().optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

const updateSchema = z.object({
  description: z.string().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

export class TimeEntryController {
  /** POST /tasks/:taskId/time-entries — start timer or create manual entry */
  start = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const taskId = req.params.taskId as string;

    // If durationSeconds or startTime/endTime is provided, create manual entry
    if (req.body?.durationSeconds !== undefined || (req.body?.startTime && req.body?.endTime)) {
      const data = manualSchema.parse(req.body);
      const entry = await TimeEntryService.createManual(
        taskId,
        req.user.id,
        data.durationSeconds,
        data.description,
        data.startTime,
        data.endTime
      );

      const finalDurationSeconds = entry.durationSeconds;
      const hours = Math.floor(finalDurationSeconds / 3600);
      const mins = Math.floor((finalDurationSeconds % 3600) / 60);
      const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

      await ActivityService.log({
        userId: req.user.id,
        entityType: 'task',
        entityId: taskId,
        action: 'time_entry.created',
        changes: { duration, description: data.description || null },
      });

      const task = await TaskService.getById(taskId, req.user.id);
      const currentUser = await UserService.getById(req.user.id);
      const userName = `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email;

      if (task.assignees && (task.assignees as any[]).length > 0) {
        const notificationPromises = (task.assignees as any[])
          .filter((a: any) => a.id !== req.user!.id)
          .map((a: any) => NotificationService.create(
            a.id,
            task.title,
            `${userName} logged ${duration} time`,
            `/tasks/${task.id}`
          ));
        await Promise.all(notificationPromises);
      }

      res.status(201).json({ success: true, data: entry });
      return;
    }

    const data = startSchema.parse(req.body);
    const entry = await TimeEntryService.start(taskId, req.user.id, data.description);

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: taskId,
      action: 'time_entry.created',
      changes: { type: 'timer_started', description: data.description || null },
    });

    const task = await TaskService.getById(taskId, req.user.id);
    const currentUser = await UserService.getById(req.user.id);
    const userName = `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email;

    if (task.assignees && (task.assignees as any[]).length > 0) {
      const notificationPromises = (task.assignees as any[])
        .filter((a: any) => a.id !== req.user!.id)
        .map((a: any) => NotificationService.create(
          a.id,
          task.title,
          `${userName} started a timer`,
          `/tasks/${task.id}`
        ));
      await Promise.all(notificationPromises);
    }

    res.status(201).json({ success: true, data: entry });
  });

  /** PUT /time-entries/:id/stop */
  stop = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const entry = await TimeEntryService.stop(req.params.id as string, req.user.id);

    const hours = Math.floor(entry.durationSeconds / 3600);
    const mins = Math.floor((entry.durationSeconds % 3600) / 60);
    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    await ActivityService.log({
      userId: req.user.id,
      entityType: 'task',
      entityId: entry.taskId,
      action: 'time_entry.stopped',
      changes: {
        type: 'timer_stopped',
        duration,
        startTime: entry.startTime?.toISOString() || null,
        endTime: entry.endTime?.toISOString() || null,
      },
    });

    res.json({ success: true, data: entry });
  });

  /** GET /tasks/:taskId/time-entries */
  getByTask = asyncHandler(async (req: Request, res: Response) => {
    const taskId = req.params.taskId as string;
    const entries = await TimeEntryService.getByTask(taskId);
    res.json({ success: true, data: entries });
  });

  /** GET /time-entries/all */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const entries = await TimeEntryService.getAll();
    res.json({ success: true, data: entries });
  });

  /** PUT /time-entries/:id */
  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = updateSchema.parse(req.body);
    const entry = await TimeEntryService.update(req.params.id as string, req.user.id, data);
    res.json({ success: true, data: entry });
  });

  /** DELETE /time-entries/:id */
  delete = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    await TimeEntryService.delete(req.params.id as string);
    res.json({ success: true, message: 'Time entry deleted' });
  });

  /** GET /users/me/time-entries/active */
  getActive = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const entry = await TimeEntryService.getActive(req.user.id);
    res.json({ success: true, data: entry });
  });
}
