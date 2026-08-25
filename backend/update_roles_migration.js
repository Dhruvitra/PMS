const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const resultMembers = await prisma.organizationMember.updateMany({
    where: { role: 'OWNER' },
    data: { role: 'ADMIN' }
  });
  
  const resultInvitations = await prisma.invitation.updateMany({
    where: { role: 'OWNER' },
    data: { role: 'ADMIN' }
  });
  
  console.log(`Successfully updated ${resultMembers.count} OWNER members to ADMINs.`);
  console.log(`Successfully updated ${resultInvitations.count} OWNER invitations to ADMINs.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
