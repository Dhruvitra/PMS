const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { firstName: { contains: 'Dhruvik', mode: 'insensitive' } }
  });
  console.log(`Found ${users.length} users:`);
  users.forEach(u => console.log(`${u.firstName} ${u.lastName} (${u.id})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
