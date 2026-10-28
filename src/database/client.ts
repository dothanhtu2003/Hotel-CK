import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

export function createPrismaClient(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is required');
  // adapter-pg normalizes timestamptz offsets to +00 without converting the wall
  // clock. Request UTC at connection startup; never change persisted instants or
  // the database-wide timezone. Stay-date rules use an explicit hotel timezone.
  const connection = new URL(url);
  connection.searchParams.set('options', `${connection.searchParams.get('options') ?? ''} -c timezone=UTC`.trim());
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: connection.toString() }, { schema: 'hotel' }) });
}
