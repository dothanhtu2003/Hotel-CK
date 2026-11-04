import { Link, useParams } from 'react-router';
import {
  Banknote,
  CreditCard,
  Info,
  Printer,
} from 'lucide-react';
import { ErrorState, LinkButton, PageHeading } from '../components/ui';
import { GuestBadge, Skeleton } from '../features/guest/components';
import { formatBookingReference, money, type Invoice, type Preview } from '../features/guest/contracts';
import { useGet, useInvoice } from '../features/guest/queries';
import { PayosPayment } from '../features/guest/payos-payment';
import { BookingPayment } from '../features/guest/booking-payment';

/* ========================================================
   HELPER FORMATTERS (CLEAN UP UUIDs & ENUMS)
   ======================================================== */
function friendlyPaymentMethod(method: string) {
  switch (method) {
    case 'BANK_TRANSFER':
      return 'Chuyển khoản';
    case 'CASH':
      return 'Tiền mặt';
    case 'CREDIT_CARD':
      return 'Thẻ tín dụng';
    default:
      return method;
  }
}

function friendlyPaymentStatus(status: string) {
  switch (status) {
    case 'COMPLETED':
    case 'SUCCESS':
      return 'Đã xác nhận';
    case 'PENDING':
      return 'Chờ xác nhận';
    case 'FAILED':
      return 'Không thành công';
    default:
      return status;
  }
}

function formatShortId(prefix: string, id: string) {
  if (!id) return '';
  return `${prefix}-${id.slice(0, 8).toUpperCase()}`;
}

/* ========================================================
   AMOUNTS BREAKDOWN COMPONENT
   ======================================================== */
function Amounts({
  room,
  services,
  total,
}: {
  room: string;
  services: string;
  total: string;
}) {
  return (
    <dl className="guest-facts folio-amounts-breakdown">
      <div>
        <dt>Tiền phòng</dt>
        <dd>{money(room)}</dd>
      </div>
      <div>
        <dt>Dịch vụ hoàn thành</dt>
        <dd>{money(services)}</dd>
      </div>
      <div className="folio-total-row">
        <dt>Tổng tiền</dt>
        <dd>
          <strong>{money(total)}</strong>
        </dd>
      </div>
    </dl>
  );
}

/* ========================================================
   INVOICE VIEW (HOTEL FOLIO BILL)
   ======================================================== */
function InvoiceView({ invoice: i }: { invoice: Invoice }) {
  const isPaidInFull = i.status === 'PAID';

  return (
    <section className="panel guest-box folio-invoice-sheet">
      {/* Folio Header */}
      <div className="folio-header">
        <div className="folio-brand">
          <span className="brand-symbol" aria-hidden="true">A<span>✦</span></span>
          <div>
            <strong>AN NHIÊN HOTEL & SUITES</strong>
            <small>Hóa đơn lưu trú & Dịch vụ khách hàng</small>
          </div>
        </div>
        <div className="folio-meta-tags">
          <GuestBadge status={i.status} />
        </div>
      </div>

      <div className="guest-row folio-title-row">
        <h2>Hóa đơn đã phát hành</h2>
        <span className="folio-serial-badge">{formatShortId('HĐ', i.id)}</span>
      </div>

      {/* Primary Folio Facts */}
      <div className="folio-info-grid">
        <div className="folio-info-item">
          <span>Mã hóa đơn:</span>
          <strong>{formatShortId('HĐ', i.id)}</strong>
          <small className="folio-raw-id">(ID: {i.id})</small>
        </div>
        <div className="folio-info-item">
          <span>Kỳ nghỉ lưu trú:</span>
          <strong>Booking {formatBookingReference(i.booking.reference)}</strong>
        </div>
        <div className="folio-info-item">
          <span>Phòng nghỉ:</span>
          <strong>Phòng {i.booking.roomNumber}</strong>
        </div>
        <div className="folio-info-item">
          <span>Ngày phát hành:</span>
          <strong>{new Date(i.issuedAt).toLocaleString('vi-VN')}</strong>
        </div>
      </div>

      {/* Amounts breakdown */}
      <div className="folio-table-wrap">
        <Amounts room={i.roomAmount} services={i.serviceAmount} total={i.totalAmount} />
      </div>

      {/* Balance & Paid Summary */}
      <dl className="guest-facts folio-balance-summary">
        <div>
          <dt>Đã thanh toán</dt>
          <dd className="text-emerald-700 font-semibold">{money(i.paidAmount)}</dd>
        </div>
        <div className={isPaidInFull ? 'balance-zero-highlight' : 'balance-due-highlight'}>
          <dt>Số dư còn lại</dt>
          <dd>
            <strong>{money(i.balance)}</strong>
          </dd>
        </div>
      </dl>

      {/* Payment Receipts Section */}
      {i.payments.length > 0 && (
        <div className="folio-receipts-section">
          <h3>Lịch sử biên nhận thanh toán</h3>
          <div className="folio-receipts-list">
            {i.payments.map((p) => (
              <div key={p.id} className="folio-receipt-item">
                <div className="receipt-item-icon">
                  {p.method === 'BANK_TRANSFER' ? (
                    <CreditCard size={16} />
                  ) : (
                    <Banknote size={16} />
                  )}
                </div>
                <div className="receipt-item-details">
                  <div className="receipt-item-top">
                    <strong>{formatShortId('BN', p.id)}</strong>
                    <span className="receipt-method-pill">
                      {friendlyPaymentMethod(p.method)}
                    </span>
                    <span className="receipt-status-pill">
                      {friendlyPaymentStatus(p.status)}
                    </span>
                  </div>
                  <p className="receipt-raw-text">
                    Biên nhận {p.id} · {money(p.amount)} · {p.method} · {p.status}
                  </p>
                </div>
                <strong className="receipt-item-amount">{money(p.amount)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <PayosPayment invoice={i} />
      {/* Front Desk Assistance Notice */}
      <div className="folio-notice-box">
        <Info size={18} />
        <p>Vui lòng liên hệ lễ tân về thanh toán và trả phòng.</p>
      </div>

      {/* Actions */}
      <div className="folio-footer-actions">
        <button
          type="button"
          onClick={() => window.print()}
          className="button button-secondary folio-print-btn"
        >
          <Printer size={16} /> In hóa đơn
        </button>
      </div>
    </section>
  );
}

/* ========================================================
   BOOKING BILLING PAGE
   ======================================================== */
export function BookingBillingPage() {
  const { id = '' } = useParams();
  const preview = useGet<Preview>(`/bookings/${id}/billing-preview`);
  const invoice = useInvoice(id);

  if (preview.data?.booking.status === 'CANCELLED' && !invoice.isPending && !invoice.error && !invoice.data) return <div className="guest-billing-page-space">
    <Link to={'/guest/bookings/'+id} className="text-link">← Chi tiết booking</Link>
    <PageHeading eyebrow="THÔNG TIN BOOKING" title="Booking đã hủy" />
    {preview.data.booking.onlinePaymentRequired ? <BookingPayment booking={preview.data.booking} /> : <p className="notice">Booking đã hủy. Không có hóa đơn lưu trú cần thanh toán.</p>}
  </div>;
  return (
    <div className="guest-billing-page-space">
      <Link to={'/guest/bookings/' + id} className="text-link">
        ← Chi tiết booking
      </Link>
      <PageHeading eyebrow="CHI PHÍ LƯU TRÚ" title="Chi phí & hóa đơn" />
      {preview.isPending || invoice.isPending ? <Skeleton /> : preview.error || invoice.error ? (
        <ErrorState message={(preview.error || invoice.error)!.message} retry={() => { void preview.refetch(); void invoice.refetch(); }} />
      ) : preview.data && (() => {
        const p = preview.data;
        const summary = p.guestSummary;
        const orders = summary?.orders ?? p.completedOrders;
        const hasPending = orders.some(o => o.status === 'PENDING');
        return <>
          <section className="panel guest-box guest-cost-overview" aria-label="Tổng chi phí kỳ nghỉ">
            <div className="guest-row">
              <div><h2>Phòng {p.booking.roomNumber}</h2><p className="preview-meta">{formatBookingReference(p.booking.reference)} · {p.booking.checkIn.split('-').reverse().join('/')} → {p.booking.checkOut.split('-').reverse().join('/')}</p></div>
              <GuestBadge status={p.booking.status} />
            </div>
            <dl className="guest-facts">
              <div><dt>Tiền phòng · {p.booking.nights} đêm</dt><dd>{money(p.roomAmount)}</dd></div>
              <div><dt>Dịch vụ đã đặt{hasPending ? ' · tạm tính' : ''}</dt><dd>{money(summary?.serviceAmount ?? p.serviceAmount)}</dd></div>
              <div className="folio-total-row"><dt>Tổng chi phí{hasPending ? ' dự kiến' : ''}</dt><dd><strong>{money(summary?.totalAmount ?? p.totalAmount)}</strong></dd></div>
              <div><dt>Đã thanh toán</dt><dd>{money(summary?.paidAmount ?? p.paidAmount ?? '0')}</dd></div>
              <div className={Number(summary?.balance ?? p.balance ?? p.totalAmount) === 0 ? 'balance-zero-highlight' : 'balance-due-highlight'}><dt>Còn phải thanh toán{hasPending ? ' · dự kiến' : ''}</dt><dd><strong>{money(summary?.balance ?? p.balance ?? p.totalAmount)}</strong></dd></div>
            </dl>
            {!orders.length && <p className="billing-help">Chưa có dịch vụ đặt cho kỳ nghỉ này.</p>}
            {hasPending && <p className="billing-help">Tổng dự kiến gồm cả dịch vụ đang chờ. Chỉ các khoản thanh toán thành công được tính vào số tiền đã thanh toán.</p>}
            {orders.length > 0 && <details className="guest-cost-details"><summary>Chi tiết {orders.length} đơn dịch vụ</summary>
              {orders.map(o => <div key={o.id} className="guest-cost-order">
                {o.items.map(item => <div className="guest-row" key={item.id}><span>{item.serviceName} × {item.quantity}</span><strong>{money(item.subtotal)}</strong></div>)}
                <small>{o.paymentMethod ? 'Đã thanh toán riêng' : o.requestedPaymentMethod === 'CASH' ? 'Thanh toán tiền mặt khi nhận dịch vụ' : o.requestedPaymentMethod === 'BANK_TRANSFER' ? 'Chưa thanh toán chuyển khoản' : o.status === 'PENDING' ? 'Chờ xác nhận · Chưa ghi vào hóa đơn' : 'Ghi vào hóa đơn phòng'}</small>
              </div>)}
              <Link to="/guest/service-orders" className="text-link">Xem và quản lý đơn dịch vụ</Link>
            </details>}
            <p className="billing-help">{invoice.data ? 'Hóa đơn phòng và các khoản dịch vụ thu riêng được tổng hợp ở trên.' : 'Đây là bảng chi phí của kỳ nghỉ. Hóa đơn chính thức sẽ được lễ tân phát hành.'}</p>
          </section>
          {p.booking.onlinePaymentRequired && Number(p.prepaidAmount ?? p.paidAmount ?? '0') < Number(p.roomAmount) && p.booking.status === 'PENDING' && <BookingPayment booking={p.booking} />}
          {invoice.data && <details className="panel guest-box guest-cost-details"><summary>Hóa đơn & lịch sử thanh toán</summary>
            <InvoiceView invoice={invoice.data} />
            <LinkButton variant="secondary" to={'/guest/invoices/' + invoice.data.id}>Mở hóa đơn</LinkButton>
          </details>}
        </>;
      })()}

    </div>
  );
}

/* ========================================================
   STANDALONE INVOICE PAGE
   ======================================================== */
export function InvoicePage() {
  const { id = '' } = useParams();
  const query = useGet<Invoice>('/invoices/' + id);

  return (
    <div className="guest-standalone-invoice-space">
      <Link to="/guest/billing" className="text-link">
        ← Chi phí & hóa đơn
      </Link>
      <PageHeading title="Hóa đơn lưu trú" />
      {query.isPending ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          retry={() => void query.refetch()}
        />
      ) : (
        query.data && <InvoiceView invoice={query.data} />
      )}
    </div>
  );
}
