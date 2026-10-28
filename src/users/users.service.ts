import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { publicUserSelect } from './public-user.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(id: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id }, select: publicUserSelect });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Authentication required');
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    if (dto.fullName === undefined && dto.phone === undefined) throw new BadRequestException('Provide fullName or phone');
    // Explicit allowlist prevents mass assignment even when called outside the HTTP pipe.
    return this.prisma.client.$transaction(async tx => {
      const result = await tx.user.updateMany({
        where: { id, status: 'ACTIVE' },
        data: { ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}), ...(dto.phone !== undefined ? { phone: dto.phone } : {}) },
      });
      if (result.count !== 1) throw new UnauthorizedException('Authentication required');
      return tx.user.findUniqueOrThrow({ where: { id }, select: publicUserSelect });
    });
  }
}
