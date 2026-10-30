import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContext } from '../../components/toast-context';
import { api } from '../../lib/api';
import type { DeskRoom } from './contracts';
import { RoomConditionEditor } from './room-condition-editor';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const room: DeskRoom = { id: 'room-1', roomNumber: '101', floor: 1, operationalStatus: 'ACTIVE', housekeepingStatus: 'DIRTY', openTaskCount: 1, bookings: [], roomType: { id: 'type-1', name: 'Standard', description: null, nightlyPrice: '450000', maxGuests: 2 } };
function mount(value = room) {
  const onSaved = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><ToastContext.Provider value={vi.fn()}><RoomConditionEditor room={value} onSaved={onSaved} /></ToastContext.Provider></QueryClientProvider>);
  return onSaved;
}

it('saves a clean room and closes open cleaning work without an extra checkbox', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue({});
  const saved = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Trống sạch' }));
  expect(screen.queryByRole('checkbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tình trạng' }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(request).toHaveBeenCalledWith('/front-desk/rooms/room-1/condition', { method: 'PATCH', body: { condition: 'CLEAN', expectedOperationalStatus: 'ACTIVE', expectedHousekeepingStatus: 'DIRTY', completeOpenTasks: true, note: '' } });
});

it('can mark a room as maintenance without closing its cleaning tasks', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue({});
  const saved = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Bảo trì' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Sửa máy lạnh' } });
  expect(screen.queryByRole('checkbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tình trạng' }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(request).toHaveBeenCalledWith('/front-desk/rooms/room-1/condition', { method: 'PATCH', body: { condition: 'MAINTENANCE', expectedOperationalStatus: 'ACTIVE', expectedHousekeepingStatus: 'DIRTY', note: 'Sửa máy lạnh' } });
});

it('hides the whole room condition editor while a guest is checked in', () => {
  const request = vi.spyOn(api, 'request');
  mount({ ...room, bookings: [{ status: 'CHECKED_IN' }] as DeskRoom['bookings'] });
  expect(screen.queryByText('Cập nhật tình trạng phòng')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Trống sạch' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Bảo trì' })).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

it('lets reception end maintenance and restore a clean vacant room', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue({});
  const saved = mount({ ...room, operationalStatus: 'OUT_OF_SERVICE', housekeepingStatus: 'CLEAN', openTaskCount: 0 });
  fireEvent.click(screen.getByRole('button', { name: 'Tắt bảo trì · Khôi phục phòng trống sạch' }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tình trạng' }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(request).toHaveBeenCalledWith('/front-desk/rooms/room-1/condition', { method: 'PATCH', body: { condition: 'CLEAN', expectedOperationalStatus: 'OUT_OF_SERVICE', expectedHousekeepingStatus: 'CLEAN', note: '' } });
});
