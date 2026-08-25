const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const acme = await prisma.organization.findFirst({
    where: { 
      OR: [
        { name: 'Acme Corp' },
        { name: 'Acme' },
        { slug: 'acme' },
        { slug: 'acme-corp' }
      ]
    }
  });

  if (acme) {
    console.log(`Deleting organization: ${acme.name} (${acme.id})`);
    
    // There are many related models.
    // organizationMember
    // organizations are roots, but we should delete their children if needed.
    // However, if it's just a default org, it might have nothing else.
    
    // Check if there are other organizations left first to avoid locking the user out of the app.
    const allOrgsCount = await prisma.organization.count();
    if (allOrgsCount <= 1) {
       console.log('Only one organization remains. Not deleting to avoid locking user out.');
       return;
    }

    // Prisma doesn't have cascade delete by default in all versions if not defined in schema.
    // Let's just delete the Org. 
    // If there are foreign key constraints, it will fail, which is safe.
    try {
      await prisma.organization.delete({ where: { id: acme.id } });
      console.log('Successfully deleted Acme Corp.');
    } catch (e) {
      console.error('Failed to delete organization - it likely has members, spaces, or tasks assigned to it.');
      console.error(e.message);
    }
  } else {
    console.log('No organization named Acme Corp found.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
