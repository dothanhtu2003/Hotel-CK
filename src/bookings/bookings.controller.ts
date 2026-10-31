import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { PublicUser } from '../users/public-user.js';
import { EmptyBodyPipe } from '../common/validation/empty-body.pipe.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';
import { BookingPageDto, BookingResponseDto } from './dto/booking-response.dto.js';
import { BookingsService } from './bookings.service.js';

@ApiTags('Bookings') @ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Authentication required' })
@ApiForbiddenResponse({ description: 'Role not allowed' })
@ApiBadRequestResponse({ description: 'Invalid input or capacity exceeded' })
@ApiConflictResponse({ description: 'Room overlap, invalid transition or check-in conditions' })
@ApiNotFoundResponse({ description: 'Room or accessible booking not found' })
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post() @Roles('GUEST') @Header('Cache-Control', 'no-store') @ApiCreatedResponse({ type: BookingResponseDto })
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateBookingDto) { return this.bookings.create(user, dto); }

  @Get('my') @Roles('GUEST') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: BookingPageDto })
  my(@CurrentUser() user: PublicUser, @Query() query: BookingQueryDto) { return this.bookings.list(query, user); }

  @Get() @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: BookingPageDto })
  list(@Query() query: BookingQueryDto, @CurrentUser() user: PublicUser) { return this.bookings.list(query, user); }

  @Get('checkout-requests') @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store')
  checkoutRequests() { return this.bookings.checkoutRequests(); }

  @Patch(':id/request-checkout') @Roles('GUEST') @Header('Cache-Control', 'no-store')
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } }) @ApiOkResponse({ type: BookingResponseDto })
  requestCheckout(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser, @Body(new EmptyBodyPipe()) _body: unknown) { return this.bookings.requestCheckout(id, user); }

  @Get(':id') @Roles('GUEST', 'RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: BookingResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.bookings.get(id, user); }

  @Patch(':id/cancel') @Roles('GUEST', 'RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store')
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } }) @ApiOkResponse({ type: BookingResponseDto })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser, @Body(new EmptyBodyPipe()) _body: unknown) { return this.bookings.transition(id, user, 'cancel'); }

  @Patch(':id/confirm') @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store')
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } }) @ApiOkResponse({ type: BookingResponseDto })
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser, @Body(new EmptyBodyPipe()) _body: unknown) { return this.bookings.transition(id, user, 'confirm'); }

  @Patch(':id/check-in') @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store')
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } }) @ApiOkResponse({ type: BookingResponseDto })
  checkIn(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser, @Body(new EmptyBodyPipe()) _body: unknown) { return this.bookings.transition(id, user, 'check-in'); }
}
