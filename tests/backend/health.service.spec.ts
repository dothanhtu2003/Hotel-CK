import { describe, expect, it, jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from '../../src/health/health.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';

describe('HealthService', () => {
  it('reports backend and database up after a successful probe', async () => {
    const pingDatabase = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const service = new HealthService({ pingDatabase } as unknown as PrismaService);
    const result = await service.check();
    expect(result).toEqual({ status: 'ok', backend: 'up', database: 'up', timestamp: expect.any(String) });
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    expect(pingDatabase).toHaveBeenCalledTimes(1);
  });

  it('returns controlled 503 without driver details on database failure', async () => {
    const pingDatabase = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('postgresql://user:secret@db-host/db'));
    const service = new HealthService({ pingDatabase } as unknown as PrismaService);
    let error: unknown;
    try { await service.check(); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    const exception = error as ServiceUnavailableException;
    expect(exception.getStatus()).toBe(503);
    expect(exception.getResponse()).toEqual({ status: 'error', backend: 'up', database: 'down', timestamp: expect.any(String) });
    expect(JSON.stringify(exception.getResponse())).not.toMatch(/secret|db-host|postgresql/);
  });
});
