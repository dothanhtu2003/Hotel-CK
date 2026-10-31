import { Link, useParams } from 'react-router';
import {
  Banknote,
  Clock,
  CreditCard,
  Info,
  Printer,
  ReceiptText,
} from 'lucide-react';
import { ErrorState, LinkButton, PageHeading } from '../components/ui';
import { GuestBadge, Skeleton } from '../features/guest/components';
import { formatBookingReference, money, type Invoice, type Preview } from '../features/guest/contracts';
import { useGet, useInvoice } from '../features/guest/queries';

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

  return (
    <div className="guest-billing-page-space">
      <Link to={'/guest/bookings/' + id} className="text-link">
        ← Chi tiết booking
      </Link>
      <PageHeading eyebrow="CHI PHÍ LƯU TRÚ" title="Chi phí & hóa đơn" />

      {/* 1. Preliminary Cost Preview (Before Invoice) */}
      {preview.isPending ? (
        <Skeleton />
      ) : preview.error ? (
        <ErrorState
          message={preview.error.message}
          retry={() => void preview.refetch()}
        />
      ) : (
        preview.data && (
          <section className="panel guest-box folio-preview-sheet">
            <div className="preview-heading-row">
              <div>
                <h2>Chi phí dự kiến · Chưa phải hóa đơn</h2>
                <p className="preview-meta">
                  {formatBookingReference(preview.data.booking.reference)} · Phòng {preview.data.booking.roomNumber}
                </p>
              </div>
              <span className="preview-draft-badge">Dự kiến</span>
            </div>

            <Amounts
              room={preview.data.roomAmount}
              services={preview.data.serviceAmount}
              total={preview.data.totalAmount}
            />

            {preview.data.pendingOrderCount > 0 ? (
              <div className="pending-orders-alert">
                <Clock size={16} />
                <p>
                  {preview.data.pendingOrderCount} đơn dịch vụ đang chờ, chưa tính vào tổng. Chi phí có thể thay đổi trước khi phát hành hóa đơn.
                </p>
              </div>
            ) : (
              <p className="pending-orders-quiet">
                {preview.data.pendingOrderCount} đơn dịch vụ đang chờ, chưa tính vào tổng. Chi phí có thể thay đổi trước khi phát hành hóa đơn.
              </p>
            )}

            {preview.data.completedOrders.length > 0 && (
              <div className="completed-orders-section">
                <h3>Chi tiết dịch vụ đã sử dụng</h3>
                <div className="completed-orders-list">
                  {preview.data.completedOrders.map((o) => (
                    <div key={o.id} className="completed-order-group">
                      {o.items.map((item) => (
                        <p key={item.id} className="completed-item-line">
                          <span>
                            {item.serviceName} × {item.quantity} · {money(item.unitPrice)} / đơn vị
                          </span>
                          <strong>{money(item.subtotal)}</strong>
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )
      )}

      {/* 2. Official Staged Invoice (If Issued) */}
      {invoice.isPending ? (
        <Skeleton />
      ) : invoice.error ? (
        <ErrorState
          message={invoice.error.message}
          retry={() => void invoice.refetch()}
        />
      ) : invoice.data ? (
        <div className="official-invoice-wrap">
          <InvoiceView invoice={invoice.data} />
          <div className="invoice-action-bar">
            <LinkButton
              variant="secondary"
              to={'/guest/invoices/' + invoice.data.id}
            >
              Mở hóa đơn
            </LinkButton>
          </div>
        </div>
      ) : (
        <section className="panel guest-box unissued-invoice-notice-card">
          <div className="unissued-icon-wrap">
            <ReceiptText size={28} />
          </div>
          <div>
            <h2>Chưa phát hành hóa đơn</h2>
            <p>
              Chưa có thông tin thanh toán và số dư chính thức. Lễ tân sẽ hỗ trợ khi bạn hoàn tất kỳ nghỉ.
            </p>
          </div>
        </section>
      )}
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
