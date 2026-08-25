const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@example.com';
  const orgId = '385456ed-4d8e-4a2d-91ba-2f0f52d40df7';
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`User not found: ${email}`);
    process.exit(1);
  }
  
  console.log(`Found User: ${user.firstName} ${user.lastName} (${user.id})`);
  
  // Set as OWNER
  const membership = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
    update: { role: 'OWNER' },
    create: { organizationId: orgId, userId: user.id, role: 'OWNER' }
  });
  
  console.log(`Successfully set ${email} as OWNER of organization ${orgId}`);
  
  // Optional: Set other members as ADMIN or MEMBER if needed
  // ...
}

main().catch(console.error).finally(() => prisma.$disconnect());
