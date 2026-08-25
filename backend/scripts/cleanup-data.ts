import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Cleanup Started ---');

  // 1. Reset all notifications to 0 (Mark all as read)
  const notifs = await prisma.notification.updateMany({
    where: { isRead: false },
    data: { isRead: true }
  });
  console.log(`Reset ${notifs.count} unread notifications to read.`);

  // 2. Fix Member Count (Cleanup duplicates)
  // Logic: Some admin@example.com members were duplicated.
  // We'll keep only one entry per user-per-organization.
  const allMembers = await prisma.organizationMember.findMany();
  const seen = new Set();
  const toDelete = [];

  for (const member of allMembers) {
    const key = `${member.userId}-${member.organizationId}`;
    if (seen.has(key)) {
      toDelete.push(member.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    const deleted = await prisma.organizationMember.deleteMany({
      where: { id: { in: toDelete } }
    });
    console.log(`Removed ${deleted.count} duplicate member records.`);
  }

  console.log('--- Cleanup Finished ---');
}

main().finally(() => prisma.$disconnect());
