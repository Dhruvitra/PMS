import { TrackerService } from '../src/services/tracker.service';
import { prisma } from '../src/config/database';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'dhruviktra.rajput.1379@gmail.com' }
  });
  if (!user) throw new Error('User not found');

  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('Org not found');

  console.log(`Testing tracker for user ${user.email} in org ${org.name} (${org.id})...`);
  
  const session = await TrackerService.startSession(user.id, org.id, undefined, 'WFO');
  console.log(`Session started successfully! ID: ${session.id}`);

  await TrackerService.endSession(session.id);
  console.log('Session ended cleanly. Test passed 100%!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
