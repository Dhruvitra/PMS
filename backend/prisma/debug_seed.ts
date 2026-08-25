import { PrismaClient, OrgRole, TaskStatus, TaskPriority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeded WordPress Demo (Debug UUIDs)...');

  try {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
    if (!admin) throw new Error('Admin not found');

    const org = await prisma.organization.findFirst({
      where: { members: { some: { userId: admin.id } } }
    });
    if (!org) throw new Error('Org not found');

    const spaceId = '00000000-0000-0000-0000-000000000001';
    const folderId = '00000000-0000-0000-0000-000000000002';
    const listId = '00000000-0000-0000-0000-000000000003';
    const projectId = '00000000-0000-0000-0000-000000000004';

    console.log('Using UUIDs:', { adminId: admin.id, projectId, listId });

    await prisma.task.create({
      data: {
        title: 'DEBUG TASK',
        status: TaskStatus.OPEN,
        priority: TaskPriority.LOW,
        projectId: projectId,
        listId: listId,
        createdById: admin.id,
        assigneeId: admin.id
      }
    });

    console.log('Debug task created successfully!');
  } catch (err: any) {
    console.error('Debug failure:', err);
  }
}

main().finally(() => prisma.$disconnect());
