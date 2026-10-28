import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { disableIsolatedFixture, fixtures, login } from './fixtures';

const api = 'http://127.0.0.1:3301/api';
async function auth(request: APIRequestContext, name = 'housekeeping') { const f = fixtures(); const r = await request.post(api + '/auth/login', { data: { email: f.users[name].email, password: f.password } }); expect(r.status()).toBe(200); return { Authorization: 'Bearer ' + (await r.json()).accessToken }; }
async function go(page: Page, path: string) {
  await page.evaluate(p => new Promise<void>(resolve => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }), path);
  const plain = path.split('?')[0], id = plain.split('/').at(-1)!;
  let ready = page.getByRole('heading', { name: 'Board buồng phòng', exact: true });
  if (plain === '/housekeeping') ready = page.getByRole('heading', { name: 'Chăm chút từng căn phòng.', exact: true });
  else if (/\/tasks\/[^/]+$/.test(plain)) ready = page.locator('.hk-page dd').filter({ hasText: id });
  else if (plain.endsWith('/tasks')) ready = page.getByRole('heading', { name: /^(Công việc của tôi|Lịch sử công việc buồng phòng)$/ });
  await expect(ready.or(page.locator('.state-panel[role="alert"]')).or(page.getByText('403 · QUYỀN TRUY CẬP')).first()).toBeVisible();
}
async function assign(page: Page, staffId: string) { await page.getByLabel('UUID nhân viên HOUSEKEEPING', { exact: true }).fill(staffId); await page.getByRole('button', { name: 'Xem lại phân công', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận phân công', exact: true }).click(); }

test('live Swagger has the exact housekeeping DTOs and seven operations', async ({ request }) => {
  const schema = await (await request.get(api + '/docs-json')).json();
  expect(schema.paths['/api/housekeeping/board'].get).toBeTruthy(); expect(schema.paths['/api/housekeeping/tasks'].get).toBeTruthy(); expect(schema.paths['/api/housekeeping/tasks'].post).toBeTruthy(); expect(schema.paths['/api/housekeeping/tasks/{id}'].get).toBeTruthy();
  for (const action of ['assign', 'start', 'complete']) expect(schema.paths[`/api/housekeeping/tasks/{id}/${action}`].patch).toBeTruthy();
  expect(schema.components.schemas.BoardRoomDto.properties.housekeepingStatus.enum).toEqual(['CLEAN', 'DIRTY', 'CLEANING']); expect(schema.components.schemas.CreateTaskDto.required).toEqual(['roomId']); expect(schema.components.schemas.AssignTaskDto.required).toEqual(['assignedStaffId']);
});

test('housekeeping dashboard totals and board are scoped to assigned open tasks, with pagination and filters', async ({ page, request }) => {
  const f = fixtures(), headers = await auth(request); await login(page, 'housekeeping');
  for (const status of ['TODO', 'IN_PROGRESS']) { const result = await (await request.get(`${api}/housekeeping/tasks?status=${status}&pageSize=1&page=1`, { headers })).json(); await expect(page.locator(`.desk-stats>a[href="/housekeeping/tasks?status=${status}"] strong`)).toHaveText(result.meta.total.toLocaleString('vi-VN')); }
  await expect(page.getByText(f.users.housekeeping.id, { exact: true })).toBeVisible();
  await page.locator('.workspace-sidebar').getByRole('link', { name: 'Buồng phòng', exact: true }).click(); await expect(page.locator('.hk-room')).toHaveCount(9);
  const board = await (await request.get(api + '/housekeeping/board?pageSize=100', { headers })).json(); expect(board.data.every((r: { openTask: { assignedStaffId: string } }) => r.openTask.assignedStaffId === f.users.housekeeping.id)).toBe(true); expect(board.data.some((r: { id: string }) => r.id === f.housekeeping.rooms[14].id)).toBe(false);
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click(); await expect(page).toHaveURL(/page=2/); await expect(page.locator('.hk-room')).toHaveCount(board.meta.total - 9);
  await page.getByLabel('Trạng thái vệ sinh', { exact: true }).selectOption('CLEANING'); await expect(page).not.toHaveURL(/page=2/); await expect(page.locator('.hk-room')).toHaveCount(1); await expect(page.locator('.hk-room .status-badge').filter({ hasText: 'Đang dọn' })).toBeVisible();
  await page.getByLabel('Trạng thái vệ sinh', { exact: true }).selectOption('CLEAN'); await expect(page.getByRole('heading', { name: 'Chưa có phòng phù hợp' })).toBeVisible();
  await page.getByLabel('Trạng thái vệ sinh', { exact: true }).selectOption('DIRTY'); await expect(page.locator('.hk-room')).toHaveCount(9); await expect(page.getByText(f.users.hkOther.fullName, { exact: true })).toHaveCount(0);
});

test('my tasks supports TODO, IN_PROGRESS, DONE, pagination and completedAt detail', async ({ page }) => {
  const f = fixtures(); await login(page, 'housekeeping'); await go(page, '/housekeeping/tasks');
  await page.getByLabel('Trạng thái công việc', { exact: true }).selectOption('TODO'); await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(10); await page.getByRole('button', { name: 'Trang sau', exact: true }).click(); await expect(page).toHaveURL(/page=2/);
  await page.getByLabel('Trạng thái công việc', { exact: true }).selectOption('IN_PROGRESS'); await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1); await expect(page).not.toHaveURL(/page=2/);
  await page.getByLabel('Trạng thái công việc', { exact: true }).selectOption('DONE'); await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
  await page.getByRole('link', { name: 'Xem công việc', exact: true }).click(); await expect(page.locator('.hk-page dd').filter({ hasText: f.housekeeping.tasks[13].id })).toBeVisible(); await expect(page.getByRole('button', { name: 'Bắt đầu dọn phòng', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Hoàn thành dọn phòng', exact: true })).toHaveCount(0); await expect(page.locator('.hk-page .guest-facts')).not.toContainText('Chưa hoàn thành');
});

test('ownership 404 has no fallback fetch and unassigned/wrong-state work is refused by real API', async ({ page, request }) => {
  const f = fixtures(), own = await auth(request); await login(page, 'housekeeping'); await expect(page.getByRole('heading', { name: 'Chăm chút từng căn phòng.', exact: true })).toBeVisible(); await expect(page.locator('.guest-skeleton')).toHaveCount(0); await expect(page.locator('.desk-stats strong').filter({ hasText: '…' })).toHaveCount(0); const businessReads: string[] = [];
  page.on('request', r => { if (/\/api\/(rooms|housekeeping)/.test(r.url())) businessReads.push(new URL(r.url()).pathname); });
  await go(page, '/housekeeping/tasks/' + f.housekeeping.tasks[14].id); await expect(page.locator('.state-panel[role="alert"]')).toContainText('Không tìm thấy'); expect(businessReads.every(p => p === '/api/housekeeping/tasks/' + f.housekeeping.tasks[14].id)).toBe(true);
  expect((await request.get(`${api}/housekeeping/tasks?assignedStaffId=${f.users.hkOther.id}`, { headers: own })).status()).toBe(403);
  expect((await request.get(`${api}/housekeeping/board?assignedStaffId=${f.users.hkOther.id}`, { headers: own })).status()).toBe(403);
  for (const index of [14, 15]) expect((await request.patch(`${api}/housekeeping/tasks/${f.housekeeping.tasks[index].id}/start`, { headers: own })).status()).toBe(404);
  expect((await request.patch(`${api}/housekeeping/tasks/${f.housekeeping.tasks[0].id}/complete`, { headers: own })).status()).toBe(409);
  for (const role of ['reception', 'admin']) { const headers = await auth(request, role); for (const action of ['start', 'complete']) expect((await request.patch(`${api}/housekeeping/tasks/${f.housekeeping.tasks[0].id}/${action}`, { headers })).status()).toBe(403); }
});

test('start and complete use empty bodies, prevent double-click, and read CLEANING/CLEAN from backend', async ({ page, request, context }) => {
  const f = fixtures(), task = f.housekeeping.tasks[0], headers = await auth(request); await login(page, 'housekeeping'); await go(page, '/housekeeping/tasks/' + task.id);
  const session = await context.newCDPSession(page); await session.send('Network.enable'); await session.send('Network.emulateNetworkConditions', { offline: false, latency: 500, downloadThroughput: -1, uploadThroughput: -1 });
  let starts = 0; page.on('request', r => { if (r.url() === `${api}/housekeeping/tasks/${task.id}/start` && r.method() === 'PATCH') starts++; });
  await page.getByRole('button', { name: 'Bắt đầu dọn phòng', exact: true }).click(); const response = page.waitForResponse(r => r.url() === `${api}/housekeeping/tasks/${task.id}/start` && r.request().method() === 'PATCH'); const submit = page.getByRole('dialog').getByRole('button', { name: 'Xác nhận bắt đầu dọn', exact: true }); await submit.click({ clickCount: 2 }); await expect(submit).toBeDisabled();
  const started = await response; expect(started.status()).toBe(200); expect(started.request().postData()).toBeNull(); const startResult = await started.json(); expect(startResult.status).toBe('IN_PROGRESS'); expect(startResult.room.housekeepingStatus).toBe('CLEANING'); expect(starts).toBe(1); await session.detach();
  await expect(page.getByRole('button', { name: 'Hoàn thành dọn phòng', exact: true })).toBeVisible(); await go(page, '/housekeeping/board?roomId=' + task.roomId); await expect(page.locator('.hk-room')).toContainText('Đang dọn'); await page.getByRole('link', { name: 'Xem công việc', exact: true }).click();
  await page.getByRole('button', { name: 'Hoàn thành dọn phòng', exact: true }).click(); const completed = page.waitForResponse(r => r.url() === `${api}/housekeeping/tasks/${task.id}/complete` && r.request().method() === 'PATCH'); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận hoàn thành dọn', exact: true }).click(); const result = await completed; expect(result.status()).toBe(200); expect(result.request().postData()).toBeNull(); const done = await result.json(); expect(done.status).toBe('DONE'); expect(done.completedAt).toBeTruthy(); expect(done.room.housekeepingStatus).toBe('CLEAN');
  await expect(page.locator('.hk-page .status-badge').filter({ hasText: 'Phòng sạch' })).toBeVisible(); await go(page, '/housekeeping/board?roomId=' + task.roomId); await expect(page.getByRole('heading', { name: 'Chưa có phòng phù hợp' })).toBeVisible();
  const list = await (await request.get(`${api}/housekeeping/tasks?roomId=${task.roomId}&status=DONE`, { headers })).json(); expect(list.data[0].id).toBe(task.id); expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
});

test('real start/complete races return 409 and refresh the visible task state', async ({ page, request }) => {
  const f = fixtures(), headers = await auth(request); await login(page, 'housekeeping');
  const a = f.housekeeping.tasks[1]; await go(page, '/housekeeping/tasks/' + a.id); await page.getByRole('button', { name: 'Bắt đầu dọn phòng', exact: true }).click(); expect((await request.patch(`${api}/housekeeping/tasks/${a.id}/start`, { headers })).status()).toBe(200); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận bắt đầu dọn', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Công việc đã thay đổi' }).first()).toBeVisible(); await expect(page.locator('.hk-page .status-badge').filter({ hasText: 'Đang thực hiện' })).toBeVisible();
  const b = f.housekeeping.tasks[2]; expect((await request.patch(`${api}/housekeeping/tasks/${b.id}/start`, { headers })).status()).toBe(200); await go(page, '/housekeeping/tasks/' + b.id); await page.getByRole('button', { name: 'Hoàn thành dọn phòng', exact: true }).click(); expect((await request.patch(`${api}/housekeeping/tasks/${b.id}/complete`, { headers })).status()).toBe(200); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận hoàn thành dọn', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Công việc đã thay đổi' }).first()).toBeVisible(); await expect(page.getByRole('button', { name: 'Hoàn thành dọn phòng', exact: true })).toHaveCount(0);
  const raced = await Promise.all([1, 2].map(() => request.patch(`${api}/housekeeping/tasks/${f.housekeeping.tasks[3].id}/start`, { headers }))); expect(raced.map(r => r.status()).sort()).toEqual([200, 409]);
});

test('reception creates a task, prevents duplicates and assigns only active HOUSEKEEPING via UUID form', async ({ page, request }) => {
  const f = fixtures(), room = f.housekeeping.rooms[16], staff = await auth(request, 'reception'); await login(page, 'reception'); await go(page, '/reception/housekeeping?roomId=' + room.id); await expect(page.locator('.hk-room')).toHaveCount(1);
  let createCalls = 0; page.on('request', r => { if (r.url() === api + '/housekeeping/tasks' && r.method() === 'POST') createCalls++; });
  await page.getByRole('button', { name: 'Tạo công việc', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Quay lại', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible(); expect(createCalls).toBe(0);
  await page.getByRole('button', { name: 'Tạo công việc', exact: true }).click(); await page.getByLabel('Ghi chú công việc', { exact: true }).fill('x'.repeat(2001)); await page.getByRole('button', { name: 'Xác nhận tạo công việc', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('2000');
  await page.getByLabel('Ghi chú công việc', { exact: true }).fill('  Thay đồ vải và vệ sinh phòng.  '); const created = page.waitForResponse(r => r.url() === api + '/housekeeping/tasks' && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Xác nhận tạo công việc', exact: true }).click({ clickCount: 2 }); const response = await created; expect(response.status()).toBe(201); expect(response.request().postDataJSON()).toEqual({ roomId: room.id, notes: 'Thay đồ vải và vệ sinh phòng.' }); const task = await response.json(); expect(task.status).toBe('TODO'); expect(task.room.housekeepingStatus).toBe('DIRTY'); expect(createCalls).toBe(1);
  await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.getByRole('button', { name: 'Tạo công việc', exact: true })).toHaveCount(0); expect((await request.post(api + '/housekeeping/tasks', { headers: staff, data: { roomId: room.id } })).status()).toBe(409); await page.getByRole('link', { name: 'Xem công việc', exact: true }).click();
  await page.getByLabel('UUID nhân viên HOUSEKEEPING', { exact: true }).fill('bad'); await page.getByRole('button', { name: 'Xem lại phân công', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'UUID nhân viên' }).first()).toBeVisible();
  for (const name of ['reception', 'hkInactive']) { await assign(page, f.users[name].id); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('HOUSEKEEPING'); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('ACTIVE'); await page.keyboard.press('Escape'); }
  const assigned = page.waitForResponse(r => r.url() === `${api}/housekeeping/tasks/${task.id}/assign` && r.request().method() === 'PATCH'); await assign(page, f.users.hkOther.id); const assignedResponse = await assigned; expect(assignedResponse.status()).toBe(200); expect(assignedResponse.request().postDataJSON()).toEqual({ assignedStaffId: f.users.hkOther.id }); await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.locator('.hk-page .guest-facts')).toContainText(f.users.hkOther.fullName);
  await expect(page.getByRole('button', { name: 'Bắt đầu dọn phòng', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Hoàn thành dọn phòng', exact: true })).toHaveCount(0);
});

test('a concurrent task creation gets 409 without duplicate history', async ({ page, request }) => {
  const room = fixtures().housekeeping.rooms[17], headers = await auth(request, 'admin'); await login(page, 'reception'); await go(page, '/reception/housekeeping?roomId=' + room.id); await page.getByRole('button', { name: 'Tạo công việc', exact: true }).click(); expect((await request.post(api + '/housekeeping/tasks', { headers, data: { roomId: room.id } })).status()).toBe(201);
  await page.getByRole('button', { name: 'Xác nhận tạo công việc', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('đã có công việc'); await expect(page.getByRole('button', { name: 'Xác nhận tạo công việc', exact: true })).toBeDisabled(); const tasks = await (await request.get(`${api}/housekeeping/tasks?roomId=${room.id}`, { headers })).json(); expect(tasks.meta.total).toBe(1);
});

test('admin board and assignment work, while a started task refuses reassignment', async ({ page, request }) => {
  const f = fixtures(), task = f.housekeeping.tasks[15], worker = await auth(request); await login(page, 'admin'); await page.locator('.workspace-sidebar').getByRole('link', { name: 'Buồng phòng', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Board buồng phòng', exact: true })).toBeVisible(); await go(page, '/admin/housekeeping/tasks/' + task.id); await assign(page, f.users.housekeeping.id); await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByLabel('UUID nhân viên HOUSEKEEPING', { exact: true }).fill(f.users.hkOther.id); await page.getByRole('button', { name: 'Xem lại phân công', exact: true }).click(); expect((await request.patch(`${api}/housekeeping/tasks/${task.id}/start`, { headers: worker })).status()).toBe(200); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận phân công', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Công việc đã thay đổi' }).first()).toBeVisible(); await expect(page.getByRole('button', { name: 'Xem lại phân công', exact: true })).toHaveCount(0);
});

test('checkout-generated TODO is visible on staff board and can be assigned without creating another task', async ({ page, request }) => {
  const f = fixtures(), room = f.housekeeping.rooms[19], guest = await auth(request, 'guest'), staff = await auth(request, 'reception'); const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), out = new Date(Date.parse(day + 'T00:00:00Z') + 2 * 86400000).toISOString().slice(0, 10);
  const booked = await request.post(api + '/bookings', { headers: guest, data: { roomId: room.id, checkIn: day, checkOut: out, guests: 1 } }); expect(booked.status()).toBe(201); const booking = await booked.json(); for (const action of ['confirm', 'check-in']) expect((await request.patch(`${api}/bookings/${booking.id}/${action}`, { headers: staff })).status()).toBe(200);
  const issued = await request.post(`${api}/bookings/${booking.id}/invoice`, { headers: staff }); expect(issued.status()).toBe(201); const invoice = await issued.json(); expect((await request.post(`${api}/invoices/${invoice.id}/payments`, { headers: { ...staff, 'Idempotency-Key': randomUUID() }, data: { amount: invoice.totalAmount, method: 'CASH' } })).status()).toBe(201); const checked = await request.patch(`${api}/bookings/${booking.id}/check-out`, { headers: staff }); expect(checked.status()).toBe(200); const result = await checked.json(); expect(result.room.housekeepingStatus).toBe('DIRTY'); expect(result.housekeepingTask.status).toBe('TODO');
  await login(page, 'reception'); await go(page, '/reception/housekeeping?roomId=' + room.id); await expect(page.locator('.hk-room')).toContainText('Cần dọn'); await page.getByRole('link', { name: 'Xem công việc', exact: true }).click(); await expect(page.locator('.hk-page .guest-facts')).toContainText(result.housekeepingTask.id); await assign(page, f.users.housekeeping.id); await expect(page.getByRole('dialog')).not.toBeVisible(); const history = await (await request.get(`${api}/housekeeping/tasks?roomId=${room.id}`, { headers: staff })).json(); expect(history.meta.total).toBe(1);
});

test('guest has no housekeeping access in UI or backend', async ({ page, request }) => {
  await login(page); for (const path of ['/housekeeping', '/housekeeping/board', '/reception/housekeeping', '/admin/housekeeping']) { await go(page, path); await expect(page.getByText('403 · QUYỀN TRUY CẬP')).toBeVisible(); }
  const headers = await auth(request, 'guest'); for (const path of ['/housekeeping/board', '/housekeeping/tasks']) expect((await request.get(api + path, { headers })).status()).toBe(403); expect((await request.get(api + '/housekeeping/board')).status()).toBe(401);
});

test('empty, loading, offline recovery and responsive board/task detail use real data', async ({ page, request, context }) => {
  await login(page, 'hkEmpty'); await page.locator('.workspace-sidebar').getByRole('link', { name: 'Buồng phòng', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Chưa có phòng phù hợp' })).toBeVisible();
  const session = await context.newCDPSession(page); await session.send('Network.enable'); await session.send('Network.emulateNetworkConditions', { offline: false, latency: 700, downloadThroughput: -1, uploadThroughput: -1 }); await go(page, '/housekeeping/tasks?status=TODO'); await expect(page.locator('.guest-skeleton')).toBeVisible(); await expect(page.getByRole('heading', { name: 'Chưa có công việc phù hợp' })).toBeVisible(); await session.detach();
  await context.setOffline(true); await go(page, '/housekeeping/board?housekeepingStatus=CLEANING'); await expect(page.locator('.state-panel[role="alert"]')).toContainText('Chưa thể kết nối'); await context.setOffline(false); await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Chưa có phòng phù hợp' })).toBeVisible();
  const headers = await auth(request, 'reception'), freshTask = await request.post(api + '/housekeeping/tasks', { headers, data: { roomId: fixtures().housekeeping.rooms[20].id, notes: 'Công việc kiểm tra hiển thị responsive.' } }); expect(freshTask.status()).toBe(201); const task = await freshTask.json(); expect((await request.patch(`${api}/housekeeping/tasks/${task.id}/assign`, { headers, data: { assignedStaffId: fixtures().users.hkEmpty.id } })).status()).toBe(200); await page.getByRole('button', { name: 'Làm mới board', exact: true }).click(); await page.getByLabel('Trạng thái vệ sinh', { exact: true }).selectOption('DIRTY'); await expect(page.locator('.hk-room')).toHaveCount(1);
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 950 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.getByRole('heading', { level: 1 }).click(); await page.screenshot({ path: '../.local/phase8d-board-mobile.png', fullPage: true }); await page.getByRole('link', { name: 'Xem công việc', exact: true }).click(); await expect(page.locator('.hk-page dd').filter({ hasText: task.id })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: '../.local/phase8d-task-mobile.png', fullPage: true });
});

test('housekeeping authenticated 401 clears the memory session', async ({ page }) => { await login(page, 'hkExpired'); await expect(page.locator('.desk-stats strong')).toHaveText(['0', '0', '0', '0']); await expect(page.locator('.guest-skeleton')).toHaveCount(0); await disableIsolatedFixture('hkExpired'); await page.locator('.workspace-sidebar').getByRole('link', { name: 'Hồ sơ cá nhân', exact: true }).click(); await expect(page).toHaveURL(/\/login$/); await expect(page.locator('.notice')).toContainText('Phiên đăng nhập đã hết hạn'); });
