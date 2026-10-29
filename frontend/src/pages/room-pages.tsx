import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpDown,
  Bath,
  Wifi,
  Wind,
} from 'lucide-react';
import {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeading,
  Pagination,
} from '../components/ui';
import { SearchForm, Skeleton } from '../features/guest/components';
import { useGet, useRoomTypes } from '../features/guest/queries';
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
  type Page,
  type Room,
  type RoomType,
} from '../features/guest/contracts';
import { useAuth } from '../features/auth/auth-context';
import { api } from '../lib/api';
import { ApiError } from '../lib/api-client';
import { useToast } from '../components/toast-context';
import { RoomGallery, type GalleryImage } from '../components/lightbox';
import {
  RoomAmenitiesSection,
  StickyBookingBar,
} from '../features/guest/room-amenities';

export interface RoomTypeGroup {
  roomType: RoomType;
  availableCount: number;
  representativeRoom: Room;
  rooms: Room[];
}

function getRoomTypeImage(typeName: string): string {
  const lower = typeName.toLowerCase();
  if (lower.includes('suite')) return '/images/suite.jpg';
  if (lower.includes('deluxe') || lower.includes('retreat')) return '/images/retreat.jpg';
  return '/images/hero.jpg';
}

function getGalleryImages(roomTypeName: string): GalleryImage[] {
  const lower = roomTypeName.toLowerCase();
  if (lower.includes('suite')) {
    return [
      {
        src: '/images/suite.jpg',
        alt: 'Phòng Suite với thiết kế tinh tế và phòng khách rộng mở',
        title: `${roomTypeName} · Không gian chính`,
      },
      {
        src: '/images/retreat.jpg',
        alt: 'Khu vực giường ngủ êm ái ngập tràn ánh sáng tự nhiên',
        title: 'Giường King êm ái',
      },
      {
        src: '/images/hero.jpg',
        alt: 'Tầm nhìn thoáng đãng và khuôn viên xanh',
        title: 'Ban công thư thái',
      },
    ];
  }
  if (lower.includes('deluxe') || lower.includes('retreat')) {
    return [
      {
        src: '/images/retreat.jpg',
        alt: 'Phòng Deluxe ấm cúng với chất liệu gỗ tự nhiên',
        title: `${roomTypeName} · Không gian nghỉ ngơi`,
      },
      {
        src: '/images/suite.jpg',
        alt: 'Góc làm việc và thư giãn yên tĩnh',
        title: 'Khu vực thư giãn',
      },
      {
        src: '/images/hero.jpg',
        alt: 'Khuôn viên xanh mát nhìn từ ban công',
        title: 'Cảnh quan tươi mát',
      },
    ];
  }
  return [
    {
      src: '/images/hero.jpg',
      alt: 'Không gian phòng nghỉ thanh lịch và đón sáng tự nhiên',
      title: `${roomTypeName} · Không gian nghỉ dưỡng`,
    },
    {
      src: '/images/retreat.jpg',
      alt: 'Khu vực giường ngủ thoải mái',
      title: 'Giường êm ái',
    },
    {
      src: '/images/suite.jpg',
      alt: 'Phòng tắm tiện nghi và sạch sẽ',
      title: 'Tiện nghi hoàn chỉnh',
    },
  ];
}

export function RoomResults({
  roomGroups,
  query = '',
  stayNights = 0,
}: {
  roomGroups: RoomTypeGroup[];
  query?: string;
  stayNights?: number;
}) {
  return (
    <div className="guest-room-grid">
      {roomGroups.map(({ roomType, availableCount, representativeRoom }) => {
        const imageSrc = getRoomTypeImage(roomType.name);
        const totalEstimate =
          stayNights > 0
            ? money(decimal(cents(roomType.nightlyPrice) * BigInt(stayNights)))
            : null;

        return (
          <article className="panel guest-room" key={roomType.id}>
            <Link to={`/rooms/${representativeRoom.id}${query ? '?' + query : ''}`}>
              <img
                src={imageSrc}
                alt={`Không gian hạng phòng ${roomType.name}`}
                loading="lazy"
              />
              <small>Ảnh phong cách · Hạng {roomType.name}</small>
            </Link>
            <div>
              <div className="room-card-top-tags">
                <p className="eyebrow">
                  HẠNG PHÒNG NGHỈ DƯỠNG · TỐI ĐA {roomType.maxGuests} KHÁCH
                </p>
                {availableCount > 1 ? (
                  <span className="room-available-badge">
                    ✓ Còn {availableCount} phòng trống
                  </span>
                ) : availableCount === 1 ? (
                  <span className="room-available-badge urgent">
                    ⚡ Chỉ còn 1 phòng cuối
                  </span>
                ) : null}
              </div>
              <h2>{roomType.name}</h2>
              <p>{roomType.description}</p>

              {/* Amenity Pills */}
              <div className="room-amenities-pills">
                <span className="amenity-pill"><Wifi size={12} /> Wi-Fi 6</span>
                <span className="amenity-pill"><Bath size={12} /> Bồn tắm</span>
                <span className="amenity-pill"><Wind size={12} /> Điều hòa</span>
              </div>

              <p>
                <strong>{money(roomType.nightlyPrice)}</strong> / đêm
              </p>
              {totalEstimate && (
                <p className="room-estimate-price">
                  Dự kiến ({stayNights} đêm): <strong>{totalEstimate}</strong>
                </p>
              )}
              <div className="room-card-actions">
                <LinkButton
                  to={`/rooms/${representativeRoom.id}${query ? '?' + query : ''}`}
                  variant="primary"
                >
                  Chọn hạng phòng này
                </LinkButton>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function RoomsPage() {
  const [params, setParams] = useSearchParams();
  const stay = readStay(params);
  const searching = ['checkIn', 'checkOut', 'guests', 'roomTypeId'].some((k) =>
    params.has(k),
  );
  const page = Math.max(1, Number(params.get('page')) || 1);
  const types = useRoomTypes();

  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc'>('default');

  const path =
    searching && stay.success
      ? '/rooms/available?' + searchParams(stay.data)
      : `/rooms?page=${page}&pageSize=12`;
  const result = useGet<Page<Room> | Availability>(path, !searching || stay.success);

  // Group raw physical rooms into distinct Room Types
  const roomGroups = useMemo(() => {
    const rawRooms = result.data?.data ?? [];
    const map = new Map<string, RoomTypeGroup>();
    for (const r of rawRooms) {
      const existing = map.get(r.roomType.id);
      if (existing) {
        existing.availableCount += 1;
        existing.rooms.push(r);
      } else {
        map.set(r.roomType.id, {
          roomType: r.roomType,
          availableCount: 1,
          representativeRoom: r,
          rooms: [r],
        });
      }
    }
    const list = Array.from(map.values());
    if (sortBy === 'price-asc') {
      list.sort(
        (a, b) =>
          Number(a.roomType.nightlyPrice) - Number(b.roomType.nightlyPrice),
      );
    } else if (sortBy === 'price-desc') {
      list.sort(
        (a, b) =>
          Number(b.roomType.nightlyPrice) - Number(a.roomType.nightlyPrice),
      );
    }
    return list;
  }, [result.data, sortBy]);

  const stayNights =
    stay.success && nightsBetween(stay.data.checkIn, stay.data.checkOut) > 0
      ? nightsBetween(stay.data.checkIn, stay.data.checkOut)
      : 0;

  return (
    <div className="site-container guest-public">
      <PageHeading
        eyebrow="AN NHIÊN · KHÔNG GIAN LƯU TRÚ"
        title="Một chốn dành cho bạn."
        description="Chọn ngày lưu trú để xem các hạng phòng phù hợp và chi phí dự kiến."
      />
      <SearchForm
        key={params.toString()}
        initial={stay.success ? stay.data : undefined}
        roomTypes={types.data}
      />
      {types.error && (
        <p role="status">
          Chưa tải được bộ lọc loại phòng. Bạn vẫn có thể tìm tất cả phòng.
        </p>
      )}

      {/* Clean Toolbar: Count & Sort */}
      {result.data && roomGroups.length > 0 && (
        <div className="rooms-clean-toolbar">
          <span className="rooms-count-info">
            Tìm thấy {roomGroups.length} hạng phòng nghỉ dưỡng
          </span>
          <div className="filter-group">
            <span className="filter-title">
              <ArrowUpDown size={15} /> Sắp xếp:
            </span>
            <select
              className="input quick-select"
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as 'default' | 'price-asc' | 'price-desc',
                )
              }
              aria-label="Sắp xếp kết quả"
            >
              <option value="default">Mặc định</option>
              <option value="price-asc">Giá: Thấp đến cao</option>
              <option value="price-desc">Giá: Cao đến thấp</option>
            </select>
          </div>
        </div>
      )}

      {searching && !stay.success ? (
        <ErrorState message="Ngày lưu trú hoặc số khách chưa hợp lệ. Vui lòng tìm lại." />
      ) : result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState
          message={result.error.message}
          retry={() => void result.refetch()}
        />
      ) : (
        result.data && (
          <>
            {'nights' in result.data && (
              <p className="notice">
                {result.data.nights} đêm · {result.data.guests} khách. Bạn có thể chọn hạng phòng phù hợp để tiến hành giữ phòng.
              </p>
            )}
            {!roomGroups.length ? (
              <EmptyState
                title="Chưa có hạng phòng phù hợp"
                description="Hãy thử ngày lưu trú khác, giảm số khách hoặc chọn hạng phòng khác."
              />
            ) : (
              <RoomResults
                roomGroups={roomGroups}
                query={stay.success ? searchParams(stay.data) : ''}
                stayNights={stayNights}
              />
            )}
            {'meta' in result.data && result.data.meta.totalPages > 1 && (
              <Pagination
                {...result.data.meta}
                onChange={(p) => setParams({ page: String(p) })}
              />
            )}
          </>
        )
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

  const isValidDates =
    calendarDate(checkIn) &&
    calendarDate(checkOut) &&
    nightsBetween(checkIn, checkOut) > 0;
  const nights = isValidDates ? nightsBetween(checkIn, checkOut) : 0;
  const r = room.data;
  const isCapacityValid = r ? guests <= r.roomType.maxGuests : true;
  const isReadyToBook =
    isValidDates && isCapacityValid && r?.operationalStatus === 'ACTIVE';

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
        : 'Phòng tạm ngừng phục vụ'}
    </Button>
  );

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

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
          <p>{roomData.roomType.description}</p>
          <p>
            Tối đa {roomData.roomType.maxGuests} khách ·{' '}
            {roomData.operationalStatus === 'ACTIVE'
              ? 'Đang hoạt động'
              : 'Tạm ngừng phục vụ'}
          </p>

          {/* Detailed Amenities Block */}
          <RoomAmenitiesSection />
        </div>

        {/* In-Card Interactive Booking Box */}
        <section className="panel guest-box booking-box-sticky" id="dat-phong">
          <div className="booking-box-header">
            <span className="eyebrow">GIÁ NIÊM YẾT</span>
            <div className="booking-box-price">
              <strong>{money(roomData.roomType.nightlyPrice)}</strong>
              <span>/ đêm</span>
            </div>
            <p className="booking-tax-note">Đã bao gồm thuế, phí dịch vụ & bữa sáng</p>
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
              <div className="summary-line">
                <span>Bữa sáng & Wi-Fi tốc độ cao</span>
                <span className="summary-free">Miễn phí</span>
              </div>
              <div className="summary-divider" />
              <div className="summary-total-line">
                <span>Tổng chi phí dự kiến:</span>
                <strong>{totalEstimate}</strong>
              </div>
            </div>
          )}

          <div className="booking-action-wrap">
            {primaryActionButton}
          </div>

          <div className="booking-perks-list">
            <p>✓ Không cần trả tiền trước · Thanh toán tại quầy lễ tân</p>
            <p>✓ Xác nhận tức thì qua hệ thống</p>
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
        <div className="dialog-booking-info">
          <p className="dialog-room-name">
            <strong>Hạng {roomData.roomType.name}</strong>
          </p>
          {isValidDates && (
            <dl className="guest-facts dialog-facts">
              <div>
                <dt>Thời gian lưu trú</dt>
                <dd>{checkIn} → {checkOut} ({nights} đêm)</dd>
              </div>
              <div>
                <dt>Số khách</dt>
                <dd>{guests} khách</dd>
              </div>
              <div>
                <dt>Tổng tiền phòng dự kiến</dt>
                <dd><strong>{totalEstimate}</strong></dd>
              </div>
              <div>
                <dt>Hình thức thanh toán</dt>
                <dd>Thanh toán tại quầy khi nhận phòng</dd>
              </div>
            </dl>
          )}
        </div>
        {create.error && (
          <div className="dialog-error-wrap">
            <p role="alert" className="form-error">
              {create.error instanceof ApiError && create.error.status === 0
                ? guestError(create.error, 'create')
                : guestError(create.error, 'booking')}
            </p>
            <LinkButton to="/rooms" variant="secondary">
              Tìm lại phòng
            </LinkButton>
            <LinkButton to="/guest/bookings" variant="ghost">
              Kiểm tra booking của tôi
            </LinkButton>
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
