import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fixtures, login } from './fixtures';

const api = 'http://127.0.0.1:3301/api';
async function go(page: Page, path: string) {
  await page.evaluate(p => new Promise<void>(resolve => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }), path);
}
async function action(page: Page, label: string, path: string, method = 'PATCH') {
  await page.getByRole('button', { name: label, exact: true }).click();
  const wait = page.waitForResponse(r => r.url() === api + path && r.request().method() === method);
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận ' + label.toLocaleLowerCase('vi-VN'), exact: true }).click();
  const response = await wait; expect(response.status()).toBe(method === 'POST' ? 201 : 200); return response.json();
}

test('Phase 9 continuous 18-step UI workflow with real REST/PostgreSQL and stored XSS text', async ({ page: guest, browser }) => {
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
    await guest.getByLabel('Mật khẩu', { exact: true }).fill(f.password); await guest.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await expect(guest).toHaveURL('/guest'); steps.push('02 login');
    await go(guest, '/guest/profile'); await expect(guest.locator('.profile-summary h2')).toHaveText('Release ' + xss);
    expect(await guest.evaluate(() => Reflect.get(window, '__phase9Xss'))).toBeUndefined(); await expect(guest.locator('img[src="x"]')).toHaveCount(0);
    await go(guest, '/'); await guest.getByLabel('NGÀY NHẬN PHÒNG').fill(today); await guest.getByLabel('NGÀY TRẢ PHÒNG').fill(out); await guest.getByRole('button', { name: 'Tìm phòng', exact: true }).click();
    await guest.getByLabel('Loại phòng').selectOption(f.releaseType.id); await guest.getByRole('button', { name: 'Tìm phòng', exact: true }).click(); await expect(guest.locator('.guest-room')).toHaveCount(1); steps.push('03 availability');
    await guest.getByRole('link', { name: 'Xem phòng ' + f.releaseRoom.roomNumber, exact: true }).click(); await expect(guest.getByRole('button', { name: 'Đặt phòng này', exact: true })).toBeVisible(); steps.push('04 room detail');
    await guest.getByRole('button', { name: 'Đặt phòng này', exact: true }).click(); const created = guest.waitForResponse(r => r.url() === api + '/bookings' && r.request().method() === 'POST'); await guest.getByRole('button', { name: 'Xác nhận đặt phòng', exact: true }).click(); const bResponse = await created; expect(bResponse.status()).toBe(201); const b = await bResponse.json(); expect(b.totalRoomAmount).toBe('1950000.75'); steps.push('05 multi-night booking');
    await login(staff, 'reception'); await go(staff, '/reception/bookings/' + b.id); await expect(staff.locator('.desk-page dd').filter({ hasText: b.id })).toBeVisible();
    await action(staff, 'Xác nhận booking', `/bookings/${b.id}/confirm`); steps.push('06 confirm'); await expect(staff.getByRole('button', { name: 'Nhận phòng', exact: true })).toBeVisible();
    await action(staff, 'Nhận phòng', `/bookings/${b.id}/check-in`); steps.push('07 check-in');
    await go(guest, '/guest/services?bookingId=' + b.id); await guest.getByLabel('Số lượng ' + f.services[0].name, { exact: true }).fill('2'); await guest.getByRole('button', { name: 'Xem lại đơn dịch vụ', exact: true }).click();
    const ordered = guest.waitForResponse(r => r.url() === api + '/service-orders' && r.request().method() === 'POST'); await guest.getByRole('button', { name: 'Xác nhận đặt dịch vụ', exact: true }).click(); const orderResponse = await ordered; expect(orderResponse.status()).toBe(201); const order = await orderResponse.json(); steps.push('08 guest services');
    await go(staff, '/reception/service-orders/' + order.id); await expect(staff.getByText('Mã đơn: ' + order.id, { exact: true })).toBeVisible(); await action(staff, 'Hoàn thành dịch vụ', `/service-orders/${order.id}/complete`); steps.push('09 complete service');
    await go(staff, `/reception/bookings/${b.id}/billing`); await expect(staff.getByRole('heading', { name: 'Chi phí & phát hành hóa đơn', exact: true })).toBeVisible(); await expect(staff.getByText('90.000,50 ₫', { exact: true }).first()).toBeVisible(); steps.push('10 billing preview');
    const invoice = await action(staff, 'Phát hành hóa đơn', `/bookings/${b.id}/invoice`, 'POST'); expect(invoice.totalAmount).toBe('2040001.25'); await expect(staff).toHaveURL('/reception/invoices/' + invoice.id); steps.push('11 invoice');
    await staff.getByLabel('Số tiền (VND)', { exact: true }).fill(invoice.totalAmount); await staff.getByLabel('Phương thức', { exact: true }).selectOption('CASH'); await staff.getByRole('checkbox').check(); await staff.getByRole('button', { name: 'Xem lại khoản thu', exact: true }).click();
    const paid = staff.waitForResponse(r => r.url() === `${api}/invoices/${invoice.id}/payments` && r.request().method() === 'POST'); await staff.getByRole('button', { name: 'Xác nhận ghi nhận khoản thu', exact: true }).click(); const paymentResponse = await paid; expect(paymentResponse.status()).toBe(201); const payment = await paymentResponse.json(); expect(payment.invoice.balance).toBe('0.00'); expect(payment.invoice.status).toBe('PAID'); steps.push('12 payment');
    await expect(staff.getByRole('button', { name: 'Trả phòng', exact: true })).toBeVisible(); const checkout = await action(staff, 'Trả phòng', `/bookings/${b.id}/check-out`); expect(checkout.booking.status).toBe('CHECKED_OUT'); steps.push('13 checkout'); expect(checkout.room.housekeepingStatus).toBe('DIRTY'); steps.push('14 DIRTY');
    const taskId = checkout.housekeepingTask.id; await go(staff, '/reception/housekeeping/tasks/' + taskId); await expect(staff.locator('.hk-page dd').filter({ hasText: taskId })).toBeVisible(); await staff.getByLabel('UUID nhân viên HOUSEKEEPING', { exact: true }).fill(f.users.housekeeping.id); await staff.getByRole('button', { name: 'Xem lại phân công', exact: true }).click();
    const assigned = staff.waitForResponse(r => r.url() === `${api}/housekeeping/tasks/${taskId}/assign` && r.request().method() === 'PATCH'); await staff.getByRole('dialog').getByRole('button', { name: 'Xác nhận phân công', exact: true }).click(); expect((await assigned).status()).toBe(200);
    await login(worker, 'housekeeping'); await go(worker, '/housekeeping/tasks/' + taskId); await expect(worker.locator('.hk-page dd').filter({ hasText: taskId })).toBeVisible(); steps.push('15 assigned worker');
    await worker.getByRole('button', { name: 'Bắt đầu dọn phòng', exact: true }).click(); const start = worker.waitForResponse(r => r.url() === `${api}/housekeeping/tasks/${taskId}/start` && r.request().method() === 'PATCH'); await worker.getByRole('dialog').getByRole('button', { name: 'Xác nhận bắt đầu dọn', exact: true }).click(); expect((await (await start).json()).room.housekeepingStatus).toBe('CLEANING'); steps.push('16 start');
    await worker.getByRole('button', { name: 'Hoàn thành dọn phòng', exact: true }).click(); const complete = worker.waitForResponse(r => r.url() === `${api}/housekeeping/tasks/${taskId}/complete` && r.request().method() === 'PATCH'); await worker.getByRole('dialog').getByRole('button', { name: 'Xác nhận hoàn thành dọn', exact: true }).click(); const done = await (await complete).json(); expect(done.status).toBe('DONE'); expect(done.completedAt).toBeTruthy(); steps.push('17 complete'); expect(done.room.housekeepingStatus).toBe('CLEAN'); steps.push('18 CLEAN');
    await go(staff, '/reception/housekeeping?roomId=' + f.releaseRoom.id); await expect(staff.locator('.hk-room')).toHaveCount(1); await expect(staff.locator('.hk-room')).toContainText('Phòng sạch');
    await go(guest, '/guest/bookings/' + b.id + '/billing'); await expect(guest.locator('.status-badge').filter({ hasText: 'Đã thanh toán' })).toBeVisible();
    for (const width of [320, 390, 768, 1440]) { await guest.setViewportSize({ width, height: 950 }); expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
    expect(errors).toEqual([]); expect(steps).toHaveLength(18);
    await worker.screenshot({ path: '../.local/phase9-workflow-clean.png', fullPage: true });
    writeFileSync('../.local/phase9-workflow.json', JSON.stringify({ steps, bookingId: b.id, orderId: order.id, invoiceId: invoice.id, paymentId: payment.payment.id, taskId, roomId: f.releaseRoom.id, invoiceTotal: invoice.totalAmount, roomFinalStatus: 'CLEAN', storedXssExecuted: false, pageErrors: errors, realTransport: true }, null, 2));
  } finally { await receptionContext.close(); await workerContext.close(); }
});
