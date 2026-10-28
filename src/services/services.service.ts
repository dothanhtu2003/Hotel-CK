import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { paginationMeta, type PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { serviceSelect, serviceView } from './service-view.js';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    const [services, total] = await this.prisma.client.$transaction([
      this.prisma.client.service.findMany({ where: { isActive: true }, select: serviceSelect, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.client.service.count({ where: { isActive: true } }),
    ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { data: services.map(serviceView), meta: paginationMeta(query, total) };
  }

  async get(id: string) {
    const service = await this.prisma.client.service.findFirst({ where: { id, isActive: true }, select: serviceSelect });
    if (!service) throw new NotFoundException('Service not found');
    return serviceView(service);
  }
}
