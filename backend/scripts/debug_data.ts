import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const userCount = await prisma.user.count();
    const orgCount = await prisma.organization.count();
    const spaceCount = await prisma.space.count();
    const memberCount = await prisma.organizationMember.count();

    console.log('Counts:');
    console.log(`Users: ${userCount}`);
    console.log(`Organizations (Workspaces): ${orgCount}`);
    console.log(`Spaces: ${spaceCount}`);
    console.log(`Organization Members: ${memberCount}`);

    if (orgCount > 0) {
      const orgs = await prisma.organization.findMany({ include: { members: { include: { user: true } } } });
      console.log('\nOrganizations and Members:');
      orgs.forEach(o => {
        console.log(`- ${o.name} (${o.id})`);
        o.members.forEach(m => {
          console.log(`  * ${m.user.email} (${m.role})`);
        });
      });
    }
  } catch (error) {
    console.error('Error debugging data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
