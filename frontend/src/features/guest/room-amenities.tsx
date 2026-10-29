import {
  Bath,
  Coffee,
  ShieldCheck,
  Sun,
  Wifi,
  Wind,
} from 'lucide-react';

export const standardAmenities = [
  { icon: Wifi, title: 'Wi-Fi 6 tốc độ cao', desc: 'Đường truyền riêng từng phòng' },
  { icon: Bath, title: 'Bồn tắm & vòi sen', desc: 'Nước khoáng ấm thư giãn' },
  { icon: Wind, title: 'Điều hòa 2 chiều êm ái', desc: 'Lọc không khí ion bạc' },
  { icon: Coffee, title: 'Máy pha cà phê cao cấp', desc: 'Trà thảo mộc & cà phê miễn phí' },
  { icon: Sun, title: 'Ban công đón sáng tự nhiên', desc: 'Tầm nhìn thoáng đãng' },
  { icon: ShieldCheck, title: 'Két sắt điện tử', desc: 'Bảo mật an toàn tuyệt đối' },
];

export function RoomAmenitiesSection() {
  return (
    <div className="room-amenities-block">
      <h3>Tiện nghi đặc quyền tại phòng</h3>
      <div className="amenities-grid">
        {standardAmenities.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="amenity-item">
            <div className="amenity-icon">
              <Icon size={20} strokeWidth={1.5} />
            </div>
            <div>
              <strong>{title}</strong>
              <small>{desc}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StickyBookingBar({
  roomNumber,
  roomTypeName,
  nightlyPrice,
  stayNights,
  estimatedTotal,
}: {
  roomNumber: string;
  roomTypeName: string;
  nightlyPrice: string;
  stayNights?: number;
  estimatedTotal?: string;
  actionButton?: React.ReactNode;
}) {
  return (
    <div className="sticky-booking-bar" role="region" aria-label="Thanh đặt phòng nhanh">
      <div className="site-container sticky-booking-inner">
        <div className="sticky-room-meta">
          <span className="sticky-room-tag">PHÒNG {roomNumber}</span>
          <strong>{roomTypeName}</strong>
          <span className="sticky-price-unit">{nightlyPrice} / đêm</span>
        </div>

        <div className="sticky-right">
          {estimatedTotal && (
            <div className="sticky-total-box">
              <span className="sticky-nights-label">
                {stayNights ? `${stayNights} đêm lưu trú` : 'Tổng dự kiến'}
              </span>
              <strong className="sticky-total-price">{estimatedTotal}</strong>
            </div>
          )}
          <div className="sticky-action-wrap">
            <a href="#dat-phong" className="button button-primary">
              Giữ phòng ngay
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
