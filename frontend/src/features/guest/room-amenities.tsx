import { t as tr, useLocale, localized } from "../../i18n";
import {
  Bath,
  Coffee,
  ShieldCheck,
  Sun,
  Wifi,
  Wind,
} from 'lucide-react';

export const standardAmenities = localized(() => ([
  { icon: Wifi, title: tr("guest:roomAmenities.highSpeedWiFi6"), desc: tr("guest:roomAmenities.dedicatedConnectionInEveryRoom") },
  { icon: Bath, title: tr("guest:roomAmenities.bathtubShower"), desc: tr("guest:roomAmenities.relaxingWarmMineralWater") },
  { icon: Wind, title: tr("guest:roomAmenities.quietHeatingAndCooling"), desc: tr("guest:roomAmenities.silverIonAirFiltration") },
  { icon: Coffee, title: tr("guest:roomAmenities.premiumCoffeeMachine"), desc: tr("guest:roomAmenities.complimentaryHerbalTeaCoffee") },
  { icon: Sun, title: tr("guest:roomAmenities.sunlitBalcony"), desc: tr("guest:roomAmenities.openViews") },
  { icon: ShieldCheck, title: tr("guest:roomAmenities.electronicSafe"), desc: tr("guest:roomAmenities.completePeaceOfMind") },
]));

export function RoomAmenitiesSection() {
  useLocale();
  return (
    <div className="room-amenities-block">
      <h3>{tr("guest:roomAmenities.specialInRoomAmenities")}</h3>
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
  actionButton,
}: {
  roomNumber: string;
  roomTypeName: string;
  nightlyPrice: string;
  stayNights?: number;
  estimatedTotal?: string;
  actionButton?: React.ReactNode;
}) {
  useLocale();
  return (
    <div className="sticky-booking-bar" role="region" aria-label={tr("guest:roomAmenities.quickBookingBar")}>
      <div className="site-container sticky-booking-inner">
        <div className="sticky-room-meta">
          <span className="sticky-room-tag">{tr("guest:roomAmenities.roomValue", { value0: (roomNumber) })}</span>
          <strong>{roomTypeName}</strong>
          <span className="sticky-price-unit">{tr("guest:roomAmenities.valueNight", { value0: (nightlyPrice) })}</span>
        </div>

        <div className="sticky-right">
          {estimatedTotal && (
            <div className="sticky-total-box">
              <span className="sticky-nights-label">
                {stayNights ? tr("guest:roomAmenities.valueNights", { value0: (stayNights) }) : tr("guest:roomAmenities.estimatedTotal")}
              </span>
              <strong className="sticky-total-price">{estimatedTotal}</strong>
            </div>
          )}
          <div className="sticky-action-wrap">
            {actionButton || (
              <a href="#dat-phong" className="button button-primary">{tr("guest:roomAmenities.bookNow")}</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
