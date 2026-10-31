import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '../../../generated/prisma/enums.js';
import { PageMetaDto } from '../../common/dto/page-meta.dto.js';

export class BookingResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() reference!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty() roomNumber!: string;
  @ApiProperty({ format: 'date' }) checkIn!: string;
  @ApiProperty({ format: 'date' }) checkOut!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) checkoutRequestedAt!: Date | null;
  @ApiProperty() nights!: number;
  @ApiProperty() guestCount!: number;
  @ApiProperty({ enum: BookingStatus }) status!: BookingStatus;
  @ApiProperty({ type: String, example: '650000.00', description: 'Database price snapshot, VND decimal string' }) nightlyPrice!: string;
  @ApiProperty({ type: String, example: '1950000.00' }) totalRoomAmount!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
export class BookingPageDto {
  @ApiProperty({ type: [BookingResponseDto] }) data!: BookingResponseDto[];
  @ApiProperty({ type: PageMetaDto }) meta!: PageMetaDto;
}
