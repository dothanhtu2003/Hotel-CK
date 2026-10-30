import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { HousekeepingStatus, OperationalStatus } from '../../generated/prisma/enums.js';

export class UpdateRoomConditionDto {
  @ApiProperty({ enum: ['CLEAN', 'MAINTENANCE'] }) @IsIn(['CLEAN', 'MAINTENANCE'])
  condition!: 'CLEAN' | 'MAINTENANCE';
  @ApiProperty({ enum: OperationalStatus }) @IsEnum(OperationalStatus)
  expectedOperationalStatus!: OperationalStatus;
  @ApiProperty({ enum: HousekeepingStatus }) @IsEnum(HousekeepingStatus)
  expectedHousekeepingStatus!: HousekeepingStatus;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() @Equals(true)
  completeOpenTasks?: boolean;
  @ApiPropertyOptional({ maxLength: 500 }) @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}
