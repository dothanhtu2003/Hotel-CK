import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({ imports: [PrismaModule], controllers: [BookingsController], providers: [BookingsService] })
export class BookingsModule {}
