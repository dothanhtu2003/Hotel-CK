import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { ServicePageDto, ServiceResponseDto } from './dto/service-response.dto.js';
import { ServicesService } from './services.service.js';

@Public() @ApiTags('Services')
@ApiBadRequestResponse({ description: 'Invalid pagination or UUID' })
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}
  @Get() @ApiOkResponse({ type: ServicePageDto })
  list(@Query() query: PaginationQueryDto) { return this.services.list(query); }

  @Get(':id') @ApiOkResponse({ type: ServiceResponseDto }) @ApiNotFoundResponse({ description: 'Active service not found' })
  get(@Param('id', ParseUUIDPipe) id: string) { return this.services.get(id); }
}
