import { formatDate as localizedDate } from "../i18n/format";
import { LocalizedError, safeError, t as tr, useLocale } from "../i18n";
import { catalogName, catalogDescription } from "../i18n/catalog";

import { Trans } from "react-i18next";
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BedDouble,
  Calendar,
  Clock,
  Coffee,
  ShieldCheck,
  Users,
  Wifi,
} from 'lucide-react';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeading,
} from '../components/ui';
import { Skeleton } from '../features/guest/components';
import { useGet } from '../features/guest/queries';
import {
  bookingSchema,
  calendarDate,
  cents,
  decimal,
  guestError,
  money,
  nightsBetween,
  readStay,
  searchParams,
  type Availability,
  type Booking,
  type Room,
} from '../features/guest/contracts';
import { useAuth } from '../features/auth/auth-context';
import { api } from '../lib/api';
import { ApiError } from '../lib/api-client';
import { useToast } from '../components/toast-context';
import { RoomGallery, type GalleryImage } from '../components/lightbox';
import {
  StickyBookingBar,
} from '../features/guest/room-amenities';

function getRoomTypeImage(typeName: string): string {
  const lower = typeName.toLowerCase();
  if (lower.includes('suite')) return '/images/suite.jpg';
  if (lower.includes('deluxe') || lower.includes('retreat')) return '/images/retreat.jpg';
  return '/images/hero.jpg';
}

function getGalleryImages(roomTypeName: string): GalleryImage[] {
  return [{
    src: getRoomTypeImage(roomTypeName),
    alt: tr("guest:roomPages.illustrationOfTheValueRoomType", { value0: (roomTypeName) }),
    title: tr("guest:roomPages.illustrativePhotoNotAConfirmedPhotoOfTheRoom"),
  }];
}

export function ReadyRooms({
  rooms,
  query,
  nights,
}: {
  rooms: Room[];
  query: string;
  nights: number;
}) {
  useLocale();
  return (
    <div className="ready-room-list">
      {rooms.map((room) => (
        <article className="ready-room-card" key={room.id}>
          {/* Room Media Thumbnail */}
          <div className="ready-room-media">
            <img
              src={getRoomTypeImage(room.roomType.name)}
              alt={tr("guest:roomPages.roomValueValue", { value0: (room.roomNumber), value1: (catalogName(room.roomType.name)) })}
              loading="lazy"
            />
            <div className="ready-room-media-badges">
              <span className="room-type-chip">{catalogName(room.roomType.name)}</span>
              <span className="room-floor-chip">{tr("guest:roomCompare.floorValue", { value0: (room.floor) })}</span>
            </div>
          </div>

          {/* Room Card Body */}
          <div className="ready-room-body">
            <div>
              <div className="ready-room-header">
                <div className="ready-room-title-block">
                  <h2>{tr("guest:roomCompare.roomValue", { value0: (room.roomNumber) })}</h2>
                  <p className="ready-room-type-sub">{tr("guest:roomPages.valueAPeacefulSpace", { value0: (catalogName(room.roomType.name)) })}</p>
                </div>
                <span className="ready-room-status-badge">
                  <span className="status-dot-pulse" /> {tr("guest:roomPages.available")}</span>
              </div>

              <p className="ready-room-desc">
                {catalogDescription(room.roomType.description, room.roomType.name) ||
                  tr("guest:roomPages.aPeacefulRoomWithWarmWoodenFurnishingsAndThoughtfulAmenitiesForA")}
              </p>

              {/* Specs & Amenities Pills */}
              <div className="ready-room-amenities">
                <span className="ready-spec-pill">
                  <Users size={14} /> {tr("guest:homePage.upTo")}{room.roomType.maxGuests} {tr("guest:homePage.guests")}</span>
                <span className="ready-spec-pill">
                  <BedDouble size={14} /> {tr("guest:roomPages.premiumMattress")}</span>
                <span className="ready-spec-pill">
                  <Wifi size={14} /> {tr("guest:homePage.highSpeedWiFi")}</span>
                <span className="ready-spec-pill">
                  <Coffee size={14} /> {tr("guest:roomPages.teaMineralWater")}</span>
              </div>
            </div>

            {/* Price & Action */}
            <div className="ready-room-footer">
              <div className="ready-room-price">
                <div className="price-main"><Trans ns="guest" i18nKey="roomPages.valueNight" values={{ value0: (money(room.roomType.nightlyPrice)) }} components={{ part0: <strong />, part1: <small /> }} /></div>
                {nights > 1 && (
                  <span className="price-total-estimate">{tr("guest:roomPages.estimatedForValueNightsValue", { value0: (nights), value1: (money(decimal(cents(room.roomType.nightlyPrice) * BigInt(nights)))) })}</span>
                )}
                <span className="price-tax-note">{tr("guest:roomPages.includesTaxesServiceCharges")}</span>
              </div>

              <LinkButton
                to={`/rooms/${room.id}?${query}`}
                className="ready-room-book-btn"
              >
                {tr("guest:roomPages.bookRoom")}<ArrowRight size={16} />
              </LinkButton>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function RoomsPage() {
  useLocale();
  const [params] = useSearchParams();
  const [activeTypeId, setActiveTypeId] = useState<string>('ALL');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const tomorrow = new Date(Date.parse(today + 'T00:00:00Z') + 86400000)
    .toISOString()
    .slice(0, 10);
  const hasStay = ['checkIn', 'checkOut', 'guests', 'roomTypeId'].some((key) =>
    params.has(key),
  );
  const effectiveParams = hasStay
    ? params
    : new URLSearchParams({ checkIn: today, checkOut: tomorrow, guests: '2' });
  const stay = readStay(effectiveParams);
  const query = stay.success ? searchParams(stay.data) : '';
  const result = useGet<Availability>('/rooms/available?' + query, stay.success);
  const rooms = (result.data?.data ?? []).filter(
    (room) =>
      room.operationalStatus === 'ACTIVE' &&
      (stay.success && stay.data.checkIn === today
        ? room.housekeepingStatus === 'CLEAN'
        : true),
  );

  // Filter tabs for room types present in results
  const roomTypesInResults = Array.from(
    new Map(rooms.map((r) => [r.roomType.id, r.roomType])).values(),
  );

  const displayedRooms =
    activeTypeId === 'ALL'
      ? rooms
      : rooms.filter((r) => r.roomType.id === activeTypeId);

  return (
    <div className="site-container guest-public ready-rooms-page">
      {/* Hero Header */}
      <div className="ready-rooms-hero-header">
        <div className="ready-rooms-hero-badge">
          <span>✦</span> {tr("guest:roomPages.roomCollection")}</div>
        <h1>{tr("guest:roomPages.readyRooms")}</h1>

      </div>

      {!stay.success ? (
        <ErrorState message={tr("guest:roomPages.pleaseChooseACheckOutDateAfterCheckInAndAValid")} />
      ) : result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState
          message={safeError(result.error)}
          retry={() => void result.refetch()}
        />
      ) : (
        <>
          {/* Quick Filter Tabs */}
          {roomTypesInResults.length > 1 && (
            <div className="ready-room-tabs-bar" role="tablist" aria-label={tr("guest:roomPages.filterByRoomType")}>
              <button
                type="button"
                className={`ready-room-tab-btn ${activeTypeId === 'ALL' ? 'active' : ''}`}
                onClick={() => setActiveTypeId('ALL')}
              >
                {tr("guest:roomPages.allRoomTypes")}<span className="ready-room-tab-count">{rooms.length}</span>
              </button>
              {roomTypesInResults.map((t) => {
                const count = rooms.filter((r) => r.roomType.id === t.id).length;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`ready-room-tab-btn ${activeTypeId === t.id ? 'active' : ''}`}
                    onClick={() => setActiveTypeId(t.id)}
                  >
                    {catalogName(t.name)} <span className="ready-room-tab-count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Availability Status Bar */}
          <div className="ready-room-count-bar">
            <p className="ready-room-count" role="status"><Trans ns="guest" i18nKey="roomPages.valueRoomsValueValueValue" values={{ value0: (displayedRooms.length), value1: (stay.data.checkIn === today ? tr("common:supplement.readyToWelcomeYouToday") : tr("common:supplement.available")), value2: (localizedDate(stay.data.checkIn)), value3: (localizedDate(stay.data.checkOut)) }} components={{ part0: <strong /> }} /></p>
            <div className="ready-room-trust-tags">
              <span>{tr("guest:roomPages.publishedRateGuaranteed")}</span>
              <span>{tr("guest:roomPages.noHiddenCharges")}</span>
              <span>{tr("guest:roomPages.instantConfirmation")}</span>
            </div>
          </div>

          {displayedRooms.length ? (
            <ReadyRooms
              rooms={displayedRooms}
              query={query}
              nights={result.data?.nights ?? 1}
            />
          ) : (
            <EmptyState
              title={tr("guest:roomPages.noReadyRooms")}
              description={tr("guest:roomPages.tryAnotherRoomTypeOrDifferentCheckInAndCheckOutDates")}
            />
          )}
        </>
      )}
    </div>
  );
}

export function RoomDetailPage() {
  useLocale();
  const { id = '' } = useParams(),
    [params, setParams] = useSearchParams(),
    location = useLocation(),
    auth = useAuth(),
    navigate = useNavigate(),
    qc = useQueryClient(),
    toast = useToast();
  const room = useGet<Room>('/rooms/' + id),
    [confirm, setConfirm] = useState(false);

  const checkIn = params.get('checkIn') || '';
  const checkOut = params.get('checkOut') || '';
  const guests = Number(params.get('guests') || 2);

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const isValidDates =
    calendarDate(checkIn) && checkIn >= todayStr &&
    calendarDate(checkOut) &&
    nightsBetween(checkIn, checkOut) > 0;
  const nights = isValidDates ? nightsBetween(checkIn, checkOut) : 0;
  const r = room.data;
  const isCapacityValid = Number.isInteger(guests) && guests >= 1 && (r ? guests <= r.roomType.maxGuests : true);
  const availability = useGet<Availability>(
    '/rooms/available?' + new URLSearchParams({ checkIn, checkOut, guests: String(guests) }),
    !!isValidDates && isCapacityValid,
  );
  const isAvailable = availability.data?.data.some(candidate => candidate.id === id) === true;
  const isReadyToBook =
    isValidDates && isCapacityValid && isAvailable && !availability.isFetching && r?.operationalStatus === 'ACTIVE';

  const totalEstimate =
    isValidDates && r
      ? money(
          decimal(cents(r.roomType.nightlyPrice) * BigInt(nights)),
        )
      : '';

  const handleParamChange = (updates: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
  }) => {
    const next = new URLSearchParams(params);
    if (updates.checkIn !== undefined) {
      if (updates.checkIn) next.set('checkIn', updates.checkIn);
      else next.delete('checkIn');
    }
    if (updates.checkOut !== undefined) {
      if (updates.checkOut) next.set('checkOut', updates.checkOut);
      else next.delete('checkOut');
    }
    if (updates.guests !== undefined) {
      next.set('guests', String(updates.guests));
    }
    setParams(next, { replace: true });
  };

  const create = useMutation({
    retry: false,
    mutationFn: () => {
      const currentDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (checkIn < currentDay) throw new LocalizedError("guest:roomPages.theCheckInDateHasPassedPleaseChooseYourStayDatesAgain");
      const input = bookingSchema.parse({
        checkIn,
        checkOut,
        guests,
        roomId: id,
      });
      return api.request<Booking>('/bookings', {
        method: 'POST',
        body: {
          roomId: input.roomId,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guests: input.guests,
        },
      });
    },
    onSuccess: async (b) => {
      void qc.invalidateQueries({ queryKey: ['guest'] });
      try {
        const payment = await api.request<{ checkoutUrl: string }>(`/bookings/${b.id}/payos`, { method: 'POST' });
        window.location.assign(payment.checkoutUrl);
      } catch {
        toast(() => (tr("guest:roomPages.yourReservationRequestIsSavedButUnpaidContinuePaymentOnTheReservation")));
        navigate('/guest/bookings/' + b.id);
      }
    },
  });

  if (room.isPending) return <Skeleton />;
  if (room.error)
    return (
      <ErrorState
        message={safeError(room.error)}
        retry={() => void room.refetch()}
      />
    );

  const roomData = room.data!;
  const galleryImages = getGalleryImages(roomData.roomType.name);

  const primaryActionButton = isReadyToBook ? (
    auth.user?.role && auth.user.role !== 'GUEST' ? (
      <p className="booking-tax-note">{tr("guest:roomPages.reservationsRequireAGuestAccount")}</p>
    ) : (
      <Button
        className="booking-submit-btn"
        onClick={() =>
          auth.user
            ? setConfirm(true)
            : navigate('/login', {
                state: { from: location.pathname + location.search },
              })
        }
      >
        {auth.user ? tr("guest:roomAmenities.bookNow") : tr("guest:roomPages.signInToBook")}
      </Button>
    )
  ) : (
    <Button disabled className="booking-submit-btn">
      {!isValidDates
        ? tr("guest:roomPages.chooseCheckInCheckOutDates")
        : !isCapacityValid
        ? tr("guest:roomPages.upToValueGuests", { value0: (roomData.roomType.maxGuests) })
        : roomData.operationalStatus !== 'ACTIVE'
        ? tr("guest:roomPages.roomTemporarilyOutOfService")
        : availability.isFetching ? tr("guest:roomPages.checkingAvailability")
        : availability.error ? tr("guest:roomPages.unableToCheckAvailability")
        : tr("guest:roomPages.theRoomIsUnavailableForTheseDates")}
    </Button>
  );



  return (
    <div className="site-container guest-public">
      <Link to={'/rooms?' + params.toString()} className="text-link">{tr("guest:roomPages.backToRooms")}</Link>
      <PageHeading
        eyebrow={tr("guest:roomPages.anNhienARelaxingRetreat")}
        title={catalogName(roomData.roomType.name)}
      />
      <div className="guest-detail-grid">
        <div>
          <RoomGallery images={galleryImages} roomName={catalogName(roomData.roomType.name)} />
          <p className="editorial-note">{tr("guest:roomPages.illustrativePhotoShowingTheStyleOfTheValueRoomType", { value0: (catalogName(roomData.roomType.name)) })}</p>
          <h2>{tr("guest:roomPages.roomInformation")}</h2>
          <p>{catalogDescription(roomData.roomType.description, roomData.roomType.name) || tr("guest:roomPages.theRoomDescriptionIsBeingUpdatedContactReceptionForDetails")}</p>
          <p>{tr("guest:roomPages.upToValueGuestsValue", { value0: (roomData.roomType.maxGuests), value1: (roomData.operationalStatus === 'ACTIVE'
              ? tr("common:supplement.active")
              : tr("common:supplement.outOfService")) })}</p>

          <dl className="room-detail-facts">
            <div><dt>{tr("guest:roomPages.roomNumber")}</dt><dd>{roomData.roomNumber}</dd></div>
            <div><dt>{tr("guest:roomPages.floor")}</dt><dd>{roomData.floor}</dd></div>
            <div><dt>{tr("guest:roomPages.maximumCapacity")}</dt><dd>{tr("guest:bookingPages.valueGuests", { value0: (roomData.roomType.maxGuests) })}</dd></div>
            <div><dt>{tr("guest:roomCompare.pricePerNight")}</dt><dd>{money(roomData.roomType.nightlyPrice)}</dd></div>
          </dl>
          <p className="notice">{tr("guest:roomPages.amenitiesBedTypesAndIncludedServicesHaveNotBeenUpdatedInThe")}</p>
        </div>

        {/* In-Card Interactive Booking Box */}
        <section className="panel guest-box booking-box-sticky" id="dat-phong">
          <div className="booking-box-header">
            <span className="eyebrow">{tr("guest:roomPages.publishedRate")}</span>
            <div className="booking-box-price">
              <strong>{money(roomData.roomType.nightlyPrice)}</strong>
              <span>{tr("guest:homePage.night")}</span>
            </div>

          </div>

          <div className="booking-form-controls">
            <div className="booking-date-grid">
              <div className="booking-field">
                <label htmlFor="detail-check-in">{tr("guest:roomPages.checkIn")}</label>
                <input
                  type="date"
                  id="detail-check-in"
                  className="input booking-date-input"
                  value={checkIn}
                  min={todayStr}
                  onChange={(e) => handleParamChange({ checkIn: e.target.value })}
                />
              </div>
              <div className="booking-field">
                <label htmlFor="detail-check-out">{tr("guest:roomPages.checkOut")}</label>
                <input
                  type="date"
                  id="detail-check-out"
                  className="input booking-date-input"
                  value={checkOut}
                  min={checkIn || todayStr}
                  onChange={(e) => handleParamChange({ checkOut: e.target.value })}
                />
              </div>
            </div>

            <div className="booking-field">
              <label htmlFor="detail-guests">{tr("guest:roomPages.numberOfGuestsUpToValue", { value0: (roomData.roomType.maxGuests) })}</label>
              <input
                type="number"
                id="detail-guests"
                className="input booking-guest-input"
                min={1}
                max={roomData.roomType.maxGuests}
                value={guests}
                onChange={(e) =>
                  handleParamChange({ guests: Math.max(1, Number(e.target.value)) })
                }
              />
            </div>
          </div>

          {isValidDates && (
            <div className="booking-live-summary">
              <div className="summary-line">
                <span>{tr("guest:roomPages.valueValueNights", { value0: (money(roomData.roomType.nightlyPrice)), value1: (nights) })}</span>
                <span>{totalEstimate}</span>
              </div>
              <div className="summary-divider" />
              <div className="summary-total-line">
                <span>{tr("guest:roomPages.estimatedTotalCharges")}</span>
                <strong>{totalEstimate}</strong>
              </div>
            </div>
          )}

          {isValidDates && isCapacityValid && availability.error && <ErrorState message={tr("guest:roomPages.unableToCheckAvailability2")} retry={() => void availability.refetch()} />}
          {isValidDates && isCapacityValid && availability.data && !isAvailable && <p role="status" className="notice"><Trans ns="guest" i18nKey="roomPages.changeDatesOrViewAvailableRooms" components={{ rooms: <Link to={'/rooms?' + params.toString()} /> }} /></p>}

          <div className="booking-perks-list">
            <p>{tr("guest:roomPages.pay100OfTheRoomChargeThroughPayosToConfirmYourRoom")}</p>
            <p>{tr("guest:roomPages.yourReservationWillAppearUnderMyReservations")}</p>
          </div>
        </section>
      </div>

      {/* Sticky Booking Summary Bar */}
      <StickyBookingBar
        roomNumber={roomData.roomNumber}
        roomTypeName={catalogName(roomData.roomType.name)}
        nightlyPrice={money(roomData.roomType.nightlyPrice)}
        stayNights={nights || undefined}
        estimatedTotal={totalEstimate || undefined}
        actionButton={primaryActionButton}
      />

      <Dialog
        open={confirm}
        onClose={() => {
          if (!create.isPending) setConfirm(false);
        }}
        title={tr("guest:roomPages.confirmReservation")}
      >
        <div className="dialog-booking-info guest-confirm-dialog-body">
          <div className="dialog-room-header">
            <span className="eyebrow">{tr("guest:roomPages.yourSelectedStay")}</span>
            <p className="dialog-room-name"><Trans ns="guest" i18nKey="roomPages.valueTypeRoomValue" values={{ value0: (catalogName(roomData.roomType.name)), value1: (roomData.roomNumber) }} components={{ part0: <strong />, part1: <small /> }} /></p>
          </div>

          {isValidDates && (
            <dl className="guest-facts dialog-facts">
              <div>
                <dt>
                  <Calendar size={14} /> {tr("guest:roomPages.stayDates")}</dt>
                <dd><Trans ns="guest" i18nKey="roomPages.valueValueValueNights" values={{ value0: (checkIn), value1: (checkOut), value2: (nights) }} components={{ part0: <strong />, part1: <strong /> }} /></dd>
              </div>
              <div>
                <dt>
                  <Users size={14} /> {tr("guest:roomPages.registeredGuests")}</dt>
                <dd>{tr("guest:bookingPages.valueGuests", { value0: (guests) })}</dd>
              </div>
              <div>
                <dt>
                  <Clock size={14} /> {tr("guest:roomPages.checkInCheckOutTimes")}</dt>
                <dd>{tr("guest:roomPages.checkInFrom1400CheckOutBefore1200")}</dd>
              </div>
              <div className="dialog-fact-highlight">
                <dt>
                  <ShieldCheck size={14} /> {tr("guest:roomPages.estimatedRoomTotal")}</dt>
                <dd>
                  <strong className="dialog-price-text">{totalEstimate}</strong>
                </dd>
              </div>
              <div>
                <dt>{tr("guest:roomPages.paymentMethod")}</dt>
                <dd>{tr("guest:roomPages.payTheFullRoomChargeThroughPayosWhenBookingOnline")}</dd>
              </div>
            </dl>
          )}

          <div className="dialog-guarantee-note">
            <ShieldCheck size={16} />
            <p>{tr("guest:roomPages.payTheRoomChargeToConfirmYourReservation")}</p>
          </div>
        </div>

        {create.error && (
          <div className="dialog-error-wrap">
            <p role="alert" className="form-error">
              {create.error instanceof ApiError && create.error.status === 0
                ? guestError(create.error, 'create')
                : guestError(create.error, 'booking')}
            </p>
            <div className="dialog-error-actions">
              <LinkButton to="/rooms" variant="secondary">{tr("guest:roomPages.searchRoomsAgain")}</LinkButton>
              <LinkButton to="/guest/bookings" variant="ghost">{tr("guest:roomPages.checkMyReservations")}</LinkButton>
            </div>
          </div>
        )}
        <div className="dialog-actions">
          <Button
            variant="secondary"
            disabled={create.isPending}
            onClick={() => setConfirm(false)}
          >{tr("guest:bookingPages.back")}</Button>
          <Button
            busy={create.isPending}
            disabled={!!create.error}
            onClick={() => create.mutate()}
          >{tr("guest:roomPages.bookPay")}</Button>
        </div>
      </Dialog>
    </div>
  );
}
