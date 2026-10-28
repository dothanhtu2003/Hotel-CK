import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './health-response.dto.js';
import { HealthService } from './health.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Check backend and local PostgreSQL connectivity' })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ type: HealthResponseDto })
  check(): Promise<HealthResponseDto> {
    return this.health.check();
  }
}
