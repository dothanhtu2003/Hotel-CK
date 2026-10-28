import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';
import { InvoicesController } from './invoices.controller.js';

@Module({ imports: [PrismaModule], controllers: [BillingController, InvoicesController], providers: [BillingService] })
export class BillingModule {}
