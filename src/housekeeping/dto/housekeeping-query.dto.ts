import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { HousekeepingStatus, OperationalStatus, TaskStatus } from '../../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export class HousekeepingTaskQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TaskStatus }) @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() roomId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'HOUSEKEEPING may only select their own ID' }) @IsOptional() @IsUUID() assignedStaffId?: string;
}
export class HousekeepingBoardQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: HousekeepingStatus }) @IsOptional() @IsEnum(HousekeepingStatus) housekeepingStatus?: HousekeepingStatus;
  @ApiPropertyOptional({ enum: OperationalStatus }) @IsOptional() @IsEnum(OperationalStatus) operationalStatus?: OperationalStatus;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() roomTypeId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() roomId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter the assignee of the open task; HOUSEKEEPING is always scoped to self' }) @IsOptional() @IsUUID() assignedStaffId?: string;
}
