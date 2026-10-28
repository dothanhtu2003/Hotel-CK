import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail } from './register.dto.js';

export class LoginDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @Transform(normalizeEmail)
  @IsEmail() @MaxLength(254)
  email!: string;

  @ApiProperty({ writeOnly: true, format: 'password', maxLength: 128 })
  @IsString() @MinLength(1) @MaxLength(128)
  password!: string;
}
