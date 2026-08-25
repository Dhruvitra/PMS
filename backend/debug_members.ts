import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const members = await prisma.organizationMember.findMany({
    include: { user: true }
  });
  console.log('--- Organization Members ---');
  members.forEach(m => {
    console.log(`ID: ${m.id}, UserID: ${m.userId}, Email: ${m.user.email}, Name: ${m.user.firstName} ${m.user.lastName}, Created: ${m.createdAt}`);
  });
  
  const invitations = await prisma.invitation.findMany();
  console.log('\n--- Invitations ---');
  invitations.forEach(i => {
    console.log(`Email: ${i.email}, Used: ${i.usedAt}, Role: ${i.role}`);
  });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
