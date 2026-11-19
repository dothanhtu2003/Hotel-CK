import { t as tr, localized } from "../../i18n";
import { ChartNoAxesCombined, CalendarDays, BedDouble, Brush, ConciergeBell, ReceiptText, type LucideIcon } from 'lucide-react';
import type { Role } from '../auth/contracts';
export interface WorkspaceFeature { slug: string; title: string; description: string; icon: LucideIcon }
const booking = localized(() => ({ slug: 'bookings', title: tr("common:navigation.reservations"), description: tr("common:navigation.findARoomAndManageYourStay"), icon: BedDouble }));
const service = localized(() => ({ slug: 'services', title: tr("common:navigation.roomService"), description: tr("common:navigation.amenitiesForACompleteGetaway"), icon: ConciergeBell }));
const housekeeping = localized(() => ({ slug: 'board', title: tr("common:navigation.housekeeping"), description: tr("common:navigation.trackAndCompleteYourAssignedTasks"), icon: Brush }));
const tasks = localized(() => ({ ...housekeeping, slug: 'tasks', title: tr("common:navigation.myTasks"), description: tr("common:navigation.assignedTasksAndCompletionHistory") }));
const deskHousekeeping = localized(() => ({ ...housekeeping, slug: 'housekeeping', description: tr("common:navigation.viewRoomsCreateAndAssignHousekeepingTasks") }));
const billing = localized(() => ({ slug: 'billing', title: tr("common:navigation.invoicesPayments"), description: tr("common:navigation.viewStayChargesAndPaymentDetails"), icon: ReceiptText }));
const revenue = localized(() => ({ slug: 'revenue', title: tr("common:navigation.revenue"), description: tr("common:navigation.trackCollectedPaymentsAndReconcileTransactions"), icon: ChartNoAxesCombined }));
const deskBooking = localized(() => ({ ...booking, title: tr("common:navigation.manageReservations"), description: tr("common:navigation.confirmReservationsCheckInGuestsAndManageStays") }));
const deskService = localized(() => ({ ...service, slug: 'service-orders', title: tr("common:navigation.serviceOrders"), description: tr("common:navigation.trackAndProcessGuestServiceOrders") }));
const deskRooms = localized(() => ({ ...booking, slug: 'rooms', title: tr("common:navigation.roomStatusBoard"), description: tr("common:navigation.roomAvailabilityAndOccupancy") }));
const tapeChart = localized(() => ({ ...deskRooms, slug: 'tape-chart', title: tr("common:navigation.tapeChart"), icon: CalendarDays }));
export const featuresForRole: Record<Role, WorkspaceFeature[]> = {
  GUEST: [booking, service, billing],
  RECEPTIONIST: [deskBooking, tapeChart, deskService, deskHousekeeping, revenue],
  HOUSEKEEPING: [housekeeping, tasks],
  ADMIN: [deskBooking, tapeChart, deskService, deskHousekeeping, billing],
};
