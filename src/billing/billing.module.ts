import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';
import { InvoicesController } from './invoices.controller.js';
import { PayosService } from './payos.service.js';
import { PayosController } from './payos.controller.js';

@Module({ imports: [PrismaModule], controllers: [BillingController, InvoicesController, PayosController], providers: [BillingService, PayosService] })
export class BillingModule {}
