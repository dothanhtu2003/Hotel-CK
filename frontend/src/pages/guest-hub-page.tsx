import { t as tr, useLocale } from "../i18n";
import { Trans } from "react-i18next";
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
  useLocale();
  const { user } = useAuth();
  const stays = useStays();
  const recentBookings = useGet<Page<Booking>>('/bookings/my?page=1&pageSize=3');

  if (!user) return null;
  const firstName = user.fullName ? user.fullName.split(' ').slice(-1)[0] : tr("guest:guestHubPage.you");

  const activeStay = stays.data?.[0];

  return (
    <div className="guest-hub-space">
      {/* Welcome Banner */}
      <section className="guest-hub-hero">
        <div className="guest-hub-hero-text">
          <p className="eyebrow light">
            <span>✦</span> {tr("guest:guestHubPage.yourGetawaySpace")}</p>
          <h1><Trans ns="guest" i18nKey="guestHubPage.welcomeValue" values={{ value0: (firstName) }} components={{ part0: <em /> }} /></h1>
          <p className="guest-hub-hero-sub">{tr("guest:guestHubPage.aMomentOfCalmForYourSoulWeAreHereForEvery")}</p>
          <div className="guest-hub-hero-cta">
            <LinkButton to="/rooms" variant="light">
              <Compass size={16} />
              {tr("guest:guestHubPage.exploreOurRooms")}</LinkButton>
            <LinkButton to="/guest/bookings" variant="secondary" className="guest-hero-secondary-btn">
              <Calendar size={16} />
              {tr("guest:guestHubPage.myJourney")}</LinkButton>
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
              <span>{tr("guest:guestHubPage.stayingAtAnNhien")}</span>
            </div>
            <GuestBadge status={activeStay.status} />
          </div>
          <div className="active-stay-body">
            <div>
              <h2>{tr("guest:roomCompare.roomValue", { value0: (activeStay.roomNumber) })}</h2>
              <p className="active-stay-meta"><Trans ns="guest" i18nKey="guestHubPage.reservationValueValueGuestsValueNights" values={{ value0: (formatBookingReference(activeStay.reference)), value1: (activeStay.guestCount), value2: (activeStay.nights) }} components={{ part0: <strong /> }} /></p>
              <p className="active-stay-dates"><Trans ns="guest" i18nKey="guestHubPage.datesValueToValue" values={{ value0: (activeStay.checkIn), value1: (activeStay.checkOut) }} components={{ part0: <strong />, part1: <strong /> }} /></p>
            </div>
            <div className="active-stay-actions">
              <LinkButton to={`/guest/services?bookingId=${activeStay.id}`}>
                <BellRing size={16} /> {tr("guest:bookingPages.orderRoomService2")}</LinkButton>
              <LinkButton to={`/guest/bookings/${activeStay.id}/billing`} variant="secondary">
                <ReceiptText size={16} /> {tr("guest:guestHubPage.currentCharges")}</LinkButton>
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
            <h3>{tr("guest:guestHubPage.myStays")}</h3>
            <p>{tr("guest:guestHubPage.viewYourReservationsCheckInDatesAndConfirmedRoomTypes")}</p>
          </div>
          <Link to="/guest/bookings" className="guest-pillar-link">
            <span>{tr("guest:guestHubPage.viewReservations")}</span>
            <ChevronRight size={16} />
          </Link>
        </article>

        <article className="guest-pillar-card">
          <div className="guest-pillar-icon">
            <BellRing size={24} strokeWidth={1.6} />
          </div>
          <div className="guest-pillar-content">
            <h3>{tr("guest:bookingPages.roomService")}</h3>
            <p>{tr("guest:guestHubPage.enjoyFineDiningRefreshingDrinksAndThoughtfulServicesDeliveredToYourRoom")}</p>
          </div>
          <Link to="/guest/services" className="guest-pillar-link">
            <span>{tr("guest:guestHubPage.orderRoomService")}</span>
            <ChevronRight size={16} />
          </Link>
        </article>

        <article className="guest-pillar-card">
          <div className="guest-pillar-icon">
            <ReceiptText size={24} strokeWidth={1.6} />
          </div>
          <div className="guest-pillar-content">
            <h3>{tr("guest:bookingPages.chargesInvoices")}</h3>
            <p>{tr("guest:guestHubPage.viewRoomChargesAndServicesUsedBeforeCheckingOut")}</p>
          </div>
          <Link to="/guest/billing" className="guest-pillar-link">
            <span>{tr("guest:bookingPages.viewChargesInvoice")}</span>
            <ChevronRight size={16} />
          </Link>
        </article>
      </section>

      {/* Recent Activity Quick View */}
      {recentBookings.data?.data && recentBookings.data.data.length > 0 && (
        <section className="guest-hub-recent-section">
          <div className="guest-hub-section-head">
            <div>
              <p className="eyebrow">{tr("guest:guestHubPage.recentJourneys")}</p>
              <h2>{tr("guest:guestHubPage.latestReservation")}</h2>
            </div>
            <Link to="/guest/bookings" className="text-link">
              {tr("common:supplement.allReservations", { value0: recentBookings.data.meta.total })} <ChevronRight size={14} />
            </Link>
          </div>

          <div className="guest-hub-recent-grid">
            {recentBookings.data.data.map((b) => (
              <div key={b.id} className="guest-recent-item-card">
                <div className="guest-recent-item-top">
                  <span className="guest-booking-ref">{b.reference}</span>
                  <GuestBadge status={b.status} />
                </div>
                <h4 className="guest-recent-room-name">{tr("guest:roomCompare.roomValue", { value0: (b.roomNumber) })}</h4>
                <p className="guest-recent-dates">{tr("guest:guestHubPage.valueValueValueNights", { value0: (b.checkIn), value1: (b.checkOut), value2: (b.nights) })}</p>
                <div className="guest-recent-foot">
                  <span><Trans ns="guest" i18nKey="guestHubPage.roomTotalValue" values={{ value0: (money(b.totalRoomAmount)) }} components={{ part0: <strong /> }} /></span>
                  <Link to={`/guest/bookings/${b.id}`} className="guest-recent-btn">
                    {tr("guest:guestHubPage.details")}<ChevronRight size={14} />
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
          <h4>{tr("guest:guestHubPage.needAnyHelpDuringYourStay")}</h4>
          <p>{tr("guest:guestHubPage.ourAnNhienReceptionTeamIsAvailable247VisitReceptionOn")}</p>
        </div>
      </section>
    </div>
  );
}
