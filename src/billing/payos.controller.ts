import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { PublicUser } from '../users/public-user.js';
import { PayosService } from './payos.service.js';

@Controller()
export class PayosController {
  constructor(private readonly payos: PayosService) {}
  @Get('bookings/:id/payment-state') @Roles('GUEST') @Header('Cache-Control', 'no-store')
  bookingState(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.payos.bookingState(id, user); }
  @Post('bookings/:id/payos') @Roles('GUEST') @Header('Cache-Control', 'no-store')
  startBooking(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.payos.startBooking(id, user); }
  @Post('bookings/:id/payos/sync') @Roles('GUEST') @Header('Cache-Control', 'no-store')
  syncBooking(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.payos.syncBooking(id, user); }
  @Post('bookings/:id/payos/cancel') @Roles('GUEST') @Header('Cache-Control', 'no-store')
  cancelBooking(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.payos.cancelBooking(id, user); }
  @Post('invoices/:id/payos') @Roles('GUEST') @Header('Cache-Control', 'no-store')
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.payos.start(id, user); }
  @Post('invoices/:id/payos/sync') @Roles('GUEST') @Header('Cache-Control', 'no-store')
  sync(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.payos.sync(id, user); }
  @Post('payments/payos/webhook') @Public()
  webhook(@Body() body: unknown) { return this.payos.webhook(body); }
}
