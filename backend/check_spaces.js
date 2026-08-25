const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const spaces = await prisma.space.findMany({
    include: {
      folders: {
        include: {
          lists: true
        }
      },
      lists: {
        where: { folderId: null }
      }
    }
  });
  console.log('Spaces Data:', JSON.stringify(spaces, null, 2));

  const orgs = await prisma.organization.findMany();
  console.log('Orgs:', JSON.stringify(orgs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
