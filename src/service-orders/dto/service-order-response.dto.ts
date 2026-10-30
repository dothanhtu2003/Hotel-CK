import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '../../../generated/prisma/enums.js';
import { PageMetaDto } from '../../common/dto/page-meta.dto.js';

export class ServiceOrderItemResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) serviceId!: string;
  @ApiProperty({ description: 'Current service label; prices use stored snapshots' }) serviceName!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty({ type: String, example: '45000.25' }) unitPrice!: string;
  @ApiProperty({ type: String, example: '90000.50' }) subtotal!: string;
}
export class ServiceOrderResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) bookingId!: string;
  @ApiProperty({ enum: OrderStatus }) status!: OrderStatus;
  @ApiProperty({ type: String, example: '90000.50', description: 'Sum of stored item subtotals, including retained cancelled orders' }) totalAmount!: string;
  @ApiProperty({ format: 'date-time' }) orderedAt!: Date;
  @ApiProperty({ enum: PaymentMethod, nullable: true }) paymentMethod!: PaymentMethod | null;
  @ApiProperty({ format: 'date-time', nullable: true }) paidAt!: Date | null;
  @ApiProperty({ format: 'date-time', nullable: true }) refundedAt!: Date | null;
  @ApiProperty({ type: [ServiceOrderItemResponseDto] }) items!: ServiceOrderItemResponseDto[];
}
export class ServiceOrderPageDto {
  @ApiProperty({ type: [ServiceOrderResponseDto] }) data!: ServiceOrderResponseDto[];
  @ApiProperty({ type: PageMetaDto }) meta!: PageMetaDto;
}
