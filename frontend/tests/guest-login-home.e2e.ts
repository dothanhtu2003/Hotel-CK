import { test, expect } from '@playwright/test';
import { fixtures, login } from './fixtures';

test('guest login lands home and old guest landing redirects home', async ({ page }) => {
  await login(page, 'guest', '/');
  await expect(page.locator('.public-header')).toBeVisible();
  await page.goto('/guest');
  await expect(page).toHaveURL('http://localhost:5174/');
  await expect(page.locator('.header-login')).toHaveAttribute('href', '/guest/bookings');
});

test('login from old guest landing also returns home', async ({ page }) => {
  await page.goto('/guest');
  await expect(page).toHaveURL(/\/login$/);
  const f = fixtures();
  await page.getByLabel('Địa chỉ email', { exact: true }).fill(f.users.guest.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:5174/');
});
