const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = 'bcff117a-9087-4db5-b25e-86e31b50ebfd'; // The owner id from previous debug
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true }
  });
  console.log('Owner Organizations:', JSON.stringify(memberships.map(m => ({
    id: m.organization.id,
    name: m.organization.name,
    role: m.role
  })), null, 2));

  // Check members of the first organization
  for (const m of memberships) {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: m.organization.id },
      include: { user: true }
    });
    console.log(`Members of ${m.organization.name}:`, JSON.stringify(members.map(mem => ({
      email: mem.user.email,
      role: mem.role
    })), null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
