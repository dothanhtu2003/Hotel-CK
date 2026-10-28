import { Body, Controller, Get, Header, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { PublicUser } from '../users/public-user.js';
import { BillingService } from './billing.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { InvoiceResponseDto, RecordPaymentResponseDto } from './dto/billing-response.dto.js';

@ApiTags('Billing') @ApiBearerAuth() @Roles('GUEST', 'RECEPTIONIST', 'ADMIN')
@ApiUnauthorizedResponse({ description: 'Authentication required' }) @ApiForbiddenResponse({ description: 'Role not allowed' })
@ApiNotFoundResponse({ description: 'Invoice missing or not accessible' }) @ApiConflictResponse({ description: 'Duplicate request mismatch, overpayment or concurrent change' })
@ApiBadRequestResponse({ description: 'Invalid amount, method, UUID or idempotency key' })
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly billing: BillingService) {}
  @Get(':id') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: InvoiceResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.billing.getInvoice(id, user); }

  @Post(':id/payments') @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store')
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Generate a fresh UUID per actual receipt. Reuse the same UUID and payload only when retrying that receipt.' })
  @ApiCreatedResponse({ type: RecordPaymentResponseDto })
  pay(@Param('id', ParseUUIDPipe) id: string, @Headers('idempotency-key') key: unknown, @Body() dto: CreatePaymentDto, @CurrentUser() user: PublicUser) { return this.billing.pay(id, key, dto, user); }
}
