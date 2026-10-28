import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { api } from '../../lib/api';
import { ApiError } from '../../lib/api-client';
import type { Invoice } from '../guest/contracts';

export function useDeskBase() { return useLocation().pathname.startsWith('/reception') ? '/reception' : '/admin'; }
export function useDeskGet<T>(path: string, enabled = true) { return useQuery({ queryKey: ['reception', path], queryFn: ({ signal }) => api.request<T>(path, { signal }), enabled }); }
export function useDeskInvoice(bookingId: string) { return useQuery({ queryKey: ['reception', `/bookings/${bookingId}/invoice`], enabled: !!bookingId, queryFn: async ({ signal }) => { try { return await api.request<Invoice>(`/bookings/${bookingId}/invoice`, { signal }); } catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; } } }); }
export function useRefreshDesk() { const client = useQueryClient(); return async () => { await Promise.all([client.invalidateQueries({ queryKey: ['reception'] }), client.invalidateQueries({ queryKey: ['guest'] }), client.invalidateQueries({ queryKey: ['housekeeping'] })]); }; }
