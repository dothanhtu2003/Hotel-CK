import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  try {
    configureApp(app);
    app.enableShutdownHooks();
    const config = app.get(ConfigService);
    await app.listen(config.getOrThrow<number>('PORT'), config.getOrThrow<string>('HOST'));
    const url = await app.getUrl();
    Logger.log(`Backend ready: ${url}/api/health | Swagger: ${url}/api/docs`, 'Bootstrap');
  } catch (error) {
    await app.close();
    throw error;
  }
}

void bootstrap().catch((error: unknown) => {
  // Write directly to stderr: Nest's logger might not be ready after a startup
  // failure. Only expose messages produced by our own configuration checks.
  const message = error instanceof Error ? error.message : '';
  const safeConfigurationErrors = new Set([
    'HOST=0.0.0.0 requires NODE_ENV=production',
    'DATABASE_URL must be a PostgreSQL URL with schema=hotel',
    'Production DATABASE_URL requires sslmode=verify-full and a trusted server certificate',
    'CORS_ORIGINS must contain explicit HTTP(S) origins separated by commas',
    'Database connection failed; check local database configuration',
  ]);
  const detail = safeConfigurationErrors.has(message)
    || /^Invalid environment fields: [A-Z_]+(?:, [A-Z_]+)*$/.test(message)
    ? message
    : 'check environment, PostgreSQL and port availability';
  process.stderr.write(`Backend startup failed: ${detail}\n`);
  process.exitCode = 1;
});
