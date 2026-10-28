import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { IsStayDate } from '../../common/validation/stay-dates.js';

export class AvailabilityQueryDto {
  @ApiProperty({ type: String, format: 'date' }) @IsStayDate()
  checkIn!: string;

  @ApiProperty({ type: String, format: 'date' }) @IsStayDate()
  checkOut!: string;

  @ApiProperty({ minimum: 1, maximum: 2147483647 })
  @Type(() => Number) @IsInt() @Min(1) @Max(2147483647)
  guests!: number;

  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  roomTypeId?: string;
}
