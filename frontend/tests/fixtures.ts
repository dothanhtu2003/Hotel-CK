import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

type FixtureUser = { id: string; email: string; role: string; fullName: string };
export function fixtures(): { password: string; users: Record<string, FixtureUser>; room: { id: string; roomNumber: string }; secondRoom: { id: string }; roomType: { id: string }; services: { id: string; name: string }[]; deskRooms: { id: string; roomNumber: string }[]; housekeeping: { rooms: { id: string; roomNumber: string }[]; tasks: { id: string; roomId: string }[] }; releaseRoom: { id: string; roomNumber: string }; releaseType: { id: string } } { return JSON.parse(readFileSync(new URL('../../.local/frontend-e2e-fixtures.json', import.meta.url), 'utf8')); }
export async function login(page: Page, name = 'guest', destination?: string) {
  const f = fixtures(), user = f.users[name]; await page.goto('/login');
  await page.getByLabel('Địa chỉ email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(`http://localhost:5174${destination ?? ({ GUEST: '/guest', RECEPTIONIST: '/reception', HOUSEKEEPING: '/housekeeping', ADMIN: '/admin' }[user.role])}`);
}
export async function disableIsolatedFixture(name: string) {
  config({ path: new URL('../../.env', import.meta.url), quiet: true });
  const value = process.env.TEST_DATABASE_URL; if (!value) throw new Error('TEST_DATABASE_URL required'); const url = new URL(value);
  if (url.pathname !== '/hotel_test' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Only local hotel_test may be mutated');
  const user = fixtures().users[name]; if (!user.email.endsWith('@frontend-test.invalid')) throw new Error('Only this E2E run fixture is allowed');
  const client = new pg.Client({ connectionString: value }); await client.connect();
  try { const result = await client.query("UPDATE hotel.users SET status='DISABLED' WHERE id=$1 AND email=$2", [user.id, user.email]); if (result.rowCount !== 1) throw new Error('Missing test fixture'); } finally { await client.end(); }
}
