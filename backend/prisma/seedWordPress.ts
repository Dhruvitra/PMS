import { PrismaClient, OrgRole, TaskStatus, TaskPriority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding WordPress Demo (Stage Labels)...');

  try {
    // 1. Get default admin user
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@example.com' }
    });

    if (!admin) {
      throw new Error('Admin user not found. Please run main seed first.');
    }

    // 2. Get organization
    const org = await prisma.organization.findFirst({
      where: { members: { some: { userId: admin.id } } }
    });

    if (!org) {
      throw new Error('Organization not found.');
    }

    // 3. Create Space: "Demo Space"
    const space = await prisma.space.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Demo Space',
        color: '#6366F1',
        icon: '🎨',
        organizationId: org.id,
        createdById: admin.id
      }
    });

    // 4. Create Folder: "WordPress Implementation"
    const folder = await prisma.folder.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'WordPress Implementation',
        spaceId: space.id
      }
    });

    // 5. Create List: "Company Event"
    const list = await prisma.list.upsert({
      where: { id: '00000000-0000-0000-0000-000000000003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Company Event',
        color: '#FF4B91',
        spaceId: space.id,
        folderId: folder.id
      }
    });

    // 6. Create Project
    const project = await prisma.project.upsert({
      where: { id: '00000000-0000-0000-0000-000000000004' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000004',
        name: 'WordPress Tasks',
        organizationId: org.id,
        spaceId: space.id,
        createdById: admin.id
      }
    });

    // 7. Clear old tasks
    await prisma.task.deleteMany({ where: { listId: list.id } });

    const tasks = [
      { title: 'Update website', status: TaskStatus.OPEN, priority: TaskPriority.LOW },
      { title: 'Send invitations', status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM },
      { title: 'Update contractor agreement forms', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT },
      { title: 'Review refreshments budget', status: TaskStatus.IN_REVIEW, priority: TaskPriority.HIGH },
      { title: 'Finalize vendor agreement', status: TaskStatus.ACCEPTED, priority: TaskPriority.HIGH },
      { title: 'Talent booked', status: TaskStatus.COMPLETED, priority: TaskPriority.URGENT },
      { title: 'Old proposal', status: TaskStatus.REJECTED, priority: TaskPriority.LOW },
      { title: 'Project Kickoff', status: TaskStatus.CLOSED, priority: TaskPriority.LOW },
    ];

    console.log(`Creating ${tasks.length} tasks...`);
    for (const t of tasks) {
      try {
        await prisma.task.create({
          data: {
            title: t.title,
            status: t.status,
            priority: t.priority,
            projectId: project.id,
            listId: list.id,
            createdById: admin.id,
            assigneeId: admin.id
          }
        });
      } catch (err: any) {
        console.error(`Failed to create task "${t.title}":`, err.message);
      }
    }

    console.log('Seeding complete. Hierarchy updated with new STAGE labels.');
  } catch (error: any) {
    console.error('Fatal seeding error:', error.message);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
