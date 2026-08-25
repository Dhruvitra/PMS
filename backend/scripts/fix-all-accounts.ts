import bcrypt from 'bcryptjs';
import { PrismaClient, OrgRole, OrganizationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const newPassword = '12345678';
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // 1. Activate all organizations
  console.log('Activating all organizations...');
  await prisma.organization.updateMany({
    data: {
      status: OrganizationStatus.ACTIVE
    }
  });

  const orgs = await prisma.organization.findMany();
  console.log(`Found ${orgs.length} organizations:`, orgs.map(o => `${o.name} (${o.status})`));

  // 2. Target accounts to setup / update
  const emails = [
    'dhruvik@shreejisoftware.com',
    'dhruviktra.rajput.1379@gmail.com',
    'shreejisoftware1@gmail.com'
  ];

  for (const email of emails) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`Creating user: ${email}`);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: email.split('@')[0],
          lastName: 'Admin',
          isPlatformAdmin: true,
        }
      });
    } else {
      console.log(`Updating user: ${email}`);
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          isPlatformAdmin: true,
        }
      });
    }

    // Ensure membership in all orgs
    for (const org of orgs) {
      const existing = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: user.id
          }
        }
      });

      if (existing) {
        await prisma.organizationMember.update({
          where: { id: existing.id },
          data: { role: OrgRole.SUPER_ADMIN }
        });
      } else {
        await prisma.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            role: OrgRole.SUPER_ADMIN
          }
        });
      }
    }
    console.log(`User ${email} configured as active SUPER_ADMIN.`);
  }

  console.log('\nAll workspaces activated and all admin accounts updated successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
