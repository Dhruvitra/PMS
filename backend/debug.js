const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debug() {
  const user = await prisma.user.findFirst({
    where: { firstName: { contains: 'Dhruvik', mode: 'insensitive' } }
  });
  
  if (!user) {
    console.log('User Dhruvik not found');
    return;
  }

  console.log(`User: ${user.firstName} ${user.lastName} (${user.id})`);

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: true }
  });

  console.log('\nOrganization Memberships:');
  memberships.forEach(m => {
    console.log(`- ${m.organization.name} (${m.organizationId}): Role: ${m.role}`);
  });

  const spaceMembers = await prisma.spaceMember.findMany({
    where: { userId: user.id },
    include: { space: true }
  });

  console.log('\nSpace Members (SpaceMember table):');
  spaceMembers.forEach(s => {
    console.log(`- ${s.space.name} (${s.spaceId}): Role: ${s.role}`);
  });

  const listMembers = await prisma.listMember.findMany({
    where: { userId: user.id },
    include: { list: true }
  });

  console.log('\nList Members (ListMember table):');
  listMembers.forEach(l => {
    console.log(`- ${l.list.name} (${l.listId}): Role: ${l.role}`);
  });

  const tasks = await prisma.task.findMany({
    where: { assignees: { some: { id: user.id } } },
    include: { list: { include: { space: true } } }
  });

  console.log('\nAssigned Tasks:');
  tasks.forEach(t => {
    console.log(`- Task "${t.title}" in List "${t.list?.name}" in Space "${t.list?.space?.name}"`);
  });
}

debug()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
