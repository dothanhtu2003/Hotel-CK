import keys from './enum-labels.json' with { type: 'json' };
import { t, type TranslationKey } from './index';

export function enumLabel(domain: keyof typeof keys, code: string): string {
  const labels: Record<string, string> = keys[domain];
  return Object.hasOwn(labels, code) ? t(labels[code] as TranslationKey) : t('common:status.unknown');
}
