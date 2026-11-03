import type { Order } from '../guest/contracts';

export function serviceOrderLabel(order: Order) {
  if (order.status === 'CANCELLED') return order.refundedAt ? 'Đã hủy · Đã hoàn tiền' : 'Đã hủy';
  if (order.requestedPaymentMethod && order.paymentMethod) return order.deliveredAt ? 'Đã giao · Đã thanh toán' : 'Đã thanh toán · Cần giao hàng';
  if (order.paymentMethod) return `Đã thu · ${order.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}`;
  return order.status === 'PENDING' ? 'Yêu cầu từ khách' : 'Ghi vào hóa đơn phòng';
}

