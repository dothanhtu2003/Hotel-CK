import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { zodResolver } from '@hookform/resolvers/zod';
import { changeLanguage, i18n, languageKey, localized, message, readLanguage, resolveMessage, t, useLocale } from './index';
import { LanguageSwitcher } from './language-switcher';
import { formatDate, formatMoney } from './format';
import { useForm } from './forms';
import { loginSchema, type LoginInput } from '../features/auth/contracts';
import { FormField, Input, Table } from '../components/ui';
import { Trans } from 'react-i18next';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('language foundation', () => {
  it('defaults invalid/absent preferences to Vietnamese and restores English', () => {
    expect(readLanguage()).toBe('vi');
    localStorage.setItem(languageKey, 'fr'); expect(readLanguage()).toBe('vi');
    localStorage.setItem(languageKey, 'en'); expect(readLanguage()).toBe('en');
  });

  it('switches both ways without replacing the mounted control', async () => {
    render(<LanguageSwitcher />);
    const english = screen.getByRole('button', { name: 'English' });
    fireEvent.click(english);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy());
    expect(screen.getByRole('button', { name: 'English' })).toBe(english);
    expect(localStorage.getItem(languageKey)).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: 'Tiếng Việt' }));
    await waitFor(() => expect(screen.getByRole('group', { name: 'Ngôn ngữ' })).toBeTruthy());
    expect(localStorage.getItem(languageKey)).toBe('vi');
  });

  it('continues switching in memory when localStorage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(readLanguage()).toBe('vi');
    await changeLanguage('en'); expect(t('common:ui.tryAgain')).toBe('Try again');
    await changeLanguage('vi'); expect(t('common:ui.tryAgain')).toBe('Thử lại');
  });

  it('resolves module-scope presentation and stored notices in the current language', async () => {
    const labels = localized(() => ({ retry: t('common:ui.tryAgain') }));
    const saved = message('common:authProvider.yourSessionHasExpiredPleaseSignInAgain');
    expect(labels.retry).toBe('Thử lại');
    await changeLanguage('en');
    expect(labels.retry).toBe('Try again');
    expect(resolveMessage(saved)).toBe('Your session has expired. Please sign in again.');
  });

  it('preserves exact fractional VND, large amounts and negative refunds', async () => {
    expect(formatMoney('90000.50')).toBe('90.000,50 ₫');
    expect(formatMoney('99999999999999.99')).toBe('99.999.999.999.999,99 ₫');
    await changeLanguage('en');
    expect(formatMoney('90000.50')).toBe('₫90,000.50');
    expect(formatMoney('-0.50')).toBe('-₫0.50');
    expect(formatMoney('-1200.75')).toBe('-₫1,200.75');
  });

  it('uses hotel time for display without changing date inputs', async () => {
    expect(formatDate('2026-11-17T18:00:00Z', { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('18/11/2026');
    await changeLanguage('en');
    expect(formatDate('2026-11-17T18:00:00Z', { day: '2-digit', month: '2-digit', year: 'numeric' })).toBe('11/18/2026');
  });

  it('keeps an active dialog/form and its values while refreshing validation', async () => {
    function Form() {
      useLocale();
      const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
      return <div role="dialog" aria-label="Account"><LanguageSwitcher /><form onSubmit={form.handleSubmit(() => undefined)}>
        <FormField name="email" label={t('common:authPages.emailAddress')} error={form.formState.errors.email?.message}>
          <Input id="email" {...form.register('email')} />
        </FormField><button type="submit">Submit</button>
      </form></div>;
    }
    render(<Form />);
    const input = screen.getByRole('textbox'); fireEvent.change(input, { target: { value: 'invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByText('Vui lòng nhập email hợp lệ.');
    const dialog = screen.getByRole('dialog');
    await act(() => i18n.changeLanguage('en'));
    await screen.findByText('Please enter a valid email address.');
    expect(screen.getByRole('dialog')).toBe(dialog); expect(screen.getByRole('textbox')).toBe(input);
    expect((input as HTMLInputElement).value).toBe('invalid');
    expect(screen.getByLabelText('Email address')).toBe(input);
  });

  it('keeps controls in translated table columns mounted', async () => {
    function View() {
      useLocale();
      return <Table caption="Operations" rows={[{ id: 'original' }]} rowKey={row => row.id} columns={[{
        title: t('common:ui.tryAgain'), render: () => <Input aria-label="Reference" defaultValue="original" />,
      }]} />;
    }
    render(<View />);
    const input = screen.getByRole('textbox'); fireEvent.change(input, { target: { value: 'pending-reference' } });
    await act(() => changeLanguage('en'));
    expect(screen.getByRole('columnheader', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByRole('textbox')).toBe(input); expect((input as HTMLInputElement).value).toBe('pending-reference');
  });

  it('keeps personal text literal inside rich translations', () => {
    const name = '<img src=x onerror="window.injected=true">';
    const { container } = render(<Trans ns="common" i18nKey="supplement.assignmentAwaitingStart" values={{ value0: name }} components={{ part0: <strong /> }} />);
    expect(container.textContent).toContain(name);
    expect(container.querySelector('img')).toBeNull();
  });
});
