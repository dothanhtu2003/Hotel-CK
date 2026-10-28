import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Page, Room, Service, Booking, Invoice } from './contracts';
import { ApiError } from '../../lib/api-client';

export function useGet<T>(path: string, enabled = true) { return useQuery({ queryKey: ['guest', path], queryFn: ({ signal }) => api.request<T>(path, { signal }), enabled }); }
export async function catalog<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const result: T[] = []; let page = 1;
  while (true) { const response = await api.request<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=100`, { signal }); result.push(...response.data); if (page >= response.meta.totalPages) return result; page++; }
}
export function useRoomTypes() { return useQuery({ queryKey: ['guest', 'room-types'], queryFn: async ({ signal }) => [...new Map((await catalog<Room>('/rooms', signal)).map(room => [room.roomType.id, room.roomType])).values()] }); }
export function useServices() { return useQuery({ queryKey: ['guest', 'catalog'], queryFn: ({ signal }) => catalog<Service>('/services', signal) }); }
export function useStays() { return useQuery({ queryKey: ['guest', 'checked-in'], queryFn: ({ signal }) => catalog<Booking>('/bookings/my?status=CHECKED_IN', signal) }); }
export function useInvoice(bookingId: string) { return useQuery({ queryKey: ['guest', `/bookings/${bookingId}/invoice`], enabled: !!bookingId, queryFn: async ({ signal }) => { try { return await api.request<Invoice>(`/bookings/${bookingId}/invoice`, { signal }); } catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; } } }); }
