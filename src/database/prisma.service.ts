import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPrismaClient } from './client.js';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: ReturnType<typeof createPrismaClient>;

  constructor(config: ConfigService) {
    this.client = createPrismaClient(config.getOrThrow<string>('DATABASE_URL'));
  }

  async onModuleInit() {
    try {
      await this.client.$connect();
      await this.pingDatabase();
    } catch {
      await this.client.$disconnect().catch(() => undefined);
      // Never bubble driver errors containing connection details into startup logs.
      throw new Error('Database connection failed; check local database configuration');
    }
  }

  async pingDatabase(): Promise<void> {
    // Verify both connection and read access to the existing hotel schema, even if empty.
    await this.client.$queryRaw`SELECT 1 AS ok FROM hotel.rooms LIMIT 1`;
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
