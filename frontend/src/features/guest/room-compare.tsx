import { X, Check, ArrowRight } from 'lucide-react';
import { Button, Dialog, LinkButton } from '../../components/ui';
import { money, type Room } from './contracts';

interface RoomCompareProps {
  rooms: Room[];
  comparedIds: string[];
  onRemove: (id: string) => void;
  onClear: () => void;
  open: boolean;
  onClose: () => void;
  queryStay?: string;
}

export function RoomCompareModal({
  rooms,
  comparedIds,
  onRemove,
  onClear,
  open,
  onClose,
  queryStay = '',
}: RoomCompareProps) {
  const comparedRooms = rooms.filter((r) => comparedIds.includes(r.id));

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title="So sánh các loại phòng" className="compare-dialog">
      {comparedRooms.length === 0 ? (
        <p>Chưa có phòng nào được chọn để so sánh. Hãy bấm "So sánh" trên các thẻ phòng.</p>
      ) : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="compare-th-feature">Đặc điểm</th>
                {comparedRooms.map((r) => (
                  <th key={r.id} className="compare-th-room">
                    <div className="compare-col-header">
                      <strong>Phòng {r.roomNumber}</strong>
                      <span>{r.roomType.name}</span>
                      <button
                        className="compare-remove-btn"
                        onClick={() => onRemove(r.id)}
                        aria-label={`Bỏ so sánh phòng ${r.roomNumber}`}
                      >
                        <X size={15} /> Bỏ chọn
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="compare-feature-label">Giá mỗi đêm</td>
                {comparedRooms.map((r) => (
                  <td key={r.id} className="compare-price-val">
                    <strong>{money(r.roomType.nightlyPrice)}</strong> / đêm
                  </td>
                ))}
              </tr>
              <tr>
                <td className="compare-feature-label">Số khách tối đa</td>
                {comparedRooms.map((r) => (
                  <td key={r.id}>
                    Tối đa <strong>{r.roomType.maxGuests} khách</strong>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="compare-feature-label">Vị trí & Tầng</td>
                {comparedRooms.map((r) => (
                  <td key={r.id}>Tầng {r.floor}</td>
                ))}
              </tr>
              <tr>
                <td className="compare-feature-label">Mô tả không gian</td>
                {comparedRooms.map((r) => (
                  <td key={r.id} className="compare-desc">
                    {r.roomType.description}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="compare-feature-label">Tiện nghi nổi bật</td>
                {comparedRooms.map((r) => (
                  <td key={r.id}>
                    <ul className="compare-amenities-list">
                      <li><Check size={14} /> Bồn tắm nước ấm</li>
                      <li><Check size={14} /> Ban công đón sáng</li>
                      <li><Check size={14} /> Wi-Fi 6 tốc độ cao</li>
                      <li><Check size={14} /> Trà & Cà phê miễn phí</li>
                    </ul>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="compare-feature-label">Hành động</td>
                {comparedRooms.map((r) => (
                  <td key={r.id}>
                    <LinkButton
                      to={`/rooms/${r.id}${queryStay ? '?' + queryStay : ''}`}
                      variant="primary"
                      className="compare-choose-btn"
                    >
                      Chọn phòng {r.roomNumber} <ArrowRight size={15} />
                    </LinkButton>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="dialog-actions">
        {comparedRooms.length > 0 && (
          <Button variant="secondary" onClick={onClear}>
            Xóa danh sách so sánh
          </Button>
        )}
        <Button onClick={onClose}>Đóng</Button>
      </div>
    </Dialog>
  );
}

export function CompareFloatingBar({
  count,
  onOpen,
  onClear,
}: {
  count: number;
  onOpen: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;

  return (
    <aside className="compare-floating-dock" aria-label="Thanh so sánh phòng">
      <div className="compare-dock-content">
        <span>Đã chọn <strong>{count}</strong> phòng để so sánh</span>
        <div className="compare-dock-actions">
          <Button onClick={onOpen} variant="primary">
            So sánh ngay
          </Button>
          <Button onClick={onClear} variant="ghost" className="compare-dock-clear">
            Xóa
          </Button>
        </div>
      </div>
    </aside>
  );
}
