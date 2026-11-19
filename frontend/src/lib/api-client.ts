import { businessErrorKeys, businessMessage } from "../i18n/errors";
import { t as tr, LocalizedError, message, type TranslationKey } from "../i18n";

export const statusErrorKeys: Record<number, TranslationKey> = {
  401: 'common:apiClient.theEmailOrPasswordIsIncorrectOrYourSessionHasExpired',
  403: 'common:apiClient.youDoNotHavePermissionToPerformThisAction',
  409: 'common:apiClient.theInformationAlreadyExistsOrHasChangedPleaseCheckAgain',
  429: 'common:apiClient.tooManyAttemptsPleaseWaitAMinuteAndTryAgain',
  400: 'common:apiClient.someInformationIsInvalidPleaseCheckTheFieldsYouEntered',
  404: 'common:apiClient.theRequestedInformationWasNotFound',
};
export class ApiError extends LocalizedError {
  override toMessage() { return message(this.code && Object.hasOwn(businessErrorKeys, this.code) ? businessErrorKeys[this.code as keyof typeof businessErrorKeys] : statusErrorKeys[this.status] ?? 'common:apiClient.unableToConnectToTheServicePleaseTryAgainLater'); }
  constructor(public readonly status: number, _message: string, public readonly code?: string) { super('common:apiClient.unableToConnectToTheServicePleaseTryAgainLater'); this.name = 'ApiError'; Object.defineProperty(this, 'message', { get: () => businessMessage(this.code) ?? apiMessage(this.status), configurable: true }); }
}

export function apiMessage(status: number) {
  if (status === 401) return tr("common:apiClient.theEmailOrPasswordIsIncorrectOrYourSessionHasExpired");
  if (status === 403) return tr("common:apiClient.youDoNotHavePermissionToPerformThisAction");
  if (status === 409) return tr("common:apiClient.theInformationAlreadyExistsOrHasChangedPleaseCheckAgain");
  if (status === 429) return tr("common:apiClient.tooManyAttemptsPleaseWaitAMinuteAndTryAgain");
  if (status === 400) return tr("common:apiClient.someInformationIsInvalidPleaseCheckTheFieldsYouEntered");
  if (status === 404) return tr("common:apiClient.theRequestedInformationWasNotFound");
  return tr("common:apiClient.unableToConnectToTheServicePleaseTryAgainLater");
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
        const body: unknown = await response.json().catch(() => null);
        const candidate = body && typeof body === 'object' && 'code' in body ? body.code : undefined;
        const code = typeof candidate === 'string' && Object.hasOwn(businessErrorKeys, candidate) ? candidate : undefined;
        throw new ApiError(response.status, apiMessage(response.status), code);
      }
      try { return await response.json() as T; } catch { throw new ApiError(0, apiMessage(0)); }
    },
  };
}
