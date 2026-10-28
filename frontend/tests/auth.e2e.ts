import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { disableIsolatedFixture, fixtures, login } from './fixtures';

test('homepage: real local assets, active availability planner and keyboard dialog', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('heading', { level: 1 })).toContainText('Một khoảng lặng');
  await expect(page.getByRole('button', { name: 'Tìm phòng' })).toBeEnabled();
  await page.locator('.room-card').last().scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
  await page.getByRole('button', { name: 'Khám phá Một giấc ngủ thật sâu' }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Khám phá Một giấc ngủ thật sâu' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('register: client validation blocks bad input without an API write', async ({ page }) => {
  let posts = 0; page.on('request', request => { if (request.url().endsWith('/api/auth/register') && request.method() === 'POST') posts++; });
  await page.goto('/register'); await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByText('Vui lòng nhập họ và tên.')).toBeVisible();
  await page.getByLabel('Họ và tên', { exact: true }).fill('An'); await page.getByLabel('Địa chỉ email', { exact: true }).fill('bad');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('short1'); await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click(); await expect(page.getByText('Vui lòng nhập email hợp lệ.')).toBeVisible(); await expect(page.getByText('Mật khẩu xác nhận chưa khớp.')).toBeVisible(); expect(posts).toBe(0);
});

test('real register -> login -> auth/me -> users/me -> profile update/clear phone -> logout', async ({ page }) => {
  const f = fixtures(), email = `${randomUUID()}@frontend-test.invalid`;
  const calls: string[] = [], statuses: number[] = []; page.on('response', response => { if (/\/api\/(auth|users)\//.test(response.url())) { calls.push(`${response.request().method()} ${new URL(response.url()).pathname}`); statuses.push(response.status()); } });
  await page.goto('/register'); await page.getByLabel('Họ và tên', { exact: true }).fill('Frontend Guest Journey'); await page.getByLabel('Địa chỉ email', { exact: true }).fill(email); await page.getByLabel('Số điện thoại (không bắt buộc)', { exact: true }).fill('+84901234567'); await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password); await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(f.password); await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/); await expect(page.getByRole('status')).toContainText('Tạo tài khoản thành công'); await expect(page.getByLabel('Địa chỉ email', { exact: true })).toHaveValue(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await expect(page).toHaveURL(/\/guest$/);
  await page.locator('.workspace-sidebar').getByRole('link', { name: 'Hồ sơ cá nhân', exact: true }).click(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ cá nhân'); await expect(page.locator('dd').filter({ hasText: email })).toBeVisible();
  await page.getByRole('link', { name: 'Chỉnh sửa hồ sơ' }).click(); await page.getByLabel('Họ và tên', { exact: true }).fill('Updated Guest Journey'); await page.getByLabel('Số điện thoại', { exact: true }).fill('+84907654321'); await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page).toHaveURL(/\/guest\/profile$/); await expect(page.locator('dd').filter({ hasText: 'Updated Guest Journey' })).toBeVisible(); await expect(page.locator('dd').filter({ hasText: '+84907654321' })).toBeVisible();
  await page.getByRole('link', { name: 'Chỉnh sửa hồ sơ' }).click(); await page.getByLabel('Số điện thoại', { exact: true }).fill(''); await page.getByRole('button', { name: 'Lưu thay đổi' }).click(); await expect(page.locator('dd').filter({ hasText: 'Chưa cập nhật' })).toBeVisible();
  expect(calls).toEqual(expect.arrayContaining(['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me', 'GET /api/users/me', 'PATCH /api/users/me'])); expect(statuses.every(status => status === 200 || status === 201)).toBe(true);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie }))).toEqual({ local: 0, session: 0, cookie: '' });
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).last().click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).last().click(); await page.getByRole('button', { name: 'Xác nhận đăng xuất' }).click(); await expect(page).toHaveURL(/\/login$/);
  await page.goto('/guest/profile'); await expect(page).toHaveURL(/\/login$/); expect(page.url()).not.toMatch(/token|Bearer|eyJ/);
});

test('duplicate registration is a real backend 409 with a clear error', async ({ page }) => {
  const f = fixtures(); await page.goto('/register'); await page.getByLabel('Họ và tên', { exact: true }).fill('Duplicate'); await page.getByLabel('Địa chỉ email', { exact: true }).fill(f.users.guest.email); await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password); await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(f.password);
  const response = page.waitForResponse(r => r.url().endsWith('/api/auth/register')); await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click(); expect((await response).status()).toBe(409); await expect(page.getByRole('alert')).toContainText('Email này đã được đăng ký');
});

test('wrong credentials return actual 401 and do not create a session', async ({ page }) => {
  await page.goto('/login'); await page.getByLabel('Địa chỉ email', { exact: true }).fill(fixtures().users.guest.email); await page.getByLabel('Mật khẩu', { exact: true }).fill('Incorrect-Password123');
  const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login')); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); expect((await response).status()).toBe(401); await expect(page.getByRole('alert')).toContainText('Email hoặc mật khẩu'); await expect(page).toHaveURL(/\/login$/);
});

test('disabled account cannot log in', async ({ page }) => {
  const f = fixtures(); await page.goto('/login'); await page.getByLabel('Địa chỉ email', { exact: true }).fill(f.users.disabled.email); await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Email hoặc mật khẩu');
});

for (const path of ['/guest/profile', '/reception', '/housekeeping', '/admin']) test(`unauthenticated guard: ${path}`, async ({ page }) => { await page.goto(path); await expect(page).toHaveURL(/\/login$/); });

for (const [name, destination, label] of [['guest', '/guest', 'Khách lưu trú'], ['reception', '/reception', 'Lễ tân'], ['housekeeping', '/housekeeping', 'Nhân viên buồng phòng'], ['admin', '/admin', 'Quản trị viên']]) test(`real backend role navigation and 403 UX: ${name}`, async ({ page }) => {
  await login(page, name); await expect(page.locator('.sidebar-role')).toContainText(label);
  const forbidden = destination === '/admin' ? '/guest' : '/admin';
  await page.evaluate(path => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }, forbidden);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('vai trò khác'); await expect(page.getByText('403 · QUYỀN TRUY CẬP')).toBeVisible();
  await page.getByRole('link', { name: 'Về không gian của bạn' }).click(); await expect(page).toHaveURL(`http://localhost:5174${destination}`);
});

test('login restores only an authorized same-role return path', async ({ page }) => {
  const f = fixtures(); await page.goto('/guest/profile'); await expect(page).toHaveURL(/\/login$/); await page.getByLabel('Địa chỉ email', { exact: true }).fill(f.users.guest.email); await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await expect(page).toHaveURL(/\/guest\/profile$/); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ cá nhân');
});

test('reload deliberately loses the in-memory session', async ({ page }) => { await login(page); await page.reload(); await expect(page).toHaveURL(/\/login$/); expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0); });

test('authenticated 401 clears the client session after test account is disabled', async ({ page }) => {
  await login(page, 'expired'); await disableIsolatedFixture('expired');
  await page.locator('.workspace-sidebar').getByRole('link', { name: 'Hồ sơ cá nhân', exact: true }).click(); await expect(page).toHaveURL(/\/login$/); await expect(page.locator('.notice[role="status"]')).toContainText('Phiên đăng nhập đã hết hạn');
});

test('real offline/network error offers retry and recovers', async ({ page, context }) => {
  await login(page); await context.setOffline(true); await page.locator('.workspace-sidebar').getByRole('link', { name: 'Hồ sơ cá nhân', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa thể kết nối'); await context.setOffline(false); await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ cá nhân');
});

test('guest booking page remains connected after portal updates', async ({ page }) => {
  await login(page); await page.locator('.workspace-sidebar').getByRole('link', { name: /Đặt phòng/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Booking của tôi');
  await expect(page.locator('.coming-soon')).toHaveCount(0);
});

test('a real delayed profile request shows a loading state before rendering', async ({ page, context }) => {
  await login(page); const session = await context.newCDPSession(page);
  await session.send('Network.enable'); await session.send('Network.emulateNetworkConditions', { offline: false, latency: 700, downloadThroughput: -1, uploadThroughput: -1 });
  await page.locator('.workspace-sidebar').getByRole('link', { name: 'Hồ sơ cá nhân', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đang tải thông tin' })).toBeVisible(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ cá nhân');
  await session.detach();
});

test('desktop staff portal renders its role-specific navigation and status table', async ({ page }) => {
  await login(page, 'reception'); await expect(page.getByRole('table', { name: 'Danh sách booking', exact: true })).toBeVisible(); await expect(page.locator('.desk-stats>a')).toHaveCount(4);
  await page.screenshot({ path: fileURLToPath(new URL('../../.local/frontend-portal-desktop.png', import.meta.url)), fullPage: true });
});

test('edit form validates and confirms discarding unsaved changes', async ({ page }) => {
  await login(page); await page.locator('.workspace-sidebar').getByRole('link', { name: 'Hồ sơ cá nhân', exact: true }).click(); await page.getByRole('link', { name: 'Chỉnh sửa hồ sơ' }).click();
  await page.getByLabel('Họ và tên', { exact: true }).fill(''); await page.getByRole('button', { name: 'Lưu thay đổi' }).click(); await expect(page.getByText('Vui lòng nhập họ và tên.')).toBeVisible();
  await page.getByRole('button', { name: 'Hủy thay đổi' }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click(); await expect(page.getByRole('dialog')).not.toBeVisible(); await page.getByRole('button', { name: 'Hủy thay đổi' }).click(); await page.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click(); await expect(page).toHaveURL(/\/guest\/profile$/);
});

test('404 route presents a working return link', async ({ page }) => { await page.goto('/not-a-page'); await expect(page.getByText('404', { exact: true })).toBeVisible(); await page.getByRole('link', { name: 'Về trang chủ', exact: true }).click(); await expect(page).toHaveURL('http://localhost:5174/'); });

for (const width of [1440, 768, 390, 320]) test(`responsive home and login: ${width}px, no page overflow`, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 }); await page.goto('/'); await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width === 390 || width === 1440) await page.screenshot({ path: fileURLToPath(new URL(`../../.local/frontend-home-${width}.png`, import.meta.url)), fullPage: true });
  if (width <= 768) { await page.getByRole('button', { name: 'Mở menu', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible(); }
  await page.goto('/login'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeInViewport();
});

test('mobile staff portal, menu and profile remain usable at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page, 'reception'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Mở menu tài khoản' }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('dialog').getByRole('link', { name: 'Hồ sơ cá nhân', exact: true }).click(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ cá nhân'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: fileURLToPath(new URL('../../.local/frontend-profile-mobile.png', import.meta.url)), fullPage: true });
});

test('dev server does not expose private env files', async ({ request }) => {
  const privatePath = fileURLToPath(new URL('../../.local/frontend-e2e-fixtures.json', import.meta.url)).replaceAll('\\', '/');
  for (const path of ['/.env.local', '/@fs/' + encodeURI(privatePath)]) { const response = await request.get(path); expect([403, 404]).toContain(response.status()); }
});
