import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { PaymentMethod } from '../../../generated/prisma/enums.js';

export class CreatePaymentDto {
  @IsOptional() @IsBoolean() checkout?: boolean;
  @ApiProperty({ type: String, example: '650000.25', description: 'Positive VND decimal string, up to 12 integer digits and 2 fractional digits. No exponent or floating-point JSON number.' })
  @IsString() @MaxLength(15) @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Counter staff records money already received/verified. BANK_TRANSFER does not call or verify a bank gateway.' })
  @IsEnum(PaymentMethod) method!: PaymentMethod;
}
