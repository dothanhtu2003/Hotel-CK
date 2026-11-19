import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

let guestOverride: FixtureUser | undefined;
type FixtureUser = { id: string; email: string; role: string; fullName: string };
export function fixtures(): { databaseName:string; password: string; users: Record<string, FixtureUser>; room: { id: string; roomNumber: string }; secondRoom: { id: string }; roomType: { id: string; name:string }; services: { id: string; name: string }[]; deskRooms: { id: string; roomNumber: string }[]; counterRooms:{id:string;roomNumber:string}[]; housekeeping: { rooms: { id: string; roomNumber: string }[]; tasks: { id: string; roomId: string }[] }; releaseRoom: { id: string; roomNumber: string }; releaseType: { id: string; name:string } } { const saved=JSON.parse(readFileSync(new URL('../../.local/frontend-e2e-fixtures.json', import.meta.url), 'utf8')); return guestOverride ? { ...saved, users:{...saved.users, guest:guestOverride} } : saved; }
export async function login(page: Page, name = 'guest', destination?: string) {
  const f = fixtures(), user = f.users[name]; await page.goto('/login');
  await page.getByLabel('Địa chỉ email', { exact: true }).fill(user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(`http://localhost:5174${destination ?? ({ GUEST: '/', RECEPTIONIST: '/reception', HOUSEKEEPING: '/housekeeping', ADMIN: '/admin' }[user.role])}`);
}
export async function disableIsolatedFixture(name: string) {
  config({ path: new URL('../../.env', import.meta.url), quiet: true });
  const value = process.env.TEST_DATABASE_URL; if (!value) throw new Error('TEST_DATABASE_URL required'); const url = new URL(value);
  if (url.pathname !== '/hotel_test' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Only local hotel_test may be mutated');
  url.pathname='/'+fixtures().databaseName;
  if(!/^hotel_e2e_[a-f0-9]{32}$/.test(fixtures().databaseName)) throw new Error('Missing owned disposable E2E database');
  const user = fixtures().users[name]; if (!user.email.endsWith('@frontend-test.invalid')) throw new Error('Only this E2E run fixture is allowed');
  const client = new pg.Client({ connectionString: url.toString() }); await client.connect();
  try { const result = await client.query("UPDATE hotel.users SET status='DISABLED' WHERE id=$1 AND email=$2", [user.id, user.email]); if (result.rowCount !== 1) throw new Error('Missing test fixture'); } finally { await client.end(); }
}

export const apiBase='http://127.0.0.1:3301/api';
export async function authHeaders(request:APIRequestContext, name='reception') {
 const f=fixtures();const r=await request.post(apiBase+'/auth/login',{data:{email:f.users[name].email,password:f.password}});expect(r.status()).toBe(200);return {Authorization:'Bearer '+(await r.json()).accessToken};
}
export function hotelDay(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function addDays(day:string,n:number){return new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);}
export async function staffBooking(request:APIRequestContext,roomId:string,checkIn=hotelDay(),checkOut=addDays(checkIn,2)) {
 const r=await request.post(apiBase+'/front-desk/walk-in',{headers:await authHeaders(request),data:{roomId,checkIn,checkOut,guests:2,customerId:fixtures().users.guest.id,receiveNow:false}});expect(r.status()).toBe(201);const b=await r.json();expect(b.status).toBe('PENDING');expect(b.onlinePaymentRequired).toBe(false);return b;
}
export async function freshGuest(request:APIRequestContext) {
 guestOverride=undefined;const fullName='Isolated Guest '+randomUUID().slice(0,8),email=randomUUID()+'@frontend-test.invalid';
 const r=await request.post(apiBase+'/auth/register',{data:{fullName,email,password:fixtures().password}});expect(r.status()).toBe(201);guestOverride=await r.json();
}
export async function cancelGuestHolds(request:APIRequestContext) {
 if(!guestOverride)return;const headers=await authHeaders(request,'guest');const r=await request.get(apiBase+'/bookings/my?status=PENDING&pageSize=100',{headers});expect(r.status()).toBe(200);
 for(const b of (await r.json()).data){const cancelled=await request.post(apiBase+`/bookings/${b.id}/payos/cancel`,{headers});expect([200,201]).toContain(cancelled.status());}
 guestOverride=undefined;
}
export async function settleProvider(request:APIRequestContext, checkoutUrl:string, amount:string, headers:Record<string,string>, syncPath:string) {
 const match=/e2e-(\d+)/.exec(checkoutUrl);expect(match).toBeTruthy();const path=new URL('../../.local/e2e-provider-state.json',import.meta.url);const state=JSON.parse(readFileSync(path,'utf8'));
 state[match![1]]={status:'PAID',amountPaid:Number(amount),amountRemaining:0};writeFileSync(path,JSON.stringify(state));
 const sync=await request.post(apiBase+syncPath,{headers});expect([200,201]).toContain(sync.status());
}
export async function payOnlineBooking(request:APIRequestContext,id:string,headers:Record<string,string>,amount:string){
 const r=await request.post(apiBase+`/bookings/${id}/payos/qr`,{headers});expect(r.status()).toBe(201);const link=await r.json();await settleProvider(request,link.checkoutUrl,amount,headers,`/bookings/${id}/payos/sync`);
 const b=await request.get(apiBase+'/bookings/'+id,{headers});expect((await b.json()).status).toBe('CONFIRMED');return link;
}
export async function openRoute(page:Page,path:string){await page.evaluate(p=>{history.pushState({},'',p);dispatchEvent(new PopStateEvent('popstate'));},path);}
export async function assertFits(page:Page){for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:950});const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:Array.from(document.querySelectorAll('*')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right}))}));expect(metrics.scroll<=metrics.width,JSON.stringify(metrics)).toBe(true);}}
