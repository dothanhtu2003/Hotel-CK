import { z } from 'zod';
import { cents, type Booking, type Invoice } from '../guest/contracts';
import { ApiError } from '../../lib/api-client';

export type DeskBooking = Booking & { userId: string; createdAt: string; updatedAt: string };
export type Checkout = { booking: Booking; invoice: Invoice; room: { id: string; housekeepingStatus: string; operationalStatus: string }; housekeepingTask: { id: string; status: string; assignedStaffId: string | null } | null };
export type PaymentResult = { payment: Invoice['payments'][number]; invoice: Invoice; replayed: boolean };
export const paymentSchema = z.object({
  amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/, 'Nhập số tiền với dấu chấm thập phân, tối đa 2 chữ số lẻ.').refine(v => /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(v) && cents(v) > 0n, 'Số tiền phải lớn hơn 0.'),
  method: z.enum(['CASH', 'BANK_TRANSFER']),
  verified: z.boolean().refine(v => v, 'Xác nhận đã nhận và kiểm tra khoản tiền này.'),
});
export type PaymentInput = z.infer<typeof paymentSchema>;
export function paymentWithinBalance(amount: string, balance: string) { const valid = paymentSchema.shape.amount.safeParse(amount); return valid.success && cents(valid.data) <= cents(balance); }
export function canIssue(b: Booking, pending: number, invoice: Invoice | null) { return b.status === 'CHECKED_IN' && pending === 0 && invoice === null; }
export function canCheckout(b: Booking, pending: number, invoice: Invoice | null) { return b.status === 'CHECKED_IN' && pending === 0 && invoice?.status === 'PAID' && cents(invoice.balance) === 0n; }
export function pageNumber(value: string | null) { const n = Number(value); return Number.isInteger(n) && n >= 1 && n <= 1000000 ? n : 1; }
export function deskError(error: Error, action = '') {
  if (error instanceof ApiError && error.status === 409) {
    if (action === 'check-in') return 'Chưa thể nhận phòng. Kiểm tra ngày lưu trú, khách đang hoạt động, phòng ACTIVE và CLEAN, không có công việc buồng phòng còn mở; trạng thái booking cũng có thể vừa thay đổi.';
    if (action === 'invoice') return 'Chưa thể phát hành: cần booking đang lưu trú, không còn đơn dịch vụ chờ và chưa có hóa đơn. Hãy tải lại dữ liệu.';
    if (action === 'check-out') return 'Chưa thể trả phòng: cần booking đang lưu trú, hóa đơn đã thanh toán đủ và không còn đơn dịch vụ chờ. Hãy tải lại dữ liệu.';
    if (action === 'payment') return 'Khoản thu bị từ chối: số dư có thể đã thay đổi hoặc khóa yêu cầu đã được sử dụng. Kiểm tra lại hóa đơn và biên nhận trước khi tiếp tục.';
    return 'Trạng thái vừa thay đổi hoặc booking đã có hóa đơn. Hãy tải lại dữ liệu trước khi thao tác tiếp.';
  }
  if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) return 'Chưa xác định thao tác đã được ghi nhận hay chưa. Hãy kiểm tra dữ liệu mới nhất trước khi gửi lại.';
  return error.message;
}
