import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export const normalizeEmail = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(120)
  fullName!: string;

  @ApiProperty({ format: 'email', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsEmail() @MaxLength(254)
  email!: string;

  @ApiProperty({ writeOnly: true, format: 'password', minLength: 1, description: 'Non-empty password; never trimmed' })
  @IsString() @MinLength(1)
  password!: string;

  @ApiPropertyOptional({ maxLength: 24 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString() @Matches(/^\+?[0-9][0-9 ()-]{5,22}[0-9]$/) @MaxLength(24)
  phone?: string;
}
