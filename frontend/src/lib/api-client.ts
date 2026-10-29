export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) { super(message); this.name = 'ApiError'; }
}

export function apiMessage(status: number) {
  if (status === 401) return 'Email hoặc mật khẩu không đúng, hoặc phiên đăng nhập đã hết hạn.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 409) return 'Thông tin đã tồn tại hoặc vừa thay đổi. Vui lòng kiểm tra lại.';
  if (status === 429) return 'Bạn đã thử quá nhiều lần. Vui lòng chờ một phút rồi thử lại.';
  if (status === 400) return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường đã nhập.';
  if (status === 404) return 'Không tìm thấy thông tin được yêu cầu.';
  return 'Chưa thể kết nối dịch vụ. Vui lòng thử lại sau.';
}

export function createApiClient(baseUrl: string, transport: typeof fetch = fetch) {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid public API base URL');
  const base = baseUrl.replace(/\/$/, '');
  let token: string | null = null;
  let unauthorized: (() => void) | undefined;
  return {
    setToken(value: string | null) { token = value; },
    onUnauthorized(callback: (() => void) | undefined) { unauthorized = callback; },
    async request<T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; authenticated?: boolean; signal?: AbortSignal; idempotencyKey?: string } = {}): Promise<T> {
      if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) throw new Error('API path must be relative');
      const usedToken = options.authenticated !== false ? token : null;
      let response: Response;
      try {
        response = await transport(base + path, {
          method: options.method ?? 'GET', credentials: 'omit', cache: 'no-store', signal: options.signal,
          headers: { Accept: 'application/json', ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(usedToken ? { Authorization: `Bearer ${usedToken}` } : {}), ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}) },
          ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ApiError(0, apiMessage(0));
      }
      if (!response.ok) {
        // An old in-flight request must not expire a newer login. A 403 never logs out.
        if (response.status === 401 && usedToken && token === usedToken) { token = null; unauthorized?.(); }
        let code: string | undefined;
        if (path === '/front-desk/walk-in' && response.status === 409) {
          const body: unknown = await response.json().catch(() => null);
          if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' && ['WALK_IN_CUSTOMER_EXISTS', 'WALK_IN_ROOM_NOT_READY', 'WALK_IN_ROOM_OCCUPIED'].includes(body.code)) code = body.code;
        }
        throw new ApiError(response.status, apiMessage(response.status), code);
      }
      return response.json() as Promise<T>;
    },
  };
}
