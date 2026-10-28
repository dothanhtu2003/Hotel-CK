import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { IsStayDate } from '../../common/validation/stay-dates.js';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() roomId!: string;
  @ApiProperty({ type: String, format: 'date' }) @IsStayDate() checkIn!: string;
  @ApiProperty({ type: String, format: 'date' }) @IsStayDate() checkOut!: string;
  @ApiProperty({ minimum: 1, maximum: 2147483647 }) @IsInt() @Min(1) @Max(2147483647) guests!: number;
}
