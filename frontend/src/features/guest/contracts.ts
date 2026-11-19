import { errorToken, localized, message, safeError, t as tr } from "../../i18n";

import { businessMessage } from "../../i18n/errors";
import { formatMoney } from "../../i18n/format";

import { z } from 'zod';
import { ApiError } from '../../lib/api-client';

export type Page<T> = { data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export type RoomType = { id: string; name: string; description: string | null; nightlyPrice: string; maxGuests: number; bedCount?: number };
export type Room = { id: string; roomNumber: string; floor: number; operationalStatus: string; housekeepingStatus: string; roomType: RoomType; estimatedTotalAmount?: string };
export type Availability = { checkIn: string; checkOut: string; guests: number; nights: number; data: Room[] };
export const bookingStatuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'] as const;
export type Booking = { currentRoomSince?: string | null; holdExpiresAt?: string | null; holdState?: string | null; serverNow?: string; onlinePaymentRequired?: boolean; checkoutRequestedAt?: string | null; id: string; reference: string; roomId: string; roomNumber: string; checkIn: string; checkOut: string; nights: number; guestCount: number; status: typeof bookingStatuses[number]; nightlyPrice: string; totalRoomAmount: string };
export type Service = { id: string; name: string; description: string | null; currentPrice: string; isActive: boolean };
export type Order = { deliveredAt?: string | null; requestedPaymentMethod?: 'CASH' | 'BANK_TRANSFER' | null; payosStatus?: string | null; id: string; bookingId: string; status: 'PENDING' | 'COMPLETED' | 'CANCELLED'; totalAmount: string; orderedAt: string; paymentMethod?: 'CASH' | 'BANK_TRANSFER' | null; paidAt?: string | null; refundedAt?: string | null; items: { id: string; serviceId: string; serviceName: string; quantity: number; unitPrice: string; subtotal: string }[] };
export type Preview = { roomExtension?: { addedNights: number; addedAmount: string }; counterPaidOrders?: Order[]; guestSummary?: { orders: Order[]; serviceAmount: string; totalAmount: string; paidAmount: string; balance: string }; prepaidAmount?: string; paidAmount?: string; balance?: string; roomPayments?: { id: string; amount: string; paidAt: string | null; method?: string }[]; counterPaidAmount?: string; booking: Booking; completedOrders: Order[]; pendingOrderCount: number; roomAmount: string; serviceAmount: string; totalAmount: string };
export type Invoice = { id: string; bookingId: string; booking: Booking; roomAmount: string; serviceAmount: string; totalAmount: string; paidAmount: string; balance: string; status: string; issuedAt: string; payments: { id: string; amount: string; method: string; status: string; paidAt: string | null }[] };
export function calendarDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000') && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value; }
export function nightsBetween(start: string, end: string) { return calendarDate(start) && calendarDate(end) ? (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000 : 0; }
export const staySchema = z.object({ checkIn: z.string().refine(calendarDate, { error: () => tr("guest:contracts.chooseAValidCheckInDate") }), checkOut: z.string().refine(calendarDate, { error: () => tr("guest:contracts.chooseAValidCheckOutDate") }), guests: z.number().int().min(1).max(2147483647), roomTypeId: z.union([z.literal(''), z.string().uuid()]).optional() }).refine(v => nightsBetween(v.checkIn, v.checkOut) > 0, { path: ['checkOut'], error: () => tr("guest:contracts.checkOutMustBeAfterCheckIn") });
export type Stay = z.infer<typeof staySchema>;
export const bookingSchema = staySchema.safeExtend({ roomId: z.string().uuid() });
export function searchParams(stay: Stay) { const p = new URLSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: String(stay.guests) }); if (stay.roomTypeId) p.set('roomTypeId', stay.roomTypeId); return p.toString(); }
export function readStay(p: URLSearchParams) { return staySchema.safeParse({ checkIn: p.get('checkIn') ?? '', checkOut: p.get('checkOut') ?? '', guests: Number(p.get('guests') ?? 2), roomTypeId: p.get('roomTypeId') ?? '' }); }
export function cents(value: string) { if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error('Invalid decimal'); const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')); }
export function decimal(value: bigint) { return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`; }
export function money(value: string) { return formatMoney(value); }
export function guestError(error: Error, action = 'update', token = false) {
  const translate = token ? message : tr;
  if (error instanceof ApiError && businessMessage(error.code)) return token ? error.toMessage() : businessMessage(error.code)!;
 if (error instanceof ApiError && error.status === 0 && action === 'create') return translate("guest:contracts.theOutcomeOfThisRequestIsUncertainCheckYourListBeforeSubmitting"); if (error instanceof ApiError && error.status === 409) return action === 'booking' ? translate("guest:contracts.theRoomIsNoLongerAvailablePleaseSearchAgainForYourStay") : translate("guest:contracts.theStatusHasChangedOrAnInvoiceHasBeenIssuedPleaseReload"); return token ? errorToken(error) : safeError(error); }
export const statusLabels: Record<string, string> = localized(() => ({ PENDING: tr("guest:contracts.pending"), CONFIRMED: tr("guest:contracts.confirmed"), CHECKED_IN: tr("guest:contracts.inHouse"), CHECKED_OUT: tr("guest:contracts.checkedOut"), CANCELLED: tr("guest:bookingStatus.cancelled"), COMPLETED: tr("guest:contracts.completed"), ISSUED: tr("guest:contracts.issued"), UNPAID: tr("guest:contracts.unpaid"), PAID: tr("guest:contracts.paid"), PARTIALLY_PAID: tr("guest:contracts.partiallyPaid") }));
export function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export function formatBookingReference(ref: string): string { if (!ref) return ''; if (isUuid(ref)) return `BK-${ref.slice(0, 8).toUpperCase()}`; return ref; }
