const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const orgId = 'fd923750-fa2e-4ffd-bb76-7b4113f02576';
  const spaces = await prisma.space.findMany({
    where: { organizationId: orgId }
  });
  console.log(`Found ${spaces.length} spaces in organization ${orgId}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
