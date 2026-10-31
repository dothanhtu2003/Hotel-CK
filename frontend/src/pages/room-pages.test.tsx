import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { RoomsPage } from './room-pages';
import type { Room } from '../features/guest/contracts';

const mocks = vi.hoisted(() => ({ useGet: vi.fn(), useRoomTypes: vi.fn() }));
vi.mock('../features/guest/queries', () => mocks);
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const type = { id: 'type-1', name: 'Deluxe', nightlyPrice: '1200000.00', maxGuests: 2, description: '' };
const room: Room = { id: 'room-101', roomNumber: '101', floor: 1, operationalStatus: 'ACTIVE', housekeepingStatus: 'CLEAN', roomType: type };
function setup(path = '/rooms?page=2') {
  mocks.useRoomTypes.mockReturnValue({ data: [type] });
  mocks.useGet.mockReturnValue({ data: { nights: 1, data: [room, { ...room, id: 'dirty', roomNumber: '102', housekeepingStatus: 'DIRTY' }, { ...room, id: 'inactive', roomNumber: '103', operationalStatus: 'MAINTENANCE' }] } });
  render(<MemoryRouter initialEntries={[path]}><RoomsPage /></MemoryRouter>);
}
it('defaults to availability for today, hides unready rooms and removes old pagination', () => {
  setup();
  expect(mocks.useGet.mock.calls[0][0]).toContain('/rooms/available?checkIn=');
  expect(mocks.useGet.mock.calls[0][0]).not.toContain('page=');
  expect(screen.getByRole('heading', { name: 'Phòng 101' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Phòng 102' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Phòng 103' })).toBeNull();
  const link = screen.getByRole('link', { name: /Đặt phòng/ });
  expect(link.getAttribute('href')).toContain('/rooms/room-101?checkIn=');
  expect(screen.queryByLabelText('Các bước đặt phòng')).toBeNull();
});
it('keeps rooms bookable for future dates regardless of current cleaning state', () => {
  setup('/rooms?checkIn=2039-11-01&checkOut=2039-11-02&guests=2');
  expect(screen.getByRole('heading', { name: 'Phòng 102' })).toBeTruthy();
  expect(screen.getAllByRole('link', { name: /Đặt phòng/ })).toHaveLength(2);
});
