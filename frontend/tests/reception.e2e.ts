import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { disableIsolatedFixture, fixtures, login } from './fixtures';

const api = 'http://127.0.0.1:3301/api';
async function headers(request: APIRequestContext, name = 'reception') { const f = fixtures(); const r = await request.post(api + '/auth/login', { data: { email: f.users[name].email, password: f.password } }); expect(r.status()).toBe(200); return { Authorization: 'Bearer ' + (await r.json()).accessToken }; }
async function go(page: Page, path: string) {
  await page.evaluate(p => new Promise<void>(resolve => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }), path);
  const pathname = path.split('?')[0], id = pathname.split('/').at(-1)!;
  let ready = page.getByRole('heading', { name: 'Một ngày đón khách chu đáo.', exact: true });
  if (/\/bookings\/[^/]+\/billing$/.test(pathname)) ready = page.getByRole('heading', { name: 'Chi phí & phát hành hóa đơn', exact: true });
  else if (/\/bookings\/[^/]+$/.test(pathname)) ready = page.locator(`.desk-page[data-booking-id="${id}"]`);
  else if (pathname.endsWith('/bookings')) ready = page.getByRole('heading', { name: 'Quản lý booking', exact: true });
  else if (/\/invoices\//.test(pathname)) ready = page.getByText('Mã hóa đơn: ' + id, { exact: true });
  else if (/\/service-orders\/[^/]+$/.test(pathname)) ready = page.getByText('Mã đơn: ' + id, { exact: true });
  else if (pathname.endsWith('/service-orders')) ready = page.getByRole('heading', { name: 'Quản lý đơn dịch vụ', exact: true });
  await expect(ready.or(page.locator('.state-panel[role="alert"]')).or(page.getByText('403 · QUYỀN TRUY CẬP')).first()).toBeVisible();
}
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function plus(date: string, days: number) { return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10); }
async function createBooking(request: APIRequestContext, room: number, checkIn = today()) { const response = await request.post(api + '/bookings', { headers: await headers(request, 'guest'), data: { roomId: fixtures().deskRooms[room].id, checkIn, checkOut: plus(checkIn, 2), guests: 2 } }); expect(response.status()).toBe(201); return response.json(); }
async function checkedIn(request: APIRequestContext, room: number) { const b = await createBooking(request, room), staff = await headers(request); for (const action of ['confirm', 'check-in']) expect((await request.patch(`${api}/bookings/${b.id}/${action}`, { headers: staff })).ok()).toBe(true); return b; }
async function invoiceFixture(request: APIRequestContext, room: number) { const b = await checkedIn(request, room); const r = await request.post(`${api}/bookings/${b.id}/invoice`, { headers: await headers(request) }); expect(r.status()).toBe(201); return r.json(); }
async function dialogAction(page: Page, name: string) { await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận ' + name.toLocaleLowerCase('vi-VN'), exact: true }).click(); }
async function paymentReview(page: Page, amount: string, method: 'CASH' | 'BANK_TRANSFER' = 'CASH') { await page.getByLabel('Số tiền (VND)', { exact: true }).fill(amount); await page.getByLabel('Phương thức', { exact: true }).selectOption(method); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Xem lại khoản thu' }).click(); await expect(page.getByRole('dialog', { name: 'Xác nhận ghi nhận thanh toán', exact: true })).toBeVisible(); }

test('desk OpenAPI contract includes idempotency header and real payment schema', async ({ request }) => {
  const r = await request.get(api + '/docs-json'), schema = await r.json();
  expect(schema.paths['/api/invoices/{id}/payments'].post.parameters.some((p: { name: string; required: boolean }) => p.name === 'Idempotency-Key' && p.required)).toBe(true);
  expect(schema.components.schemas.CreatePaymentDto.properties.amount.type).toBe('string');
  for (const p of ['/api/bookings/{id}/confirm', '/api/bookings/{id}/check-in', '/api/bookings/{id}/check-out', '/api/service-orders/{id}/complete']) expect(schema.paths[p].patch).toBeTruthy();
});

test('reception dashboard totals, booking filters, pagination, detail, double-click confirm and cancel', async ({ page, request }) => {
  const b = await createBooking(request, 0, '2042-01-01'); await login(page, 'reception'); const staff = await headers(request);
  const snapshot = await (await request.get(`${api}/front-desk/dashboard`, { headers: staff })).json();
  for (const key of ['arrivals','departures','staying','ready','dirty','orders','pending']) await expect(page.locator(`.desk-stats .metric-${key} strong`)).toHaveText(snapshot.counts[key].toLocaleString('vi-VN'));
  await page.locator('.workspace-sidebar').getByRole('link', { name: 'Quản lý booking', exact: true }).click(); await page.getByRole('combobox', { name: 'Trạng thái booking', exact: true }).selectOption('PENDING');
  await expect(page.getByRole('table', { name: 'Danh sách booking', exact: true })).toBeVisible(); await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click(); await expect(page).toHaveURL(/page=2/); await page.getByRole('button', { name: 'Trang trước', exact: true }).click();
  await page.getByRole('link', { name: b.reference, exact: true }).click(); await expect(page.getByRole('heading', { level: 1 })).toHaveText(b.reference);
  let posts = 0; page.on('request', r => { if (r.url() === `${api}/bookings/${b.id}/confirm` && r.method() === 'PATCH') posts++; });
  await page.getByRole('button', { name: 'Xác nhận booking', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận xác nhận booking', exact: true }).click({ clickCount: 2 });
  await expect(page.locator('.desk-page .status-badge').filter({ hasText: 'Đã xác nhận' })).toBeVisible(); expect(posts).toBe(1);
  await dialogAction(page, 'Hủy booking'); await expect(page.locator('.desk-page .status-badge').filter({ hasText: 'Đã hủy' })).toBeVisible();
});

test('invalid check-in is a real PostgreSQL 409 with actionable room/date conditions', async ({ page, request }) => {
  const b = await createBooking(request, 0, '2043-01-01'), staff = await headers(request); expect((await request.patch(`${api}/bookings/${b.id}/confirm`, { headers: staff })).status()).toBe(200);
  await login(page, 'reception'); await go(page, '/reception/bookings/' + b.id); await expect(page.getByRole('heading', { name: 'Điều kiện nhận phòng' })).toBeVisible();
  await dialogAction(page, 'Nhận phòng'); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('CLEAN'); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('ngày lưu trú');
});

test('full front desk stay: confirm, check-in, services, invoice, CASH + BANK_TRANSFER, paid check-out triggers', async ({ page, request }) => {
  const f = fixtures(), b = await createBooking(request, 1), staff = await headers(request), guest = await headers(request, 'guest');
  await login(page, 'reception'); await go(page, '/reception/bookings/' + b.id); await dialogAction(page, 'Xác nhận booking'); await expect(page.getByRole('button', { name: 'Nhận phòng', exact: true })).toBeVisible(); await dialogAction(page, 'Nhận phòng'); await expect(page.locator('.desk-page .status-badge').filter({ hasText: 'Đang lưu trú' })).toBeVisible();
  const orderIds: string[] = [];
  for (let i = 0; i < 2; i++) { const r = await request.post(api + '/service-orders', { headers: guest, data: { bookingId: b.id, items: [{ serviceId: f.services[i].id, quantity: 2 }] } }); expect(r.status()).toBe(201); orderIds.push((await r.json()).id); }
  await go(page, `/reception/bookings/${b.id}/billing`); await expect(page.getByRole('button', { name: 'Phát hành hóa đơn', exact: true })).toHaveCount(0); expect((await request.post(`${api}/bookings/${b.id}/invoice`, { headers: staff })).status()).toBe(409);
  await go(page, '/reception/service-orders?status=PENDING'); await expect(page.getByRole('link', { name: orderIds[0].slice(0, 8), exact: true })).toBeVisible();
  await page.getByRole('link', { name: orderIds[0].slice(0, 8), exact: true }).click(); await expect(page.getByRole('table', { name: 'Chi tiết dịch vụ và giá snapshot', exact: true })).toBeVisible(); await dialogAction(page, 'Hoàn thành dịch vụ'); await expect(page.locator('.desk-page .status-badge').filter({ hasText: 'Hoàn thành' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Hoàn thành dịch vụ', exact: true })).toHaveCount(0);
  await go(page, '/reception/service-orders/' + orderIds[1]); await dialogAction(page, 'Hủy đơn dịch vụ'); await expect(page.locator('.desk-page .status-badge').filter({ hasText: 'Đã hủy' })).toBeVisible();
  await go(page, `/reception/bookings/${b.id}/billing`); await expect(page.getByText('90.000,50 ₫', { exact: true }).first()).toBeVisible();
  const issued = page.waitForResponse(r => r.url() === `${api}/bookings/${b.id}/invoice` && r.request().method() === 'POST'); await dialogAction(page, 'Phát hành hóa đơn'); const issuedResponse = await issued; expect(issuedResponse.status()).toBe(201); expect(issuedResponse.request().postData()).toBeNull(); const i = await issuedResponse.json(); await expect(page).toHaveURL('/reception/invoices/' + i.id);
  await expect(page.getByRole('button', { name: 'Trả phòng', exact: true })).toHaveCount(0); expect((await request.patch(`${api}/bookings/${b.id}/check-out`, { headers: staff })).status()).toBe(409);
  await page.getByLabel('Số tiền (VND)', { exact: true }).fill('999999999999.99'); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Xem lại khoản thu' }).click(); await expect(page.locator('.desk-payment .field-error')).toContainText('không được vượt số dư');
  await paymentReview(page, '100000.25'); const cash = page.waitForResponse(r => r.url() === `${api}/invoices/${i.id}/payments` && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Xác nhận ghi nhận khoản thu', exact: true }).click({ clickCount: 2 }); const cashResponse = await cash; expect(cashResponse.status()).toBe(201); const cashResult = await cashResponse.json(); expect(cashResponse.request().headers()['idempotency-key']).toBe(cashResult.payment.id); expect(cashResponse.request().postDataJSON()).toEqual({ amount: '100000.25', method: 'CASH' });
  await expect(page.getByRole('table', { name: 'Danh sách payment', exact: true }).locator('tbody tr')).toHaveCount(1);
  await paymentReview(page, cashResult.invoice.balance, 'BANK_TRANSFER'); const transfer = page.waitForResponse(r => r.url() === `${api}/invoices/${i.id}/payments` && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Xác nhận ghi nhận khoản thu', exact: true }).click(); expect((await transfer).status()).toBe(201);
  await expect(page.getByRole('table', { name: 'Danh sách payment', exact: true }).locator('tbody tr')).toHaveCount(2); await expect(page.locator('.desk-page .status-badge').filter({ hasText: 'Đã thanh toán' })).toBeVisible(); expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  await page.getByRole('heading', { level: 1 }).click(); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '../.local/phase8c-invoice-desktop.png', fullPage: true });
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 950 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.screenshot({ path: '../.local/phase8c-invoice-mobile.png', fullPage: true });
  const checkout = page.waitForResponse(r => r.url() === `${api}/bookings/${b.id}/check-out` && r.request().method() === 'PATCH'); await dialogAction(page, 'Trả phòng'); const checked = await checkout; expect(checked.status()).toBe(200); const result = await checked.json(); expect(result.booking.status).toBe('CHECKED_OUT'); expect(result.room.housekeepingStatus).toBe('DIRTY'); expect(result.housekeepingTask.status).toBe('TODO');
  await expect(page.getByRole('heading', { name: 'Đã hoàn tất trả phòng', exact: true })).toBeVisible(); const room = await (await request.get(api + '/rooms/' + f.deskRooms[1].id)).json(); expect(room.housekeepingStatus).toBe('DIRTY');
});

test('offline payment keeps UUID across reload and retries same payload; server replay creates no duplicate', async ({ page, request, context }) => {
  const i = await invoiceFixture(request, 2); await login(page, 'reception'); await go(page, '/reception/invoices/' + i.id); await paymentReview(page, '100000.25');
  await context.setOffline(true); await page.getByRole('button', { name: 'Xác nhận ghi nhận khoản thu', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Khoản thu chờ kiểm tra' })).toBeVisible();
  const stored = await page.evaluate(userId => JSON.parse(sessionStorage.getItem('an-nhien:pending-receipt:' + userId)!), fixtures().users.reception.id); expect(stored.invoiceId).toBe(i.id); await expect(page.getByRole('button', { name: 'Gửi lại cùng khóa' })).toHaveCount(0);
  await context.setOffline(false); await page.reload(); await expect(page).toHaveURL(/\/login$/); await login(page, 'reception', '/reception/invoices/' + i.id); await go(page, '/reception/invoices/' + i.id);
  await expect(page.getByRole('heading', { name: 'Khoản thu chờ kiểm tra' })).toBeVisible(); await page.getByRole('button', { name: 'Kiểm tra lại hóa đơn' }).click(); await expect(page.getByRole('button', { name: 'Gửi lại cùng khóa' })).toBeVisible();
  const retry = page.waitForResponse(r => r.url() === `${api}/invoices/${i.id}/payments` && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Gửi lại cùng khóa' }).click(); const r = await retry; expect(r.status()).toBe(201); expect(r.request().headers()['idempotency-key']).toBe(stored.key); expect(r.request().postDataJSON()).toEqual({ amount: stored.amount, method: stored.method });
  const staff = await headers(request), replay = await request.post(`${api}/invoices/${i.id}/payments`, { headers: { ...staff, 'Idempotency-Key': stored.key }, data: { amount: stored.amount, method: stored.method } }); expect(replay.status()).toBe(201); expect((await replay.json()).replayed).toBe(true);
  const fresh = await (await request.get(api + '/invoices/' + i.id, { headers: staff })).json(); expect(fresh.payments.filter((p: { id: string }) => p.id === stored.key)).toHaveLength(1); await expect(page.getByRole('heading', { name: 'Ghi nhận thanh toán tại quầy' })).toBeVisible();
});

test('lost response after real committed payment is reconciled from invoice without another POST', async ({ page, request, context }) => {
  const i = await invoiceFixture(request, 3); await login(page, 'reception'); await go(page, '/reception/invoices/' + i.id); await paymentReview(page, '100000.50', 'BANK_TRANSFER');
  const session = await context.newCDPSession(page); await session.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/invoices/*/payments', requestStage: 'Response' }] });
  const dropped = new Promise<void>(resolve => { session.on('Fetch.requestPaused', async event => { if (event.request.method !== 'POST') { await session.send('Fetch.continueResponse', { requestId: event.requestId }); return; } expect(event.responseStatusCode).toBe(201); await session.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'TimedOut' }); await session.send('Fetch.disable'); resolve(); }); });
  let writes = 0; page.on('request', r => { if (r.url() === `${api}/invoices/${i.id}/payments` && r.method() === 'POST') writes++; });
  await page.getByRole('button', { name: 'Xác nhận ghi nhận khoản thu', exact: true }).click(); await dropped; await expect(page.getByRole('heading', { name: 'Khoản thu chờ kiểm tra' })).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm tra lại hóa đơn' }).click(); await expect(page.getByRole('heading', { name: 'Ghi nhận thanh toán tại quầy' })).toBeVisible(); expect(writes).toBe(1);
  await expect(page.getByRole('table', { name: 'Danh sách payment', exact: true }).locator('tbody tr')).toHaveCount(1); expect(await page.evaluate(() => sessionStorage.length)).toBe(0); await session.detach();
});

for (const role of ['guest', 'housekeeping']) test(`${role} cannot enter Front Desk or call staff APIs`, async ({ page, request }) => {
  await login(page, role); await go(page, '/reception'); await expect(page.getByText('403 · QUYỀN TRUY CẬP')).toBeVisible(); const h = await headers(request, role); expect((await request.get(api + '/bookings', { headers: h })).status()).toBe(403); expect((await request.get(api + '/service-orders', { headers: h })).status()).toBe(403);
});

test('admin has the same supported desk actions, 404 and responsive dashboard', async ({ page, request }) => {
  await login(page, 'admin'); await expect(page.getByRole('heading', { level: 1 })).toContainText('Một ngày đón khách'); await go(page, '/reception'); await expect(page.getByText('403 · QUYỀN TRUY CẬP')).toHaveCount(0);
  const b = await createBooking(request, 4, '2044-01-01'); await go(page, '/reception/bookings/' + b.id); await dialogAction(page, 'Xác nhận booking'); await expect(page.getByRole('button', { name: 'Nhận phòng', exact: true })).toBeVisible();
  await go(page, '/reception/bookings/' + randomUUID()); await expect(page.locator('.state-panel[role="alert"]')).toContainText('Không tìm thấy'); await go(page, '/reception');
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 950 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); } await page.screenshot({ path: '../.local/phase8c-dashboard-mobile.png', fullPage: true });
});

test('concurrent service completion and new pending order prevent stale staff mutations', async ({ page, request }) => {
  const b = await checkedIn(request, 5), staff = await headers(request), guest = await headers(request, 'guest');
  const create = async () => { const r = await request.post(api + '/service-orders', { headers: guest, data: { bookingId: b.id, items: [{ serviceId: fixtures().services[0].id, quantity: 1 }] } }); expect(r.status()).toBe(201); return r.json(); };
  const order = await create(); await login(page, 'reception'); await go(page, '/reception/service-orders/' + order.id);
  await page.getByRole('button', { name: 'Hủy đơn dịch vụ', exact: true }).click(); expect((await request.patch(`${api}/service-orders/${order.id}/complete`, { headers: staff })).status()).toBe(200);
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận hủy đơn dịch vụ', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Trạng thái vừa thay đổi' }).first()).toBeVisible(); await page.keyboard.press('Escape');
  await go(page, `/reception/bookings/${b.id}/billing`); await page.getByRole('button', { name: 'Phát hành hóa đơn', exact: true }).click(); await create();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận phát hành hóa đơn', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Chưa thể phát hành' }).first()).toBeVisible();
});

test('staff loading, empty results, offline recovery and responsive lists', async ({ page, context }) => {
  await login(page, 'reception'); await go(page, '/reception/bookings?page=1000000'); await expect(page.getByRole('heading', { name: 'Chưa có booking phù hợp' })).toBeVisible();
  await context.setOffline(true); await go(page, '/reception/bookings?status=CONFIRMED'); await expect(page.locator('.state-panel[role="alert"]')).toContainText('Chưa thể kết nối'); await context.setOffline(false); await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await expect(page.getByRole('table', { name: 'Danh sách booking', exact: true })).toBeVisible();
  const session = await context.newCDPSession(page); await session.send('Network.enable'); await session.send('Network.emulateNetworkConditions', { offline: false, latency: 700, downloadThroughput: -1, uploadThroughput: -1 });
  await go(page, '/reception/service-orders?status=COMPLETED'); await expect(page.locator('.guest-skeleton')).toBeVisible(); await expect(page.getByRole('table', { name: 'Danh sách đơn dịch vụ', exact: true })).toBeVisible(); await session.detach();
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 950 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
});

test('authenticated staff 401 clears JWT session and returns to login', async ({ page }) => {
  await login(page, 'deskExpired'); await disableIsolatedFixture('deskExpired');
  // A dashboard request may already expire the session before a profile link can be clicked.
  await page.evaluate(() => { history.pushState({}, '', '/reception/profile'); window.dispatchEvent(new PopStateEvent('popstate')); }); await expect(page).toHaveURL(/\/login$/); await expect(page.locator('.notice')).toContainText('Phiên đăng nhập đã hết hạn');
});
