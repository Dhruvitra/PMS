const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany();
  for (const org of orgs) {
    const spaces = await prisma.space.findMany({
      where: { organizationId: org.id },
      include: {
        _count: { select: { folders: true, lists: true } }
      }
    });
    console.log(`Org: ${org.name} (${org.id}) - Found ${spaces.length} spaces.`);
    for (const space of spaces) {
      console.log(`  Space: ${space.name} (${space.id}) - Folders: ${space._count.folders}, Lists: ${space._count.lists}`);
      const folders = await prisma.folder.findMany({ where: { spaceId: space.id } });
      for (const folder of folders) {
        const lists = await prisma.list.findMany({ where: { folderId: folder.id } });
        console.log(`    Folder: ${folder.name} (${folder.id}) - Online Lists: ${lists.length}`);
      }
      const directLists = await prisma.list.findMany({ where: { spaceId: space.id, folderId: null } });
      console.log(`    Direct Lists: ${directLists.length}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
