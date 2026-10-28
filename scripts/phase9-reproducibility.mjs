import 'dotenv/config';
import process from 'node:process';
import { URL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
import { hash, argon2id } from 'argon2';

// Never reset or drop a database. The new target is retained for inspection.
const source = new URL(process.env.TEST_DATABASE_URL ?? '');
assert(['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) && source.pathname === '/hotel_test', 'Requires local hotel_test reference');
const name = `hotel_phase9_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}_${randomUUID().slice(0, 8)}`;
assert(/^hotel_phase9_\d{8}_[a-f0-9]{8}$/.test(name) && !['hotel_dev', 'hotel_test'].includes(name));
const adminUrl = new URL(source); adminUrl.pathname = '/postgres';
const targetUrl = new URL(source); targetUrl.pathname = '/' + name; targetUrl.searchParams.set('schema', 'hotel');
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount, 0, 'Target must not already exist');
  process.stdout.write(`Verified disposable target: ${source.hostname}:${source.port}/${name}; creating new only, no DROP/reset.\n`);
  await admin.query(`CREATE DATABASE "${name}"`);
} finally { await admin.end(); }
for (let attempt = 0; attempt < 2; attempt++) {
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: targetUrl.toString(), DIRECT_URL: targetUrl.toString() }, stdio: 'pipe' });
}
const fresh = new pg.Client({ connectionString: targetUrl.toString() }), reference = new pg.Client({ connectionString: source.toString() });
await fresh.connect(); await reference.connect();
const report = { target: `${source.hostname}:${source.port}/${name}`, migrationDeployRuns: 2, createdOnly: true, retained: true };
async function catalog(client) {
  const definitions = {};
  for (const [key, sql] of Object.entries({
    columns: "SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='hotel' AND table_name<>'_prisma_migrations' ORDER BY table_name,ordinal_position",
    constraints: "SELECT r.relname,c.conname,pg_get_constraintdef(c.oid,true) definition FROM pg_constraint c JOIN pg_class r ON c.conrelid=r.oid JOIN pg_namespace n ON r.relnamespace=n.oid WHERE n.nspname='hotel' AND r.relname<>'_prisma_migrations' ORDER BY r.relname,c.conname",
    indexes: "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='hotel' AND tablename<>'_prisma_migrations' ORDER BY tablename,indexname",
    triggers: "SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid,true) definition FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='hotel' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
    functions: "SELECT p.proname,pg_get_functiondef(p.oid) definition FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='hotel' ORDER BY p.proname",
    enums: "SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid JOIN pg_namespace n ON t.typnamespace=n.oid WHERE n.nspname='hotel' ORDER BY t.typname,e.enumsortorder",
  })) definitions[key] = (await client.query(sql)).rows;
  return definitions;
}
try {
  assert.equal((await fresh.query('SELECT current_database() db')).rows[0].db, name);
  await reference.query('BEGIN READ ONLY');
  const schema = await catalog(fresh); assert.deepEqual(schema, await catalog(reference));
  await reference.query('ROLLBACK');
  report.catalog = Object.fromEntries(Object.entries(schema).map(([k, v]) => [k, v.length]));
  report.catalogSha256 = createHash('sha256').update(JSON.stringify(schema)).digest('hex');
  report.migrations = (await fresh.query('SELECT migration_name,checksum FROM hotel._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;
  assert.equal(report.migrations.length, 4);
  await fresh.query('BEGIN');
  await fresh.query('SET LOCAL search_path=hotel,public');
  const ids = Object.fromEntries(['guest', 'worker', 'type', 'room', 'service', 'booking', 'order', 'item', 'invoice', 'payment'].map(k => [k, randomUUID()]));
  const passwordHash = await hash(randomUUID(), { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
  // Owner supplies catalogs/staff; runtime cannot administer them.
  await fresh.query("INSERT INTO users(id,full_name,email,password_hash,role) VALUES($1,'Worker','worker@release.invalid',$2,'HOUSEKEEPING')", [ids.worker, passwordHash]);
  await fresh.query("INSERT INTO room_types(id,name,nightly_price,max_guests) VALUES($1,'Release',650000.25,2)", [ids.type]);
  await fresh.query("INSERT INTO rooms(id,room_number,room_type_id,floor) VALUES($1,'R9ACL',$2,1)", [ids.room, ids.type]);
  await fresh.query("INSERT INTO services(id,name,current_price) VALUES($1,'Release service',45000.25)", [ids.service]);
  const role = 'phase9_runtime_' + randomUUID().replaceAll('-', '');
  await fresh.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
  await fresh.query(readFileSync('scripts/release-runtime-grants.sql', 'utf8').replaceAll('hotel_runtime', role));
  await fresh.query(`SET LOCAL ROLE ${role}`);
  const q = async (sql, values = []) => (await fresh.query(sql, values)).rows;
  await q("INSERT INTO users(id,full_name,email,password_hash) VALUES($1,'Guest','guest@release.invalid',$2)", [ids.guest, passwordHash]);
  await q("UPDATE users SET full_name='Guest updated' WHERE id=$1", [ids.guest]);
  await q("INSERT INTO bookings(id,reference,user_id,room_id,check_in_date,check_out_date,guest_count) VALUES($1,'PHASE9ACL',$2,$3,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date+3,2)", [ids.booking, ids.guest, ids.room]);
  await q("UPDATE bookings SET status='CONFIRMED' WHERE id=$1", [ids.booking]);
  await q("UPDATE bookings SET status='CHECKED_IN' WHERE id=$1", [ids.booking]);
  await q('INSERT INTO service_orders(id,booking_id) VALUES($1,$2)', [ids.order, ids.booking]);
  await q('INSERT INTO service_order_items(id,service_order_id,service_id,quantity) VALUES($1,$2,$3,2)', [ids.item, ids.order, ids.service]);
  await q("UPDATE service_orders SET status='COMPLETED' WHERE id=$1", [ids.order]);
  await q('INSERT INTO invoices(id,booking_id) VALUES($1,$2)', [ids.invoice, ids.booking]);
  const invoice = (await q('SELECT total_amount FROM invoices WHERE id=$1', [ids.invoice]))[0]; assert.equal(invoice.total_amount, '2040001.25');
  await q("INSERT INTO payments(id,invoice_id,amount,method,status) VALUES($1,$2,$3,'CASH','COMPLETED')", [ids.payment, ids.invoice, invoice.total_amount]);
  await q("UPDATE bookings SET status='CHECKED_OUT' WHERE id=$1", [ids.booking]);
  const task = (await q("SELECT id FROM housekeeping_tasks WHERE room_id=$1 AND status='TODO'", [ids.room]))[0]; assert(task);
  assert.equal((await q('SELECT housekeeping_status FROM rooms WHERE id=$1', [ids.room]))[0].housekeeping_status, 'DIRTY');
  await q('UPDATE housekeeping_tasks SET assigned_staff_id=$1 WHERE id=$2', [ids.worker, task.id]);
  await q("UPDATE housekeeping_tasks SET status='IN_PROGRESS' WHERE id=$1", [task.id]);
  assert.equal((await q('SELECT housekeeping_status FROM rooms WHERE id=$1', [ids.room]))[0].housekeeping_status, 'CLEANING');
  await q("UPDATE housekeeping_tasks SET status='DONE' WHERE id=$1", [task.id]);
  assert.equal((await q('SELECT housekeeping_status FROM rooms WHERE id=$1', [ids.room]))[0].housekeeping_status, 'CLEAN');
  await q('SET CONSTRAINTS ALL IMMEDIATE');
  report.restrictedRuntimeWorkflow = 'PASS: booking, services, decimal invoice/payment, checkout, assignment, cleaning; deferred constraints checked';
  const denied = ["UPDATE users SET role='ADMIN'", 'UPDATE room_types SET nightly_price=0', 'UPDATE services SET current_price=0', 'UPDATE payments SET amount=0', 'DELETE FROM payments', 'TRUNCATE bookings CASCADE', 'CREATE TABLE hotel.unauthorized(id int)', 'SELECT * FROM hotel._prisma_migrations', 'DELETE FROM housekeeping_tasks'];
  for (const sql of denied) {
    await q('SAVEPOINT denied');
    let code; try { await q(sql); } catch (e) { code = e.code; }
    await q('ROLLBACK TO SAVEPOINT denied');
    assert.equal(code, '42501', `Must be denied by privilege: ${sql}`);
  }
  report.deniedPrivilegeProbes = denied.length;
  await fresh.query('ROLLBACK'); // Also removes the transient NOLOGIN role and fixtures.
  assert.equal((await fresh.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount, 0);
  report.fixtureAndRoleRollback = true;
  const counts = {};
  for (const { table_name } of (await fresh.query("SELECT table_name FROM information_schema.tables WHERE table_schema='hotel' AND table_name<>'_prisma_migrations' ORDER BY table_name")).rows) {
    assert(/^[a-z_]+$/.test(table_name)); counts[table_name] = Number((await fresh.query(`SELECT count(*) FROM hotel."${table_name}"`)).rows[0].count); assert.equal(counts[table_name], 0);
  }
  report.emptyBusinessTables = counts;
  mkdirSync('.local', { recursive: true }); writeFileSync('.local/phase9-reproducibility.json', JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} finally { await fresh.query('ROLLBACK'); await reference.query('ROLLBACK'); await fresh.end(); await reference.end(); }
