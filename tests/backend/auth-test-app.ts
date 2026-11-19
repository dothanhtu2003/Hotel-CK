import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Type } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { configureApp } from '../../src/configure-app.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { validateEnvironment } from '../../src/config/environment.js';

export async function createAuthTestApp(limit = 100, controllers: Type<unknown>[] = [], options: { disposableDatabase?: string } = {}) {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) throw new Error('TEST_DATABASE_URL required; never write auth fixtures to dev');
  const url = new URL(testUrl);
  const expected = options.disposableDatabase ?? 'hotel_test';
  if (options.disposableDatabase && !/^hotel_e2e_[a-f0-9]{32}$/.test(expected)) throw new Error('Invalid disposable E2E database name');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/' + expected || url.searchParams.get('schema') !== 'hotel') throw new Error('Auth integration requires the dedicated local hotel_test database');
  const config = validateEnvironment({ ...process.env, DATABASE_URL: testUrl, JWT_SECRET: randomBytes(48).toString('base64url'), AUTH_RATE_LIMIT: limit, AUTH_RATE_TTL_MS: 60000 });
  // AppModule still reads the existing environment at import. The test override changes
  // the injected runtime config before any PrismaService is instantiated/connected.
  const { AppModule } = await import('../../src/app.module.js');
  const module = await Test.createTestingModule({ imports: [AppModule], controllers })
    .overrideProvider(ConfigService).useValue(new ConfigService(config)).compile();
  const app = module.createNestApplication({ logger: false });
  try {
    // Independent test apps represent different clients. Keep limiter enforcement
    // within an app while preventing unrelated suites sharing loopback hold buckets.
    const clientIdentity = { ip: `198.19.${randomBytes(1)[0]}.${1 + randomBytes(1)[0] % 254}` };
    app.use((req: object, _res: unknown, next: () => void) => {
      Object.defineProperty(req, 'ip', { configurable: true, get: () => clientIdentity.ip });
      next();
    });
    configureApp(app);
    await app.init();
    const prisma = app.get(PrismaService);
    const database = await prisma.client.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    if (database[0]?.name !== expected) throw new Error('Refusing to write to an unexpected test database');
    return { app, prisma, config, clientIdentity };
  } catch (error) { await app.close(); throw error; }
}
