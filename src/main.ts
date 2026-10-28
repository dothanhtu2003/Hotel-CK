import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
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

void bootstrap().catch(() => {
  Logger.error('Backend startup failed; check environment, PostgreSQL and port availability', 'Bootstrap');
  process.exitCode = 1;
});
