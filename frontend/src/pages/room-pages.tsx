import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpDown,
  Bath,
  Filter,
  Scale,
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
  decimal,
  cents,
  guestError,
  money,
  readStay,
  searchParams,
  type Availability,
  type Booking,
  type Page,
  type Room,
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
import {
  CompareFloatingBar,
  RoomCompareModal,
} from '../features/guest/room-compare';

export function RoomResults({
  rooms,
  query = '',
  comparedIds = [],
  onToggleCompare,
}: {
  rooms: Room[];
  query?: string;
  comparedIds?: string[];
  onToggleCompare?: (roomId: string) => void;
}) {
  return (
    <div className="guest-room-grid">
      {rooms.map((r, i) => {
        const isCompared = comparedIds.includes(r.id);
        const imageSrc = i % 2 ? '/images/retreat.jpg' : '/images/suite.jpg';

        return (
          <article className="panel guest-room" key={r.id}>
            <Link to={`/rooms/${r.id}${query ? '?' + query : ''}`}>
              <img
                src={imageSrc}
                alt="Ảnh minh họa phong cách phòng"
                loading="lazy"
              />
              <small>Ảnh minh họa · Phòng {r.roomNumber}</small>
            </Link>
            <div>
              <div className="room-card-top-tags">
                <p className="eyebrow">
                  TẦNG {r.floor} · TỐI ĐA {r.roomType.maxGuests} KHÁCH
                </p>
                {onToggleCompare && (
                  <button
                    type="button"
                    className={`room-compare-tag ${isCompared ? 'active' : ''}`}
                    onClick={() => onToggleCompare(r.id)}
                    aria-label={`So sánh phòng ${r.roomNumber}`}
                  >
                    <Scale size={13} />
                    {isCompared ? 'Đã chọn so sánh' : 'So sánh'}
                  </button>
                )}
              </div>
              <h2>{r.roomType.name}</h2>
              <p>{r.roomType.description}</p>

              {/* Amenity Pills */}
              <div className="room-amenities-pills">
                <span className="amenity-pill"><Wifi size={12} /> Wi-Fi</span>
                <span className="amenity-pill"><Bath size={12} /> Bồn tắm</span>
                <span className="amenity-pill"><Wind size={12} /> Điều hòa</span>
              </div>

              <p>
                <strong>{money(r.roomType.nightlyPrice)}</strong> / đêm
              </p>
              {r.estimatedTotalAmount && (
                <p>
                  Dự kiến: <strong>{money(r.estimatedTotalAmount)}</strong>
                </p>
              )}
              <p>
                {r.operationalStatus === 'ACTIVE'
                  ? 'Đang hoạt động · Kiểm tra theo ngày lưu trú'
                  : 'Tạm ngừng phục vụ'}
              </p>
              <div className="room-card-actions">
                <LinkButton
                  to={`/rooms/${r.id}${query ? '?' + query : ''}`}
                  variant="secondary"
                >
                  Xem phòng {r.roomNumber}
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

  // Secondary interactive UI filters
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc'>('default');
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const path =
    searching && stay.success
      ? '/rooms/available?' + searchParams(stay.data)
      : `/rooms?page=${page}&pageSize=6`;
  const result = useGet<Page<Room> | Availability>(path, !searching || stay.success);

  const rawRooms = result.data?.data ?? [];

  // Client-side filtering & sorting for enhanced UX
  const processedRooms = useMemo(() => {
    let list = [...rawRooms];
    if (selectedFloor) {
      list = list.filter((r) => String(r.floor) === selectedFloor);
    }
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
  }, [rawRooms, selectedFloor, sortBy]);

  const toggleCompare = (id: string) => {
    setComparedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const clearCompare = () => setComparedIds([]);

  return (
    <div className="site-container guest-public">
      <PageHeading
        eyebrow="AN NHIÊN · KHÔNG GIAN LƯU TRÚ"
        title="Một chốn dành cho bạn."
        description="Chọn ngày lưu trú để xem phòng phù hợp và chi phí dự kiến."
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

      {/* Advanced Quick Filters Bar */}
      {result.data && rawRooms.length > 0 && (
        <div className="rooms-quick-filter-bar">
          <div className="filter-group">
            <span className="filter-title">
              <Filter size={15} /> Lọc nhanh:
            </span>
            <select
              className="input quick-select"
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              aria-label="Lọc theo tầng"
            >
              <option value="">Tất cả các tầng</option>
              {Array.from(new Set(rawRooms.map((r) => r.floor)))
                .sort((a, b) => a - b)
                .map((f) => (
                  <option key={f} value={f}>
                    Tầng {f}
                  </option>
                ))}
            </select>
          </div>

          <div className="filter-group">
            <span className="filter-title">
              <ArrowUpDown size={15} /> Sắp xếp:
            </span>
            <select
              className="input quick-select"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'default' | 'price-asc' | 'price-desc')
              }
              aria-label="Sắp xếp kết quả"
            >
              <option value="default">Mặc định</option>
              <option value="price-asc">Giá: Thấp đến cao</option>
              <option value="price-desc">Giá: Cao đến thấp</option>
            </select>
          </div>

          {comparedIds.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => setCompareModalOpen(true)}
              className="compare-trigger-btn"
            >
              <Scale size={15} /> So sánh ({comparedIds.length})
            </Button>
          )}
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
      ) : result.data && (
        <>
          {'nights' in result.data && (
            <p className="notice">
              {result.data.nights} đêm · {result.data.guests} khách. Kết quả
              tìm kiếm chưa giữ phòng; giá và khả dụng được xác nhận khi đặt.
            </p>
          )}
          {!processedRooms.length ? (
            <EmptyState
              title="Chưa có phòng phù hợp"
              description="Hãy thử ngày lưu trú khác, giảm số khách hoặc chọn loại phòng khác."
            />
          ) : (
            <RoomResults
              rooms={processedRooms}
              query={stay.success ? searchParams(stay.data) : ''}
              comparedIds={comparedIds}
              onToggleCompare={toggleCompare}
            />
          )}
          {'meta' in result.data && (
            <Pagination
              {...result.data.meta}
              onChange={(p) => setParams({ page: String(p) })}
            />
          )}
        </>
      )}

      {/* Floating Compare Dock & Modal */}
      <CompareFloatingBar
        count={comparedIds.length}
        onOpen={() => setCompareModalOpen(true)}
        onClear={clearCompare}
      />
      <RoomCompareModal
        rooms={rawRooms}
        comparedIds={comparedIds}
        onRemove={toggleCompare}
        onClear={clearCompare}
        open={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        queryStay={stay.success ? searchParams(stay.data) : ''}
      />
    </div>
  );
}

export function RoomDetailPage() {
  const { id = '' } = useParams(),
    [params] = useSearchParams(),
    location = useLocation(),
    auth = useAuth(),
    navigate = useNavigate(),
    qc = useQueryClient(),
    toast = useToast();
  const room = useGet<Room>('/rooms/' + id),
    stay = readStay(params),
    [confirm, setConfirm] = useState(false);

  const create = useMutation({
    retry: false,
    mutationFn: () => {
      const input = bookingSchema.parse({
        ...(stay.success ? stay.data : {}),
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

  const r = room.data!;
  const valid =
    stay.success &&
    stay.data.guests <= r.roomType.maxGuests &&
    r.operationalStatus === 'ACTIVE';

  const nights = stay.success
    ? (Date.parse(stay.data.checkOut) - Date.parse(stay.data.checkIn)) / 86400000
    : 0;

  const totalEstimate = stay.success
    ? money(
        decimal(
          cents(r.roomType.nightlyPrice) * BigInt(nights),
        ),
      )
    : '';

  // Multi-angle photo gallery
  const galleryImages: GalleryImage[] = [
    {
      src: '/images/suite.jpg',
      alt: 'Không gian phòng nghỉ ngập tràn ánh sáng và chất liệu gỗ ấm',
      title: `Phòng ${r.roomNumber} · Không gian chính`,
    },
    {
      src: '/images/retreat.jpg',
      alt: 'Góc nghỉ ngơi thư thái với ánh sáng tự nhiên',
      title: 'Khu vực giường nghỉ êm ái',
    },
    {
      src: '/images/hero.jpg',
      alt: 'Toàn cảnh khuôn viên khách sạn và hồ bơi xanh mát',
      title: 'Tầm nhìn từ ban công phòng',
    },
  ];

  const primaryActionButton = valid ? (
    auth.user?.role && auth.user.role !== 'GUEST' ? (
      <p>Đặt phòng dành cho tài khoản khách lưu trú.</p>
    ) : (
      <Button
        onClick={() =>
          auth.user
            ? setConfirm(true)
            : navigate('/login', {
                state: { from: location.pathname + location.search },
              })
        }
      >
        {auth.user ? 'Đặt phòng này' : 'Đăng nhập để đặt phòng'}
      </Button>
    )
  ) : (
    <p>Vui lòng chọn ngày hợp lệ và số khách phù hợp để đặt phòng.</p>
  );

  return (
    <div className="site-container guest-public">
      <Link to={'/rooms?' + params.toString()} className="text-link">
        ← Quay lại tìm phòng
      </Link>
      <PageHeading
        eyebrow={`PHÒNG ${r.roomNumber} · TẦNG ${r.floor}`}
        title={r.roomType.name}
      />
      <div className="guest-detail-grid">
        <div>
          <RoomGallery images={galleryImages} roomName={r.roomType.name} />
          <p className="editorial-note">
            Ảnh local minh họa phong cách, chưa phải ảnh riêng của phòng.
          </p>
          <p>{r.roomType.description}</p>
          <p>
            Tối đa {r.roomType.maxGuests} khách ·{' '}
            {r.operationalStatus === 'ACTIVE'
              ? 'Đang hoạt động'
              : 'Tạm ngừng phục vụ'}
          </p>

          {/* Detailed Amenities Block */}
          <RoomAmenitiesSection />
        </div>

        <section className="panel guest-box" id="dat-phong">
          <h2>Kỳ nghỉ của bạn</h2>
          <p>
            <strong>{money(r.roomType.nightlyPrice)}</strong> / đêm
          </p>
          {stay.success && (
            <>
              <p>
                {stay.data.checkIn} → {stay.data.checkOut}
              </p>
              <p>
                {nights} đêm · {stay.data.guests} khách
              </p>
              <p>
                Tổng dự kiến: <strong>{totalEstimate}</strong>
              </p>
            </>
          )}
          <p>Phòng chưa được giữ. Giá cuối cùng do hệ thống xác nhận khi đặt.</p>
          {primaryActionButton}
          <LinkButton to="/guest/bookings" variant="ghost">
            Kiểm tra booking của tôi
          </LinkButton>
        </section>
      </div>

      <SearchForm initial={stay.success ? stay.data : undefined} />

      {/* Sticky Booking Summary Bar */}
      <StickyBookingBar
        roomNumber={r.roomNumber}
        roomTypeName={r.roomType.name}
        nightlyPrice={money(r.roomType.nightlyPrice)}
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
        <p>
          Phòng {r.roomNumber} · {r.roomType.name}
        </p>
        {stay.success && (
          <p>
            {stay.data.checkIn} → {stay.data.checkOut} · {stay.data.guests} khách
            <br />
            Tổng dự kiến: {totalEstimate}
          </p>
        )}
        {create.error && (
          <>
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
          </>
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
