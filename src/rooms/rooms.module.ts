import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({ imports: [PrismaModule], controllers: [RoomsController], providers: [RoomsService] })
export class RoomsModule {}
