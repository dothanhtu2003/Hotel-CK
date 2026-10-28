import 'dotenv/config';
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('TEST_DATABASE_URL is required; never fall back to DATABASE_URL');
const target = new URL(testUrl);
if (!['localhost','127.0.0.1','[::1]'].includes(target.hostname) || target.pathname !== '/hotel_test') throw new Error('Tests only permit the dedicated local hotel_test database');

export function migrateTestDatabase() {
  execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'], {
    env:{...process.env,DATABASE_URL:testUrl,DIRECT_URL:testUrl},stdio:'pipe',
  });
}
export async function connect() {
  const c = new pg.Client({connectionString:testUrl});
  await c.connect();
  await c.query("SET search_path=hotel,public; SET statement_timeout='10s'; SET lock_timeout='5s'");
  return c;
}
export async function withTx(fn:(c:pg.Client)=>Promise<void>) {
  const c=await connect();
  try { await c.query('BEGIN'); await fn(c); }
  finally { await c.query('ROLLBACK'); await c.end(); }
}
export async function rejects(c:pg.Client, sql:string, params:unknown[]=[], codes=['23514']) {
  await c.query('SAVEPOINT expected_failure');
  try {
    await assert.rejects(c.query(sql,params),(e:unknown)=>codes.includes((e as {code:string}).code));
  } finally { await c.query('ROLLBACK TO SAVEPOINT expected_failure'); await c.query('RELEASE SAVEPOINT expected_failure'); }
}
export async function fixture(c:pg.Client) {
  const uid=randomUUID(),rid=randomUUID(),tid=randomUUID(),sid=randomUUID(),staff=randomUUID();
  const hash=`scrypt$${'a'.repeat(32)}$${'b'.repeat(128)}`;
  await c.query('INSERT INTO users(id,full_name,email,password_hash,role) VALUES($1,$2,$3,$4,$5),($6,$7,$8,$4,$9)',[uid,'Test Guest',`${uid}@test.invalid`,hash,'GUEST',staff,'Test Staff',`${staff}@test.invalid`,'HOUSEKEEPING']);
  await c.query('INSERT INTO room_types(id,name,nightly_price,max_guests) VALUES($1,$2,650000,2)',[tid,tid]);
  await c.query('INSERT INTO rooms(id,room_number,room_type_id,floor) VALUES($1,$2,$3,1)',[rid,rid.slice(0,12),tid]);
  await c.query('INSERT INTO services(id,name,current_price) VALUES($1,$2,45000)',[sid,sid]);
  return {uid,rid,tid,sid,staff};
}
export type Fixture=Awaited<ReturnType<typeof fixture>>;
export async function booking(c:pg.Client,f:Fixture,start?:string,end?:string) {
  const id=randomUUID();
  await c.query(`INSERT INTO bookings(id,reference,user_id,room_id,check_in_date,check_out_date,guest_count)
    VALUES($1::uuid,$1::text,$2,$3,COALESCE($4::date,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-1),COALESCE($5::date,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+3),2)`,[id,f.uid,f.rid,start??null,end??null]);
  return id;
}
export async function checkIn(c:pg.Client,bid:string) {
  await c.query("UPDATE bookings SET status='CONFIRMED' WHERE id=$1",[bid]);
  await c.query("UPDATE bookings SET status='CHECKED_IN' WHERE id=$1",[bid]);
}
export async function order(c:pg.Client,f:Fixture,bid:string,quantity=2,final='COMPLETED') {
  const id=randomUUID();
  await c.query('INSERT INTO service_orders(id,booking_id) VALUES($1,$2)',[id,bid]);
  const item=randomUUID();
  await c.query('INSERT INTO service_order_items(id,service_order_id,service_id,quantity) VALUES($1,$2,$3,$4)',[item,id,f.sid,quantity]);
  if(final!=='PENDING') await c.query('UPDATE service_orders SET status=$2::hotel."OrderStatus" WHERE id=$1',[id,final]);
  return {id,item};
}
export async function issueInvoiceSql(c:pg.Client,bid:string) {
  await c.query('SELECT id FROM bookings WHERE id=$1 FOR UPDATE',[bid]);
  const id=randomUUID();
  const {rows:[invoice]}=await c.query('INSERT INTO invoices(id,booking_id) VALUES($1,$2) RETURNING *',[id,bid]);
  return invoice;
}
export async function checkoutSql(c:pg.Client,bid:string) {
  const invoice=await issueInvoiceSql(c,bid);
  if (invoice.total_amount !== '0.00') await c.query("INSERT INTO payments(id,invoice_id,amount,method,status) VALUES($1,$2,$3,'CASH','COMPLETED')",[randomUUID(),invoice.id,invoice.total_amount]);
  await c.query("UPDATE bookings SET status='CHECKED_OUT' WHERE id=$1",[bid]);
  return invoice;
}
