import { t, type TranslationKey } from './index';

export const businessErrorKeys = {
  INVALID_CREDENTIALS: 'common:errors.invalidCredentials',
  ROOM_UNAVAILABLE: 'guest:contracts.theRoomIsNoLongerAvailablePleaseSearchAgainForYourStay',
  BOOKING_HOLD_LIMIT: 'common:errors.bookingHoldLimit',
  PAYMENT_VERIFICATION_REQUIRED: 'reception:paymentForm.theTransactionIsStillAwaitingVerificationCheckPaymentBeforeCollectingMore',
  WALK_IN_CUSTOMER_EXISTS: 'reception:contracts.thisGuestAlreadyHasARecordCloseTheConfirmationChooseFindExisting',
  WALK_IN_ROOM_NOT_READY: 'reception:contracts.theRoomIsNotReadyItMustBeActiveCleanAndHave',
  WALK_IN_ROOM_OCCUPIED: 'reception:contracts.theRoomIsOccupiedPleaseChooseAnotherRoom',
  EXTENSION_CHANGED: 'common:apiClient.thisOptionCannotBeAppliedTheInvoiceIsFinalizedOrRoomAvailability',
  EXTENSION_INVALID_DATE: 'common:apiClient.theNewCheckOutDateMustFollowTheCurrentCheckOutDate',
  EXTENSION_INVOICED: 'common:apiClient.theInvoiceIsFinalizedCompleteTheCurrentStayBeforeStartingANew',
  EXTEND_ROOM_OVERLAP: 'common:apiClient.theRoomHasAnotherReservationDuringTheExtensionCheckTheRoomCalendar',
  ROOM_CHANGED: 'common:errors.roomChanged', ROOM_OCCUPIED: 'common:errors.roomOccupied',
  ROOM_TASK_CONFIRMATION_REQUIRED: 'common:errors.roomTaskConfirmation',
  OVERDUE_STAY_UNSETTLED: 'common:errors.overdueStay',
} satisfies Record<string, TranslationKey>;

export function businessMessage(code: string | undefined): string | undefined {
  return code && Object.hasOwn(businessErrorKeys, code) ? t(businessErrorKeys[code as keyof typeof businessErrorKeys]) : undefined;
}
