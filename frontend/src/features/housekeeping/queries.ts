import { useRef } from 'react';
import { useLocation } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useToast } from '../../components/toast-context';
import { housekeepingError } from './contracts';

export function useHousekeepingBase() { const { pathname } = useLocation(); return pathname.startsWith('/reception') ? '/reception/housekeeping' : pathname.startsWith('/admin') ? '/admin/housekeeping' : '/housekeeping'; }
export function useHousekeepingGet<T>(path: string) { return useQuery({ queryKey: ['housekeeping', path], queryFn: ({ signal }) => api.request<T>(path, { signal }) }); }
export function useWorkMutation<T, V>(action: string, label: string, fn: (variables: V) => Promise<T>, onSuccess?: (result: T) => void) {
  const client = useQueryClient(), toast = useToast(), lock = useRef(false);
  const mutation = useMutation({ retry: false, mutationFn: fn, onSuccess: async result => { toast(label); await refresh(); onSuccess?.(result); }, onError: async error => { toast(housekeepingError(error, action), 'error'); await refresh(); }, onSettled: () => { lock.current = false; } });
  async function refresh() { await Promise.all(['housekeeping', 'reception', 'guest'].map(key => client.invalidateQueries({ queryKey: [key] }))); }
  return { ...mutation, run: (variables: V) => { if (lock.current) return; lock.current = true; mutation.mutate(variables); }, locked: () => lock.current };
}
