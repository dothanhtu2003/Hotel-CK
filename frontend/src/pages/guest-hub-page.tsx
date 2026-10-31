import { Link } from 'react-router';
import {
  BedDouble,
  BellRing,
  Calendar,
  ChevronRight,
  Compass,
  HeartHandshake,
  ReceiptText,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { useGet, useStays } from '../features/guest/queries';
import { formatBookingReference, money, type Booking, type Page } from '../features/guest/contracts';
import { GuestBadge, Skeleton } from '../features/guest/components';
import { LinkButton } from '../components/ui';

export function GuestHubPage() {
  const { user } = useAuth();
  const stays = useStays();
  const recentBookings = useGet<Page<Booking>>('/bookings/my?page=1&pageSize=3');

  if (!user) return null;
  const firstName = user.fullName ? user.fullName.split(' ').slice(-1)[0] : 'bạn';

  const activeStay = stays.data?.[0];

  return (
    <div className="guest-hub-space">
      {/* Welcome Banner */}
      <section className="guest-hub-hero">
        <div className="guest-hub-hero-text">
          <p className="eyebrow light">
            <span>✦</span> KHÔNG GIAN NGHỈ DƯỠNG CỦA BẠN
          </p>
          <h1>
            Kính chào, <em>{firstName}.</em>
          </h1>
          <p className="guest-hub-hero-sub">
            Một khoảng lặng để tâm hồn thảnh thơi. Chúng tôi luôn sẵn sàng đồng hành cùng từng khoảnh khắc trong kỳ nghỉ của bạn.
          </p>
          <div className="guest-hub-hero-cta">
            <LinkButton to="/rooms" variant="light">
              <Compass size={16} />
              Khám phá phòng nghỉ
            </LinkButton>
            <LinkButton to="/guest/bookings" variant="secondary" className="guest-hero-secondary-btn">
              <Calendar size={16} />
              Hành trình của tôi
            </LinkButton>
          </div>
        </div>
        <div className="guest-hub-hero-graphic" aria-hidden="true">
          <span>A</span>
        </div>
      </section>

      {/* Current Stay Highlight (If Checked-in) */}
      {stays.isPending ? (
        <Skeleton />
      ) : activeStay ? (
        <section className="guest-hub-active-stay-card">
          <div className="active-stay-header">
            <div className="active-stay-tag">
              <Sparkles size={14} />
              <span>Đang lưu trú tại An Nhiên</span>
            </div>
            <GuestBadge status={activeStay.status} />
          </div>
          <div className="active-stay-body">
            <div>
              <h2>Phòng {activeStay.roomNumber}</h2>
              <p className="active-stay-meta">
                Mã booking: <strong>{formatBookingReference(activeStay.reference)}</strong> · {activeStay.guestCount} khách · {activeStay.nights} đêm
              </p>
              <p className="active-stay-dates">
                Thời gian: <strong>{activeStay.checkIn}</strong> đến <strong>{activeStay.checkOut}</strong>
              </p>
            </div>
            <div className="active-stay-actions">
              <LinkButton to={`/guest/services?bookingId=${activeStay.id}`}>
                <BellRing size={16} /> Đặt dịch vụ phòng
              </LinkButton>
              <LinkButton to={`/guest/bookings/${activeStay.id}/billing`} variant="secondary">
                <ReceiptText size={16} /> Chi phí hiện tại
              </LinkButton>
            </div>
          </div>
        </section>
      ) : null}

      {/* 3 Core Experience Pillars */}
      <section className="guest-hub-pillars-grid">
        <article className="guest-pillar-card">
          <div className="guest-pillar-icon">
            <BedDouble size={24} strokeWidth={1.6} />
          </div>
          <div className="guest-pillar-content">
            <h3>Kỳ nghỉ của tôi</h3>
            <p>Tra cứu chi tiết các lịch đặt phòng, thời gian nhận phòng và thông tin hạng phòng đã chốt.</p>
          </div>
          <Link to="/guest/bookings" className="guest-pillar-link">
            <span>Xem danh sách booking</span>
            <ChevronRight size={16} />
          </Link>
        </article>

        <article className="guest-pillar-card">
          <div className="guest-pillar-icon">
            <BellRing size={24} strokeWidth={1.6} />
          </div>
          <div className="guest-pillar-content">
            <h3>Dịch vụ phòng</h3>
            <p>Thưởng thức ẩm thực tinh tế, đồ uống tươi mát và các dịch vụ chăm sóc tiện nghi tận phòng.</p>
          </div>
          <Link to="/guest/services" className="guest-pillar-link">
            <span>Gọi dịch vụ phòng</span>
            <ChevronRight size={16} />
          </Link>
        </article>

        <article className="guest-pillar-card">
          <div className="guest-pillar-icon">
            <ReceiptText size={24} strokeWidth={1.6} />
          </div>
          <div className="guest-pillar-content">
            <h3>Chi phí & Hóa đơn</h3>
            <p>Minh bạch chi phí lưu trú, tiền phòng và các dịch vụ đã sử dụng trước khi trả phòng.</p>
          </div>
          <Link to="/guest/billing" className="guest-pillar-link">
            <span>Xem chi phí & hóa đơn</span>
            <ChevronRight size={16} />
          </Link>
        </article>
      </section>

      {/* Recent Activity Quick View */}
      {recentBookings.data?.data && recentBookings.data.data.length > 0 && (
        <section className="guest-hub-recent-section">
          <div className="guest-hub-section-head">
            <div>
              <p className="eyebrow">HÀNH TRÌNH GẦN ĐÂY</p>
              <h2>Booking mới nhất</h2>
            </div>
            <Link to="/guest/bookings" className="text-link">
              Tất cả booking ({recentBookings.data.meta.total}) <ChevronRight size={14} />
            </Link>
          </div>

          <div className="guest-hub-recent-grid">
            {recentBookings.data.data.map((b) => (
              <div key={b.id} className="guest-recent-item-card">
                <div className="guest-recent-item-top">
                  <span className="guest-booking-ref">{b.reference}</span>
                  <GuestBadge status={b.status} />
                </div>
                <h4 className="guest-recent-room-name">Phòng {b.roomNumber}</h4>
                <p className="guest-recent-dates">
                  {b.checkIn} → {b.checkOut} ({b.nights} đêm)
                </p>
                <div className="guest-recent-foot">
                  <span>Tổng phòng: <strong>{money(b.totalRoomAmount)}</strong></span>
                  <Link to={`/guest/bookings/${b.id}`} className="guest-recent-btn">
                    Chi tiết <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hospitality Note */}
      <section className="guest-hub-hospitality-banner">
        <HeartHandshake size={28} strokeWidth={1.4} />
        <div>
          <h4>Cần hỗ trợ bất kỳ điều gì trong kỳ nghỉ?</h4>
          <p>
            Đội ngũ lễ tân An Nhiên luôn trực 24/7 để phục vụ bạn. Hãy ghé quầy lễ tân tầng 1 hoặc liên hệ số nội bộ để được chăm sóc chu đáo nhất.
          </p>
        </div>
      </section>
    </div>
  );
}
