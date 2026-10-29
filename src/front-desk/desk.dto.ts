import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto.js";
import { BookingQueryDto } from "../bookings/dto/booking-query.dto.js";
import { CreateBookingDto } from "../bookings/dto/create-booking.dto.js";
import { ServiceOrderQueryDto } from "../service-orders/dto/service-order-query.dto.js";
import { IsStayDate } from "../common/validation/stay-dates.js";
export class DeskQuery extends BookingQueryDto {
  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsStayDate()
  date?: string;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsStayDate()
  checkIn?: string;
  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsStayDate()
  checkOut?: string;
  @ApiPropertyOptional({ enum: ["arrivals", "departures", "staying"] })
  @IsOptional()
  @IsIn(["arrivals", "departures", "staying"])
  view?: string;
}
export class RoomQuery extends PaginationQueryDto {
  @ApiPropertyOptional({ format: "date", description: "Tape chart inclusive start; requires end" })
  @IsOptional()
  @IsStayDate()
  start?: string;
  @ApiPropertyOptional({ format: "date", description: "Tape chart exclusive end; maximum 31 nights" })
  @IsOptional()
  @IsStayDate()
  end?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  roomTypeId?: string;
  @ApiPropertyOptional({ enum: ["ready", "dirty", "occupied"] })
  @IsOptional()
  @IsIn(["ready", "dirty", "occupied"])
  state?: string;
}
export class WalkInDto extends CreateBookingDto {
  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Existing active guest; omit fullName/email/phone when supplied",
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;
  @ApiPropertyOptional({
    maxLength: 120,
    description: "Required with email and phone when creating a new guest",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName?: string;
  @ApiPropertyOptional({ format: "email" })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;
  @ApiPropertyOptional({ minLength: 6, maxLength: 24 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(24)
  phone?: string;
}
export class CustomerQuery {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page = 1;
}
export class DeskOrderQuery extends ServiceOrderQueryDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  bookingId?: string;
}
