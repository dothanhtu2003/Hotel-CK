import { ApiProperty } from '@nestjs/swagger';
import { HousekeepingStatus, OperationalStatus, TaskStatus } from '../../../generated/prisma/enums.js';
import { PageMetaDto } from '../../common/dto/page-meta.dto.js';

export class AssignedStaffDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
}
export class HousekeepingRoomTypeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
}
export class HousekeepingRoomDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() roomNumber!: string;
  @ApiProperty() floor!: number;
  @ApiProperty({ enum: HousekeepingStatus }) housekeepingStatus!: HousekeepingStatus;
  @ApiProperty({ enum: OperationalStatus }) operationalStatus!: OperationalStatus;
  @ApiProperty({ type: HousekeepingRoomTypeDto }) roomType!: HousekeepingRoomTypeDto;
}
export class TaskSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) roomId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) assignedStaffId!: string | null;
  @ApiProperty({ enum: TaskStatus }) status!: TaskStatus;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) completedAt!: Date | null;
  @ApiProperty({ type: AssignedStaffDto, nullable: true }) assignedStaff!: AssignedStaffDto | null;
}
export class TaskResponseDto extends TaskSummaryDto {
  @ApiProperty({ type: HousekeepingRoomDto }) room!: HousekeepingRoomDto;
}
export class BoardRoomDto extends HousekeepingRoomDto {
  @ApiProperty({ type: TaskSummaryDto, nullable: true }) openTask!: TaskSummaryDto | null;
}
export class HousekeepingBoardPageDto {
  @ApiProperty({ type: [BoardRoomDto] }) data!: BoardRoomDto[];
  @ApiProperty({ type: PageMetaDto }) meta!: PageMetaDto;
}
export class HousekeepingTaskPageDto {
  @ApiProperty({ type: [TaskResponseDto] }) data!: TaskResponseDto[];
  @ApiProperty({ type: PageMetaDto }) meta!: PageMetaDto;
}
