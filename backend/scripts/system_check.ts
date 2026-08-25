import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- SYSTEM CHECK ---');
    
    // Check for users without any organization memberships
    const usersWithNoOrg = await prisma.user.findMany({
      where: {
        organizationMemberships: {
          none: {}
        }
      }
    });
    console.log('Users with no Orgs:', usersWithNoOrg.map(u => u.email));

    // Check for organizations with no members (shouldn't happen)
    const orgsWithNoMembers = await prisma.organization.findMany({
      where: {
        members: {
          none: {}
        }
      }
    });
    console.log('Orgs with no members:', orgsWithNoMembers.map(o => o.name));

    // Check recent logs/activities if possible
    const recentActivities = await prisma.activity.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Recent Activities:', recentActivities);

  } catch (error) {
    console.error('System Check Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
