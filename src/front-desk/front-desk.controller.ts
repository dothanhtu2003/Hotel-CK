import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { PublicUser } from "../users/public-user.js";
import {
  BillingQuery,
  BookingCountsQueryDto,
  CustomerQuery,
  DeskOrderQuery,
  DeskQuery,
  RoomQuery,
  WalkInDto,
} from "./desk.dto.js";
import { RoomsService } from "../rooms/rooms.service.js";
import { AvailabilityQueryDto } from "../rooms/dto/availability-query.dto.js";
import { FrontDeskService } from "./front-desk.service.js";
import { UpdateRoomConditionDto } from './room-condition.dto.js';
@ApiTags("Front desk")
@ApiBearerAuth()
@Roles("RECEPTIONIST", "ADMIN")
@Controller("front-desk")
export class FrontDeskController {
  constructor(
    private readonly desk: FrontDeskService,
    private readonly roomService: RoomsService,
  ) {}
  @Header("Cache-Control", "no-store") @Get("available") available(
    @Query() q: AvailabilityQueryDto,
  ) {
    return this.roomService.available(q, true);
  }
  @Header("Cache-Control", "no-store") @Get("room-filters") filters() {
    return this.desk.roomFilters();
  }
  @Header("Cache-Control", "no-store") @Get("dashboard") dashboard() {
    return this.desk.dashboard();
  }
  @Header("Cache-Control", "no-store") @Get("booking-counts") bookingCounts(
    @Query() q: BookingCountsQueryDto,
  ) {
    return this.desk.bookingCounts(q.date);
  }
  @Header("Cache-Control", "no-store") @Get("billing") billing(@Query() q: BillingQuery) {
    return this.desk.billing(q);
  }
  @Header("Cache-Control", "no-store") @Get("bookings") bookings(
    @Query() q: DeskQuery,
  ) {
    return this.desk.bookings(q);
  }
  @Header("Cache-Control", "no-store") @Get("bookings/:id") detail(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.desk.detail(id);
  }
  @Header("Cache-Control", "no-store") @Get("orders") orders(
    @Query() q: DeskOrderQuery,
  ) {
    return this.desk.orders(q);
  }
  @Header("Cache-Control", "no-store") @Get("rooms") rooms(
    @Query() q: RoomQuery,
  ) {
    return this.desk.rooms(q);
  }
  @Header('Cache-Control', 'no-store') @Patch('rooms/:id/condition') updateRoomCondition(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: PublicUser,
    @Body() dto: UpdateRoomConditionDto,
  ) {
    return this.desk.updateRoomCondition(id, actor, dto);
  }
  @Header("Cache-Control", "no-store") @Get("customers") customers(
    @Query() q: CustomerQuery,
  ) {
    return this.desk.customers(q);
  }
  @Header("Cache-Control", "no-store") @Post("walk-in") walkIn(
    @CurrentUser() actor: PublicUser,
    @Body() dto: WalkInDto,
  ) {
    return this.desk.walkIn(actor.id, dto);
  }
}
