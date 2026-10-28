import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { PublicUser } from '../users/public-user.js';
import { EmptyBodyPipe } from '../common/validation/empty-body.pipe.js';
import { CreateServiceOrderDto } from './dto/create-service-order.dto.js';
import { ServiceOrderQueryDto } from './dto/service-order-query.dto.js';
import { ServiceOrderPageDto, ServiceOrderResponseDto } from './dto/service-order-response.dto.js';
import { ServiceOrdersService } from './service-orders.service.js';

@ApiTags('Service Orders') @ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Role not allowed' })
@ApiBadRequestResponse({ description: 'Invalid input' })
@ApiNotFoundResponse({ description: 'Resource not found or not accessible' })
@ApiConflictResponse({ description: 'Inactive service, invalid order/stay state or concurrent change' })
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly orders: ServiceOrdersService) {}

  @Post() @Roles('GUEST') @Header('Cache-Control', 'no-store') @ApiCreatedResponse({ type: ServiceOrderResponseDto })
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateServiceOrderDto) { return this.orders.create(user, dto); }

  @Get('my') @Roles('GUEST') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: ServiceOrderPageDto })
  my(@Query() query: ServiceOrderQueryDto, @CurrentUser() user: PublicUser) { return this.orders.list(query, user); }

  @Get() @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: ServiceOrderPageDto })
  list(@Query() query: ServiceOrderQueryDto, @CurrentUser() user: PublicUser) { return this.orders.list(query, user); }

  @Get(':id') @Roles('GUEST', 'RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: ServiceOrderResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.orders.get(id, user); }

  @Patch(':id/complete') @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store')
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } }) @ApiOkResponse({ type: ServiceOrderResponseDto })
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser, @Body(new EmptyBodyPipe()) _body: unknown) { return this.orders.transition(id, user, 'complete'); }

  @Patch(':id/cancel') @Roles('GUEST', 'RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store')
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } }) @ApiOkResponse({ type: ServiceOrderResponseDto })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser, @Body(new EmptyBodyPipe()) _body: unknown) { return this.orders.transition(id, user, 'cancel'); }
}
