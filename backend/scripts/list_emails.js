const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, firstName: true }
  });
  console.log('User Emails:');
  users.forEach(u => console.log(`${u.firstName}: ${u.email}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
