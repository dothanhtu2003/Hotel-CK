import { Body, Controller, Get, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import type { PublicUser } from '../users/public-user.js';
import { UserResponseDto } from '../users/dto/user-response.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { TokenResponseDto } from './dto/token-response.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'Email already registered' })
  @ApiTooManyRequestsResponse({ description: 'Too many registration attempts from this IP' })
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Public()
  @Post('login')
  @HttpCode(200)
  @UseGuards(AuthRateLimitGuard)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or disabled account' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts from this IP' })
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Get('me')
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  me(@CurrentUser() user: PublicUser) { return user; }
}
