import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { ServicesService } from './services.service.js';
import { ServicesController } from './services.controller.js';

@Module({ imports: [PrismaModule], controllers: [ServicesController], providers: [ServicesService] })
export class ServicesModule {}
