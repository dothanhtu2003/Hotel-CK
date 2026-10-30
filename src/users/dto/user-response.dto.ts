import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountStatus, Role } from '../../../generated/prisma/enums.js';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ format: 'email', nullable: true }) email!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty({ enum: Role }) role!: Role;
  @ApiProperty({ enum: AccountStatus }) status!: AccountStatus;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}
