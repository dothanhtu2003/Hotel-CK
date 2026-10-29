import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { DeskBooking, DeskRoom } from './contracts';
import { Button } from '../../components/ui';

interface TapeChartProps {
  rooms: DeskRoom[];
  base: string;
  onSelectBooking?: (booking: DeskBooking) => void;
  onSelectRoom?: (room: DeskRoom) => void;
}

export function TapeChart({ rooms, base, onSelectBooking, onSelectRoom }: TapeChartProps) {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [filterFloor, setFilterFloor] = useState<string>('');
  const [searchRoom, setSearchRoom] = useState<string>('');

  // 7 days window
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday =
      new Date().toISOString().split('T')[0] === dateStr;
    const dayOfWeek = new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(d);
    const formatted = `${d.getDate()}/${d.getMonth() + 1}`;
    return { date: d, dateStr, dayOfWeek, formatted, isToday };
  });

  const shiftDays = (delta: number) => {
    setStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  };

  const resetToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setStartDate(d);
  };

  // Filtered rooms
  const filteredRooms = rooms.filter((r) => {
    if (filterFloor && String(r.floor) !== filterFloor) return false;
    if (searchRoom && !r.roomNumber.toLowerCase().includes(searchRoom.toLowerCase()) && !r.roomType.name.toLowerCase().includes(searchRoom.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Extract unique floors
  const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);

  return (
    <div className="tape-chart-container">
      <div className="tape-chart-header">
        <div className="tape-chart-controls">
          <div className="tape-chart-nav-buttons">
            <Button
              variant="secondary"
              onClick={() => shiftDays(-7)}
              title="7 ngày trước"
              aria-label="7 ngày trước"
            >
              <ChevronLeft size={16} /> 7 ngày trước
            </Button>
            <Button
              variant="secondary"
              onClick={resetToday}
              title="Về hôm nay"
            >
              Hôm nay
            </Button>
            <Button
              variant="secondary"
              onClick={() => shiftDays(7)}
              title="7 ngày tới"
              aria-label="7 ngày tới"
            >
              7 ngày tới <ChevronRight size={16} />
            </Button>
          </div>

          <span className="tape-chart-range-label">
            <Calendar size={16} />
            Từ <strong>{days[0].formatted}</strong> đến <strong>{days[6].formatted}</strong>
          </span>
        </div>

        <div className="tape-chart-quick-filters">
          <input
            type="search"
            placeholder="Tìm nhanh số phòng…"
            value={searchRoom}
            onChange={(e) => setSearchRoom(e.target.value)}
            className="input tape-search-input"
          />
          <select
            className="input"
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
          >
            <option value="">Tất cả tầng</option>
            {floors.map((f) => (
              <option key={f} value={f}>
                Tầng {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="tape-chart-table-wrap">
        <table className="tape-chart-table" aria-label="Sơ đồ timeline đặt phòng">
          <thead>
            <tr>
              <th className="tape-th-room">Phòng</th>
              {days.map((d) => (
                <th
                  key={d.dateStr}
                  className={`tape-th-day ${d.isToday ? 'tape-day-today' : ''}`}
                >
                  <span className="tape-day-name">{d.dayOfWeek}</span>
                  <span className="tape-day-date">{d.formatted}</span>
                  {d.isToday && <span className="tape-today-pill">Hôm nay</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRooms.map((r) => {
              const activeBookings = r.bookings.filter(
                (b) => b.status !== 'CANCELLED',
              );

              return (
                <tr key={r.id} className="tape-row">
                  <td className="tape-td-room" onClick={() => onSelectRoom?.(r)}>
                    <div className="tape-room-info">
                      <strong className="tape-room-num">Phòng {r.roomNumber}</strong>
                      <span className="tape-room-type">
                        {r.roomType.name} · T{r.floor}
                      </span>
                      <span
                        className={`tape-room-status-dot status-${r.housekeepingStatus.toLowerCase()}`}
                        title={`Vệ sinh: ${r.housekeepingStatus}`}
                      />
                    </div>
                  </td>

                  {days.map((day) => {
                    // Check if this date falls within any booking [checkIn, checkOut)
                    const matchedBooking = activeBookings.find((b) => {
                      return day.dateStr >= b.checkIn && day.dateStr < b.checkOut;
                    });

                    if (matchedBooking) {
                      const isCheckInDay = matchedBooking.checkIn === day.dateStr;
                      const isCheckOutDay =
                        new Date(new Date(matchedBooking.checkOut).getTime() - 86400000)
                          .toISOString()
                          .split('T')[0] === day.dateStr;

                      const statusClass =
                        matchedBooking.status === 'CHECKED_IN'
                          ? 'tape-cell-occupied'
                          : matchedBooking.status === 'CONFIRMED'
                            ? 'tape-cell-confirmed'
                            : 'tape-cell-pending';

                      return (
                        <td
                          key={day.dateStr}
                          className={`tape-td-cell tape-td-booked ${statusClass}`}
                          onClick={() => {
                            if (onSelectBooking) onSelectBooking(matchedBooking);
                            else navigate(`${base}/bookings/${matchedBooking.id}`);
                          }}
                          title={`Booking: ${matchedBooking.reference}\nKhách: ${matchedBooking.customer?.fullName ?? 'Khách'}\nTừ ${matchedBooking.checkIn} đến ${matchedBooking.checkOut}`}
                        >
                          <div className="tape-booking-pill">
                            <span className="tape-booking-title">
                              {matchedBooking.customer?.fullName || matchedBooking.reference}
                            </span>
                            <small className="tape-booking-ref">
                              {isCheckInDay ? '↓ Vào' : isCheckOutDay ? '↑ Trả' : ''}
                            </small>
                          </div>
                        </td>
                      );
                    }

                    // Available cell
                    const isClickable = r.operationalStatus === 'ACTIVE';
                    return (
                      <td
                        key={day.dateStr}
                        className={`tape-td-cell tape-td-free ${
                          day.isToday ? 'tape-cell-today' : ''
                        }`}
                        onClick={() => {
                          if (isClickable) {
                            const nextDay = new Date(day.date);
                            nextDay.setDate(nextDay.getDate() + 1);
                            const checkOutStr = nextDay.toISOString().split('T')[0];
                            navigate(
                              `${base}/walk-in?roomId=${r.id}&checkIn=${day.dateStr}&checkOut=${checkOutStr}`,
                            );
                          }
                        }}
                        title={
                          isClickable
                            ? `Phòng trống ngày ${day.formatted}. Bấm để tạo Walk-in.`
                            : 'Phòng tạm ngừng phục vụ'
                        }
                      >
                        <span className="tape-free-slot">
                          <Plus size={13} />
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {filteredRooms.length === 0 && (
              <tr>
                <td colSpan={8} className="tape-empty-row">
                  Không tìm thấy phòng nào phù hợp với bộ lọc số phòng hoặc tầng.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="tape-chart-legend">
        <span className="tape-legend-title">Chú giải Timeline:</span>
        <div className="tape-legend-item">
          <span className="tape-legend-box tape-cell-occupied" />
          <span>Đang lưu trú (Checked-in)</span>
        </div>
        <div className="tape-legend-item">
          <span className="tape-legend-box tape-cell-confirmed" />
          <span>Đã xác nhận (Confirmed)</span>
        </div>
        <div className="tape-legend-item">
          <span className="tape-legend-box tape-cell-pending" />
          <span>Chờ xử lý (Pending)</span>
        </div>
        <div className="tape-legend-item">
          <span className="tape-legend-box tape-cell-free" />
          <span>Trống (Bấm '+' để đặt tại quầy)</span>
        </div>
      </div>
    </div>
  );
}
