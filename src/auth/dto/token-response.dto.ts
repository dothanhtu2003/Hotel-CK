import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';

export class TokenResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ enum: ['Bearer'] }) tokenType!: 'Bearer';
  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' }) expiresIn!: number;
  @ApiProperty({ type: UserResponseDto }) user!: UserResponseDto;
}
