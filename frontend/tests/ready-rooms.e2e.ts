import { test, expect } from '@playwright/test';

test('compact availability shows individual ready rooms on desktop and mobile', async ({ page }) => {
  const type = { id: 'aa64d5c7-b9f9-4ed1-8d14-716aa480b001', name: 'Deluxe', nightlyPrice: '1200000.00', maxGuests: 2, description: '' };
  const rooms = [
    { id: 'room-101', roomNumber: '101', floor: 1, operationalStatus: 'ACTIVE', housekeepingStatus: 'CLEAN', roomType: type },
    { id: 'room-102', roomNumber: '102', floor: 1, operationalStatus: 'ACTIVE', housekeepingStatus: 'DIRTY', roomType: type },
  ];
  await page.route('**/api/rooms?*', route => route.fulfill({ json: { data: rooms, meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 } } }));
  await page.route('**/api/rooms/available?*', route => route.fulfill({ json: { data: rooms, nights: 1 } }));
  await page.goto('/rooms?page=2');
  await expect(page.getByRole('heading', { name: 'Phòng 101', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Phòng 102', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Đặt phòng', exact: true })).toHaveAttribute('href', /rooms\/room-101\?checkIn=/);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('*')).filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, cls: el.className, right: el.getBoundingClientRect().right })))).toEqual([]);
    await expect(page.getByRole('link', { name: 'Đặt phòng', exact: true })).toBeInViewport();
    if (width === 1440 || width === 390) await page.screenshot({ path: `../.local/ready-rooms-${width}.png`, fullPage: true });
  }
});

