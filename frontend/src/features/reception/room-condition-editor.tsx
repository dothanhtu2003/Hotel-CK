import { errorToken, message as uiMessage, resolveMessage, t as tr, useLocale } from "../../i18n";


import { useRef, useState } from 'react';
import { ShieldCheck, Wrench } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../components/toast-context';
import { api } from '../../lib/api';
import { ApiError } from '../../lib/api-client';
import type { DeskRoom } from './contracts';
import { useRefreshDesk } from './queries';

export function RoomConditionEditor({ room, onSaved }: { room: DeskRoom; onSaved: () => void }) {
  useLocale();
  const [condition, setCondition] = useState<'CLEAN' | 'MAINTENANCE' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const refresh = useRefreshDesk();
  const toast = useToast();
  const occupied = room.bookings.some(booking => booking.status === 'CHECKED_IN');
  const openTasks = room.openTaskCount ?? 0;
  const maintenance = room.operationalStatus === 'OUT_OF_SERVICE';
  const completeOpenTasks = condition === 'CLEAN' && openTasks > 0;
  if (occupied) return null;
  return <section className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
    <h3 className="text-sm font-bold text-zinc-900">{maintenance ? tr("reception:roomConditionEditor.endMaintenance") : tr("reception:roomConditionEditor.updateRoomCondition")}</h3>
    <fieldset disabled={busy} className="space-y-3">
      <div className={maintenance ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2'}>
        <Button variant={maintenance ? 'primary' : 'secondary'} aria-pressed={condition === 'CLEAN'} disabled={room.operationalStatus === 'ACTIVE' && room.housekeepingStatus === 'CLEAN' && !openTasks} onClick={() => { setCondition('CLEAN'); setError(''); }}><ShieldCheck size={16} /> {maintenance ? tr("reception:roomConditionEditor.endMaintenanceRestoreCleanVacantRoom") : tr("reception:roomConditionEditor.cleanVacant")}</Button>
        {!maintenance && <Button variant="secondary" aria-pressed={condition === 'MAINTENANCE'} onClick={() => { setCondition('MAINTENANCE'); setError(''); }}><Wrench size={16} /> {tr("reception:roomConditionEditor.maintenance")}</Button>}
      </div>
      {condition && <div className="rounded-xl bg-zinc-50 p-3 space-y-3">
        <label className="block text-xs space-y-1"><textarea aria-label={tr("reception:roomConditionEditor.notes")} className="input w-full" rows={2} maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder={tr("reception:roomConditionEditor.exampleCleanlinessInspectedAirConditionerRepaired")} /></label>
        {error && <p role="alert" className="text-xs text-rose-600">{resolveMessage(error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCondition(null)}>{tr("reception:components.cancel")}</Button>
          <Button busy={busy} onClick={async () => {
            if (lock.current) return;
            lock.current = true; setBusy(true); setError('');
            try {
              await api.request(`/front-desk/rooms/${room.id}/condition`, { method: 'PATCH', body: {
                condition, expectedOperationalStatus: room.operationalStatus, expectedHousekeepingStatus: room.housekeepingStatus,
                ...(completeOpenTasks ? { completeOpenTasks: true } : {}), note,
              } });
              await refresh();
              toast(() => (tr("reception:roomConditionEditor.roomValueUpdatedToValue", { value0: (room.roomNumber), value1: (condition === 'CLEAN' ? tr("common:supplement.cleanVacant") : tr("common:supplement.maintenance")) })));
              onSaved();
            } catch (caught) {
              setError(caught instanceof ApiError && caught.status === 409 ? uiMessage("reception:roomConditionEditor.theRoomOrCleaningTasksChangedOrTheRoomIsOccupiedClose") : caught instanceof Error ? errorToken(caught) : uiMessage("reception:roomConditionEditor.unableToUpdateRoom"));
            } finally { lock.current = false; setBusy(false); }
          }}>{tr("reception:roomConditionEditor.saveCondition")}</Button>
        </div>
      </div>}
    </fieldset>
  </section>;
}
