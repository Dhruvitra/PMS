import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const memberCount = await prisma.organizationMember.count();
  const notifCount = await prisma.notification.count({ where: { isRead: false } });
  
  console.log({ userCount, memberCount, notifCount });
  
  const members = await prisma.organizationMember.findMany({
    include: { user: true }
  });
  console.log('Members:', members.map(m => m.user.email));
}

main().finally(() => prisma.$disconnect());
