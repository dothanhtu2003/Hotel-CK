import { IsOptional, IsUUID, Matches } from 'class-validator';
import { IsStayDate } from '../../common/validation/stay-dates.js';
export class ExtensionPreviewDto {
  @IsStayDate() checkOut!: string;
  @IsStayDate() expectedCheckOut!: string;
}
export class ExtendBookingDto extends ExtensionPreviewDto {
  @IsUUID() requestId!: string;
  @IsOptional() @IsUUID() targetRoomId?: string;
  @Matches(/^[a-f0-9]{64}$/) quoteToken!: string;
}
