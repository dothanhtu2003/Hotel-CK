import { beforeEach } from 'vitest';
import { i18n, languageKey } from './index';

beforeEach(async () => {
  try { localStorage.removeItem(languageKey); } catch { /* Test may simulate denied storage. */ }
  await i18n.changeLanguage('vi');
});
