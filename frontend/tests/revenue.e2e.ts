import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { hotelToday, shiftDate } from '../src/features/reception/room-state';
import { login } from './fixtures';

test('revenue totals, charts, filters, pagination, CSV, and links', async ({ page }) => {
  const today = hotelToday();
  const date = today + 'T05:00:00Z';
  const receipt = {
    bookingId: '00000000-0000-4000-8000-000000000001',
    reference: 'REV-CASH', room: '101', guest: '=1+1', date,
    amount: '100000.00', roomAmount: '100000.00', serviceAmount: '0.00', method: 'CASH', source: 'Tiền phòng', collector: 'Lễ tân A', refund: false,
  };
  const rows = [
    { ...receipt, id: 'cash' },
    ...Array.from({ length: 15 }, (_, i) => ({
      ...receipt, id: 'bank-' + i, reference: 'REV-BANK-' + i, amount: '20000.00', roomAmount: '0.00', serviceAmount: '20000.00',
      method: 'BANK_TRANSFER', source: 'payOS · Dịch vụ',
    })),
    { ...receipt, id: 'refund', reference: 'REV-REFUND', amount: '-50000.00', roomAmount: '0.00', serviceAmount: '-50000.00', refund: true },
  ];
  const requests: URL[] = [];
  await page.route('**/api/revenue?*', route => {
    requests.push(new URL(route.request().url()));
    const transactions = requests.at(-1)?.searchParams.get('from') === shiftDate(today, -13)
      ? rows.map(row => row.id === 'refund' ? { ...row, date: shiftDate(today, -1) + 'T05:00:00Z' } : row)
      : rows;
    return route.fulfill({ json: { pending: 2, previousTotal: '175000.00', transactions } });
  });
  await login(page, 'reception');
  await page.getByRole('link', { name: 'Doanh thu', exact: true }).click();
  const kpis = page.getByRole('region', { name: 'Tổng hợp doanh thu' });
  await expect(kpis).toContainText('350.000');
  await expect(kpis).toContainText('50.000');
  await expect(kpis).toContainText('300.000');
  await expect(kpis).toContainText('+100%');
  await expect(kpis).toContainText('16');
  const sources = page.getByRole('region', { name: 'Thực thu theo nguồn' });
  await expect(sources).toContainText('100.000');
  await expect(sources).toContainText('250.000');
  expect(requests[0].searchParams.get('from')).toBe(today);
  expect(requests[0].searchParams.get('to')).toBe(today);
  await expect(page.getByRole('img', { name: 'Tiền mặt 25%, chuyển khoản 75%' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Biểu đồ cột thực thu theo ngày' })).toBeVisible();
  await expect(page.getByText('2 khoản thanh toán payOS', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mở hàng chờ đối soát' })).toHaveAttribute('href', '/reception/billing');

  const table = page.getByRole('table', { name: 'Giao dịch doanh thu' });
  await expect(table.locator('tbody tr:not(.revenue-day)')).toHaveCount(15);
  await page.getByRole('button', { name: 'Trang sau' }).click();
  await expect(table.locator('tbody tr:not(.revenue-day)')).toHaveCount(2);
  await page.getByRole('button', { name: 'Trang trước' }).click();
  await expect(table.locator('tbody tr:not(.revenue-day)')).toHaveCount(15);
  const method = page.getByRole('group', { name: 'Phương thức thanh toán' });
  await method.getByRole('button', { name: 'Tiền mặt', exact: true }).click();
  await expect(table.locator('tbody tr:not(.revenue-day)')).toHaveCount(2);
  await expect(table.getByText('Đã hoàn tiền')).toBeVisible();
  await expect(table.getByText('Hôm nay', { exact: true })).toBeVisible();
  await expect(table.getByText('Thu tiền phòng', { exact: true })).toBeVisible();
  await expect(table.getByText('Hoàn tiền dịch vụ', { exact: true })).toBeVisible();
  await expect(table.getByRole('link', { name: 'REV-CASH' })).toHaveAttribute('href', '/reception/bookings/' + receipt.bookingId);
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Xuất CSV (Excel)' }).click(),
  ]);
  expect(file.suggestedFilename()).toBe(`doanh-thu-${today}-${today}.csv`);
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv).toContain('REV-CASH');
  expect(csv).toContain("'=1+1");
  expect(csv).toContain('-50000.00');
  expect(csv).not.toContain('REV-BANK');
  await method.getByRole('button', { name: 'Chuyển khoản', exact: true }).click();
  await expect(table.locator('tbody tr:not(.revenue-day)')).toHaveCount(15);
  await expect(table.getByText('payOS · Dịch vụ')).toHaveCount(15);

  await page.getByRole('button', { name: '14 ngày', exact: true }).click();
  await expect.poll(() => requests.at(-1)?.searchParams.get('from')).toBe(shiftDate(today, -13));
  await page.getByRole('group', { name: 'Phương thức thanh toán' }).getByRole('button', { name: 'Tiền mặt', exact: true }).click();
  await expect(table.getByText('Hôm qua', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chọn ngày', exact: true }).click();
  await page.getByLabel('Từ ngày').fill(shiftDate(today, -2));
  await page.getByLabel('Đến ngày').fill(shiftDate(today, -1));
  await expect.poll(() => requests.at(-1)?.searchParams.get('to')).toBe(shiftDate(today, -1));
  await page.getByLabel('Từ ngày').fill(today);
  await expect(page.getByRole('alert')).toContainText('Chọn khoảng từ 1 đến 366 ngày');
  await expect(page.getByRole('button', { name: 'Xuất CSV (Excel)' })).toBeDisabled();
});

test('revenue handles a failed request, retry, and an empty period', async ({ page }) => {
  let fail = true;
  await page.route('**/api/revenue?*', route => fail
    ? route.fulfill({ status: 500, json: { message: 'Test error' } })
    : route.fulfill({ json: { pending: 0, previousTotal: '0.00', transactions: [] } }));
  await login(page, 'reception');
  await page.getByRole('link', { name: 'Doanh thu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được báo cáo doanh thu');
  fail = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Không có giao dịch trong kỳ đã chọn.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xuất CSV (Excel)' })).toBeDisabled();
});
