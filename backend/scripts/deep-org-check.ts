import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    include: {
      members: { include: { user: true } },
      invitations: true
    }
  });

  orgs.forEach(org => {
    console.log(`Org: ${org.name} (${org.id})`);
    console.log(`  Members: ${org.members.length}`);
    org.members.forEach(m => console.log(`    - ${m.user.email} (${m.role})`));
    console.log(`  Invitations: ${org.invitations.length}`);
  });
}

main().finally(() => prisma.$disconnect());
