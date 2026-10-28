import { ApiProperty } from '@nestjs/swagger';
import { HousekeepingStatus, OperationalStatus } from '../../../generated/prisma/enums.js';
import { PageMetaDto } from '../../common/dto/page-meta.dto.js';

export class RoomTypeResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, example: '650000.00', description: 'Current catalog price (VND), decimal string' }) nightlyPrice!: string;
  @ApiProperty() maxGuests!: number;
}
export class RoomResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() roomNumber!: string;
  @ApiProperty() floor!: number;
  @ApiProperty({ enum: OperationalStatus }) operationalStatus!: OperationalStatus;
  @ApiProperty({ enum: HousekeepingStatus, description: 'Current cleanliness; independent of date-based occupancy' }) housekeepingStatus!: HousekeepingStatus;
  @ApiProperty({ type: RoomTypeResponseDto }) roomType!: RoomTypeResponseDto;
}
export class RoomPageDto {
  @ApiProperty({ type: [RoomResponseDto] }) data!: RoomResponseDto[];
  @ApiProperty({ type: PageMetaDto }) meta!: PageMetaDto;
}
export class AvailableRoomDto extends RoomResponseDto {
  @ApiProperty({ type: String, example: '1950000.00', description: 'Estimate only; final snapshot is calculated by the database at booking time' }) estimatedTotalAmount!: string;
}
export class AvailabilityResponseDto {
  @ApiProperty({ format: 'date' }) checkIn!: string;
  @ApiProperty({ format: 'date' }) checkOut!: string;
  @ApiProperty() guests!: number;
  @ApiProperty() nights!: number;
  @ApiProperty({ type: [AvailableRoomDto] }) data!: AvailableRoomDto[];
}
