import { FrontDeskModule } from './front-desk/front-desk.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.js';
import { HealthModule } from './health/health.module.js';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { ServicesModule } from './services/services.module.js';
import { ServiceOrdersModule } from './service-orders/service-orders.module.js';
import { HousekeepingModule } from './housekeeping/housekeeping.module.js';
import { BillingModule } from './billing/billing.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate: validateEnvironment }),
    HealthModule,
    FrontDeskModule,
    AuthModule,
    RoomsModule,
    BookingsModule,
    ServicesModule,
    ServiceOrdersModule,
    HousekeepingModule,
    BillingModule,
  ],
  providers: [
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
})
export class AppModule {}
