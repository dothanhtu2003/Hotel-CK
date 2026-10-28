import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { AvailabilityQueryDto } from './dto/availability-query.dto.js';
import { AvailabilityResponseDto, RoomPageDto, RoomResponseDto } from './dto/room-response.dto.js';
import { RoomsService } from './rooms.service.js';

@Public()
@ApiTags('Rooms')
@ApiBadRequestResponse({ description: 'Invalid UUID, query or stay dates' })
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get() @ApiOkResponse({ type: RoomPageDto })
  list(@Query() query: PaginationQueryDto) { return this.rooms.list(query); }

  // Literal route precedes :id so /available is never interpreted as a room UUID.
  @Get('available')
  @ApiOperation({ summary: 'Search active rooms by half-open stay dates, capacity and optional room type' })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  available(@Query() query: AvailabilityQueryDto) { return this.rooms.available(query); }

  @Get(':id') @ApiOkResponse({ type: RoomResponseDto }) @ApiNotFoundResponse({ description: 'Room not found' })
  get(@Param('id', ParseUUIDPipe) id: string) { return this.rooms.get(id); }
}
