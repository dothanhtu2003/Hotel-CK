import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize = 20;
}

export function paginationMeta(query: PaginationQueryDto, total: number) {
  return { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
}
