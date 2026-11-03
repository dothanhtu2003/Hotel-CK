import { createPrismaClient } from '../src/database/client.js';
const db = createPrismaClient();
try {
  const changed = await db.service.updateMany({ where: { currentPrice: { gte: 10000 } }, data: { currentPrice: 9000 } });
  const remaining = await db.service.count({ where: { currentPrice: { gte: 10000 } } });
  console.log(JSON.stringify({ updated: changed.count, servicesAtOrAbove10000: remaining }));
} finally { await db.$disconnect(); }
