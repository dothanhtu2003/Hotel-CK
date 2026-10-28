import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '../../src/database/client.js';
import { checkout, placeServiceOrder } from '../../src/database/transactions.js';
import { availabilitySql } from '../../src/database/queries.js';
import { booking, checkIn, checkoutSql, issueInvoiceSql, connect, fixture, migrateTestDatabase, order, rejects, testUrl, withTx } from './helpers.js';

before(migrateTestDatabase);

test('01 Empty room is available',()=>withTx(async c=>{
  const f=await fixture(c); const result=await c.query(availabilitySql,['2099-11-10','2099-11-13',2]);
  assert(result.rows.some(r=>r.id===f.rid));
}));
const overlaps=[
  ['02 Exact overlap','2099-11-10','2099-11-13'],
  ['03 Overlap at beginning','2099-11-08','2099-11-11'],
  ['04 Overlap at end','2099-11-12','2099-11-15'],
  ['05 Inside existing stay','2099-11-11','2099-11-12'],
  ['06 Covers existing stay','2099-11-09','2099-11-14'],
];
for(const [name,start,end] of overlaps) test(name,()=>withTx(async c=>{
  const f=await fixture(c); await booking(c,f,'2099-11-10','2099-11-13');
  assert(!(await c.query(availabilitySql,[start,end,2])).rows.some(r=>r.id===f.rid));
  await rejects(c,`INSERT INTO bookings(id,reference,user_id,room_id,check_in_date,check_out_date,guest_count) VALUES($1::uuid,$1::text,$2,$3,$4,$5,2)`,[randomUUID(),f.uid,f.rid,start,end],['23P01']);
}));
test('07 Adjacent stays are permitted',()=>withTx(async c=>{
  const f=await fixture(c); await booking(c,f,'2099-11-10','2099-11-13');
  assert((await c.query(availabilitySql,['2099-11-13','2099-11-15',2])).rows.some(r=>r.id===f.rid));
  await booking(c,f,'2099-11-13','2099-11-15');
}));
test('08 CANCELLED releases the calendar and retains history',()=>withTx(async c=>{
  const f=await fixture(c); const bid=await booking(c,f,'2099-11-10','2099-11-13');
  await c.query("UPDATE bookings SET status='CANCELLED' WHERE id=$1",[bid]);
  assert((await c.query(availabilitySql,['2099-11-10','2099-11-13',2])).rows.some(r=>r.id===f.rid));
  await booking(c,f,'2099-11-10','2099-11-13');
  assert.equal((await c.query('SELECT count(*)::int n FROM bookings WHERE room_id=$1',[f.rid])).rows[0].n,2);
}));
test('09 Concurrent requests: one commits, loser conflicts; retry hits exclusion',async()=>{
  const setup=await connect(); const f=await fixture(setup); await setup.end();
  const a=await connect(),b=await connect();
  let arrivals=0; let release!:()=>void;
  const barrier=new Promise<void>(resolve=>{release=resolve;});
  const attempt=async(c:typeof a)=>{
    await c.query('BEGIN'); if(++arrivals===2) release(); await barrier;
    try { const id=await booking(c,f,'2099-12-01','2099-12-04'); await c.query('COMMIT'); return {id,code:'OK'}; }
    catch(e) { await c.query('ROLLBACK'); return {code:(e as {code:string}).code}; }
  };
  try {
    const results=await Promise.all([attempt(a),attempt(b)]);
    // Simultaneous GiST exclusion checks can deadlock before either INSERT
    // commits. PostgreSQL aborts one writer; both outcomes preserve the calendar.
    assert.equal(results.filter(x=>x.code==='OK').length,1);
    const loser=results.find(x=>x.code!=='OK')!;
    assert(['23P01','40P01'].includes(loser.code));
    assert.equal((await a.query('SELECT count(*)::int n FROM bookings WHERE room_id=$1',[f.rid])).rows[0].n,1);
    await assert.rejects(booking(results[0].code==='OK'?b:a,f,'2099-12-01','2099-12-04'),{code:'23P01'});
    assert.equal((await a.query('SELECT count(*)::int n FROM bookings WHERE room_id=$1',[f.rid])).rows[0].n,1);
  } finally {await a.end();await b.end();}
});
test('10 Checkout date must follow check-in date',()=>withTx(async c=>{
  const f=await fixture(c);
  for(const end of ['2099-11-10','2099-11-09']) await rejects(c,'INSERT INTO bookings(id,reference,user_id,room_id,check_in_date,check_out_date,guest_count) VALUES($1::uuid,$1::text,$2,$3,$4,$5,2)',[randomUUID(),f.uid,f.rid,'2099-11-10',end]);
}));
test('11 Guest count must be positive',()=>withTx(async c=>{
  const f=await fixture(c);
  for(const count of [0,-1]) await rejects(c,"INSERT INTO bookings(id,reference,user_id,room_id,check_in_date,check_out_date,guest_count) VALUES($1::uuid,$1::text,$2,$3,'2099-01-01','2099-01-03',$4)",[randomUUID(),f.uid,f.rid,count]);
}));
test('12 Capacity enforced',()=>withTx(async c=>{
  const f=await fixture(c); await rejects(c,"INSERT INTO bookings(id,reference,user_id,room_id,check_in_date,check_out_date,guest_count) VALUES($1::uuid,$1::text,$2,$3,'2099-01-01','2099-01-03',3)",[randomUUID(),f.uid,f.rid]);
}));
test('13 Negative room prices rejected',()=>withTx(async c=>{
  const f=await fixture(c); await rejects(c,'UPDATE room_types SET nightly_price=-1 WHERE id=$1',[f.tid]);
  await rejects(c,"INSERT INTO bookings(id,reference,user_id,room_id,check_in_date,check_out_date,guest_count,nightly_price) VALUES($1::uuid,$1::text,$2,$3,'2099-01-01','2099-01-03',2,-1)",[randomUUID(),f.uid,f.rid]);
}));
test('14 Invalid booking transitions rejected',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f);
  await rejects(c,"UPDATE bookings SET status='CHECKED_IN' WHERE id=$1",[bid]);
  await c.query("UPDATE bookings SET status='CANCELLED' WHERE id=$1",[bid]);
  await rejects(c,"UPDATE bookings SET status='CONFIRMED' WHERE id=$1",[bid]);
}));
test('15 Service requires CHECKED_IN',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f);
  await rejects(c,'INSERT INTO service_orders(id,booking_id) VALUES($1,$2)',[randomUUID(),bid]);
}));
test('16 Service price snapshot survives catalog changes',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid); const o=await order(c,f,bid);
  await c.query('UPDATE services SET current_price=90000 WHERE id=$1',[f.sid]);
  assert.equal((await c.query('SELECT unit_price,subtotal FROM service_order_items WHERE id=$1',[o.item])).rows[0].unit_price,'45000.00');
  const fresh=await order(c,f,bid,1);
  assert.equal((await c.query('SELECT unit_price FROM service_order_items WHERE id=$1',[fresh.item])).rows[0].unit_price,'90000.00');
}));
test('17 Cancelled orders excluded from invoice',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid); await order(c,f,bid,2,'CANCELLED');
  assert.equal((await checkoutSql(c,bid)).service_amount,'0.00');
}));
test('18 Multiple completed orders consolidated',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid); await order(c,f,bid,2); await order(c,f,bid,3);
  assert.equal((await checkoutSql(c,bid)).service_amount,'225000.00');
}));
test('19 New task sets room DIRTY',()=>withTx(async c=>{
  const f=await fixture(c); await c.query('INSERT INTO housekeeping_tasks(id,room_id) VALUES($1,$2)',[randomUUID(),f.rid]);
  assert.equal((await c.query('SELECT housekeeping_status FROM rooms WHERE id=$1',[f.rid])).rows[0].housekeeping_status,'DIRTY');
}));
test('20 IN_PROGRESS sets CLEANING and requires staff',()=>withTx(async c=>{
  const f=await fixture(c),id=randomUUID(); await c.query('INSERT INTO housekeeping_tasks(id,room_id) VALUES($1,$2)',[id,f.rid]);
  await rejects(c,"UPDATE housekeeping_tasks SET status='IN_PROGRESS' WHERE id=$1",[id]);
  await c.query("UPDATE housekeeping_tasks SET assigned_staff_id=$2,status='IN_PROGRESS' WHERE id=$1",[id,f.staff]);
  assert.equal((await c.query('SELECT housekeeping_status FROM rooms WHERE id=$1',[f.rid])).rows[0].housekeeping_status,'CLEANING');
}));
test('21 DONE sets completion timestamp and CLEAN',()=>withTx(async c=>{
  const f=await fixture(c),id=randomUUID(); await c.query('INSERT INTO housekeeping_tasks(id,room_id,assigned_staff_id) VALUES($1,$2,$3)',[id,f.rid,f.staff]);
  await c.query("UPDATE housekeeping_tasks SET status='IN_PROGRESS' WHERE id=$1",[id]); await c.query("UPDATE housekeeping_tasks SET status='DONE' WHERE id=$1",[id]);
  assert((await c.query('SELECT completed_at FROM housekeeping_tasks WHERE id=$1',[id])).rows[0].completed_at);
  assert.equal((await c.query('SELECT housekeeping_status FROM rooms WHERE id=$1',[f.rid])).rows[0].housekeeping_status,'CLEAN');
}));
test('22 Room cannot contradict open housekeeping task',()=>withTx(async c=>{
  const f=await fixture(c); await c.query('INSERT INTO housekeeping_tasks(id,room_id) VALUES($1,$2)',[randomUUID(),f.rid]);
  await rejects(c,"UPDATE rooms SET housekeeping_status='CLEAN' WHERE id=$1",[f.rid]);
  await rejects(c,'INSERT INTO housekeeping_tasks(id,room_id) VALUES($1,$2)',[randomUUID(),f.rid],['23505']);
}));
test('23 Multi-night count uses date difference across month boundary',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f,'2099-01-30','2099-02-02');
  assert.equal((await c.query('SELECT check_out_date-check_in_date nights FROM bookings WHERE id=$1',[bid])).rows[0].nights,3);
}));
test('24 Room amount snapshot immutable after catalog price change',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f,'2099-01-30','2099-02-02'); await c.query('UPDATE room_types SET nightly_price=800000 WHERE id=$1',[f.tid]);
  assert.equal((await c.query('SELECT total_room_amount FROM bookings WHERE id=$1',[bid])).rows[0].total_room_amount,'1950000.00');
  await rejects(c,'UPDATE bookings SET nightly_price=800000,total_room_amount=2400000 WHERE id=$1',[bid]);
}));
test('25 Service totals follow valid quantity changes',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid); const o=await order(c,f,bid,2,'PENDING');
  await c.query('UPDATE service_order_items SET quantity=3 WHERE id=$1',[o.item]);
  assert.equal((await c.query('SELECT total_amount FROM service_orders WHERE id=$1',[o.id])).rows[0].total_amount,'135000.00');
  await rejects(c,'UPDATE service_order_items SET quantity=0 WHERE id=$1',[o.item]);
}));
test('26 Invoice total uses snapshots and checkout creates dirty-room task',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid); await order(c,f,bid,2);
  const inv=await checkoutSql(c,bid); assert.equal(inv.room_amount,'2600000.00'); assert.equal(inv.service_amount,'90000.00'); assert.equal(inv.total_amount,'2690000.00');
  assert.equal((await c.query('SELECT housekeeping_status FROM rooms WHERE id=$1',[f.rid])).rows[0].housekeeping_status,'DIRTY');
  assert.equal((await c.query("SELECT count(*)::int n FROM housekeeping_tasks WHERE room_id=$1 AND status='TODO'",[f.rid])).rows[0].n,1);
}));
test('27 Only one final invoice per booking',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid); await checkoutSql(c,bid);
  await rejects(c,'INSERT INTO invoices(id,booking_id) VALUES($1,$2)',[randomUUID(),bid]);
  const {rows:[constraint]}=await c.query("SELECT 1 FROM pg_indexes WHERE schemaname='hotel' AND tablename='invoices' AND indexdef LIKE 'CREATE UNIQUE%booking_id%'"); assert(constraint);
}));
test('28 Valid counter payment settles invoice and blocks overpayment',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid); const inv=await issueInvoiceSql(c,bid);
  const p=randomUUID(); await c.query("INSERT INTO payments(id,invoice_id,amount,method,status) VALUES($1,$2,$3,'BANK_TRANSFER','COMPLETED')",[p,inv.id,inv.total_amount]);
  assert.equal((await c.query('SELECT status FROM invoices WHERE id=$1',[inv.id])).rows[0].status,'PAID');
  assert((await c.query('SELECT paid_at FROM payments WHERE id=$1',[p])).rows[0].paid_at);
  await rejects(c,"INSERT INTO payments(id,invoice_id,amount,method,status) VALUES($1,$2,1,'CASH','COMPLETED')",[randomUUID(),inv.id]);
}));

test('29 CHECKED_OUT retains historical exclusion',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid); await checkoutSql(c,bid);
  await rejects(c,`INSERT INTO bookings(id,reference,user_id,room_id,check_in_date,check_out_date,guest_count) SELECT $1::uuid,$1::text,user_id,room_id,check_in_date,check_out_date,guest_count FROM bookings WHERE id=$2`,[randomUUID(),bid],['23P01']);
}));
test('30 Check-in rejects dirty, inactive and out-of-date rooms',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await c.query("UPDATE bookings SET status='CONFIRMED' WHERE id=$1",[bid]);
  await c.query("UPDATE rooms SET housekeeping_status='DIRTY' WHERE id=$1",[f.rid]); await rejects(c,"UPDATE bookings SET status='CHECKED_IN' WHERE id=$1",[bid]);
  await c.query("UPDATE rooms SET housekeeping_status='CLEAN',operational_status='OUT_OF_SERVICE' WHERE id=$1",[f.rid]); await rejects(c,"UPDATE bookings SET status='CHECKED_IN' WHERE id=$1",[bid]);
  await c.query("UPDATE rooms SET operational_status='ACTIVE' WHERE id=$1",[f.rid]);
  const future=await booking(c,f,'2099-01-01','2099-01-03'); await c.query("UPDATE bookings SET status='CONFIRMED' WHERE id=$1",[future]); await rejects(c,"UPDATE bookings SET status='CHECKED_IN' WHERE id=$1",[future]);
}));
test('31 Pending orders block checkout; finalized items immutable',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid); const o=await order(c,f,bid,2,'PENDING');
  await rejects(c,'INSERT INTO invoices(id,booking_id) VALUES($1,$2)',[randomUUID(),bid]);
  await c.query("UPDATE service_orders SET status='COMPLETED' WHERE id=$1",[o.id]);
  await rejects(c,'UPDATE service_order_items SET quantity=10 WHERE id=$1',[o.item]);
}));
test('32 Invoice can commit before payment; unpaid checkout is rejected without side effects',async()=>{
  const c=await connect();
  try {
    await c.query('BEGIN'); const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid);
    await c.query('INSERT INTO invoices(id,booking_id) VALUES($1,$2)',[randomUUID(),bid]);
    await c.query('COMMIT');
    await c.query('BEGIN');
    await rejects(c,"UPDATE bookings SET status='CHECKED_OUT' WHERE id=$1",[bid]);
    assert.equal((await c.query('SELECT status FROM bookings WHERE id=$1',[bid])).rows[0].status,'CHECKED_IN');
    assert.equal((await c.query('SELECT housekeeping_status FROM rooms WHERE id=$1',[f.rid])).rows[0].housekeeping_status,'CLEAN');
    assert.equal((await c.query('SELECT count(*)::int n FROM housekeeping_tasks WHERE room_id=$1',[f.rid])).rows[0].n,0);
  } finally {await c.query('ROLLBACK');await c.end();}
});
test('33 FK, normalized email, image-primary and audit retention',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f);
  await rejects(c,'DELETE FROM bookings WHERE id=$1',[bid]);
  await rejects(c,'DELETE FROM users WHERE id=$1',[f.uid],['23503','23001']);
  await rejects(c,"UPDATE users SET email='Mixed@Example.com' WHERE id=$1",[f.uid]);
  await c.query("INSERT INTO room_images(id,room_id,secure_url,public_id,is_primary,display_order) VALUES($1::uuid,$2,'https://res.cloudinary.com/demo/image/upload/sample.jpg',$1::text,true,0)",[randomUUID(),f.rid]);
  await rejects(c,"INSERT INTO room_images(id,room_id,secure_url,public_id,is_primary,display_order) VALUES($1::uuid,$2,'https://res.cloudinary.com/demo/image/upload/sample.jpg',$1::text,true,1)",[randomUUID(),f.rid],['23505']);
}));

test('34 Concurrent completed payments cannot overpay',async()=>{
  const setup=await connect(); const f=await fixture(setup);
  await setup.query('BEGIN'); const bid=await booking(setup,f); await checkIn(setup,bid); const inv=await issueInvoiceSql(setup,bid); await setup.query('COMMIT'); await setup.end();
  const a=await connect(),b=await connect();
  let arrivals=0; let release!:()=>void; const barrier=new Promise<void>(resolve=>{release=resolve;});
  const attempt=async(c:typeof a)=>{
    await c.query('BEGIN'); if(++arrivals===2) release(); await barrier;
    try {
      await c.query("INSERT INTO payments(id,invoice_id,amount,method,status) VALUES($1,$2,$3,'CASH','COMPLETED')",[randomUUID(),inv.id,inv.total_amount]);
      await c.query('COMMIT'); return 'OK';
    } catch(e) {await c.query('ROLLBACK'); return (e as {code:string}).code;}
  };
  try {
    assert.deepEqual((await Promise.all([attempt(a),attempt(b)])).sort(),['23514','OK']);
    assert.equal((await a.query("SELECT sum(amount)::text total FROM payments WHERE invoice_id=$1 AND status='COMPLETED'",[inv.id])).rows[0].total,inv.total_amount);
  } finally {await a.end();await b.end();}
});

test('35 Checkout locks out racing service order after invoice commits',async()=>{
  const setup=await connect(); const f=await fixture(setup); const bid=await booking(setup,f); await checkIn(setup,bid); await setup.end();
  const a=await connect(),b=await connect();
  try {
    await a.query('BEGIN'); await a.query('SELECT id FROM bookings WHERE id=$1 FOR UPDATE',[bid]);
    await b.query('BEGIN');
    const racingOrder=b.query('INSERT INTO service_orders(id,booking_id) VALUES($1,$2)',[randomUUID(),bid]).then(()=> 'OK',(e:{code:string})=>e.code);
    await checkoutSql(a,bid); await a.query('COMMIT');
    assert.equal(await racingOrder,'23514'); await b.query('ROLLBACK');
    assert.equal((await a.query('SELECT count(*)::int n FROM service_orders WHERE booking_id=$1',[bid])).rows[0].n,0);
  } finally {await a.query('ROLLBACK');await b.query('ROLLBACK');await a.end();await b.end();}
});

test('36 Prisma transaction helpers: order, checkout, retry returns same invoice',async()=>{
  const setup=await connect(); const f=await fixture(setup),bid=await booking(setup,f); await checkIn(setup,bid); await setup.end();
  const db=createPrismaClient(testUrl);
  try {
    const o=await placeServiceOrder(db,bid,[{serviceId:f.sid,quantity:2}]);
    assert.equal(o.totalAmount.toString(),'90000');
    await db.serviceOrder.update({where:{id:o.id},data:{status:'COMPLETED'}});
    await db.$transaction(async tx => {
      const invoice=await tx.invoice.create({data:{bookingId:bid}});
      await tx.payment.create({data:{invoiceId:invoice.id,amount:invoice.totalAmount,method:'CASH',status:'COMPLETED'}});
    });
    const inv=await checkout(db,bid),again=await checkout(db,bid);
    assert.equal(inv.totalAmount.toString(),'2690000'); assert.equal(again.id,inv.id);
  } finally {await db.$disconnect();}
});

test('37 Restricted backend role can execute trigger workflows without DDL access',()=>withTx(async c=>{
  const f=await fixture(c),bid=await booking(c,f); await checkIn(c,bid);
  const role=`test_runtime_${randomUUID().replaceAll('-','')}`;
  await c.query(`CREATE ROLE ${role} NOLOGIN`);
  await c.query(`GRANT USAGE ON SCHEMA hotel TO ${role}`);
  await c.query(`GRANT SELECT, INSERT, UPDATE ON hotel.users,hotel.room_types,hotel.rooms,hotel.room_images,hotel.bookings,hotel.services,hotel.service_orders,hotel.service_order_items,hotel.housekeeping_tasks,hotel.invoices,hotel.payments TO ${role}`);
  await c.query(`SET LOCAL ROLE ${role}`);
  await order(c,f,bid); const inv=await issueInvoiceSql(c,bid);
  await c.query("INSERT INTO payments(id,invoice_id,amount,method,status) VALUES($1,$2,$3,'CASH','COMPLETED')",[randomUUID(),inv.id,inv.total_amount]);
  await c.query("UPDATE bookings SET status='CHECKED_OUT' WHERE id=$1",[bid]);
  await rejects(c,'SELECT * FROM hotel._prisma_migrations',[],['42501']);
  await rejects(c,'CREATE TABLE hotel.unauthorized_test(id int)',[],['42501']);
}));

test('38 Monetary values reject NUMERIC NaN',()=>withTx(async c=>{
  const f=await fixture(c);
  await rejects(c,"UPDATE room_types SET nightly_price='NaN' WHERE id=$1",[f.tid]);
  await rejects(c,"UPDATE services SET current_price='NaN' WHERE id=$1",[f.sid]);
  const bid=await booking(c,f);await checkIn(c,bid);const inv=await issueInvoiceSql(c,bid);
  await rejects(c,"INSERT INTO payments(id,invoice_id,amount,method) VALUES($1,$2,'NaN','CASH')",[randomUUID(),inv.id]);
}));
