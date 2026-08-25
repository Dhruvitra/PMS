const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    include: {
      _count: {
        select: {
          spaces: true,
          members: true,
        }
      }
    }
  });

  console.log('Organizations:');
  console.log(JSON.stringify(orgs, null, 2));

  const spaces = await prisma.space.findMany({
    include: {
      folders: {
        include: {
          lists: true,
        }
      },
      lists: {
        where: { folderId: null }
      }
    }
  });

  console.log('\nSpaces:');
  console.log(JSON.stringify(spaces, null, 2));
  
  const memberships = await prisma.organizationMember.findMany({
    include: {
      user: {
        select: { email: true, firstName: true }
      },
      organization: {
        select: { name: true }
      }
    }
  });
  
  console.log('\nMemberships:');
  console.log(JSON.stringify(memberships, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
