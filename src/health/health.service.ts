import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { HealthResponseDto } from './health-response.dto.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponseDto> {
    try {
      await this.prisma.pingDatabase();
      return { status: 'ok', backend: 'up', database: 'up', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error', backend: 'up', database: 'down', timestamp: new Date().toISOString(),
      } satisfies HealthResponseDto);
    }
  }
}
