import { t as tr } from "../../i18n";
import type { Order } from '../guest/contracts';

export function serviceOrderLabel(order: Order) {
  if (order.status === 'CANCELLED') return order.refundedAt ? tr("reception:serviceOrderLabel.cancelledRefunded") : tr("reception:cashier.cancelled");
  if (order.requestedPaymentMethod && order.paymentMethod) return order.deliveredAt ? tr("reception:serviceOrderLabel.deliveredPaid") : tr("reception:serviceOrderLabel.paidDeliveryRequired");
  if (order.paymentMethod) return tr("reception:serviceOrderLabel.collectedValue", { value0: (order.paymentMethod === 'CASH' ? tr("common:supplement.cash") : tr("common:supplement.bankTransfer")) });
  return order.status === 'PENDING' ? tr("reception:serviceOrderLabel.guestRequest") : tr("reception:createServiceOrder.chargeToRoomInvoice");
}

