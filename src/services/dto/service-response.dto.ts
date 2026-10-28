import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../common/dto/page-meta.dto.js';

export class ServiceResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, example: '45000.25', description: 'Current price in VND, decimal string' }) currentPrice!: string;
  @ApiProperty() isActive!: boolean;
}
export class ServicePageDto {
  @ApiProperty({ type: [ServiceResponseDto] }) data!: ServiceResponseDto[];
  @ApiProperty({ type: PageMetaDto }) meta!: PageMetaDto;
}
