const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@example.com';
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organizationMemberships: {
        include: { organization: true }
      }
    }
  });
  
  if (!user) {
    console.log(`User not found: ${email}`);
    return;
  }
  
  console.log(`User: ${user.firstName} ${user.lastName}`);
  user.organizationMemberships.forEach(m => {
    console.log(`- Org: ${m.organization.name}, Role: ${m.role}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
