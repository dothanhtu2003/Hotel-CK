import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 24, description: 'Phone number; null clears the current number' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(/^\+?[0-9][0-9 ()-]{5,22}[0-9]$/)
  @MaxLength(24)
  phone?: string | null;
}
