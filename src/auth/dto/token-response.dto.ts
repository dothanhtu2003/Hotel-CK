import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class TokenResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ enum: ['Bearer'] }) tokenType!: 'Bearer';
  @ApiProperty({ example: 86400, description: 'Lifetime in seconds: staff defaults to 24 hours; guests to 15 minutes' }) expiresIn!: number;
  @ApiProperty({ type: UserResponseDto }) user!: UserResponseDto;
}
