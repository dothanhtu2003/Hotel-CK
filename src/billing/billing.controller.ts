import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { PublicUser } from '../users/public-user.js';
import { EmptyBodyPipe } from '../common/validation/empty-body.pipe.js';
import { BillingService } from './billing.service.js';
import { BillingPreviewDto, CheckoutResponseDto, InvoiceResponseDto } from './dto/billing-response.dto.js';

@ApiTags('Billing') @ApiBearerAuth() @Roles('GUEST', 'RECEPTIONIST', 'ADMIN')
@ApiUnauthorizedResponse({ description: 'Authentication required' }) @ApiForbiddenResponse({ description: 'Role not allowed' })
@ApiNotFoundResponse({ description: 'Resource missing or not accessible' }) @ApiConflictResponse({ description: 'Billing conditions or concurrent state do not allow this action' })
@ApiBadRequestResponse({ description: 'Invalid input or UUID' })
@Controller('bookings')
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get(':id/billing-preview') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: BillingPreviewDto })
  preview(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.billing.preview(id, user); }

  @Post(':id/invoice') @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store')
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } }) @ApiCreatedResponse({ type: InvoiceResponseDto })
  issue(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser, @Body(new EmptyBodyPipe()) _body: unknown) { return this.billing.issue(id, user); }

  @Get(':id/invoice') @Header('Cache-Control', 'no-store') @ApiOkResponse({ type: InvoiceResponseDto })
  invoice(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser) { return this.billing.getInvoice(id, user, true); }

  @Patch(':id/check-out') @Roles('RECEPTIONIST', 'ADMIN') @Header('Cache-Control', 'no-store')
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } }) @ApiOkResponse({ type: CheckoutResponseDto })
  checkout(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: PublicUser, @Body(new EmptyBodyPipe()) _body: unknown) { return this.billing.checkout(id, user); }
}
