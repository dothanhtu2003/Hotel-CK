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

  @ApiProperty({ writeOnly: true, format: 'password', minLength: 12, maxLength: 128, description: 'At least 12 characters including a letter and a digit; never trimmed' })
  @IsString() @MinLength(12) @MaxLength(128)
  @Matches(/^(?=[\s\S]*\p{L})(?=[\s\S]*\p{N})[\s\S]+$/u, { message: 'password must contain a letter and a digit' })
  password!: string;

  @ApiPropertyOptional({ maxLength: 24 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString() @Matches(/^\+?[0-9][0-9 ()-]{5,22}[0-9]$/) @MaxLength(24)
  phone?: string;
}
