import { expect, test } from '@playwright/test';
import { fixtures, login } from './fixtures';

const roles = [
  { user: 'guest', home: '/', paths: ['/rooms', '/guest/bookings', '/guest/services', '/guest/service-orders', '/guest/billing', '/guest/profile', '/guest/profile/edit'] },
  { user: 'reception', home: '/reception', paths: ['/reception/bookings', '/reception/rooms', '/reception/tape-chart', '/reception/walk-in', '/reception/service-orders', '/reception/billing', '/reception/revenue', '/reception/housekeeping', '/reception/housekeeping/tasks', '/reception/profile'] },
  { user: 'housekeeping', home: '/housekeeping', paths: ['/housekeeping/board', '/housekeeping/tasks', '/housekeeping/profile'] },
  { user: 'admin', home: '/admin', paths: ['/admin/bookings', '/admin/rooms', '/admin/tape-chart', '/admin/walk-in', '/admin/service-orders', '/admin/billing', '/admin/revenue', '/admin/housekeeping', '/admin/housekeeping/tasks', '/admin/profile'] },
];

for (const role of roles) test(`${role.user}: VI/EN switching, direct routes, refresh and mobile controls`, async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await login(page, role.user);
  const switcher = () => page.locator('.language-switcher:visible').first();
  await switcher().getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('an-nhien.language'))).toBe('en');
  for (const path of role.paths) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(switcher().getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('body')).not.toContainText(/\b(?:common|guest|reception|housekeeping|admin):[A-Za-z]/);
    await expect(page.getByText('Chưa có thông tin', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Information unavailable', { exact: true })).toHaveCount(0);
    await expect(page.locator('.state-panel[role="alert"]')).toHaveCount(0);
  }
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(role.home);
  await page.waitForLoadState('networkidle');
  if (role.user === 'reception' || role.user === 'admin') await expect(page.getByRole('group', { name: 'Filter by bed count' })).toBeVisible();
  if (role.user === 'housekeeping') await expect(page.getByRole('button', { name: 'Start cleaning', exact: true }).first()).toBeVisible();
  if (role.user === 'guest') await expect(page.getByRole('heading', { name: /A moment of calm/ })).toBeVisible();
  await expect(switcher().getByRole('button', { name: 'Tiếng Việt', exact: true })).toBeVisible();
  await page.screenshot({ path: `../.local/i18n-${role.user}-en-mobile.png` });
  await switcher().getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(switcher().getByRole('button', { name: 'Tiếng Việt', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('English choice survives authentication, logout and session expiry', async ({ page }) => {
  const f = fixtures(); await page.goto('/login');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill(f.users.guest.email);
  await page.getByLabel('Password', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:5174/');
  await page.goto('/guest/bookings');
  await expect(page.getByRole('heading', { name: 'My reservations', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await page.getByRole('button', { name: 'Confirm sign out', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(f.users.guest.email);
  await page.getByLabel('Password', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:5174/guest/bookings');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('an-nhien.auth-session')!);
    saved.expiresAt = Date.now() - 1;
    localStorage.setItem('an-nhien.auth-session', JSON.stringify(saved));
  });
  await page.goto('/guest/profile');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('an-nhien.language'))).toBe('en');
});
