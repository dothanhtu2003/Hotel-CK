import { changeLanguage, useLocale, t } from './index';

export function LanguageSwitcher() {
  const current = useLocale();
  return <div className="language-switcher" role="group" aria-label={t('common:language.label')}>
    <button type="button" lang="vi" aria-label="Tiếng Việt" aria-pressed={current === 'vi'} onClick={() => void changeLanguage('vi')}>VI</button>
    <span aria-hidden="true">/</span>
    <button type="button" lang="en" aria-label="English" aria-pressed={current === 'en'} onClick={() => void changeLanguage('en')}>EN</button>
  </div>;
}
