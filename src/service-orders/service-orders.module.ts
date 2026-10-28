import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { ServiceOrdersController } from './service-orders.controller.js';
import { ServiceOrdersService } from './service-orders.service.js';

@Module({ imports: [PrismaModule], controllers: [ServiceOrdersController], providers: [ServiceOrdersService] })
export class ServiceOrdersModule {}
