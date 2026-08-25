import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import type { StatusType } from '@prisma/client';

interface CreateStatusInput {
  name: string;
  color: string;
  type: StatusType;
  position?: number;
  listId: string;
}

interface UpdateStatusInput {
  name?: string;
  color?: string;
  type?: StatusType;
  position?: number;
}

const DEFAULT_STATUSES: { name: string; color: string; type: StatusType; position: number }[] = [
  { name: 'TO DO', color: '#d1d5db', type: 'OPEN', position: 0 },
  { name: 'IN PROGRESS', color: '#3b82f6', type: 'IN_PROGRESS', position: 1 },
  { name: 'COMPLETE', color: '#22c55e', type: 'CLOSED', position: 2 },
];

export class StatusService {
  /** Get all statuses for a list, ordered by position */
  static async getByList(listId: string) {
    const list = await prisma.list.findUnique({ where: { id: listId } });
    if (!list) throw ApiError.notFound('List not found');

    return prisma.status.findMany({
      where: { listId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { position: 'asc' },
    });
  }

  /** Create a new status */
  static async create(input: CreateStatusInput) {
    const list = await prisma.list.findUnique({ where: { id: input.listId } });
    if (!list) throw ApiError.notFound('List not found');

    // Auto-assign position if not provided
    if (input.position === undefined) {
      const maxPos = await prisma.status.aggregate({
        where: { listId: input.listId },
        _max: { position: true },
      });
      input.position = (maxPos._max.position ?? -1) + 1;
    }

    return prisma.status.create({
      data: {
        name: input.name,
        color: input.color,
        type: input.type,
        position: input.position,
        listId: input.listId,
      },
      include: { _count: { select: { tasks: true } } },
    });
  }

  /** Update a status */
  static async update(id: string, input: UpdateStatusInput) {
    const status = await prisma.status.findUnique({ where: { id } });
    if (!status) throw ApiError.notFound('Status not found');

    return prisma.status.update({
      where: { id },
      data: input,
      include: { _count: { select: { tasks: true } } },
    });
  }

  /** Delete a status (only if no tasks are using it) */
  static async delete(id: string) {
    const status = await prisma.status.findUnique({
      where: { id },
      include: { _count: { select: { tasks: true } } },
    });
    if (!status) throw ApiError.notFound('Status not found');

    if (status._count.tasks > 0) {
      throw ApiError.badRequest(
        `Cannot delete status with ${status._count.tasks} task(s). Move or delete tasks first.`
      );
    }

    await prisma.status.delete({ where: { id } });
  }

  /** Reorder statuses for a list */
  static async reorder(listId: string, statusIds: string[]) {
    const list = await prisma.list.findUnique({ where: { id: listId } });
    if (!list) throw ApiError.notFound('List not found');

    const updates = statusIds.map((id, index) =>
      prisma.status.update({ where: { id }, data: { position: index } })
    );

    await prisma.$transaction(updates);

    return prisma.status.findMany({
      where: { listId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { position: 'asc' },
    });
  }

  /** Create default statuses for a new list */
  static async createDefaults(listId: string) {
    const data = DEFAULT_STATUSES.map((s) => ({ ...s, listId }));
    await prisma.status.createMany({ data });

    return prisma.status.findMany({
      where: { listId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { position: 'asc' },
    });
  }
}
