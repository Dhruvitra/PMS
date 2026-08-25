import { PrismaClient, OrgRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'shreejisoftware1@gmail.com' },
    update: { passwordHash },
    create: {
      email: 'shreejisoftware1@gmail.com',
      passwordHash,
      firstName: 'Shreeji',
      lastName: 'Software',
    },
  });

  console.log(`Created user: ${user.email}`);

  // Create assessor user with password 987654
  const assessorHash = await bcrypt.hash('987654', 12);

  const assessor = await prisma.user.upsert({
    where: { email: 'assessor@example.com' },
    update: { passwordHash: assessorHash },
    create: {
      email: 'assessor@example.com',
      passwordHash: assessorHash,
      firstName: 'Assessor',
      lastName: 'User',
    },
  });

  console.log(`Created assessor user: ${assessor.email}`);

  const org = await prisma.organization.upsert({
    where: { slug: 'shreeji-software' },
    update: {},
    create: {
      name: 'Shreeji Software',
      slug: 'shreeji-software',

      members: {
        create: {
          userId: user.id,
          role: OrgRole.SUPER_ADMIN,
        },
      },
    },
  });

  // Add assessor as a member of the organization
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: assessor.id,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      userId: assessor.id,
      role: OrgRole.MEMBER,
    },
  });

  console.log(`Created organization: ${org.name}`);
  console.log('Assessor added as member of organization');
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
