import { Controller, Get, Header, Patch, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { PublicUser } from './public-user.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

@ApiTags('User Profile')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing/invalid token or inactive account' })
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: UserResponseDto })
  me(@CurrentUser() user: PublicUser) { return user; }

  @Patch('me')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: UserResponseDto })
  update(@CurrentUser() user: PublicUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }
}
