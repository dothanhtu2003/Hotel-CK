import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class SettleServiceOrderDto {
  @ApiProperty({ enum: ['ROOM', 'CASH', 'BANK_TRANSFER'] })
  @IsIn(['ROOM', 'CASH', 'BANK_TRANSFER']) settlement!: 'ROOM' | 'CASH' | 'BANK_TRANSFER';

  @ApiPropertyOptional({ description: 'Staff confirmed actual receipt of cash/bank transfer' })
  @IsOptional() @IsBoolean() @Equals(true) paymentVerified?: boolean;

  @ApiPropertyOptional({ description: 'Expected full amount when collecting at the counter' })
  @IsOptional() @IsString() @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/) expectedAmount?: string;
}

export class CancelServiceOrderDto {
  @ApiPropertyOptional({ description: 'Confirm full refund already returned to the guest' })
  @IsOptional() @IsBoolean() @Equals(true) refundConfirmed?: boolean;
}
