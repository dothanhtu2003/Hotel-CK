import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fixtures, login, authHeaders, payOnlineBooking } from './fixtures';

const api = 'http://127.0.0.1:3301/api';
async function go(page: Page, path: string) {
  await page.evaluate(p => new Promise<void>(resolve => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }), path);
}
async function action(page:Page,label:string,path:string,method='PATCH'){
 const wait=page.waitForResponse(r=>r.url()===api+path&&r.request().method()===method);await page.getByRole('button',{name:label,exact:true}).click();if(label!=='Nhận phòng'&&label!=='Nhận tiền và hoàn tất')await page.getByRole('dialog').getByRole('button').last().click();const r=await wait;expect(r.status()).toBe(method==='POST'?201:200);return r.json();
}
test('Phase 9 continuous 18-step UI workflow with real REST/PostgreSQL and stored XSS text', async ({ page: guest, browser, request }) => {
  test.setTimeout(120000);
  const f = fixtures(), steps: string[] = [], receptionContext = await browser.newContext(), workerContext = await browser.newContext();
  const staff = await receptionContext.newPage(), worker = await workerContext.newPage();
  const errors: string[] = []; for (const p of [guest, staff, worker]) p.on('pageerror', e => errors.push(e.message));
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const out = new Date(Date.parse(today + 'T00:00:00Z') + 3 * 86400000).toISOString().slice(0, 10);
    // Registration and login are both UI operations, in a new guest session.
    await guest.goto('/register');
    const email = `${randomUUID()}@frontend-test.invalid`, xss = '<img src=x onerror="window.__phase9Xss=true">';
    await guest.getByLabel('Họ và tên', { exact: true }).fill('Release ' + xss);
    await guest.getByLabel('Địa chỉ email', { exact: true }).fill(email);
    await guest.getByLabel('Mật khẩu', { exact: true }).fill(f.password);
    await guest.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(f.password);
    await guest.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click(); await expect(guest).toHaveURL(/\/login$/); steps.push('01 registration');
    await guest.getByLabel('Mật khẩu', { exact: true }).fill(f.password); await guest.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await expect(guest).toHaveURL('/'); steps.push('02 login');
    await go(guest, '/guest/profile'); await expect(guest.locator('.profile-summary h2')).toHaveText('Release ' + xss);
    expect(await guest.evaluate(() => Reflect.get(window, '__phase9Xss'))).toBeUndefined(); await expect(guest.locator('img[src="x"]')).toHaveCount(0);
    await go(guest, '/'); await guest.getByLabel('NGÀY NHẬN PHÒNG').fill(today); await guest.getByLabel('NGÀY TRẢ PHÒNG').fill(out); await guest.getByRole('button', { name: 'Tìm phòng', exact: true }).click();
    await guest.getByRole('tablist').getByRole('button',{name:new RegExp('^'+f.releaseType.name)}).click();await expect(guest.locator('.ready-room-card')).toHaveCount(1); steps.push('03 availability');
    await guest.getByRole('link', { name: 'Đặt phòng', exact: true }).click(); await expect(guest.getByRole('button', { name: 'Đặt phòng ngay', exact: true })).toBeVisible(); steps.push('04 room detail');
    await guest.route('https://pay.payos.vn/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Simulated payOS checkout</h1>'}));const saved=await guest.evaluate(()=>JSON.parse(localStorage.getItem('an-nhien.auth-session')!));await guest.getByRole('button', { name: 'Đặt phòng ngay', exact: true }).click(); const created = guest.waitForResponse(r => r.url() === api + '/bookings' && r.request().method() === 'POST'); await guest.getByRole('button', { name: 'Đặt phòng & thanh toán', exact: true }).click(); const bResponse = await created; expect(bResponse.status()).toBe(201); const b = await bResponse.json(); expect(b.totalRoomAmount).toBe('1950000.00'); steps.push('05 multi-night booking');await expect(guest).toHaveURL(/https:\/\/pay.payos.vn/);await guest.goto('/guest/bookings/'+b.id);
    await login(staff, 'reception'); await go(staff, '/reception/bookings/' + b.id); await expect(staff.locator(`.desk-page[data-booking-id="${b.id}"]`)).toBeVisible();
    await staff.screenshot({ path: '../.local/kamra-reservation-desktop.png', fullPage: true });
    const h=await authHeaders(request);expect((await request.patch(api+`/bookings/${b.id}/confirm`,{headers:h})).status()).toBe(409);expect((await request.patch(api+`/bookings/${b.id}/check-in`,{headers:h})).status()).toBe(409);
    await staff.getByRole('button',{name:/Mở.*QR.*thanh toán/}).click();const qrBefore=staff.getByRole('img',{name:'Mã VietQR thanh toán tiền phòng qua payOS',exact:true});await expect(qrBefore).toBeVisible();const originalQr=await qrBefore.getAttribute('src');let languageCreates=0;staff.on('request',r=>{if(r.url().endsWith('/payos/qr')&&r.method()==='POST')languageCreates++;});
    // The header is native-dialog-inert. Invoke the same language controller as its buttons while preserving the open modal.
    await staff.evaluate(async()=>{const {changeLanguage}=await import(String('/src/i18n/index.ts'));await changeLanguage('en');});await expect(staff.getByRole('img',{name:'VietQR code for room payment through payOS',exact:true})).toHaveAttribute('src',originalQr!);await expect(staff.getByText('0123456789',{exact:true})).toBeVisible();await expect(staff.getByText('E2E HOTEL',{exact:true})).toBeVisible();expect(languageCreates).toBe(0);await staff.evaluate(async()=>{const {changeLanguage}=await import(String('/src/i18n/index.ts'));await changeLanguage('vi');});await expect(qrBefore).toHaveAttribute('src',originalQr!);expect(languageCreates).toBe(0);await staff.getByRole('dialog').getByRole('button',{name:'Đóng hộp thoại',exact:true}).click();

    await payOnlineBooking(request,b.id,{Authorization:'Bearer '+saved.accessToken},b.totalRoomAmount);await staff.reload(); steps.push('06 confirm'); await expect(staff.getByRole('button', { name: 'Nhận phòng', exact: true })).toBeVisible();
    await action(staff, 'Nhận phòng', `/bookings/${b.id}/check-in`); steps.push('07 check-in');
    await go(guest, '/guest/services?bookingId=' + b.id); await guest.getByLabel('Số lượng ' + f.services[0].name, { exact: true }).fill('2'); await guest.getByRole('button', { name: 'Xem lại đơn dịch vụ', exact: true }).click();
    const ordered = guest.waitForResponse(r => r.url() === api + '/service-orders' && r.request().method() === 'POST'); await guest.getByRole('dialog').getByRole('button',{name:/^Đặt dịch vụ/}).click(); const orderResponse = await ordered; expect(orderResponse.status()).toBe(201); const order = await orderResponse.json(); steps.push('08 guest services');
    await go(staff, '/reception/service-orders/' + order.id); await expect(staff.getByRole('heading',{name:'Đơn dịch vụ #'+order.id.slice(0,8),exact:true})).toBeVisible(); const delivered=await action(staff,'Nhận tiền và hoàn tất',`/service-orders/${order.id}/collect-and-deliver`);expect(delivered.paymentMethod).toBe('CASH');expect(delivered.totalAmount).toBe('90000.50'); steps.push('09 complete service');
    await go(staff, `/reception/bookings/${b.id}/billing`); await expect(staff.locator('.billing-header-card')).toBeVisible(); const preview=await(await request.get(api+`/bookings/${b.id}/billing-preview`,{headers:h})).json();expect(preview.serviceAmount).toBe('0.00');expect(preview.paidAmount).toBe('1950000.00'); steps.push('10 billing preview');
    const invoice = await action(staff, 'Phát hành hóa đơn', `/bookings/${b.id}/invoice`, 'POST'); expect(invoice.totalAmount).toBe('1950000.00'); await staff.locator(`a[href="/reception/invoices/${invoice.id}"]`).click();await expect(staff).toHaveURL('/reception/invoices/'+invoice.id); steps.push('11 invoice');
    expect(invoice.balance).toBe('0.00');expect(invoice.status).toBe('PAID');await expect(staff.getByText('Đã thanh toán',{exact:true}).first()).toBeVisible();steps.push('12 room receipt credited without duplicate collection');
    await expect(staff.getByRole('button', { name: 'Xác nhận trả phòng', exact: true })).toBeVisible(); const checkout = await action(staff, 'Xác nhận trả phòng', `/bookings/${b.id}/check-out`); expect(checkout.booking.status).toBe('CHECKED_OUT'); steps.push('13 checkout'); expect(checkout.room.housekeepingStatus).toBe('DIRTY'); steps.push('14 DIRTY');
    const taskId = checkout.housekeepingTask.id; await go(staff, '/reception/housekeeping/tasks/' + taskId); await expect(staff.locator(`[title="${taskId}"]`)).toBeVisible(); await staff.getByLabel('Nhân viên buồng phòng', { exact: true }).selectOption(f.users.housekeeping.id); await staff.getByRole('button', { name: 'Xem lại phân công', exact: true }).click();
    const assigned = staff.waitForResponse(r => r.url() === `${api}/housekeeping/tasks/${taskId}/assign` && r.request().method() === 'PATCH'); await staff.getByRole('dialog').getByRole('button', { name: 'Xác nhận phân công', exact: true }).click(); expect((await assigned).status()).toBe(200);
    await login(worker, 'housekeeping'); await go(worker, '/housekeeping/tasks/' + taskId); await expect(worker.locator(`[title="${taskId}"]`)).toBeVisible(); steps.push('15 assigned worker');
    await worker.getByRole('button', { name: 'Bắt đầu dọn phòng', exact: true }).click(); const start = worker.waitForResponse(r => r.url() === `${api}/housekeeping/tasks/${taskId}/start` && r.request().method() === 'PATCH'); await worker.getByRole('dialog').getByRole('button', { name: 'Xác nhận bắt đầu dọn', exact: true }).click(); expect((await (await start).json()).room.housekeepingStatus).toBe('CLEANING'); steps.push('16 start');
    await worker.getByRole('button', { name: 'Hoàn thành dọn phòng', exact: true }).click(); const complete = worker.waitForResponse(r => r.url() === `${api}/housekeeping/tasks/${taskId}/complete` && r.request().method() === 'PATCH'); await worker.getByRole('dialog').getByRole('button', { name: 'Xác nhận hoàn thành dọn', exact: true }).click(); const done = await (await complete).json(); expect(done.status).toBe('DONE'); expect(done.completedAt).toBeTruthy(); steps.push('17 complete'); expect(done.room.housekeepingStatus).toBe('CLEAN'); steps.push('18 CLEAN');
    await go(staff,'/reception/housekeeping?roomId='+f.releaseRoom.id);await expect(staff.getByRole('heading',{name:'Chưa có phòng phù hợp'})).toBeVisible();expect((await (await request.get(api+'/rooms/'+f.releaseRoom.id)).json()).housekeepingStatus).toBe('CLEAN');
    await go(guest,'/guest/bookings/'+b.id+'/billing');await guest.locator('summary').filter({hasText:'Hóa đơn'}).click();await expect(guest.locator('.status-badge').filter({hasText:'Đã thanh toán'})).toBeVisible();
    for (const width of [320, 390, 768, 1440]) { await guest.setViewportSize({ width, height: 950 }); expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
    expect(errors).toEqual([]); expect(steps).toHaveLength(18);
    await worker.screenshot({ path: '../.local/phase9-workflow-clean.png', fullPage: true });
    writeFileSync('../.local/phase9-workflow.json', JSON.stringify({ steps, bookingId: b.id, orderId: order.id, invoiceId: invoice.id, roomPaymentVerified:true, taskId, roomId: f.releaseRoom.id, invoiceTotal: invoice.totalAmount, roomFinalStatus: 'CLEAN', storedXssExecuted: false, pageErrors: errors, realTransport: true }, null, 2));
  } finally { await receptionContext.close(); await workerContext.close(); }
});
