/**
 * Day 39: Backend Tests - Task Service Unit Tests
 */

jest.mock('../../src/config/database', () => ({
  prisma: {
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../src/config/database';
import { TaskService } from '../../src/services/task.service';

const mockTask = prisma.task as jest.Mocked<typeof prisma.task>;

const TASK_FIXTURE = {
  id: 'task-001',
  title: 'Write unit tests',
  description: 'Cover all services',
  status: 'TODO' as const,
  priority: 'HIGH' as const,
  position: 0,
  dueDate: null,
  projectId: 'proj-001',
  listId: null,
  statusId: null,
  parentTaskId: null,
  assigneeIds: ['user-001'],
  createdById: 'user-001',
  createdAt: new Date(),
  updatedAt: new Date(),
  assignees: [{ id: 'user-001', email: 'dev@example.com', firstName: 'Dev', lastName: 'User' }],
  createdBy: { id: 'user-001', email: 'dev@example.com', firstName: 'Dev', lastName: 'User' },
};

describe('TaskService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── create ──────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create and return a task', async () => {
      (mockTask.create as jest.Mock).mockResolvedValue(TASK_FIXTURE);

      const task = await TaskService.create({
        title: 'Write unit tests',
        projectId: 'proj-001',
        createdById: 'user-001',
        priority: 'HIGH',
      });

      expect(task.title).toBe('Write unit tests');
      expect(mockTask.create).toHaveBeenCalledTimes(1);
    });

    it('should set dueDate when provided', async () => {
      (mockTask.create as jest.Mock).mockResolvedValue({ ...TASK_FIXTURE, dueDate: new Date('2025-12-31') });

      const task = await TaskService.create({
        title: 'Task with due date',
        projectId: 'proj-001',
        createdById: 'user-001',
        dueDate: '2025-12-31',
      });

      expect(task.dueDate).toBeDefined();
    });
  });

  // ─── getByProject ─────────────────────────────────────────────────────────
  describe('getByProject', () => {
    it('should return tasks for a project', async () => {
      (mockTask.findMany as jest.Mock).mockResolvedValue([TASK_FIXTURE]);

      const tasks = await TaskService.getByProject({ projectId: 'proj-001' });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-001');
    });

    it('should filter by status when provided', async () => {
      (mockTask.findMany as jest.Mock).mockResolvedValue([]);

      await TaskService.getByProject({ projectId: 'proj-001', status: 'DONE' });

      expect(mockTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DONE' }),
        })
      );
    });
  });

  // ─── getById ──────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return a task by id', async () => {
      (mockTask.findUnique as jest.Mock).mockResolvedValue({
        ...TASK_FIXTURE,
        project: { id: 'proj-001', name: 'My Project', organizationId: 'org-001' },
      });

      const task = await TaskService.getById('task-001');
      expect(task.id).toBe('task-001');
    });

    it('should throw 404 if task not found', async () => {
      (mockTask.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(TaskService.getById('nonexistent')).rejects.toThrow('Task not found');
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update and return the task', async () => {
      (mockTask.findUnique as jest.Mock).mockResolvedValue(TASK_FIXTURE);
      (mockTask.update as jest.Mock).mockResolvedValue({ ...TASK_FIXTURE, title: 'Updated' });

      const task = await TaskService.update('task-001', { title: 'Updated' });
      expect(task.title).toBe('Updated');
    });

    it('should throw 404 if task not found', async () => {
      (mockTask.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(TaskService.update('nope', { title: 'x' })).rejects.toThrow('Task not found');
    });
  });

  // ─── bulkUpdate ───────────────────────────────────────────────────────────
  describe('bulkUpdate', () => {
    it('should bulk update tasks and return count', async () => {
      (mockTask.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const result = await TaskService.bulkUpdate(['t1', 't2', 't3'], { status: 'DONE' });
      expect(result.updated).toBe(3);
    });

    it('should throw if no task IDs provided', async () => {
      await expect(TaskService.bulkUpdate([], { status: 'DONE' })).rejects.toThrow('No task IDs provided');
    });
  });

  // ─── bulkDelete ───────────────────────────────────────────────────────────
  describe('bulkDelete', () => {
    it('should bulk delete tasks and return count', async () => {
      (mockTask.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      const result = await TaskService.bulkDelete(['t1', 't2']);
      expect(result.deleted).toBe(2);
    });

    it('should throw if no task IDs provided', async () => {
      await expect(TaskService.bulkDelete([])).rejects.toThrow('No task IDs provided');
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────
  describe('delete', () => {
    it('should delete a task', async () => {
      (mockTask.findUnique as jest.Mock).mockResolvedValue(TASK_FIXTURE);
      (mockTask.delete as jest.Mock).mockResolvedValue(TASK_FIXTURE);

      await expect(TaskService.delete('task-001')).resolves.toBeUndefined();
      expect(mockTask.delete).toHaveBeenCalledWith({ where: { id: 'task-001' } });
    });
  });
});
