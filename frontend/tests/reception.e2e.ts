import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { disableIsolatedFixture, fixtures, login, staffBooking, assertFits } from './fixtures';

const api = 'http://127.0.0.1:3301/api';
async function headers(request: APIRequestContext, name = 'reception') { const f = fixtures(); const r = await request.post(api + '/auth/login', { data: { email: f.users[name].email, password: f.password } }); expect(r.status()).toBe(200); return { Authorization: 'Bearer ' + (await r.json()).accessToken }; }
async function go(page: Page, path: string) {
  await page.evaluate(p => new Promise<void>(resolve => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }), path);
  const pathname = path.split('?')[0], id = pathname.split('/').at(-1)!;
  let ready = page.getByRole('heading', { name: 'Tổng quan lễ tân', exact: true });
  if (/\/bookings\/[^/]+\/billing$/.test(pathname)) ready = page.locator('.billing-header-card');
  else if (/\/bookings\/[^/]+$/.test(pathname)) ready = page.locator(`.desk-page[data-booking-id="${id}"]`);
  else if (pathname.endsWith('/bookings')) ready = page.getByRole('heading', { name: 'Quản lý booking', exact: true });
  else if (/\/invoices\//.test(pathname)) ready = page.locator('.billing-header-card');
  else if (/\/service-orders\/[^/]+$/.test(pathname)) ready = page.getByRole('heading',{name:'Đơn dịch vụ #'+id.slice(0,8),exact:true});
  else if (pathname.endsWith('/service-orders')) ready = page.getByRole('heading', { name: 'Quản lý đơn dịch vụ', exact: true });
  await expect(ready.or(page.locator('.state-panel[role="alert"]')).or(page.getByText('403 · QUYỀN TRUY CẬP')).first()).toBeVisible();
}
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function plus(date: string, days: number) { return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10); }
async function createBooking(request:APIRequestContext,room:number,checkIn=today()){return staffBooking(request,fixtures().deskRooms[room].id,checkIn,plus(checkIn,2));}
async function checkedIn(request: APIRequestContext, room: number) { const b = await createBooking(request, room), staff = await headers(request); for (const action of ['confirm', 'check-in']) expect((await request.patch(`${api}/bookings/${b.id}/${action}`, { headers: staff })).ok()).toBe(true); return b; }
async function invoiceFixture(request: APIRequestContext, room: number) { const b = await checkedIn(request, room); const r = await request.post(`${api}/bookings/${b.id}/invoice`, { headers: await headers(request) }); expect(r.status()).toBe(201); return r.json(); }
async function dialogAction(page:Page,name:string){
 const actual=name==='Hoàn thành dịch vụ'?'Ghi nhận đơn':name==='Hủy đơn dịch vụ'?'Hủy đơn':name==='Trả phòng'?'Xác nhận trả phòng':name;
 const suffix=name==='Hoàn thành dịch vụ'?'/settle':name==='Hủy đơn dịch vụ'||name==='Hủy booking'?'/cancel':name==='Phát hành hóa đơn'?'/invoice':name==='Trả phòng'?'/check-out':'/check-in';
 const response=page.waitForResponse(r=>r.url().startsWith(api+'/')&&r.url().endsWith(suffix)&&['POST','PATCH'].includes(r.request().method()));await page.getByRole('button',{name:actual,exact:true}).click();if(name!=='Nhận phòng')await page.getByRole('dialog').getByRole('button').last().click();expect((await response).status()).toBe(name==='Phát hành hóa đơn'?201:200);
}
async function paymentReview(page:Page,amount:string){await expect(page.locator('.desk-payment input[type="hidden"]')).toHaveValue(amount);await page.getByLabel('Phương thức',{exact:true}).selectOption('CASH');}
test('desk OpenAPI contract includes idempotency header and real payment schema', async ({ request }) => {
  const r = await request.get(api + '/docs-json'), schema = await r.json();
  expect(schema.paths['/api/invoices/{id}/payments'].post.parameters.some((p: { name: string; required: boolean }) => p.name === 'Idempotency-Key' && p.required)).toBe(true);
  expect(schema.components.schemas.CreatePaymentDto.properties.amount.type).toBe('string');
  for (const p of ['/api/bookings/{id}/confirm', '/api/bookings/{id}/check-in', '/api/bookings/{id}/check-out', '/api/service-orders/{id}/complete']) expect(schema.paths[p].patch).toBeTruthy();
});

test('reception dashboard totals, booking filters, pagination, detail, double-click confirm and cancel', async ({ page, request }) => {
  const b = await createBooking(request, 0, '2042-01-01'); await login(page, 'reception');
  await expect(page.locator('.today-metric')).toHaveCount(0);
  await expect(page.getByText('Điều phối khách', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Bảng trạng thái phòng', { exact: true })).toBeVisible();
  await page.locator('.workspace-sidebar').getByRole('link', { name: 'Quản lý booking', exact: true }).click(); await page.getByRole('group',{name:'Chế độ xem booking'}).getByRole('button',{name:/Chờ nhận phòng/}).click();
  await expect(page.getByRole('table', { name: 'Danh sách booking', exact: true })).toBeVisible(); await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click(); await expect(page).toHaveURL(/page=2/); await page.getByRole('button', { name: 'Trang trước', exact: true }).click();
  await page.getByRole('link', { name: b.reference, exact: true }).click(); await expect(page.locator('[data-booking-id]')).toContainText(b.reference);
  const h=await headers(request);const confirmations=await Promise.all([1,2].map(()=>request.patch(`${api}/bookings/${b.id}/confirm`,{headers:h})));expect(confirmations.map(r=>r.status()).sort()).toEqual([200,409]);await page.reload();expect((await(await request.get(`${api}/bookings/${b.id}`,{headers:h})).json()).status).toBe('CONFIRMED');await expect(page.getByText('Chờ nhận phòng',{exact:true}).first()).toBeVisible();
  await dialogAction(page, 'Hủy booking'); await expect(page.getByText('Đã hủy',{exact:true}).first()).toBeVisible();
});

test('booking detail returns to the filtered reception list', async ({ page }) => {
  await login(page, 'reception');
  await page.goto('/reception/bookings?status=PENDING');
  const table = page.getByRole('table', { name: 'Danh sách booking', exact: true });
  await table.locator('a[href^="/reception/bookings/"]').first().click();
  await page.getByRole('link', { name: 'Quay lại', exact: true }).click();
  await expect(page).toHaveURL(/\/reception\/bookings\?status=PENDING$/);
  await expect(page.getByRole('button',{name:/Chờ nhận phòng/}).first()).toHaveClass(/bg-white/);
  await expect(table).toBeVisible();
});

test('invalid check-in is a real PostgreSQL 409 with actionable room/date conditions', async ({ page, request }) => {
  const b = await createBooking(request, 0, '2043-01-01'), staff = await headers(request); expect((await request.patch(`${api}/bookings/${b.id}/confirm`, { headers: staff })).status()).toBe(200);
  await login(page,'reception');await go(page,'/reception/bookings/'+b.id);await expect(page.getByRole('button',{name:'Chưa đến ngày nhận phòng',exact:true})).toBeDisabled();expect((await request.patch(`${api}/bookings/${b.id}/check-in`,{headers:staff})).status()).toBe(409);expect((await (await request.get(api+'/bookings/'+b.id,{headers:staff})).json()).status).toBe('CONFIRMED');

});

test('full front desk stay: confirm, check-in, services, invoice, CASH + BANK_TRANSFER, paid check-out triggers', async ({ page, request }) => {
  const f = fixtures(), b = await createBooking(request, 1), staff = await headers(request), guest = await headers(request, 'guest');
  await login(page, 'reception'); await go(page, '/reception/bookings/' + b.id); expect((await request.patch(`${api}/bookings/${b.id}/confirm`,{headers:staff})).status()).toBe(200);await page.reload(); await expect(page.getByRole('button', { name: 'Nhận phòng', exact: true })).toBeVisible(); await dialogAction(page, 'Nhận phòng'); await expect(page.getByText('Đang lưu trú',{exact:true}).first()).toBeVisible();
  const orderIds: string[] = [];
  for (let i = 0; i < 2; i++) { const r = await request.post(api + '/service-orders', { headers: guest, data: { bookingId: b.id, items: [{ serviceId: f.services[i].id, quantity: 2 }] } }); expect(r.status()).toBe(201); orderIds.push((await r.json()).id); }
  await go(page, `/reception/bookings/${b.id}/billing`); await expect(page.getByRole('button', { name: 'Phát hành hóa đơn', exact: true })).toHaveCount(0); expect((await request.post(`${api}/bookings/${b.id}/invoice`, { headers: staff })).status()).toBe(409);
  await go(page, '/reception/service-orders?status=PENDING'); await expect(page.locator(`a[href="/reception/service-orders/${orderIds[0]}"]`).first()).toBeVisible();
  await page.locator(`a[href="/reception/service-orders/${orderIds[0]}"]`).first().click(); await expect(page.getByRole('columnheader',{name:'Đơn giá',exact:true})).toBeVisible();await expect(page.locator('tbody')).toContainText(fixtures().services[0].name);await expect(page.locator('tbody')).toContainText('45.000,25'); await dialogAction(page, 'Hoàn thành dịch vụ'); expect((await(await request.get(api+'/service-orders/'+orderIds[0],{headers:staff})).json()).status).toBe('COMPLETED');await expect(page.getByText('Ghi vào hóa đơn phòng',{exact:true}).first()).toBeVisible(); await expect(page.getByRole('button', { name: 'Hoàn thành dịch vụ', exact: true })).toHaveCount(0);
  await go(page, '/reception/service-orders/' + orderIds[1]); await dialogAction(page, 'Hủy đơn dịch vụ'); await expect(page.getByText('Đã hủy',{exact:true}).first()).toBeVisible();
  await go(page, `/reception/bookings/${b.id}/billing`); await expect(page.getByText('90.000,50 ₫', { exact: true }).first()).toBeVisible();
  const issued = page.waitForResponse(r => r.url() === `${api}/bookings/${b.id}/invoice` && r.request().method() === 'POST'); await dialogAction(page, 'Phát hành hóa đơn'); const issuedResponse = await issued; expect(issuedResponse.status()).toBe(201); expect(issuedResponse.request().postData()).toBeNull(); const i = await issuedResponse.json(); await page.locator(`a[href="/reception/invoices/${i.id}"]`).click();await expect(page).toHaveURL('/reception/invoices/'+i.id);
  await expect(page.getByRole('button', { name: 'Trả phòng', exact: true })).toHaveCount(0); expect((await request.patch(`${api}/bookings/${b.id}/check-out`, { headers: staff })).status()).toBe(409);
  const over=await request.post(`${api}/invoices/${i.id}/payments`,{headers:{...staff,'Idempotency-Key':randomUUID()},data:{amount:'999999999999.99',method:'CASH'}});expect(over.status()).toBe(409);
  const key=randomUUID(),data={amount:'100000.25',method:'CASH'};const cashResponse=await request.post(`${api}/invoices/${i.id}/payments`,{headers:{...staff,'Idempotency-Key':key},data});expect(cashResponse.status()).toBe(201);const cashResult=await cashResponse.json();expect(cashResult.payment.id).toBe(key);expect(cashResult.payment.amount).toBe('100000.25');
  const replay=await request.post(`${api}/invoices/${i.id}/payments`,{headers:{...staff,'Idempotency-Key':key},data});expect((await replay.json()).replayed).toBe(true);
  const transfer=await request.post(`${api}/invoices/${i.id}/payments`,{headers:{...staff,'Idempotency-Key':randomUUID()},data:{amount:cashResult.invoice.balance,method:'BANK_TRANSFER'}});expect(transfer.status()).toBe(201);const paid=await transfer.json();expect(paid.invoice.balance).toBe('0.00');expect(paid.invoice.status).toBe('PAID');expect(paid.payment.method).toBe('BANK_TRANSFER');await page.reload();
  const fresh=await (await request.get(`${api}/invoices/${i.id}`,{headers:staff})).json();expect(fresh.payments).toHaveLength(2);expect(fresh.payments.map((p:{method:string})=>p.method).sort()).toEqual(['BANK_TRANSFER','CASH']);expect(await page.evaluate(()=>sessionStorage.length)).toBe(0);
  await page.getByRole('heading', { level: 1 }).click(); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '../.local/phase8c-invoice-desktop.png', fullPage: true });
  await assertFits(page);
  await page.screenshot({ path: '../.local/phase8c-invoice-mobile.png', fullPage: true });
  let languageWrites=0;page.on('request',r=>{if(r.url()===`${api}/invoices/${i.id}/payments`&&r.method()==='POST')languageWrites++;});await page.locator('.language-switcher:visible').first().getByRole('button',{name:'English',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.getByText('Bank transfer',{exact:true}).first()).toBeVisible();await assertFits(page);await page.screenshot({path:'../.local/acceptance-invoice-en-mobile.png'});expect(languageWrites).toBe(0);
  const unchanged=await(await request.get(`${api}/invoices/${i.id}`,{headers:staff})).json();for(const key of ['totalAmount','roomAmount','serviceAmount','paidAmount','balance'])expect(unchanged[key]).toBe(fresh[key]);expect(unchanged.payments.map((p:{id:string})=>p.id)).toEqual(fresh.payments.map((p:{id:string})=>p.id));await page.locator('.language-switcher:visible').first().getByRole('button',{name:'Tiếng Việt',exact:true}).click();

  const checkout = page.waitForResponse(r => r.url() === `${api}/bookings/${b.id}/check-out` && r.request().method() === 'PATCH'); await dialogAction(page, 'Trả phòng'); const checked = await checkout; expect(checked.status()).toBe(200); const result = await checked.json(); expect(result.booking.status).toBe('CHECKED_OUT'); expect(result.room.housekeepingStatus).toBe('DIRTY'); expect(result.housekeepingTask.status).toBe('TODO');
  await expect(page.getByRole('status').filter({hasText:'Đã hoàn tất trả phòng'})).toBeVisible(); const room = await (await request.get(api + '/rooms/' + f.deskRooms[1].id)).json(); expect(room.housekeepingStatus).toBe('DIRTY');
});

test('offline payment keeps UUID across reload and retries same payload; server replay creates no duplicate', async ({ page, request, context }) => {
  const i = await invoiceFixture(request, 2); await login(page, 'reception'); await go(page, '/reception/invoices/' + i.id); await paymentReview(page,i.balance);
  await context.setOffline(true); await page.getByRole('button',{name:'Thanh toán đủ & trả phòng',exact:true}).click(); await expect(page.getByRole('heading', { name: 'Khoản thu chờ kiểm tra' })).toBeVisible();
  const stored = await page.evaluate(userId => JSON.parse(sessionStorage.getItem('an-nhien:pending-receipt:' + userId)!), fixtures().users.reception.id); expect(stored.invoiceId).toBe(i.id); await expect(page.getByRole('button', { name: 'Gửi lại cùng khóa' })).toHaveCount(0);
  let switchedWrites=0;page.on('request',r=>{if(r.url()===`${api}/invoices/${i.id}/payments`&&r.method()==='POST')switchedWrites++;});await page.locator('.language-switcher:visible').first().getByRole('button',{name:'English',exact:true}).click();await expect(page.getByRole('heading',{name:'Pending receipt review',exact:true})).toBeVisible();expect(await page.evaluate(userId=>JSON.parse(sessionStorage.getItem('an-nhien:pending-receipt:'+userId)!).key,fixtures().users.reception.id)).toBe(stored.key);expect(switchedWrites).toBe(0);await page.locator('.language-switcher:visible').first().getByRole('button',{name:'Tiếng Việt',exact:true}).click();
  await context.setOffline(false); await page.reload();await expect(page).toHaveURL('/reception/invoices/'+i.id);
  await expect(page.getByRole('heading', { name: 'Khoản thu chờ kiểm tra' })).toBeVisible(); await page.getByRole('button', { name: 'Kiểm tra lại hóa đơn' }).click(); await expect(page.getByRole('button', { name: 'Gửi lại cùng khóa' })).toBeVisible();
  const retry = page.waitForResponse(r => r.url() === `${api}/invoices/${i.id}/payments` && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Gửi lại cùng khóa' }).click(); const r = await retry; expect(r.status()).toBe(201); expect(r.request().headers()['idempotency-key']).toBe(stored.key); expect(r.request().postDataJSON()).toEqual({amount:stored.amount,method:stored.method,checkout:true});
  const staff = await headers(request), replay = await request.post(`${api}/invoices/${i.id}/payments`, { headers: { ...staff, 'Idempotency-Key': stored.key }, data: { amount: stored.amount, method: stored.method } }); expect(replay.status()).toBe(201); expect((await replay.json()).replayed).toBe(true);
  const fresh = await (await request.get(api + '/invoices/' + i.id, { headers: staff })).json(); expect(fresh.payments.filter((p: { id: string }) => p.id === stored.key)).toHaveLength(1); await expect(page.getByRole('heading',{name:'Khoản thu chờ kiểm tra'})).toHaveCount(0);await expect(page.getByText('Đã thanh toán',{exact:true}).first()).toBeVisible();
});

test('lost response after real committed payment is reconciled from invoice without another POST', async ({ page, request, context }) => {
  const i = await invoiceFixture(request, 3); await login(page, 'reception'); await go(page, '/reception/invoices/' + i.id); await paymentReview(page,i.balance);
  const session = await context.newCDPSession(page); await session.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/invoices/*/payments', requestStage: 'Response' }] });
  const dropped = new Promise<void>(resolve => { session.on('Fetch.requestPaused', async event => { if (event.request.method !== 'POST') { await session.send('Fetch.continueResponse', { requestId: event.requestId }); return; } expect(event.responseStatusCode).toBe(201); await session.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'TimedOut' }); await session.send('Fetch.disable'); resolve(); }); });
  let writes = 0; page.on('request', r => { if (r.url() === `${api}/invoices/${i.id}/payments` && r.method() === 'POST') writes++; });
  await page.getByRole('button',{name:'Thanh toán đủ & trả phòng',exact:true}).click(); await dropped; await expect(page.getByRole('heading', { name: 'Khoản thu chờ kiểm tra' })).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm tra lại hóa đơn' }).click(); await expect(page.getByRole('heading',{name:'Khoản thu chờ kiểm tra'})).toHaveCount(0);await expect(page.getByText('Đã thanh toán',{exact:true}).first()).toBeVisible(); expect(writes).toBe(1);
  const fresh=await (await request.get(`${api}/invoices/${i.id}`,{headers:await headers(request)})).json();expect(fresh.payments).toHaveLength(1); expect(await page.evaluate(() => sessionStorage.length)).toBe(0); await session.detach();
});

for (const role of ['guest', 'housekeeping']) test(`${role} cannot enter Front Desk or call staff APIs`, async ({ page, request }) => {
  await login(page, role); await go(page, '/reception'); await expect(page.getByText('403 · QUYỀN TRUY CẬP')).toBeVisible(); const h = await headers(request, role); expect((await request.get(api + '/bookings', { headers: h })).status()).toBe(403); expect((await request.get(api + '/service-orders', { headers: h })).status()).toBe(403);
});

test('admin has the same supported desk actions, 404 and responsive dashboard', async ({ page, request }) => {
  await login(page, 'admin'); await expect(page.getByRole('heading', { level: 1 })).toContainText('Tổng quan lễ tân'); await go(page, '/reception'); await expect(page.getByText('403 · QUYỀN TRUY CẬP')).toHaveCount(0);
  const b = await createBooking(request, 4, '2044-01-01'); await go(page, '/reception/bookings/' + b.id); expect((await request.patch(`${api}/bookings/${b.id}/confirm`,{headers:await headers(request,'admin')})).status()).toBe(200);await page.reload();await expect(page.getByRole('button',{name:'Chưa đến ngày nhận phòng',exact:true})).toBeDisabled();
  await go(page, '/reception/bookings/' + randomUUID()); await expect(page.locator('.state-panel[role="alert"]')).toContainText('Không tìm thấy'); await go(page, '/reception');
  await assertFits(page); await page.screenshot({ path: '../.local/phase8c-dashboard-mobile.png', fullPage: true });
});

test('concurrent service completion, invoice finalization and new pending order prevent stale staff mutations', async ({ page, request }) => {
  const b = await checkedIn(request, 5), staff = await headers(request), guest = await headers(request, 'guest');
  const create = async () => { const r = await request.post(api + '/service-orders', { headers: guest, data: { bookingId: b.id, items: [{ serviceId: fixtures().services[0].id, quantity: 1 }] } }); expect(r.status()).toBe(201); return r.json(); };
  const order = await create(); await login(page, 'reception'); await go(page, '/reception/service-orders/' + order.id);
  await page.getByRole('button', { name: 'Hủy đơn', exact: true }).click(); expect((await request.patch(`${api}/service-orders/${order.id}/complete`, { headers: staff })).status()).toBe(200);expect((await request.post(`${api}/bookings/${b.id}/invoice`,{headers:staff})).status()).toBe(201);
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận hủy', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Trạng thái vừa thay đổi' }).first()).toBeVisible(); await page.keyboard.press('Escape');
  const next=await staffBooking(request,fixtures().housekeeping.rooms[18].id);for(const action of ['confirm','check-in'])expect((await request.patch(`${api}/bookings/${next.id}/${action}`,{headers:staff})).status()).toBe(200);
  await go(page,`/reception/bookings/${next.id}/billing`);await page.getByRole('button',{name:'Phát hành hóa đơn',exact:true}).click();const pending=await request.post(api+'/service-orders',{headers:guest,data:{bookingId:next.id,items:[{serviceId:fixtures().services[0].id,quantity:1}]}});expect(pending.status()).toBe(201);
  await page.getByRole('dialog').getByRole('button',{name:'Xác nhận phát hành hóa đơn',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Chưa thể phát hành'}).first()).toBeVisible();expect((await request.get(`${api}/bookings/${next.id}/invoice`,{headers:staff})).status()).toBe(404);

});

test('staff loading, empty results, offline recovery and responsive lists', async ({ page, context,request }) => {
  const own=await checkedIn(request,0),h=await headers(request);const order=await request.post(api+'/service-orders',{headers:await headers(request,'guest'),data:{bookingId:own.id,items:[{serviceId:fixtures().services[0].id,quantity:1}]}});expect(order.status()).toBe(201);expect((await request.patch(api+'/service-orders/'+(await order.json()).id+'/complete',{headers:h})).status()).toBe(200);
  await login(page, 'reception'); await go(page, '/reception/bookings?page=1000000'); await expect(page.getByRole('heading', { name: 'Chưa có booking phù hợp' })).toBeVisible();
  await context.setOffline(true); await go(page, '/reception/bookings?status=CONFIRMED'); await expect(page.locator('.state-panel[role="alert"]')).toContainText('Chưa thể kết nối'); await context.setOffline(false); await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await expect(page.getByRole('table', { name: 'Danh sách booking', exact: true })).toBeVisible();
  const session = await context.newCDPSession(page); await session.send('Network.enable'); await session.send('Network.emulateNetworkConditions', { offline: false, latency: 700, downloadThroughput: -1, uploadThroughput: -1 });
  await go(page, '/reception/service-orders?status=COMPLETED'); await expect(page.locator('.guest-skeleton')).toBeVisible(); await expect(page.getByRole('table', { name: 'Danh sách đơn dịch vụ', exact: true })).toBeVisible(); await session.detach();
  await assertFits(page);
});

test('authenticated staff 401 clears JWT session and returns to login', async ({ page }) => {
  await login(page, 'deskExpired'); await disableIsolatedFixture('deskExpired');
  // A dashboard request may already expire the session before a profile link can be clicked.
  await page.evaluate(() => { history.pushState({}, '', '/reception/profile'); window.dispatchEvent(new PopStateEvent('popstate')); }); await expect(page).toHaveURL(/\/login$/); await expect(page.locator('.notice')).toContainText('Phiên đăng nhập đã hết hạn');
});
