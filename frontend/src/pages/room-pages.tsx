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
    alt: `Ảnh minh họa hạng phòng ${roomTypeName}`,
    title: 'Ảnh minh họa · Không phải ảnh xác nhận của phòng',
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
  return (
    <div className="ready-room-list">
      {rooms.map((room) => (
        <article className="ready-room-card" key={room.id}>
          {/* Room Media Thumbnail */}
          <div className="ready-room-media">
            <img
              src={getRoomTypeImage(room.roomType.name)}
              alt={`Phòng ${room.roomNumber} - ${room.roomType.name}`}
              loading="lazy"
            />
            <div className="ready-room-media-badges">
              <span className="room-type-chip">{room.roomType.name}</span>
              <span className="room-floor-chip">Tầng {room.floor}</span>
            </div>
          </div>

          {/* Room Card Body */}
          <div className="ready-room-body">
            <div>
              <div className="ready-room-header">
                <div className="ready-room-title-block">
                  <h2>Phòng {room.roomNumber}</h2>
                  <p className="ready-room-type-sub">
                    {room.roomType.name} · Không gian an nhiên
                  </p>
                </div>
                <span className="ready-room-status-badge">
                  <span className="status-dot-pulse" /> Còn trống
                </span>
              </div>

              <p className="ready-room-desc">
                {room.roomType.description ||
                  'Không gian nghỉ ngơi thanh bình, trang bị nội thất gỗ ấm áp và tiện nghi chu đáo cho kỳ nghỉ trọn vẹn.'}
              </p>

              {/* Specs & Amenities Pills */}
              <div className="ready-room-amenities">
                <span className="ready-spec-pill">
                  <Users size={14} /> Tối đa {room.roomType.maxGuests} khách
                </span>
                <span className="ready-spec-pill">
                  <BedDouble size={14} /> Giường đệm cao cấp
                </span>
                <span className="ready-spec-pill">
                  <Wifi size={14} /> Wifi tốc độ cao
                </span>
                <span className="ready-spec-pill">
                  <Coffee size={14} /> Trà & Nước khoáng
                </span>
              </div>
            </div>

            {/* Price & Action */}
            <div className="ready-room-footer">
              <div className="ready-room-price">
                <div className="price-main">
                  <strong>{money(room.roomType.nightlyPrice)}</strong>
                  <small>/ đêm</small>
                </div>
                {nights > 1 && (
                  <span className="price-total-estimate">
                    Dự kiến {nights} đêm: {money(decimal(cents(room.roomType.nightlyPrice) * BigInt(nights)))}
                  </span>
                )}
                <span className="price-tax-note">Đã bao gồm thuế & phí dịch vụ</span>
              </div>

              <LinkButton
                to={`/rooms/${room.id}?${query}`}
                className="ready-room-book-btn"
              >
                Đặt phòng <ArrowRight size={16} />
              </LinkButton>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function RoomsPage() {
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
          <span>✦</span> BỘ SƯU TẬP PHÒNG NGHỈ
        </div>
        <h1>Phòng sẵn sàng</h1>

      </div>

      {!stay.success ? (
        <ErrorState message="Vui lòng chọn ngày trả phòng sau ngày nhận phòng và số khách hợp lệ." />
      ) : result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState
          message={result.error.message}
          retry={() => void result.refetch()}
        />
      ) : (
        <>
          {/* Quick Filter Tabs */}
          {roomTypesInResults.length > 1 && (
            <div className="ready-room-tabs-bar" role="tablist" aria-label="Lọc theo hạng phòng">
              <button
                type="button"
                className={`ready-room-tab-btn ${activeTypeId === 'ALL' ? 'active' : ''}`}
                onClick={() => setActiveTypeId('ALL')}
              >
                Tất cả hạng phòng <span className="ready-room-tab-count">{rooms.length}</span>
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
                    {t.name} <span className="ready-room-tab-count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Availability Status Bar */}
          <div className="ready-room-count-bar">
            <p className="ready-room-count" role="status">
              <strong>{displayedRooms.length} phòng</strong>{' '}
              {stay.data.checkIn === today ? 'sẵn sàng đón bạn hôm nay' : 'còn trống'} ·{' '}
              {stay.data.checkIn.split('-').reverse().join('/')} –{' '}
              {stay.data.checkOut.split('-').reverse().join('/')}
            </p>
            <div className="ready-room-trust-tags">
              <span>✓ Giữ giá niêm yết</span>
              <span>✓ Không phụ phí ẩn</span>
              <span>✓ Xác nhận tức thì</span>
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
              title="Không có phòng sẵn sàng"
              description="Thử đổi hạng phòng hoặc tìm kiếm ngày nhận/trả phòng khác."
            />
          )}
        </>
      )}
    </div>
  );
}

export function RoomDetailPage() {
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
      if (checkIn < currentDay) throw new Error('Ngày nhận phòng đã qua. Vui lòng chọn lại ngày lưu trú.');
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
    onSuccess: (b) => {
      void qc.invalidateQueries({ queryKey: ['guest'] });
      toast('Đặt phòng thành công. Giá đã được xác nhận.');
      navigate('/guest/bookings/' + b.id);
    },
  });

  if (room.isPending) return <Skeleton />;
  if (room.error)
    return (
      <ErrorState
        message={room.error.message}
        retry={() => void room.refetch()}
      />
    );

  const roomData = room.data!;
  const galleryImages = getGalleryImages(roomData.roomType.name);

  const primaryActionButton = isReadyToBook ? (
    auth.user?.role && auth.user.role !== 'GUEST' ? (
      <p className="booking-tax-note">Đặt phòng dành cho tài khoản khách lưu trú.</p>
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
        {auth.user ? 'Đặt phòng này ngay' : 'Đăng nhập để đặt phòng'}
      </Button>
    )
  ) : (
    <Button disabled className="booking-submit-btn">
      {!isValidDates
        ? 'Chọn ngày nhận & trả phòng'
        : !isCapacityValid
        ? `Tối đa ${roomData.roomType.maxGuests} khách`
        : roomData.operationalStatus !== 'ACTIVE'
        ? 'Phòng tạm ngừng phục vụ'
        : availability.isFetching ? 'Đang kiểm tra phòng trống…'
        : availability.error ? 'Chưa kiểm tra được phòng trống'
        : 'Phòng đã kín trong ngày đã chọn'}
    </Button>
  );



  return (
    <div className="site-container guest-public">
      <Link to={'/rooms?' + params.toString()} className="text-link">
        ← Quay lại danh sách phòng
      </Link>
      <PageHeading
        eyebrow="AN NHIÊN · KHÔNG GIAN NGHỈ DƯỠNG"
        title={roomData.roomType.name}
      />
      <div className="guest-detail-grid">
        <div>
          <RoomGallery images={galleryImages} roomName={roomData.roomType.name} />
          <p className="editorial-note">
            Ảnh minh họa chuẩn phong cách hạng phòng {roomData.roomType.name}.
          </p>
          <h2>Thông tin phòng</h2>
          <p>{roomData.roomType.description || 'Mô tả phòng đang được cập nhật. Liên hệ lễ tân để biết thêm chi tiết.'}</p>
          <p>
            Tối đa {roomData.roomType.maxGuests} khách ·{' '}
            {roomData.operationalStatus === 'ACTIVE'
              ? 'Đang hoạt động'
              : 'Tạm ngừng phục vụ'}
          </p>

          <dl className="room-detail-facts">
            <div><dt>Số phòng</dt><dd>{roomData.roomNumber}</dd></div>
            <div><dt>Tầng</dt><dd>{roomData.floor}</dd></div>
            <div><dt>Sức chứa tối đa</dt><dd>{roomData.roomType.maxGuests} khách</dd></div>
            <div><dt>Giá mỗi đêm</dt><dd>{money(roomData.roomType.nightlyPrice)}</dd></div>
          </dl>
          <p className="notice">Tiện nghi, loại giường và dịch vụ đi kèm chưa được cập nhật trong hệ thống. Vui lòng xác nhận với lễ tân nếu bạn có yêu cầu riêng.</p>
        </div>

        {/* In-Card Interactive Booking Box */}
        <section className="panel guest-box booking-box-sticky" id="dat-phong">
          <div className="booking-box-header">
            <span className="eyebrow">GIÁ NIÊM YẾT</span>
            <div className="booking-box-price">
              <strong>{money(roomData.roomType.nightlyPrice)}</strong>
              <span>/ đêm</span>
            </div>
            <p className="booking-tax-note">Giá tiền phòng mỗi đêm theo hệ thống</p>
          </div>

          <div className="booking-form-controls">
            <div className="booking-date-grid">
              <div className="booking-field">
                <label htmlFor="detail-check-in">Nhận phòng</label>
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
                <label htmlFor="detail-check-out">Trả phòng</label>
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
              <label htmlFor="detail-guests">
                Số lượng khách (Tối đa {roomData.roomType.maxGuests} khách)
              </label>
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
                <span>{money(roomData.roomType.nightlyPrice)} × {nights} đêm</span>
                <span>{totalEstimate}</span>
              </div>
              <div className="summary-divider" />
              <div className="summary-total-line">
                <span>Tổng chi phí dự kiến:</span>
                <strong>{totalEstimate}</strong>
              </div>
            </div>
          )}

          {isValidDates && isCapacityValid && availability.error && <ErrorState message="Chưa kiểm tra được phòng trống." retry={() => void availability.refetch()} />}
          {isValidDates && isCapacityValid && availability.data && !isAvailable && <p role="status" className="notice">Hãy đổi ngày lưu trú hoặc <Link to={'/rooms?' + params.toString()}>xem phòng khác còn trống</Link>.</p>}
          <div className="booking-action-wrap">
            {primaryActionButton}
          </div>

          <div className="booking-perks-list">
            <p>Kiểm tra lại ngày, số khách và tổng tiền trước khi xác nhận.</p>
            <p>Đơn đặt phòng sẽ hiển thị trong mục Đặt phòng của tôi.</p>
          </div>
        </section>
      </div>

      {/* Sticky Booking Summary Bar */}
      <StickyBookingBar
        roomNumber={roomData.roomNumber}
        roomTypeName={roomData.roomType.name}
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
        title="Xác nhận đặt phòng"
      >
        <div className="dialog-booking-info guest-confirm-dialog-body">
          <div className="dialog-room-header">
            <span className="eyebrow">THÔNG TIN KỲ NGHỈ ĐÃ CHỌN</span>
            <p className="dialog-room-name">
              <strong>Hạng {roomData.roomType.name}</strong>
              <small>Phòng {roomData.roomNumber}</small>
            </p>
          </div>

          {isValidDates && (
            <dl className="guest-facts dialog-facts">
              <div>
                <dt>
                  <Calendar size={14} /> Thời gian lưu trú
                </dt>
                <dd>
                  <strong>{checkIn}</strong> → <strong>{checkOut}</strong> ({nights} đêm)
                </dd>
              </div>
              <div>
                <dt>
                  <Users size={14} /> Số khách đăng ký
                </dt>
                <dd>{guests} khách</dd>
              </div>
              <div>
                <dt>
                  <Clock size={14} /> Giờ nhận & trả phòng
                </dt>
                <dd>Nhận từ 14:00 · Trả trước 12:00</dd>
              </div>
              <div className="dialog-fact-highlight">
                <dt>
                  <ShieldCheck size={14} /> Tổng tiền phòng dự kiến
                </dt>
                <dd>
                  <strong className="dialog-price-text">{totalEstimate}</strong>
                </dd>
              </div>
              <div>
                <dt>Hình thức thanh toán</dt>
                <dd>Thanh toán tại quầy khi nhận phòng (Tiền mặt / Chuyển khoản)</dd>
              </div>
            </dl>
          )}

          <div className="dialog-guarantee-note">
            <ShieldCheck size={16} />
            <p>
              Giá tiền phòng sẽ được hệ thống xác nhận khi đặt thành công. Dịch vụ phát sinh được tính riêng.
            </p>
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
              <LinkButton to="/rooms" variant="secondary">
                Tìm lại phòng
              </LinkButton>
              <LinkButton to="/guest/bookings" variant="ghost">
                Kiểm tra booking của tôi
              </LinkButton>
            </div>
          </div>
        )}
        <div className="dialog-actions">
          <Button
            variant="secondary"
            disabled={create.isPending}
            onClick={() => setConfirm(false)}
          >
            Quay lại
          </Button>
          <Button
            busy={create.isPending}
            disabled={!!create.error}
            onClick={() => create.mutate()}
          >
            Xác nhận đặt phòng
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
