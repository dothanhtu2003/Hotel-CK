import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() roomId!: string;
  @ApiPropertyOptional({ maxLength: 2000 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MaxLength(2000) notes?: string;
}
export class AssignTaskDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() assignedStaffId!: string;
}
