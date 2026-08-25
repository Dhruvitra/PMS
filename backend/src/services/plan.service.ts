import { prisma } from '../config/database';

// Seeded once, on first read, if the table is empty -- so a fresh deploy (or the first request
// after this feature ships) always has the 3 plans available with no separate manual seed step.
// Adjustable afterward via the DB/admin tooling without a code deploy.
const DEFAULT_PLANS = [
  { name: 'Basic', priceInPaise: 50_000, storageLimitGB: 10 },
  { name: 'Silver', priceInPaise: 100_000, storageLimitGB: 30 },
  { name: 'Gold', priceInPaise: 150_000, storageLimitGB: 50 },
];

export class PlanService {
  static async getAll() {
    const count = await prisma.plan.count();
    if (count === 0) {
      await prisma.plan.createMany({ data: DEFAULT_PLANS, skipDuplicates: true });
    }
    return prisma.plan.findMany({ orderBy: { priceInPaise: 'asc' } });
  }

  static async getById(id: string) {
    return prisma.plan.findUnique({ where: { id } });
  }
}
