import { PrismaClient, Tag } from '@prisma/client';

const prisma = new PrismaClient();

export class TagService {
  static async getByOrganization(organizationId: string): Promise<Tag[]> {
    return prisma.tag.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  static async create(data: {
    name: string;
    color: string;
    organizationId: string;
  }): Promise<Tag> {
    return prisma.tag.create({
      data,
    });
  }

  static async update(
    id: string,
    data: { name?: string; color?: string }
  ): Promise<Tag> {
    return prisma.tag.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string): Promise<Tag> {
    return prisma.tag.delete({
      where: { id },
    });
  }
}
