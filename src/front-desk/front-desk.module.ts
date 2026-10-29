import { Module } from "@nestjs/common";
import { RoomsModule } from "../rooms/rooms.module.js";
import { PrismaModule } from "../database/prisma.module.js";
import { FrontDeskController } from "./front-desk.controller.js";
import { FrontDeskService } from "./front-desk.service.js";
@Module({
  imports: [PrismaModule, RoomsModule],
  controllers: [FrontDeskController],
  providers: [FrontDeskService],
})
export class FrontDeskModule {}
