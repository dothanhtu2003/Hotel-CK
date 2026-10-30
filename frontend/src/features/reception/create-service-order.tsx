import { useMemo, useRef, useState } from 'react';
import { Button, Dialog, ErrorState, Pagination } from '../../components/ui';
import { api } from '../../lib/api';
import { cents, decimal, money, type Order, type Page, type Service } from '../guest/contracts';
import { deskError, type DeskBooking } from './contracts';
import { useDeskGet, useRefreshDesk } from './queries';
import {
  BedDouble,
  Car,
  Coffee,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';

function cleanServiceName(name: string) {
  return name.replace(/^TEST\s*-\s*\d{8}\s*/i, '').trim() || name;
}

function getServiceIcon(name: string) {
  const lower = name.toLowerCase();
  if (
    lower.includes('ăn') ||
    lower.includes('bữa') ||
    lower.includes('tối') ||
    lower.includes('sáng') ||
    lower.includes('trưa') ||
    lower.includes('food') ||
    lower.includes('cơm') ||
    lower.includes('mì') ||
    lower.includes('buffet') ||
    lower.includes('bánh')
  ) {
    return <Utensils className="size-3.5 text-amber-600" />;
  }
  if (
    lower.includes('uống') ||
    lower.includes('nước') ||
    lower.includes('cà phê') ||
    lower.includes('coffee') ||
    lower.includes('tea') ||
    lower.includes('trà') ||
    lower.includes('bia') ||
    lower.includes('rượu') ||
    lower.includes('juice') ||
    lower.includes('coke')
  ) {
    return <Coffee className="size-3.5 text-amber-700" />;
  }
  if (
    lower.includes('sân bay') ||
    lower.includes('xe') ||
    lower.includes('đón') ||
    lower.includes('tiễn') ||
    lower.includes('car') ||
    lower.includes('transfer')
  ) {
    return <Car className="size-3.5 text-sky-600" />;
  }
  if (
    lower.includes('giặt') ||
    lower.includes('ủi') ||
    lower.includes('laundry') ||
    lower.includes('dọn') ||
    lower.includes('vệ sinh')
  ) {
    return <Sparkles className="size-3.5 text-teal-600" />;
  }
  return <Package className="size-3.5 text-emerald-600" />;
}

const CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'food', label: 'Đồ ăn', icon: '🍽️' },
  { id: 'drink', label: 'Đồ uống', icon: '☕' },
  { id: 'laundry', label: 'Giặt ủi', icon: '🧺' },
  { id: 'transport', label: 'Vận chuyển', icon: '🚗' },
  { id: 'other', label: 'Khác', icon: '✨' },
];

function matchCategory(name: string, catId: string) {
  if (catId === 'all') return true;
  const lower = name.toLowerCase();
  const isFood =
    lower.includes('ăn') ||
    lower.includes('bữa') ||
    lower.includes('tối') ||
    lower.includes('sáng') ||
    lower.includes('trưa') ||
    lower.includes('food') ||
    lower.includes('cơm') ||
    lower.includes('mì') ||
    lower.includes('buffet') ||
    lower.includes('bánh');
  const isDrink =
    lower.includes('uống') ||
    lower.includes('nước') ||
    lower.includes('cà phê') ||
    lower.includes('coffee') ||
    lower.includes('tea') ||
    lower.includes('trà') ||
    lower.includes('bia') ||
    lower.includes('rượu') ||
    lower.includes('juice') ||
    lower.includes('coke');
  const isLaundry =
    lower.includes('giặt') || lower.includes('ủi') || lower.includes('laundry');
  const isTransport =
    lower.includes('sân bay') ||
    lower.includes('xe') ||
    lower.includes('đón') ||
    lower.includes('tiễn') ||
    lower.includes('car') ||
    lower.includes('transfer');

  if (catId === 'food') return isFood;
  if (catId === 'drink') return isDrink;
  if (catId === 'laundry') return isLaundry;
  if (catId === 'transport') return isTransport;
  if (catId === 'other') return !isFood && !isDrink && !isLaundry && !isTransport;
  return true;
}

export function CreateServiceOrder({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (order: Order) => void;
}) {
  const [bookingPage, setBookingPage] = useState(1);
  const [servicePage, setServicePage] = useState(1);
  const [bookingId, setBookingId] = useState('');
  const [items, setItems] = useState<Record<string, number>>({});
  const [selectedServices, setSelectedServices] = useState<Record<string, Service>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [busy, setBusy] = useState(false);
  const [settlement, setSettlement] = useState<'ROOM' | 'CASH' | 'BANK_TRANSFER'>('ROOM');
  const [verifiedReceipt, setVerifiedReceipt] = useState('');
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const refresh = useRefreshDesk();

  const bookings = useDeskGet<Page<DeskBooking>>(
    `/front-desk/bookings?status=CHECKED_IN&page=${bookingPage}&pageSize=100`,
  );
  const services = useDeskGet<Page<Service>>(
    `/services?page=${servicePage}&pageSize=100`,
  );

  const allServices = useMemo(() => {
    return (services.data?.data ?? []).filter((s) => s.isActive);
  }, [services.data]);

  const selected = useMemo(() => {
    return Object.entries(items).filter(([, quantity]) => quantity > 0);
  }, [items]);

  const totalParts = useMemo(() => {
    return selected.reduce((sum, [, qty]) => sum + qty, 0);
  }, [selected]);

  const totalCents = useMemo(() => {
    return selected.reduce((sum, [id, qty]) => {
      const svc = allServices.find((s) => s.id === id) ?? selectedServices[id];
      if (!svc) return sum;
      return sum + cents(svc.currentPrice) * BigInt(qty);
    }, 0n);
  }, [selected, allServices, selectedServices]);

  const totalDisplay = money(decimal(totalCents));
  const receiptFingerprint = `${bookingId}:${settlement}:${decimal(totalCents)}`;
  const paymentVerified = verifiedReceipt === receiptFingerprint;

  const filteredServices = useMemo(() => {
    return allServices.filter((s) => {
      const matchesCat = matchCategory(s.name, selectedCategory);
      const matchesQuery =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [allServices, selectedCategory, searchQuery]);

  const selectedBooking = useMemo(() => {
    return bookings.data?.data.find((b) => b.id === bookingId);
  }, [bookings.data, bookingId]);

  const updateQuantity = (serviceId: string, delta: number) => {
    const service = allServices.find(s => s.id === serviceId);
    if (service) setSelectedServices(previous => ({ ...previous, [serviceId]: service }));
    setItems((prev) => {
      const current = prev[serviceId] ?? 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[serviceId];
        return copy;
      }
      return { ...prev, [serviceId]: next };
    });
  };

  const setExactQuantity = (serviceId: string, val: number) => {
    const service = allServices.find(s => s.id === serviceId);
    if (service) setSelectedServices(previous => ({ ...previous, [serviceId]: service }));
    setItems((prev) => {
      const qty = Math.max(0, Math.floor(val));
      if (qty === 0) {
        const copy = { ...prev };
        delete copy[serviceId];
        return copy;
      }
      return { ...prev, [serviceId]: qty };
    });
  };

  return (
    <Dialog
      open
      title="Thêm đơn dịch vụ phòng"
      onClose={() => {
        if (!submitting.current) onClose();
      }}
      className="create-service-dialog"
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting.current || !bookingId || !selected.length || (settlement !== 'ROOM' && !paymentVerified)) return;
          submitting.current = true;
          setBusy(true);
          setError('');
          let order: Order;
          try {
            const body = {
              bookingId, settlement,
              ...(settlement !== 'ROOM' ? { paymentVerified, expectedAmount: decimal(totalCents) } : {}),
              items: selected.map(([serviceId, quantity]) => ({ serviceId, quantity })),
            };
            requestId.current ??= crypto.randomUUID();
            order = await api.request<Order>('/service-orders', {
              method: 'POST',
              body: { ...body, requestId: requestId.current },
            });
          } catch (caught) {
            setError(
              deskError(
                caught instanceof Error ? caught : new Error('Không thể tạo đơn.'),
              ),
            );
            submitting.current = false;
            setBusy(false);
            return;
          }
          void refresh();
          onCreated(order);
        }}
      >
        <fieldset disabled={busy} className="min-w-0 border-0 p-0 m-0">
        <div className="create-service-modal-body">
          {/* CỘT TRÁI (60%): MENU DỊCH VỤ */}
          <div className="create-service-catalog-pane">
            {/* Search & Categories */}
            <div className="space-y-2.5 mb-3">
              <div className="relative">
                <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Tìm món: cà phê, bữa sáng, giặt là..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  className="h-10 w-full pl-9 pr-8 text-sm border border-zinc-200 rounded-xl bg-zinc-50/50 focus:bg-white focus:border-brand-600 focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-sm cursor-pointer p-0.5"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      selectedCategory === cat.id
                        ? 'bg-brand-700 text-white font-semibold shadow-2xs'
                        : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70'
                    }`}
                  >
                    {cat.icon && <span className="mr-1">{cat.icon}</span>}
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Service Items Grid */}
            <div className="create-service-items-grid max-h-[480px] overflow-y-auto pr-1">
              {services.isPending ? (
                <div className="py-14 text-center text-sm text-zinc-400">
                  Đang tải danh mục dịch vụ…
                </div>
              ) : services.error ? (
                <ErrorState
                  message={services.error.message}
                  retry={() => void services.refetch()}
                />
              ) : filteredServices.length === 0 ? (
                <div className="py-14 text-center text-sm text-zinc-400">
                  Không tìm thấy dịch vụ phù hợp.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {filteredServices.map((service) => {
                    const qty = items[service.id] ?? 0;
                    const isSelected = qty > 0;
                    return (
                      <div
                        key={service.id}
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/40 ring-1 ring-brand-600/20 shadow-2xs'
                            : 'border-zinc-200/90 bg-white hover:border-zinc-300 hover:bg-zinc-50/50 shadow-2xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-start gap-2">
                            <span className="p-1.5 rounded-lg bg-zinc-100 text-zinc-600 shrink-0 mt-0.5">
                              {getServiceIcon(service.name)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h4
                                className="text-xs sm:text-[13px] font-semibold text-zinc-900 leading-snug line-clamp-2"
                                title={service.name}
                              >
                                {cleanServiceName(service.name)}
                              </h4>
                              <div className="mt-1 text-xs sm:text-sm font-bold text-brand-800">
                                {money(service.currentPrice)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-2.5 pt-2 border-t border-zinc-100/90">
                          {qty === 0 ? (
                            <button
                              type="button"
                              onClick={() => updateQuantity(service.id, 1)}
                              className="w-full h-8 text-xs font-semibold rounded-lg bg-zinc-100/80 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 border border-transparent text-zinc-700 transition-colors cursor-pointer inline-flex items-center justify-center gap-1"
                            >
                              <Plus className="size-3.5" /> Thêm vào đơn
                            </button>
                          ) : (
                            <div className="w-full flex items-center justify-between gap-1">
                              <button
                                type="button"
                                onClick={() => updateQuantity(service.id, -1)}
                                className="size-7.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
                                title="Giảm 1"
                              >
                                <Minus className="size-3.5" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={50}
                                value={qty}
                                onChange={(e) =>
                                  setExactQuantity(
                                    service.id,
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className="h-7.5 w-11 text-center text-xs sm:text-sm font-bold border border-zinc-200 rounded-lg bg-white focus:outline-none focus:border-brand-600"
                              />
                              <button
                                type="button"
                                onClick={() => updateQuantity(service.id, 1)}
                                className="size-7.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white flex items-center justify-center cursor-pointer transition-colors"
                                title="Tăng 1"
                              >
                                <Plus className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {services.data && services.data.meta.totalPages > 1 && (
              <div className="mt-2">
                <Pagination
                  {...services.data.meta}
                  onChange={setServicePage}
                />
              </div>
            )}
          </div>

          {/* CỘT PHẢI (40%): PHÒNG & GIỎ HÀNG */}
          <div className="create-service-cart-pane">
            <div className="space-y-3.5">
              {/* Bước 1: Chọn phòng */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-zinc-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <BedDouble className="size-4 text-brand-700" />
                  1. Phòng nhận dịch vụ
                </label>
                {bookings.error ? (
                  <ErrorState
                    message={bookings.error.message}
                    retry={() => void bookings.refetch()}
                  />
                ) : (
                  <>
                    <select
                      aria-label="Phòng nhận dịch vụ"
                      className="w-full h-10 px-3 text-xs sm:text-sm border border-zinc-200 rounded-xl bg-white focus:border-brand-600 focus:outline-none transition-colors text-zinc-900 cursor-pointer"
                      value={bookingId}
                      onChange={(e) => setBookingId(e.target.value)}
                      disabled={busy || bookings.isPending}
                      required
                    >
                      <option value="">
                        {bookings.isPending
                          ? 'Đang tải danh sách phòng…'
                          : '-- Chọn phòng & khách đang ở --'}
                      </option>
                      {bookings.data?.data.map((b) => (
                        <option key={b.id} value={b.id}>
                          P.{b.roomNumber} · {b.customer?.fullName ?? b.reference} ({b.reference})
                        </option>
                      ))}
                    </select>

                    {selectedBooking && (
                      <div className="mt-2 p-2.5 rounded-xl bg-brand-50 border border-brand-200/80 text-xs sm:text-sm flex items-center justify-between">
                        <div>
                          <span className="font-bold text-brand-900">
                            Phòng {selectedBooking.roomNumber}
                          </span>
                          <span className="text-zinc-600 ml-1.5">
                            · {selectedBooking.customer?.fullName ?? 'Khách tại quầy'}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-medium text-brand-700">
                          {selectedBooking.reference}
                        </span>
                      </div>
                    )}

                    {bookings.data?.meta.total === 0 && (
                      <p className="text-xs text-amber-700 mt-1.5">
                        Hiện chưa có phòng nào đang có khách lưu trú (CHECKED_IN).
                      </p>
                    )}
                    {bookings.data && bookings.data.meta.totalPages > 1 && (
                      <div className="mt-1">
                        <Pagination
                          {...bookings.data.meta}
                          onChange={setBookingPage}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bước 2: Chi tiết đơn hàng */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs sm:text-sm font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="size-4 text-brand-700" />
                    2. Món đã chọn ({selected.length} món)
                  </span>
                  {selected.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setItems({})}
                      className="text-xs text-zinc-400 hover:text-rose-600 cursor-pointer transition-colors"
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>

                <div className="create-service-cart-list max-h-[230px] overflow-y-auto divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
                  {selected.length === 0 ? (
                    <div className="py-8 px-3 text-center text-xs sm:text-sm text-zinc-400">
                      Chưa chọn món nào.
                      <div className="text-xs text-zinc-400 mt-1">
                        Bấm "+ Thêm vào đơn" ở menu bên trái.
                      </div>
                    </div>
                  ) : (
                    selected.map(([serviceId, qty]) => {
                      const svc = allServices.find((s) => s.id === serviceId) ?? selectedServices[serviceId];
                      if (!svc) return null;
                      const subtotal = cents(svc.currentPrice) * BigInt(qty);
                      return (
                        <div
                          key={serviceId}
                          className="p-2.5 flex items-center justify-between gap-2.5 hover:bg-zinc-50/50"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-semibold text-zinc-900 truncate">
                              {cleanServiceName(svc.name)}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {money(svc.currentPrice)} × {qty} ={' '}
                              <strong className="text-zinc-800 font-bold">
                                {money(decimal(subtotal))}
                              </strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateQuantity(serviceId, -1)}
                              className="size-6.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-600 flex items-center justify-center cursor-pointer text-xs font-bold"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs sm:text-sm font-semibold tabular-nums">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(serviceId, 1)}
                              className="size-6.5 rounded-md bg-zinc-800 hover:bg-black text-white flex items-center justify-center cursor-pointer text-xs font-bold"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => updateQuantity(serviceId, -qty)}
                              className="p-1 text-zinc-300 hover:text-rose-600 cursor-pointer ml-1"
                              title="Xóa món này"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Tóm tắt & Nút tạo đơn */}
            <div className="pt-3 border-t border-zinc-200/90 mt-3 space-y-2.5">
              <label className="block text-xs sm:text-sm font-semibold space-y-1.5">Cách thanh toán
                <select aria-label="Cách thanh toán" className="input w-full h-10 text-xs sm:text-sm px-3 rounded-xl border-zinc-200" value={settlement} disabled={busy} onChange={event => { setSettlement(event.target.value as typeof settlement); setVerifiedReceipt(''); }}>
                  <option value="ROOM">Ghi vào hóa đơn phòng</option>
                  <option value="CASH">Thanh toán ngay · Tiền mặt</option>
                  <option value="BANK_TRANSFER">Thanh toán ngay · Chuyển khoản</option>
                </select>
              </label>
              {settlement !== 'ROOM' ? <label className="flex items-start gap-2 text-xs text-zinc-600"><input type="checkbox" required disabled={busy} checked={paymentVerified} onChange={event => setVerifiedReceipt(event.target.checked ? receiptFingerprint : '')} />Tôi đã nhận và kiểm tra đủ {totalDisplay}. Khoản này không thu lại khi trả phòng.</label> : <p className="text-xs text-zinc-500">Ghi nhận ngay vào hóa đơn phòng, không cần xác nhận hoàn thành.</p>}
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-xs sm:text-sm text-zinc-500 font-medium">Tổng tiền dự kiến:</span>
                  <div className="text-xs text-zinc-400">
                    {totalParts > 0 ? `${totalParts} phần (tối đa 50)` : 'Chưa có món'}
                  </div>
                </div>
                <span className="text-xl sm:text-2xl font-black text-brand-900 tabular-nums">
                  {totalDisplay}
                </span>
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-lg"
                >
                  {error}
                </p>
              )}

              <div className="flex items-center gap-2.5 pt-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={onClose}
                  className="flex-1 h-10 text-xs sm:text-sm font-medium"
                >
                  Hủy
                </Button>
                <button
                  type="submit"
                  disabled={
                    !bookingId ||
                    selected.length === 0 ||
                    totalParts > 50 ||
                    (settlement !== 'ROOM' && !paymentVerified) ||
                    busy
                  }
                  className="flex-2 h-10 px-4 text-xs sm:text-sm font-semibold rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer shadow-2xs inline-flex items-center justify-center gap-1.5"
                >
                  {busy ? 'Đang tạo đơn…' : `Tạo đơn · ${totalDisplay}`}
                </button>
              </div>
            </div>
          </div>
        </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
