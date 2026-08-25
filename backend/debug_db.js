const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true }
  });
  console.log('Users:', JSON.stringify(users, null, 2));

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true }
  });
  console.log('Organizations:', JSON.stringify(orgs, null, 2));

  const memberships = await prisma.organizationMember.findMany({
    select: { id: true, organizationId: true, userId: true, role: true }
  });
  console.log('Memberships:', JSON.stringify(memberships, null, 2));

  const invites = await prisma.invitation.findMany({
    select: { id: true, email: true, usedAt: true, organizationId: true }
  });
  console.log('Invitations:', JSON.stringify(invites, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
