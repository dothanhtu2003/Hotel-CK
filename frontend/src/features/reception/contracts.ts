import { errorToken, message, safeError, t as tr } from "../../i18n";

import { businessMessage } from "../../i18n/errors";

import { z } from 'zod';
import { statusLabels, cents, type Booking, type Invoice } from '../guest/contracts';
import { ApiError } from '../../lib/api-client';

export type Customer = { id: string; fullName: string; email: string | null; phone: string | null };
export type DeskBookingCounts = { arrivals: number; departures: number; staying: number };
export type DeskBooking = Booking & { roomPaidAmount?: string; userId: string; createdAt: string; updatedAt: string; customer?: Customer; room?: import('../guest/contracts').Room; openTaskCount?: number };
export type DeskRoom = import('../guest/contracts').Room & { bookings: DeskBooking[]; openTaskCount: number; awaitingHousekeepingStart?: boolean; housekeepingAssignees?: string[] };
export type Dashboard = { today: string; totalRooms: number; occupiedRooms: number; openTasks: number; bookingCounts?: Record<'arrivals'|'departures'|'staying',number>; counts: Record<'arrivals'|'departures'|'staying'|'ready'|'dirty'|'orders'|'pending',number>; arrivals: DeskBooking[]; departures: DeskBooking[] };
export type Checkout = { booking: Booking; invoice: Invoice; room: { id: string; housekeepingStatus: string; operationalStatus: string }; housekeepingTask: { id: string; status: string; assignedStaffId: string | null } | null };
export type PaymentResult = { payment: Invoice['payments'][number]; invoice: Invoice; replayed: boolean };
export const paymentSchema = z.object({
  amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/, { error: () => tr("reception:contracts.enterAnAmountWithADecimalPointAndUpTo2Decimal") }).refine(v => /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(v) && cents(v) > 0n, { error: () => tr("reception:contracts.theAmountMustBeGreaterThanZero") }),
  method: z.enum(['CASH', 'BANK_TRANSFER']),
});
export type PaymentInput = z.infer<typeof paymentSchema>;
export function paymentWithinBalance(amount: string, balance: string) { const valid = paymentSchema.shape.amount.safeParse(amount); return valid.success && cents(valid.data) <= cents(balance); }
export function canIssue(b: Booking, pending: number, invoice: Invoice | null) { return b.status === 'CHECKED_IN' && pending === 0 && invoice === null; }
export function canCheckout(b: Booking, pending: number, invoice: Invoice | null) { return b.status === 'CHECKED_IN' && pending === 0 && invoice?.status === 'PAID' && cents(invoice.balance) === 0n; }
export function pageNumber(value: string | null) { const n = Number(value); return Number.isInteger(n) && n >= 1 && n <= 1000000 ? n : 1; }
export function deskError(error: Error, action = '', token = false) {
  const translate = token ? message : tr;
  if (error instanceof ApiError && businessMessage(error.code)) return token ? error.toMessage() : businessMessage(error.code)!;

  if (error instanceof ApiError && error.status === 409) {
    if (action === 'booking') {
      if (error.code === 'WALK_IN_CUSTOMER_EXISTS') return translate("reception:contracts.thisGuestAlreadyHasARecordCloseTheConfirmationChooseFindExisting");
      if (error.code === 'WALK_IN_ROOM_NOT_READY') return translate("reception:contracts.theRoomIsNotReadyItMustBeActiveCleanAndHave");
      if (error.code === 'WALK_IN_ROOM_OCCUPIED') return translate("reception:contracts.theRoomIsOccupiedPleaseChooseAnotherRoom");
      return translate("reception:contracts.theRoomOrGuestRecordHasChangedCheckAnyCreatedReservationsSearch");
    }
    if (action === 'check-in') return translate("reception:contracts.unableToCheckInCheckStayDatesActiveGuestActiveCleanRoom");
    if (action === 'invoice') return translate("reception:contracts.unableToIssueAnInvoiceTheGuestMustBeInHouseWith");
    if (action === 'check-out') return translate("reception:contracts.unableToCheckOutTheGuestMustBeInHouseTheInvoice");
    if (action === 'cancel') return translate("reception:contracts.unableToCancelPayosIsProcessingOrHasReceivedMoneyCheckPayment");
    if (action === 'payment') return translate("reception:contracts.theReceiptWasRejectedTheBalanceMayHaveChangedOrTheRequest");
    return translate("reception:contracts.theStatusChangedOrAnInvoiceExistsReloadTheDataBeforeProceeding");
  }
  if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) return translate("reception:contracts.theOutcomeOfThisActionIsUncertainCheckTheLatestDataBefore");
  return token ? errorToken(error) : safeError(error);
}

export function awaitingOnlinePayment(b: Pick<Booking, 'status' | 'onlinePaymentRequired'>) {
  return b.status === 'PENDING' && b.onlinePaymentRequired === true;
}
export function deskBookingStatusLabel(b: Pick<Booking, 'status' | 'onlinePaymentRequired' | 'holdState'>) {
  if (b.holdState === 'EXPIRED') return tr("reception:contracts.paymentExpired");
  if (b.holdState === 'CHECKING_PAYMENT') return tr("reception:contracts.paymentVerificationInProgress");
  if (awaitingOnlinePayment(b)) return tr("reception:contracts.awaitingPayment");
  if (b.status === 'PENDING') return tr("reception:contracts.awaitingConfirmation");
  if (b.status === 'CONFIRMED') return tr("reception:contracts.awaitingCheckIn");
  return statusLabels[b.status] ?? tr("common:status.unknown");
}
