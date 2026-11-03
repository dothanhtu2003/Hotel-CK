import { BillingModule } from '../billing/billing.module.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({ imports: [PrismaModule, BillingModule], controllers: [BookingsController], providers: [BookingsService] })
export class BookingsModule {}
