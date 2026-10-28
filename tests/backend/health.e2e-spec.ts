import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { PrismaService } from '../../src/database/prisma.service.js';

describe('Backend integration with existing local PostgreSQL (read-only)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countsBefore: number[];

  async function counts() {
    return Promise.all([prisma.client.user.count(), prisma.client.room.count(), prisma.client.booking.count(), prisma.client.invoice.count(), prisma.client.payment.count()]);
  }

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Integration tests require an existing local PostgreSQL database');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    countsBefore = await counts();
  });

  afterAll(async () => {
    if (app) {
      try { if (countsBefore) expect(await counts()).toEqual(countsBefore); }
      finally { await app.close(); }
    }
  });

  it('GET /api/health queries the real hotel schema', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', backend: 'up', database: 'up', timestamp: expect.any(String) });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('Swagger UI and JSON document include the health endpoint', async () => {
    const ui = await request(app.getHttpServer()).get('/api/docs/').expect(200);
    expect(ui.text).toContain('swagger-ui');
    const document = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(document.body.paths['/api/health'].get.responses).toHaveProperty('200');
    expect(document.body.paths['/api/health'].get.responses).toHaveProperty('503');
    expect(document.body.paths).toHaveProperty('/api/rooms/available');
    expect(document.body.paths).toHaveProperty('/api/housekeeping/board');
    expect(document.body.paths).toHaveProperty('/api/bookings');
    expect(document.body.paths).toHaveProperty('/api/bookings/{id}/check-out');
  });

  it('allows preflight for the configured Vite origin', async () => {
    const response = await request(app.getHttpServer()).options('/api/health')
      .set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'GET').expect(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('does not grant CORS access to an unlisted origin', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').set('Origin', 'https://unlisted.invalid').expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('database failure becomes 503 without revealing the underlying exception', async () => {
    const spy = jest.spyOn(prisma, 'pingDatabase').mockRejectedValueOnce(new Error('database-password-and-host-must-not-leak'));
    try {
      const response = await request(app.getHttpServer()).get('/api/health').expect(503);
      expect(response.body.database).toBe('down');
      expect(response.body.backend).toBe('up');
      expect(response.text).not.toMatch(/password|host|stack|Prisma/);
    } finally { spy.mockRestore(); }
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('maps an unexpected error to a safe 500 response', async () => {
    const { HealthService } = await import('../../src/health/health.service.js');
    const spy = jest.spyOn(app.get(HealthService), 'check').mockRejectedValueOnce(new Error('sensitive-driver-message'));
    try {
      const response = await request(app.getHttpServer()).get('/api/health').expect(500);
      expect(response.body.message).toBe('Internal server error');
      expect(response.text).not.toMatch(/sensitive|driver|stack/);
    } finally { spy.mockRestore(); }
  });

  it('has no unprefixed health route and requires authentication for booking list', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
    await request(app.getHttpServer()).get('/api/bookings').expect(401);
  });
});
