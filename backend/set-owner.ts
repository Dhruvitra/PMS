import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'shreejisoftware1@gmail.com';
  console.log(`Setting owner role for user: ${email}...`);

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  console.log(`Found user ID: ${user.id}`);

  // Find all organization memberships for this user
  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id }
  });

  if (memberships.length === 0) {
    console.error('User is not a member of any organization.');
    process.exit(1);
  }

  for (const membership of memberships) {
    await prisma.organizationMember.update({
      where: { id: membership.id },
      data: { role: 'OWNER' }
    });
    console.log(`Updated organization member role to OWNER for organization ID: ${membership.organizationId}`);
  }

  console.log('Success! Role changed to OWNER.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
