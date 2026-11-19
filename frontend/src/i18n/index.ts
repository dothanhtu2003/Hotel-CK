import i18next from 'i18next';
import { z } from 'zod';
import { initReactI18next, useTranslation } from 'react-i18next';
import viCommon from './locales/vi/common.json' with { type: 'json' };
import viGuest from './locales/vi/guest.json' with { type: 'json' };
import viReception from './locales/vi/reception.json' with { type: 'json' };
import viHousekeeping from './locales/vi/housekeeping.json' with { type: 'json' };
import viAdmin from './locales/vi/admin.json' with { type: 'json' };
import enCommon from './locales/en/common.json' with { type: 'json' };
import enGuest from './locales/en/guest.json' with { type: 'json' };
import enReception from './locales/en/reception.json' with { type: 'json' };
import enHousekeeping from './locales/en/housekeeping.json' with { type: 'json' };
import enAdmin from './locales/en/admin.json' with { type: 'json' };

export const languageKey = 'an-nhien.language';
export type Language = 'vi' | 'en';
export const resources = {
  vi: { common: viCommon, guest: viGuest, reception: viReception, housekeeping: viHousekeeping, admin: viAdmin },
  en: { common: enCommon, guest: enGuest, reception: enReception, housekeeping: enHousekeeping, admin: enAdmin },
};
type Leaves<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}` }[keyof T & string];
type ResourceKey = { [N in keyof typeof resources.vi]: `${N}:${Leaves<(typeof resources.vi)[N]>}` }[keyof typeof resources.vi];
type PluralBase<K extends string> = K extends `${infer Base}_one` | `${infer Base}_other` ? Base : never;
export type TranslationKey = ResourceKey | PluralBase<ResourceKey>;

export function readLanguage(): Language {
  try { return localStorage.getItem(languageKey) === 'en' ? 'en' : 'vi'; } catch { return 'vi'; }
}

export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources, lng: readLanguage(), supportedLngs: ['vi', 'en'], fallbackLng: 'vi',
  defaultNS: 'common', initAsync: false, saveMissing: false, returnEmptyString: false,
  returnNull: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
// Registered formatters let one full message pluralize several independent counts.
for (const name of Object.keys(viCommon.counts).filter(key => key.endsWith('_other')).map(key => key.slice(0, -6))) {
  i18n.services.formatter?.add(name, (value: unknown, lng?: string) => String(i18n.t(`common:counts.${name}` as TranslationKey, {
    count: Number(value), display: typeof value === 'number' ? new Intl.NumberFormat(lng === 'en' ? 'en-US' : 'vi-VN').format(value) : String(value), lng,
  })));
}
// Covers default Zod type/UUID/number/enum messages as well as explicit schema copy.
z.config({ customError: () => t('common:validation.invalid') });

export function language(): Language { return i18n.resolvedLanguage === 'en' ? 'en' : 'vi'; }
export function displayLocale() { return language() === 'en' ? 'en-US' : 'vi-VN'; }
export function useLocale(): Language { useTranslation(); return language(); }
export async function changeLanguage(value: Language) {
  await i18n.changeLanguage(value);
  try { localStorage.setItem(languageKey, value); } catch { /* In-memory choice remains available. */ }
}

/** The narrow application boundary prevents accidental raw-key display. */
export function t(key: TranslationKey, values: Record<string, unknown> = {}): string {
  if (!i18n.exists(key, values)) return language() === 'en' ? 'Information unavailable' : 'Chưa có thông tin';
  return String(i18n.t(key, values));
}

/** Read-only, language-reactive presentation configuration. No business data is proxied. */
export function localized<T extends object>(factory: () => T): T {
  return new Proxy(factory(), {
    get(_target, property) {
      const current = factory();
      const value = Reflect.get(current, property);
      return typeof value === 'function' ? value.bind(current) : value;
    },
    set() { throw new TypeError('Localized presentation configuration is read-only'); },
  });
}

export type Message = { key: TranslationKey; values?: Record<string, unknown> };
const messagePrefix = '\u001ei18n:';
/** Persist descriptors in transient notices/toasts, so already-visible copy changes language. */
export function message(key: TranslationKey, values?: Record<string, unknown>): string {
  return messagePrefix + JSON.stringify({ key, values });
}
export function resolveMessage(value: string | null | undefined): string {
  if (!value) return '';
  if (!value.startsWith(messagePrefix)) return value;
  try {
    const descriptor = JSON.parse(value.slice(messagePrefix.length)) as Message;
    return t(descriptor.key, descriptor.values);
  } catch { return t('common:apiClient.unableToConnectToTheServicePleaseTryAgainLater'); }
}
export class LocalizedError extends Error {
  constructor(public readonly translationKey: TranslationKey, public readonly values?: Record<string, unknown>) {
    super();
    Object.defineProperty(this, 'message', { get: () => t(translationKey, values), configurable: true });
  }
  toMessage(): string { return message(this.translationKey, this.values); }
}
export function safeError(error: unknown): string {
  return error instanceof LocalizedError ? error.message : t('common:apiClient.unableToConnectToTheServicePleaseTryAgainLater');
}
export function errorToken(error: unknown): string {
  return error instanceof LocalizedError ? error.toMessage() : message('common:apiClient.unableToConnectToTheServicePleaseTryAgainLater');
}
