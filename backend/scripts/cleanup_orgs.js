const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const keepId = '385456ed-4d8e-4a2d-91ba-2f0f52d40df7';
  const others = await prisma.organization.findMany({
    where: { NOT: { id: keepId } }
  });
  console.log(`Found ${others.length} duplicate organizations to delete.`);
  for (const org of others) {
    console.log(`Deleting: ${org.name} (${org.id})`);
    try {
      await prisma.organization.delete({ where: { id: org.id } });
      console.log(`Successfully deleted ${org.name}`);
    } catch (e) {
      console.error(`Failed to delete ${org.name}: ${e.message}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
