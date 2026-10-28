import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { PublicUser } from '../users/public-user.js';
import { EmptyBodyPipe } from '../common/validation/empty-body.pipe.js';
import { AssignTaskDto, CreateTaskDto } from './dto/create-task.dto.js';
import { HousekeepingBoardQueryDto, HousekeepingTaskQueryDto } from './dto/housekeeping-query.dto.js';
import { HousekeepingBoardPageDto, HousekeepingTaskPageDto, TaskResponseDto } from './dto/housekeeping-response.dto.js';
import { HousekeepingService } from './housekeeping.service.js';

@ApiTags('Housekeeping') @ApiBearerAuth()
@Roles('RECEPTIONIST', 'HOUSEKEEPING', 'ADMIN')
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Role not allowed or assignee filter outside own scope' })
@ApiBadRequestResponse({ description: 'Invalid input or assignee is not active housekeeping staff' })
@ApiNotFoundResponse({ description: 'Room, staff or accessible task not found' })
@ApiConflictResponse({ description: 'Duplicate open task, invalid state or concurrent change' })
@Controller('housekeeping')
export class HousekeepingController {
  constructor(private readonly housekeeping: HousekeepingService) {}

  @Get('board') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: HousekeepingBoardPageDto })
  board(@Query() query: HousekeepingBoardQueryDto, @CurrentUser() user: PublicUser) { return this.housekeeping.board(query, user); }

  @Get('tasks') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: HousekeepingTaskPageDto })
  list(@Query() query: HousekeepingTaskQueryDto, @CurrentUser() user: PublicUser) { return this.housekeeping.list(query, user); }

  @Get('tasks/:id') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: TaskResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.housekeeping.get(id, user); }

  @Post('tasks') @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store') @ApiCreatedResponse({ type: TaskResponseDto })
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: PublicUser) { return this.housekeeping.create(dto, user); }

  @Patch('tasks/:id/assign') @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: TaskResponseDto })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignTaskDto, @CurrentUser() user: PublicUser) { return this.housekeeping.assign(id, dto, user); }

  @Patch('tasks/:id/start') @Roles('HOUSEKEEPING') @Header('Cache-Control', 'no-store')
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } }) @ApiOkResponse({ type: TaskResponseDto })
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser, @Body(new EmptyBodyPipe()) _body: unknown) { return this.housekeeping.transition(id, user, 'start'); }

  @Patch('tasks/:id/complete') @Roles('HOUSEKEEPING') @Header('Cache-Control', 'no-store')
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } }) @ApiOkResponse({ type: TaskResponseDto })
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser, @Body(new EmptyBodyPipe()) _body: unknown) { return this.housekeeping.transition(id, user, 'complete'); }
}
