import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';
import { InvoicesController } from './invoices.controller.js';
import { PayosService } from './payos.service.js';
import { RevenueController } from './revenue.controller.js';
import { PayosController } from './payos.controller.js';

@Module({ imports: [PrismaModule], controllers: [BillingController, InvoicesController, PayosController, RevenueController], providers: [BillingService, PayosService], exports:[PayosService] })
export class BillingModule {}
