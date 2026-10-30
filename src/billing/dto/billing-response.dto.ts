import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus, PaymentMethod, PaymentStatus, HousekeepingStatus, OperationalStatus, TaskStatus } from '../../../generated/prisma/enums.js';
import { BookingResponseDto } from '../../bookings/dto/booking-response.dto.js';
import { ServiceOrderResponseDto } from '../../service-orders/dto/service-order-response.dto.js';
import { OmitType } from '@nestjs/swagger';

export class BillingBookingDto extends OmitType(BookingResponseDto, ['userId'] as const) {}
export class BillingPreviewDto {
  @ApiProperty({ type: BillingBookingDto }) booking!: BillingBookingDto;
  @ApiProperty({ type: [ServiceOrderResponseDto] }) completedOrders!: ServiceOrderResponseDto[];
  @ApiProperty() pendingOrderCount!: number;
  @ApiProperty({ type: String, description: 'Services already paid separately at the counter; excluded from this invoice' }) counterPaidAmount!: string;
  @ApiProperty({ type: String }) roomAmount!: string;
  @ApiProperty({ type: String }) serviceAmount!: string;
  @ApiProperty({ type: String }) totalAmount!: string;
}
export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The client-supplied Idempotency-Key' }) id!: string;
  @ApiProperty({ format: 'uuid' }) invoiceId!: string;
  @ApiProperty({ type: String }) amount!: string;
  @ApiProperty({ enum: PaymentMethod }) method!: PaymentMethod;
  @ApiProperty({ enum: PaymentStatus }) status!: PaymentStatus;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) paidAt!: Date | null;
}
export class InvoiceResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) bookingId!: string;
  @ApiProperty({ type: String }) roomAmount!: string;
  @ApiProperty({ type: String }) serviceAmount!: string;
  @ApiProperty({ type: String }) totalAmount!: string;
  @ApiProperty({ enum: InvoiceStatus }) status!: InvoiceStatus;
  @ApiProperty({ format: 'date-time' }) issuedAt!: Date;
  @ApiProperty({ type: String }) paidAmount!: string;
  @ApiProperty({ type: String }) balance!: string;
  @ApiProperty({ type: BillingBookingDto }) booking!: BillingBookingDto;
  @ApiProperty({ type: [PaymentResponseDto] }) payments!: PaymentResponseDto[];
}
export class RecordPaymentResponseDto {
  @ApiProperty({ type: PaymentResponseDto }) payment!: PaymentResponseDto;
  @ApiProperty() replayed!: boolean;
  @ApiProperty({ type: InvoiceResponseDto }) invoice!: InvoiceResponseDto;
}
export class CheckoutRoomDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: HousekeepingStatus }) housekeepingStatus!: HousekeepingStatus;
  @ApiProperty({ enum: OperationalStatus }) operationalStatus!: OperationalStatus;
}
export class CheckoutTaskDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: TaskStatus }) status!: TaskStatus;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) assignedStaffId!: string | null;
}
export class CheckoutResponseDto {
  @ApiProperty({ type: BillingBookingDto }) booking!: BillingBookingDto;
  @ApiProperty({ type: InvoiceResponseDto }) invoice!: InvoiceResponseDto;
  @ApiProperty({ type: CheckoutRoomDto }) room!: CheckoutRoomDto;
  @ApiProperty({ type: CheckoutTaskDto, nullable: true }) housekeepingTask!: CheckoutTaskDto | null;
}
