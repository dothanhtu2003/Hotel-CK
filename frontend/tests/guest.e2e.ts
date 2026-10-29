import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { fixtures, login } from './fixtures';

const base = 'http://127.0.0.1:3301/api';
async function token(request: APIRequestContext, name: string) { const f = fixtures(); const r = await request.post(base + '/auth/login', { data: { email: f.users[name].email, password: f.password } }); expect(r.ok()).toBe(true); return { Authorization: 'Bearer ' + (await r.json()).accessToken }; }
async function navigate(page: Page, path: string) { await page.evaluate(p => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); }, path); }
async function book(request: APIRequestContext, roomId: string, checkIn: string, checkOut: string) { const headers = await token(request, 'guest'); const r = await request.post(base + '/bookings', { headers, data: { roomId, checkIn, checkOut, guests: 2 } }); expect(r.status()).toBe(201); return r.json(); }

test('OpenAPI confirms guest contracts from the real backend', async ({ request }) => { const r = await request.get(base + '/docs-json'); expect(r.ok()).toBe(true); const schema = await r.json(); for (const path of ['/api/rooms/available', '/api/bookings/my', '/api/service-orders/my', '/api/bookings/{id}/billing-preview', '/api/invoices/{id}']) expect(schema.paths[path]).toBeTruthy(); });

test('homepage search → room → registration/login return → booking → cancel; ownership and pagination', async ({ page, request }) => {
  const f = fixtures(); await page.goto('/');
  await page.getByLabel('NGÀY NHẬN PHÒNG').fill('2035-11-10'); await page.getByLabel('NGÀY TRẢ PHÒNG').fill('2035-11-13');
  await page.getByRole('button', { name: 'Tìm phòng', exact: true }).click(); await expect(page).toHaveURL(/checkIn=2035-11-10/);
  await page.getByLabel('Loại phòng').selectOption(f.roomType.id); await page.getByRole('button', { name: 'Tìm phòng', exact: true }).click();
  await expect(page.locator('.guest-room')).toHaveCount(1);
  await page.getByRole('link', { name: 'Chọn hạng phòng này', exact: true }).click();
  await page.getByRole('button', { name: 'Đăng nhập để đặt phòng' }).click();
  await page.getByRole('link', { name: 'Tạo tài khoản', exact: true }).click();
  const email = `${randomUUID()}@frontend-test.invalid`;
  await page.getByLabel('Họ và tên', { exact: true }).fill('Guest Phase 8B'); await page.getByLabel('Địa chỉ email', { exact: true }).fill(email); await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password); await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(f.password); await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/); await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/rooms/' + f.room.id + '\\?'));
  await page.getByRole('button', { name: 'Đặt phòng này ngay', exact: true }).click(); await expect(page.getByRole('dialog')).toContainText('1.950.000,75');
  const response = page.waitForResponse(r => r.url() === base + '/bookings' && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Xác nhận đặt phòng', exact: true }).click();
  const created = await response; expect(created.status()).toBe(201); const b = await created.json(); expect(Object.keys(created.request().postDataJSON()).sort()).toEqual(['checkIn', 'checkOut', 'guests', 'roomId']);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(b.reference); await expect(page.getByText('3 đêm · 2 khách', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Xem chi phí & hóa đơn', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Chưa phát hành hóa đơn' })).toBeVisible();
  const other = await token(request, 'guest'); expect((await request.get(base + '/bookings/' + b.id, { headers: other })).status()).toBe(404); expect((await request.get(base + '/bookings/' + b.id + '/billing-preview', { headers: other })).status()).toBe(404);
  await navigate(page, '/guest/bookings'); await expect(page.getByRole('heading', { name: b.reference })).toBeVisible(); await page.getByRole('link', { name: 'Chi tiết booking', exact: true }).click();
  await page.getByRole('button', { name: 'Hủy booking', exact: true }).click(); await page.getByRole('button', { name: 'Xác nhận hủy booking' }).click(); await expect(page.locator('.status-badge').filter({ hasText: 'Đã hủy' })).toBeVisible();
  await navigate(page, '/guest/bookings?status=CONFIRMED'); await expect(page.getByRole('heading', { name: 'Chưa có booking' })).toBeVisible();
  await navigate(page, '/rooms'); await expect(page.getByRole('button', { name: 'Trang trước' })).toBeDisabled(); await page.getByRole('button', { name: 'Trang sau' }).click(); await expect(page).toHaveURL(/page=2/);
});

test('checked-in guest orders multiple services, cancels pending order, sees preview and staff-issued paid invoice', async ({ page, request }) => {
  const f = fixtures(), today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const out = new Date(Date.parse(today + 'T00:00:00Z') + 2 * 86400000).toISOString().slice(0, 10), b = await book(request, f.secondRoom.id, today, out), staff = await token(request, 'reception');
  for (const action of ['confirm', 'check-in']) expect((await request.patch(`${base}/bookings/${b.id}/${action}`, { headers: staff })).ok()).toBe(true);
  await login(page); await navigate(page, '/guest/services?bookingId=' + b.id);
  await expect(page.getByRole('button', { name: 'Xem lại đơn dịch vụ' })).toBeDisabled();
  await page.getByLabel('Số lượng ' + f.services[0].name, { exact: true }).fill('1.5'); await expect(page.getByRole('button', { name: 'Xem lại đơn dịch vụ' })).toBeDisabled();
  for (const s of f.services) await page.getByLabel('Số lượng ' + s.name, { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Xem lại đơn dịch vụ' }).click();
  const response = page.waitForResponse(r => r.url() === base + '/service-orders' && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Xác nhận đặt dịch vụ' }).click();
  const created = await response; expect(created.status()).toBe(201); const o = await created.json(); expect(Object.keys(created.request().postDataJSON()).sort()).toEqual(['bookingId', 'items']); expect(Object.keys(created.request().postDataJSON().items[0]).sort()).toEqual(['quantity', 'serviceId']);
  await expect(page.getByRole('heading', { name: 'Đơn dịch vụ đã được tạo' })).toBeVisible(); await expect(page.getByRole('status').filter({ hasText: 'Đơn dịch vụ đã được tạo' })).toContainText('250.001,50');
  await page.getByRole('link', { name: 'Xem đơn dịch vụ', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Đơn ' + o.id.slice(0, 8) })).toBeVisible();
  await page.getByRole('button', { name: 'Hủy đơn dịch vụ', exact: true }).click(); await page.getByRole('button', { name: 'Xác nhận hủy đơn' }).click(); await expect(page.locator('.status-badge').filter({ hasText: 'Đã hủy' })).toBeVisible();
  const guest = await token(request, 'guest'); const completedResponse = await request.post(base + '/service-orders', { headers: guest, data: { bookingId: b.id, items: [{ serviceId: f.services[0].id, quantity: 3 }] } }); expect(completedResponse.status()).toBe(201); const completed = await completedResponse.json(); expect((await request.patch(base + '/service-orders/' + completed.id + '/complete', { headers: staff })).ok()).toBe(true);
  await navigate(page, '/guest/bookings/' + b.id + '/billing'); await expect(page.getByRole('heading', { name: 'Chi phí dự kiến · Chưa phải hóa đơn' })).toBeVisible(); await expect(page.getByText('135.000,75 ₫', { exact: true })).toBeVisible();
  const issued = await request.post(base + '/bookings/' + b.id + '/invoice', { headers: staff }); expect(issued.status()).toBe(201); const inv = await issued.json();
  expect((await request.post(`${base}/invoices/${inv.id}/payments`, { headers: { ...staff, 'Idempotency-Key': randomUUID() }, data: { amount: inv.totalAmount, method: 'CASH' } })).status()).toBe(201);
  await navigate(page, '/guest/bookings/' + b.id); await page.getByRole('link', { name: 'Xem chi phí & hóa đơn' }).click(); await expect(page.getByRole('heading', { name: 'Hóa đơn đã phát hành' })).toBeVisible(); await expect(page.locator('.status-badge').filter({ hasText: 'Đã thanh toán' })).toBeVisible();
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.screenshot({ path: '../.local/phase8b-billing-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Mở hóa đơn' }).click(); await expect(page).toHaveURL(new RegExp('/guest/invoices/' + inv.id)); await expect(page.getByText('0 ₫', { exact: true })).toBeVisible();
  expect((await request.get(base + '/invoices/' + inv.id, { headers: await token(request, 'admin') })).status()).toBe(200);
  expect((await request.patch(base + '/bookings/' + b.id + '/check-out', { headers: guest })).status()).toBe(403);
  for (const endpoint of [`/bookings/${b.id}/invoice`, `/invoices/${inv.id}/payments`]) expect((await request.post(base + endpoint, { headers: guest, data: {} })).status()).toBe(403);
  await navigate(page, '/guest/services?bookingId=' + b.id); await expect(page.getByText('Booking đã có hóa đơn nên không thể đặt thêm dịch vụ.')).toBeVisible(); await expect(page.getByLabel('Số lượng ' + f.services[0].name, { exact: true })).toBeDisabled();
});

test('real booking race returns 409 and blocks duplicate submission', async ({ page, request }) => {
  const f = fixtures(); await login(page); await navigate(page, `/rooms/${f.room.id}?checkIn=2036-01-01&checkOut=2036-01-03&guests=2`); await page.getByRole('button', { name: 'Đặt phòng này' }).click();
  await book(request, f.room.id, '2036-01-01', '2036-01-03');
  await page.getByRole('button', { name: 'Xác nhận đặt phòng', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Phòng không còn khả dụng'); await expect(page.getByRole('button', { name: 'Xác nhận đặt phòng', exact: true })).toBeDisabled();
});

test('cancel handles a real state conflict and booking ownership stays hidden in UI', async ({ page, request }) => {
  const f = fixtures(), b = await book(request, f.room.id, '2037-01-01', '2037-01-03'); await login(page); await navigate(page, '/guest/bookings/' + b.id); await page.getByRole('button', { name: 'Hủy booking', exact: true }).click();
  expect((await request.patch(base + '/bookings/' + b.id + '/cancel', { headers: await token(request, 'guest') })).ok()).toBe(true);
  await page.getByRole('button', { name: 'Xác nhận hủy booking' }).click(); await expect(page.getByRole('alert')).toContainText('Trạng thái vừa thay đổi'); await page.keyboard.press('Escape');
  const email = `${randomUUID()}@frontend-test.invalid`, password = fixtures().password;
  expect((await request.post(base + '/auth/register', { data: { fullName: 'Other guest', email, password } })).status()).toBe(201);
  const otherLogin = await request.post(base + '/auth/login', { data: { email, password } });
  const outsider = await request.post(base + '/bookings', { headers: { Authorization: 'Bearer ' + (await otherLogin.json()).accessToken }, data: { roomId: f.room.id, checkIn: '2038-01-01', checkOut: '2038-01-02', guests: 1 } });
  expect(outsider.status()).toBe(201); const other = await outsider.json(); await navigate(page, '/guest/bookings/' + other.id); await expect(page.getByRole('alert')).toContainText('Không tìm thấy');

});

test('availability loading, offline recovery, empty results and responsive pages', async ({ page, context }) => {
  await page.goto('/rooms?checkIn=2039-01-01&checkOut=2039-01-03&guests=2147483647'); await expect(page.getByRole('heading', { name: 'Chưa có hạng phòng phù hợp' })).toBeVisible();
  const session = await context.newCDPSession(page); await session.send('Network.enable'); await session.send('Network.emulateNetworkConditions', { offline: false, latency: 900, downloadThroughput: -1, uploadThroughput: -1 });
  await page.goto('/rooms?checkIn=2039-02-01&checkOut=2039-02-03&guests=2'); await expect(page.locator('.guest-skeleton')).toBeVisible(); await expect(page.locator('.guest-room').first()).toBeVisible(); await session.detach();
  await context.setOffline(true); await navigate(page, '/rooms?checkIn=2039-03-01&checkOut=2039-03-03&guests=2'); await expect(page.getByRole('alert')).toContainText('Chưa thể kết nối'); await context.setOffline(false); await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await expect(page.locator('.guest-room').first()).toBeVisible();
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.locator('.guest-room').first().getByRole('link', { name: 'Chọn hạng phòng này', exact: true }).click(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../.local/phase8b-room-mobile.png', fullPage: true });
});
