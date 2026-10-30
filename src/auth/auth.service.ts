import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service.js';
import { publicUserSelect, type PublicUser } from '../users/public-user.js';
import { PasswordService } from './password.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  async register(dto: RegisterDto) {
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      return await this.prisma.client.user.create({
        data: { fullName: dto.fullName, email: dto.email.trim().toLowerCase(), passwordHash, phone: dto.phone, role: 'GUEST', status: 'ACTIVE' },
        select: publicUserSelect,
      });
    } catch (error) {
      // Handle the UNIQUE race at INSERT; a SELECT-before-INSERT is insufficient.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new ConflictException('Email is already registered');
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.client.user.findUnique({ where: { email: dto.email.trim().toLowerCase() }, select: { ...publicUserSelect, passwordHash: true } });
    const valid = await this.passwords.verify(user?.passwordHash, dto.password);
    if (!user || !valid || user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid email or password');
    const expiresIn = this.config.getOrThrow<number>(user.role === 'GUEST' ? 'JWT_ACCESS_TTL_SECONDS' : 'JWT_STAFF_TTL_SECONDS');
    const accessToken = await this.jwt.signAsync({ sub: user.id, tokenType: 'access' }, { expiresIn });
    // Return a fresh allowlisted object; never spread a record containing passwordHash.
    const safeUser: PublicUser = { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, role: user.role, status: user.status, createdAt: user.createdAt, updatedAt: user.updatedAt };
    return { accessToken, tokenType: 'Bearer' as const, expiresIn, user: safeUser };
  }
}
