import { describe, expect, it, jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from '../../src/health/health.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import { databaseStartupCategory } from '../../src/database/startup-error.js';

describe('database startup diagnostics', () => {
  it.each([
    [{ meta: { driverAdapterError: { cause: { kind: 'AuthenticationFailed', originalMessage: 'private details' } } } }, 'AUTHENTICATION'],
    [{ meta: { cause: { originalMessage: "ENOENT: no such file or directory, open '/etc/secrets/ca.crt'" } } }, 'CERTIFICATE_FILE_MISSING'],
    [{ code: 'EACCES' }, 'CERTIFICATE_FILE_UNREADABLE'],
    [{ cause: { originalMessage: 'error: PEM routines: no start line' } }, 'CERTIFICATE_FILE_INVALID'],
    [{ cause: { originalMessage: 'unsupported startup parameter: options' } }, 'POOLER_STARTUP_OPTIONS'],
    [{ code: 'P2010', meta: { code: 'XX000' } }, 'DRIVER_CODES_P2010'],
    [{ meta: { driverAdapterError: { cause: { originalCode: '28P01' } } } }, 'AUTHENTICATION'],
    [Object.assign(new Error('credential hidden'), { code: 'SELF_SIGNED_CERT_IN_CHAIN' }), 'TLS_CERTIFICATE'],
    [new Error('FATAL: (ENOTFOUND) tenant/user postgres.example not found'), 'POOLER_TENANT_NOT_FOUND'],
    [{ cause: { code: '42P01' } }, 'SCHEMA_OR_TABLE_MISSING'],
    [{ code: '42501' }, 'PERMISSION'],
    [{ code: 'ENOTFOUND' }, 'DNS'],
    [{ code: 'ETIMEDOUT' }, 'NETWORK'],
    [new Error('postgresql://user:secret@private-host/db'), 'UNKNOWN'],
  ])('classifies a wrapped failure without exposing driver text', (error, expected) => {
    expect(databaseStartupCategory(error)).toBe(expected);
  });
});

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
