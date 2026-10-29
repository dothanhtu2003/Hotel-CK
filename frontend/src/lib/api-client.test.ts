import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api-client';

describe('Central API boundary (isolated transport unit tests, no business API mocks)', () => {
  it('forwards the same payment idempotency key and exact Decimal string on an explicit replay', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    const client = createApiClient('http://localhost/api', fetcher), key = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await client.request('/invoices/id/payments', { method: 'POST', idempotencyKey: key, body: { amount: '100.25', method: 'CASH' } });
    expect(fetcher.mock.calls[0][1]?.headers).toHaveProperty('Idempotency-Key', key);
    expect(fetcher.mock.calls[0][1]?.body).toBe('{"amount":"100.25","method":"CASH"}');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('uses only bearer headers, JSON allowlist and no browser credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"ok":true}'));
    const client = createApiClient('http://localhost:3000/api/', fetcher); client.setToken('test-token');
    expect(await client.request('/users/me', { method: 'PATCH', body: { fullName: 'Guest' } })).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith('http://localhost:3000/api/users/me', expect.objectContaining({ credentials: 'omit', cache: 'no-store', method: 'PATCH', body: '{"fullName":"Guest"}', headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
  });
  it('does not send a session token to public login/register', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}')); const client = createApiClient('http://localhost/api', fetcher); client.setToken('token');
    await client.request('/auth/login', { authenticated: false, body: {} }); expect(fetcher.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
  });
  it('clears one expired token and signals logout on authenticated 401', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 401 })); const client = createApiClient('http://localhost/api', fetcher), expire = vi.fn();
    client.setToken('expired'); client.onUnauthorized(expire); await expect(client.request('/users/me')).rejects.toBeInstanceOf(ApiError); await expect(client.request('/users/me')).rejects.toMatchObject({ status: 401 }); expect(expire).toHaveBeenCalledTimes(1);
  });
  it('403 stays distinct from 401 and preserves the current session', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 403 })); const client = createApiClient('http://localhost/api', fetcher), expire = vi.fn(); client.setToken('active'); client.onUnauthorized(expire);
    await expect(client.request('/users/me')).rejects.toMatchObject({ status: 403, message: 'Bạn không có quyền thực hiện thao tác này.' }); expect(expire).not.toHaveBeenCalled();
    await expect(client.request('/users/me')).rejects.toThrow(); expect(fetcher.mock.calls[1][1]?.headers).toHaveProperty('Authorization', 'Bearer active');
  });
  it('an old 401 cannot clear a newer login', async () => {
    let finish!: (value: Response) => void; const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const client = createApiClient('http://localhost/api', fetcher), expire = vi.fn(); client.onUnauthorized(expire); client.setToken('old');
    const pending = client.request('/users/me'); client.setToken('new'); finish(new Response('{}', { status: 401 })); await expect(pending).rejects.toThrow(); expect(expire).not.toHaveBeenCalled();
  });
  it.each([400, 404, 409, 429, 500])('maps %s to a safe message without echoing server errors', async status => {
    const client = createApiClient('http://localhost/api', vi.fn<typeof fetch>().mockResolvedValue(new Response('{"message":"SQL secret JWT password"}', { status })));
    await expect(client.request('/users/me')).rejects.not.toThrow(/SQL|secret|JWT|password/);
  });
  it('reports a network failure without leaking transport details', async () => {
    const client = createApiClient('http://localhost/api', vi.fn<typeof fetch>().mockRejectedValue(new Error('sensitive host/password'))); await expect(client.request('/users/me')).rejects.toMatchObject({ status: 0 });
  });
  it('preserves request cancellation', async () => {
    const abort = new DOMException('Cancelled', 'AbortError'); const client = createApiClient('http://localhost/api', vi.fn<typeof fetch>().mockRejectedValue(abort)); await expect(client.request('/users/me')).rejects.toBe(abort);
  });
  it.each(['https://evil.example/path', '//evil.example/path'])('rejects absolute API path %s', async path => { const client = createApiClient('http://localhost/api'); await expect(client.request(path)).rejects.toThrow('relative'); });
  it.each(['javascript:alert(1)', 'http://user:password@localhost/api'])('rejects unsafe base URLs', base => expect(() => createApiClient(base)).toThrow());
  it('keeps only declared walk-in error codes and never echoes unknown server messages', async () => {
    const client = createApiClient('http://localhost/api', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ code: 'WALK_IN_CUSTOMER_EXISTS', message: 'private SQL' }), { status: 409 })));
    await expect(client.request('/front-desk/walk-in')).rejects.toMatchObject({ status: 409, code: 'WALK_IN_CUSTOMER_EXISTS' });
    const unknown = createApiClient('http://localhost/api', vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ code: 'private SQL', message: 'password' }), { status: 409 })));
    await expect(unknown.request('/front-desk/walk-in')).rejects.toMatchObject({ code: undefined });
    await expect(unknown.request('/front-desk/walk-in')).rejects.not.toThrow(/SQL|password/);
  });

});
