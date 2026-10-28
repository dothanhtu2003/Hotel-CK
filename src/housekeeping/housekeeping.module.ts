import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { HousekeepingController } from './housekeeping.controller.js';
import { HousekeepingService } from './housekeeping.service.js';

@Module({ imports: [PrismaModule], controllers: [HousekeepingController], providers: [HousekeepingService] })
export class HousekeepingModule {}
