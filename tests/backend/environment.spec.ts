import { describe, expect, it } from '@jest/globals';
import { validateEnvironment } from '../../src/config/environment.js';
import { randomBytes } from 'node:crypto';

const valid = { DATABASE_URL: 'postgresql://example:example@127.0.0.1:55432/hotel_dev?schema=hotel', JWT_SECRET: randomBytes(48).toString('base64url') };

describe('Environment configuration', () => {
  it('keeps the existing database URL and supplies local app defaults', () => {
    const config = validateEnvironment(valid);
    expect(config.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(config.PORT).toBe(3000);
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.CORS_ORIGINS).toContain('http://localhost:5173');
  });

  it('converts PORT and trims explicit CORS origins', () => {
    const config = validateEnvironment({ ...valid, PORT: '3001', CORS_ORIGINS: 'http://localhost:5173, http://127.0.0.1:5173' });
    expect(config.PORT).toBe(3001);
    expect(config.CORS_ORIGINS).toBe('http://localhost:5173,http://127.0.0.1:5173');
  });

  it.each(['', 'abc', '0', '65536', '1.5'])('rejects invalid PORT %s', PORT => {
    expect(() => validateEnvironment({ ...valid, PORT })).toThrow('PORT');
  });

  it.each(['*', '', 'http://localhost:5173/path', 'file:///tmp'])('rejects invalid CORS origin %s', CORS_ORIGINS => {
    expect(() => validateEnvironment({ ...valid, CORS_ORIGINS })).toThrow('CORS_ORIGINS');
  });

  it('requires the hotel schema and never includes secret values in errors', () => {
    const secret = 'sensitive-password-placeholder';
    let error: unknown;
    try { validateEnvironment({ ...valid, DATABASE_URL: `postgresql://user:${secret}@localhost/db?schema=public` }); }
    catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('schema=hotel');
    expect((error as Error).message).not.toContain(secret);
    expect(() => validateEnvironment({})).toThrow('DATABASE_URL');
  });

  it('rejects binding outside localhost for this local foundation', () => {
    expect(() => validateEnvironment({ ...valid, HOST: '0.0.0.0' })).toThrow('HOST');
  });
  it('permits explicit production wildcard binding with verified TLS, preserving local defaults', () => {
    const config = validateEnvironment({ ...valid, NODE_ENV: 'production', HOST: '0.0.0.0', PORT: '10000', DATABASE_URL: valid.DATABASE_URL + '&sslmode=verify-full' });
    expect(config.HOST).toBe('0.0.0.0'); expect(config.PORT).toBe(10000);
    expect(() => validateEnvironment({ ...valid, NODE_ENV: 'production' })).toThrow('sslmode=verify-full');
    expect(() => validateEnvironment({ ...valid, NODE_ENV: 'production', DATABASE_URL: valid.DATABASE_URL + '&sslmode=no-verify' })).toThrow('sslmode=verify-full');
  });

  it('requires a signing secret and bounded token lifetime', () => {
    expect(() => validateEnvironment({ ...valid, JWT_SECRET: undefined })).toThrow('JWT_SECRET');
    expect(() => validateEnvironment({ ...valid, JWT_SECRET: 'short' })).toThrow('JWT_SECRET');
    expect(() => validateEnvironment({ ...valid, JWT_ACCESS_TTL_SECONDS: '0' })).toThrow('JWT_ACCESS_TTL_SECONDS');
    expect(() => validateEnvironment({ ...valid, JWT_ACCESS_TTL_SECONDS: '3601' })).toThrow('JWT_ACCESS_TTL_SECONDS');
  });
});
