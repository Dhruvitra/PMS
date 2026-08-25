const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgId = '385456ed-4d8e-4a2d-91ba-2f0f52d40df7';
  const spaces = await prisma.space.findMany({
    where: { organizationId: orgId },
    include: {
      folders: { include: { lists: true } },
      lists: { where: { folderId: null } }
    }
  });
  console.log(`Found ${spaces.length} spaces in organization ${orgId}`);
  spaces.forEach(s => {
    console.log(`- Space: ${s.name} (${s.id})`);
    s.folders.forEach(f => {
      console.log(`  * Folder: ${f.name} (${f.id})`);
      f.lists.forEach(l => console.log(`    > List: ${l.name} (${l.id})`));
    });
    s.lists.forEach(l => console.log(`  * List: ${l.name} (${l.id})`));
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
