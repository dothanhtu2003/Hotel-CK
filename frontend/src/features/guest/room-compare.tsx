import { catalogName, catalogDescription } from "../../i18n/catalog";
import { t as tr, useLocale } from "../../i18n";
import { Trans } from "react-i18next";
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
  useLocale();
  const comparedRooms = rooms.filter((r) => comparedIds.includes(r.id));

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} title={tr("guest:roomCompare.compareRoomTypes")} className="compare-dialog">
      {comparedRooms.length === 0 ? (
        <p>{tr("guest:roomCompare.noRoomsSelectedForComparisonSelectCompareOnARoomCard")}</p>
      ) : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="compare-th-feature">{tr("guest:roomCompare.features")}</th>
                {comparedRooms.map((r) => (
                  <th key={r.id} className="compare-th-room">
                    <div className="compare-col-header">
                      <strong>{tr("guest:roomCompare.roomValue", { value0: (r.roomNumber) })}</strong>
                      <span>{catalogName(r.roomType.name)}</span>
                      <button
                        className="compare-remove-btn"
                        onClick={() => onRemove(r.id)}
                        aria-label={tr("guest:roomCompare.removeRoomValueFromComparison", { value0: (r.roomNumber) })}
                      >
                        <X size={15} /> {tr("guest:roomCompare.remove")}</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="compare-feature-label">{tr("guest:roomCompare.pricePerNight")}</td>
                {comparedRooms.map((r) => (
                  <td key={r.id} className="compare-price-val"><Trans ns="guest" i18nKey="roomCompare.valueNight" values={{ value0: (money(r.roomType.nightlyPrice)) }} components={{ part0: <strong /> }} /></td>
                ))}
              </tr>
              <tr>
                <td className="compare-feature-label">{tr("guest:roomCompare.maximumGuests")}</td>
                {comparedRooms.map((r) => (
                  <td key={r.id}><Trans ns="guest" i18nKey="roomCompare.upToValueGuests" values={{ value0: (r.roomType.maxGuests) }} components={{ part0: <strong /> }} /></td>
                ))}
              </tr>
              <tr>
                <td className="compare-feature-label">{tr("guest:roomCompare.locationFloor")}</td>
                {comparedRooms.map((r) => (
                  <td key={r.id}>{tr("guest:roomCompare.floorValue", { value0: (r.floor) })}</td>
                ))}
              </tr>
              <tr>
                <td className="compare-feature-label">{tr("guest:roomCompare.roomDescription")}</td>
                {comparedRooms.map((r) => (
                  <td key={r.id} className="compare-desc">
                    {catalogDescription(r.roomType.description, r.roomType.name)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="compare-feature-label">{tr("guest:roomCompare.featuredAmenities")}</td>
                {comparedRooms.map((r) => (
                  <td key={r.id}>
                    <ul className="compare-amenities-list">
                      <li><Check size={14} /> {tr("guest:roomCompare.warmBathtub")}</li>
                      <li><Check size={14} /> {tr("guest:roomCompare.sunlitBalcony")}</li>
                      <li><Check size={14} /> {tr("guest:roomCompare.highSpeedWiFi6")}</li>
                      <li><Check size={14} /> {tr("guest:roomCompare.complimentaryTeaCoffee")}</li>
                    </ul>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="compare-feature-label">{tr("guest:roomCompare.actions")}</td>
                {comparedRooms.map((r) => (
                  <td key={r.id}>
                    <LinkButton
                      to={`/rooms/${r.id}${queryStay ? '?' + queryStay : ''}`}
                      variant="primary"
                      className="compare-choose-btn"
                    >
                      {tr("guest:roomCompare.chooseRoom")}{r.roomNumber} <ArrowRight size={15} />
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
          <Button variant="secondary" onClick={onClear}>{tr("guest:roomCompare.clearComparison")}</Button>
        )}
        <Button onClick={onClose}>{tr("guest:roomCompare.close")}</Button>
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
  useLocale();
  if (count === 0) return null;

  return (
    <aside className="compare-floating-dock" aria-label={tr("guest:roomCompare.roomComparisonBar")}>
      <div className="compare-dock-content">
        <span><Trans ns="guest" i18nKey="roomCompare.valueRoomsSelectedForComparison" values={{ value0: (count) }} components={{ part0: <strong /> }} /></span>
        <div className="compare-dock-actions">
          <Button onClick={onOpen} variant="primary">{tr("guest:roomCompare.compareNow")}</Button>
          <Button onClick={onClear} variant="ghost" className="compare-dock-clear">{tr("guest:roomCompare.clear")}</Button>
        </div>
      </div>
    </aside>
  );
}
