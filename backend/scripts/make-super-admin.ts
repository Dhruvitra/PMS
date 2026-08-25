import bcrypt from 'bcryptjs';
import { PrismaClient, OrgRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'dhruviktra.rajput.1379@gmail.com';
  const newPassword = '12345678';
  
  console.log(`Setting up super admin for ${email}...`);
  const passwordHash = await bcrypt.hash(newPassword, 12);

  let user = await prisma.user.findUnique({
    where: { email },
    include: { organizationMemberships: true }
  });

  if (!user) {
    console.log(`User ${email} does not exist, creating new user...`);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Dhruvik',
        lastName: 'Rajput',
        isPlatformAdmin: true,
      },
      include: { organizationMemberships: true }
    });
    console.log(`Created user with ID: ${user.id}`);
  } else {
    console.log(`Updating existing user ${user.id}...`);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isPlatformAdmin: true,
      },
      include: { organizationMemberships: true }
    });
    console.log(`Updated password and platform admin status for user.`);
  }

  // Check organization memberships
  const orgs = await prisma.organization.findMany();
  if (orgs.length === 0) {
    console.log('No organizations found, creating default workspace...');
    const newOrg = await prisma.organization.create({
      data: {
        name: 'Main Workspace',
        slug: 'main-workspace',
        status: 'ACTIVE',
      }
    });
    await prisma.organizationMember.create({
      data: {
        organizationId: newOrg.id,
        userId: user.id,
        role: OrgRole.SUPER_ADMIN,
      }
    });
    console.log(`Created workspace and added user as SUPER_ADMIN.`);
  } else {
    for (const org of orgs) {
      const existingMembership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId: user.id,
          }
        }
      });

      if (existingMembership) {
        await prisma.organizationMember.update({
          where: { id: existingMembership.id },
          data: { role: OrgRole.SUPER_ADMIN }
        });
        console.log(`Updated membership in org "${org.name}" (${org.id}) to SUPER_ADMIN.`);
      } else {
        await prisma.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: user.id,
            role: OrgRole.SUPER_ADMIN,
          }
        });
        console.log(`Added membership in org "${org.name}" (${org.id}) as SUPER_ADMIN.`);
      }
    }
  }

  console.log('\n--- Super Admin Setup Summary ---');
  console.log(`Email: ${email}`);
  console.log(`Password: ${newPassword}`);
  console.log(`isPlatformAdmin: true`);
  console.log(`Org Role: SUPER_ADMIN across all organizations`);
}

main()
  .catch((e) => {
    console.error('Error setting super admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
