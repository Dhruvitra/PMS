import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function test() {
  const task = await prisma.task.findFirst();
  console.log('Task fields:', Object.keys(task || {}));
}
test();
