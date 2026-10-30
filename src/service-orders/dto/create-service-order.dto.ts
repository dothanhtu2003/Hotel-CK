import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { IsOptional } from 'class-validator';
import { SettleServiceOrderDto } from './settle-service-order.dto.js';

export class CreateServiceOrderItemDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() serviceId!: string;
  @ApiProperty({ minimum: 1, maximum: 2147483647 }) @IsInt() @Min(1) @Max(2147483647) quantity!: number;
}
export class CreateServiceOrderDto extends PartialType(SettleServiceOrderDto) {
  @IsOptional() @IsUUID() requestId?: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() bookingId!: string;
  @ApiProperty({ type: [CreateServiceOrderItemDto], minItems: 1, maxItems: 50, description: 'Each serviceId may appear once; increase quantity for multiples' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ArrayUnique<CreateServiceOrderItemDto>(item => typeof item?.serviceId === 'string' ? item.serviceId.toLowerCase() : item)
  @ValidateNested({ each: true }) @Type(() => CreateServiceOrderItemDto)
  items!: CreateServiceOrderItemDto[];
}
