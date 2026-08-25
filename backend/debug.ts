import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debug() {
  const users = await prisma.user.findMany({
    where: { firstName: 'Dhruvik' }
  });
  
  if (users.length === 0) {
    console.log('User Dhruvik not found');
    return;
  }

  const user = users[0];
  console.log(`User: ${user.firstName} ${user.lastName} (${user.id})`);

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: true }
  });

  console.log('\nOrganization Memberships:');
  memberships.forEach(m => {
    console.log(`- ${m.organization.name}: ${m.role}`);
  });

  const spaceMembers = await prisma.spaceMember.findMany({
    where: { userId: user.id },
    include: { space: true }
  });

  console.log('\nSpace Memberships:');
  spaceMembers.forEach(s => {
    console.log(`- ${s.space.name}: ${s.role}`);
  });

  const listMembers = await prisma.listMember.findMany({
    where: { userId: user.id },
    include: { list: true }
  });

  console.log('\nList Memberships:');
  listMembers.forEach(l => {
    console.log(`- ${l.list.name}: ${l.role}`);
  });
}

debug()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
