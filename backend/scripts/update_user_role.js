const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'dhruviktra.rajput.1379@gmail.com';
  const orgId = '385456ed-4d8e-4a2d-91ba-2f0f52d40df7';
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`User not found: ${email}`);
    process.exit(1);
  }
  
  console.log(`Found User: ${user.firstName} ${user.lastName} (${user.id})`);
  
  // Set as ADMIN (remove OWNER)
  await prisma.organizationMember.update({
    where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
    data: { role: 'ADMIN' }
  });
  
  console.log(`Successfully changed role for ${email} from OWNER to ADMIN.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
