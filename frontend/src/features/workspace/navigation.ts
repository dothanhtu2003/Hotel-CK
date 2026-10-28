import { BedDouble, Brush, ConciergeBell, ReceiptText, type LucideIcon } from 'lucide-react';
import type { Role } from '../auth/contracts';
export interface WorkspaceFeature { slug: string; title: string; description: string; icon: LucideIcon }
const booking = { slug: 'bookings', title: 'Đặt phòng', description: 'Tìm phòng và quản lý hành trình lưu trú.', icon: BedDouble };
const service = { slug: 'services', title: 'Dịch vụ phòng', description: 'Những tiện ích cho một kỳ nghỉ trọn vẹn.', icon: ConciergeBell };
const housekeeping = { slug: 'board', title: 'Buồng phòng', description: 'Theo dõi và hoàn thành công việc được phân công.', icon: Brush };
const tasks = { ...housekeeping, slug: 'tasks', title: 'Công việc của tôi', description: 'Công việc được giao và lịch sử hoàn thành.' };
const deskHousekeeping = { ...housekeeping, slug: 'housekeeping', description: 'Xem phòng, tạo và phân công công việc dọn phòng.' };
const billing = { slug: 'billing', title: 'Hóa đơn & thanh toán', description: 'Tra cứu chi phí lưu trú và thông tin thanh toán.', icon: ReceiptText };
const deskBooking = { ...booking, title: 'Quản lý booking', description: 'Xác nhận, nhận phòng và theo dõi kỳ nghỉ.' };
const deskService = { ...service, slug: 'service-orders', title: 'Đơn dịch vụ', description: 'Theo dõi và xử lý dịch vụ khách đã đặt.' };
export const featuresForRole: Record<Role, WorkspaceFeature[]> = {
  GUEST: [booking, service, billing], RECEPTIONIST: [deskBooking, deskService, deskHousekeeping, billing], HOUSEKEEPING: [housekeeping, tasks], ADMIN: [deskBooking, deskService, deskHousekeeping, billing],
};
