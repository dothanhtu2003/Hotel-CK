import { test, expect, type Page } from '@playwright/test';
import { fixtures, login, authHeaders, apiBase } from './fixtures';
import { randomUUID } from 'node:crypto';

const evidence = '../docs/i18n/qa-screenshots/fixes';
async function language(page: Page, lang: 'vi' | 'en') {
  await page.locator('.language-switcher:visible').first().getByRole('button', { name: lang === 'en' ? 'English' : 'Tiếng Việt', exact: true }).click();
}
async function capture(page: Page, name: string) {
  await page.screenshot({ path: `${evidence}/${name}.png`, animations: 'disabled' });
}
async function within(page: Page, selector: string) {
  const boxes = await page.locator(selector).evaluateAll(es => es.map(e => ({ text: e.textContent, rect: e.getBoundingClientRect().toJSON(), scroll: e.scrollWidth, client: e.clientWidth })));
  for (const b of boxes) { expect(b.rect.right, JSON.stringify(b)).toBeLessThanOrEqual(321); expect(b.scroll, JSON.stringify(b)).toBeLessThanOrEqual(b.client + 1); }
}

for (const lang of ['vi', 'en'] as const) {
  test(`QA fixes: ${lang} housekeeping menu and status`, async ({ page }) => {
    await login(page, 'housekeeping'); await language(page, lang);
    await page.setViewportSize({ width: 320, height: 950 });
    await page.goto('/housekeeping/profile');
    await page.getByRole('button', { name: lang === 'en' ? 'Open account menu' : 'Mở menu tài khoản', exact: true }).click();
    const nav = page.getByRole('dialog').locator('nav');
    await expect(nav.getByRole('link')).toHaveCount(4);
    const rect = await nav.boundingBox(); expect(rect).not.toBeNull();
    for (const link of await nav.getByRole('link').all()) { const b = await link.boundingBox(); expect(b!.x + b!.width).toBeLessThanOrEqual(302); }
    await capture(page, `004-menu-${lang}-320`);
    await nav.locator('a[href="/housekeeping/tasks"]').focus(); await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/housekeeping\/tasks$/);
    await page.goto('/housekeeping/tasks/' + fixtures().housekeeping.tasks[0].id);
    await expect(page.locator('.hk-task-status')).toBeVisible();
    const label = page.locator('.hk-task-status > span').first();
    expect((await label.boundingBox())!.height).toBeLessThan(35);
    await capture(page, `009-status-${lang}-320`);
  });

  test(`QA fixes: ${lang} guest amounts, cart and payment guidance`, async ({ page, request }) => {
    await login(page); await language(page, lang);
    const h = await authHeaders(request, 'guest');
    const bookings = await (await request.get(apiBase + '/bookings/my', { headers: h })).json();
    await page.setViewportSize({ width: 320, height: 950 });
    await page.route('**/api/bookings/my**', r => r.fulfill({ json: { ...bookings, data: [{ ...bookings.data[0], status: 'CHECKED_IN' }] } }));
    await page.goto('/guest/services');
    await page.getByLabel((lang === 'en' ? 'Quantity for ' : 'Số lượng ') + fixtures().services[0].name, { exact: true }).fill('2');
    await expect(page.locator('.guest-cart-summary-card')).toBeVisible();
    await within(page, '.guest-cart-summary-card, .guest-cart-summary-card button');
    const stat = page.locator('.cart-summary-stat span');
    expect((await stat.boundingBox())!.height).toBeLessThan(65);
    expect((await page.locator('.cart-summary-action button').boundingBox())!.y + (await page.locator('.cart-summary-action button').boundingBox())!.height).toBeLessThanOrEqual(885);
    await capture(page, `002-cart-${lang}-320`);
    await page.goto(`/guest/bookings/${bookings.data[0].id}/billing`);
    await expect(page.locator('.guest-facts dd').first()).toBeVisible();
    await within(page, '.guest-facts dd');
    await capture(page, `003-billing-${lang}-320`);
    await page.goto('/'); await page.waitForLoadState('networkidle');
    await within(page, '.showcase-price-box');
    await page.locator('.showcase-price-box').first().scrollIntoViewIfNeeded();
    await capture(page, `003-room-price-${lang}-320`);
    const faq = page.getByRole('button', { name: lang === 'en' ? 'Do I need to pay when booking online?' : /Tôi có cần thanh toán tiền ngay/ });
    await faq.click(); await faq.scrollIntoViewIfNeeded();
    await expect(page.locator('.faq-answer-body')).toContainText('payOS');
    await expect(page.locator('.faq-answer-body')).not.toContainText(lang === 'en' ? 'card' : 'thẻ');
    await capture(page, `007-faq-${lang}-320`);
  });

  test(`QA fixes: ${lang} revenue, long room name, timeline and palette`, async ({ page, request }) => {
    await login(page, 'reception'); await language(page, lang);
    await page.goto('/reception'); await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('combobox')).toBeFocused();
    expect(await dialog.evaluate(e => e.parentElement === document.body && getComputedStyle(e).opacity === '1')).toBe(true);
    const unobscured = await dialog.locator('[role="option"]').first().evaluate(e => { const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)); });
    expect(unobscured).toBe(true); await capture(page, `012-palette-${lang}-1440`);
    await page.keyboard.press('ArrowDown'); await expect(dialog.locator('[aria-selected="true"]')).toHaveCount(1);
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    await page.goto('/reception/tape-chart'); await expect(page.locator('body')).toContainText(lang === 'en' ? 'HK:' : 'VS:');
    await capture(page, `006-timeline-${lang}-1440`);
    await page.route('**/api/revenue?**', route => route.fulfill({ json: { pending: 0, previousTotal: '0.00', transactions: [] } }));
    await page.goto('/reception/revenue'); await expect(page.locator('.revenue-card').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('false');
    await page.getByRole('button',{name:lang === 'en' ? 'Cash' : 'Tiền mặt',exact:true}).click();
    await expect(page.locator('body')).not.toContainText('false');
    await capture(page, `001-revenue-${lang}-1440`);
    await page.unroute('**/api/revenue?**');
    await page.setViewportSize({ width: 320, height: 950 });
    await page.goto('/reception/revenue'); await expect(page.locator('.revenue-kpis').first()).toBeVisible();
    await within(page, '.revenue-kpis strong'); await capture(page, `003-revenue-${lang}-320`);
    const h=await authHeaders(request,'guest');const bs=await(await request.get(apiBase+'/bookings/my',{headers:h})).json();
    await page.goto(`/reception/bookings/${bs.data[0].id}/billing`);
    await expect(page.locator('.billing-room-hero-num')).toBeVisible();
    await within(page, '.billing-room-hero-num'); await capture(page, `010-room-badge-${lang}-320`);
    await page.goto('/reception?mode=booking'); await page.getByRole('button',{name:new RegExp('^'+fixtures().releaseRoom.roomNumber)}).click();
    await expect(page.getByRole('dialog')).toBeVisible();await within(page,'.drawer-room-hero');
    await capture(page, `010-booking-modal-${lang}-320`);
  });

  test(`QA fixes: ${lang} invoice and service print`, async ({ page, browser }) => {
    await login(page, 'admin'); await language(page, lang);
    const id=randomUUID(),bid=randomUUID(),oid=randomUUID();
    const booking={id:bid,reference:'QA-PRINT',roomId:fixtures().room.id,roomNumber:'101-LONG-ROOM',checkIn:'2041-01-01',checkOut:'2041-01-03',nights:2,guestCount:2,status:'CHECKED_OUT',nightlyPrice:'650000.25',totalRoomAmount:'1300000.50'};
    const invoice={id,bookingId:bid,booking,roomAmount:'1300000.50',serviceAmount:'0.00',totalAmount:'1300000.50',paidAmount:'1300000.50',balance:'0.00',status:'PAID',issuedAt:'2026-11-18T01:00:00Z',payments:[{id:'QA-RECEIPT',amount:'1300000.50',method:'CASH',status:'COMPLETED',paidAt:'2026-11-18T01:00:00Z'}]};
    await page.route('**/api/invoices/'+id,r=>r.fulfill({json:invoice}));
    await page.route('**/api/bookings/'+bid+'/billing-preview',r=>r.fulfill({json:{booking,completedOrders:[],roomAmount:invoice.roomAmount,serviceAmount:'0.00',totalAmount:invoice.totalAmount,pendingOrderCount:0}}));
    await page.route('**/api/front-desk/bookings/'+bid,r=>r.fulfill({json:{...booking,customer:{fullName:'QA Print Guest',email:null,phone:null}}}));
    await page.goto('/admin/invoices/'+id);await expect(page.locator('.print-document')).toBeVisible();
    await page.emulateMedia({media:'print'});
    await expect(page.locator('.workspace-sidebar')).toBeHidden();await expect(page.locator('.print-document button')).toBeHidden();
    await expect(page.locator('.print-document')).toContainText('QA Print Guest');
    await capture(page,`008-admin-print-${lang}-1440`);await page.emulateMedia({media:'screen'});
    const order={id:oid,bookingId:bid,status:'COMPLETED',totalAmount:'90000.50',orderedAt:'2026-11-18T01:00:00Z',deliveredAt:'2026-11-18T01:00:00Z',paymentMethod:'CASH',paidAt:'2026-11-18T01:00:00Z',items:[{id:'item',serviceId:fixtures().services[0].id,serviceName:'Cà phê',quantity:2,unitPrice:'45000.25',subtotal:'90000.50'}]};
    await page.route('**/api/service-orders/'+oid,r=>r.fulfill({json:order}));
    await page.goto('/admin/service-orders/'+oid);await expect(page.locator('.print-document')).toBeVisible();await page.emulateMedia({media:'print'});
    await expect(page.locator('.workspace-sidebar')).toBeHidden();await expect(page.locator('.service-order-no-print').first()).toBeHidden();
    await capture(page,`008-ticket-print-${lang}-1440`);
    const guestContext = await browser.newContext({ viewport: { width:1440,height:950 } });
    const guestPage = await guestContext.newPage(); await login(guestPage); await language(guestPage,lang);
    await guestPage.route('**/api/invoices/'+id,r=>r.fulfill({json:invoice}));
    await guestPage.goto('/guest/invoices/'+id); await expect(guestPage.locator('.print-document')).toBeVisible();
    await guestPage.emulateMedia({media:'print'}); await expect(guestPage.locator('.guest-portal-header')).toBeHidden();
    await expect(guestPage.locator('.print-document button')).toBeHidden();
    await expect(guestPage.locator('.print-document')).toContainText(lang==='en'?'1,300,000.50':'1.300.000,50');
    await capture(guestPage,`008-guest-print-${lang}-1440`); await guestContext.close();
  });
}
