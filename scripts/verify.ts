import 'dotenv/config';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for pg verification');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const counts = await client.query(`SELECT 'users' AS entity,count(*)::int FROM hotel.users UNION ALL SELECT 'rooms',count(*)::int FROM hotel.rooms UNION ALL SELECT 'room_types',count(*)::int FROM hotel.room_types UNION ALL SELECT 'services',count(*)::int FROM hotel.services UNION ALL SELECT 'bookings',count(*)::int FROM hotel.bookings UNION ALL SELECT 'invoices',count(*)::int FROM hotel.invoices UNION ALL SELECT 'payments',count(*)::int FROM hotel.payments`);
  console.table(counts.rows);
  const constraints = await client.query(`SELECT conname,contype FROM pg_constraint WHERE connamespace='hotel'::regnamespace AND contype IN ('c','x') ORDER BY conname`);
  console.table(constraints.rows);
  const drift = await client.query(`SELECT i.id FROM hotel.invoices i JOIN hotel.bookings b ON b.id=i.booking_id WHERE i.room_amount<>b.total_room_amount OR i.service_amount<>(SELECT coalesce(sum(x.subtotal),0) FROM hotel.service_orders o JOIN hotel.service_order_items x ON x.service_order_id=o.id WHERE o.booking_id=b.id AND o.status='COMPLETED') OR b.status NOT IN ('CHECKED_IN','CHECKED_OUT')`);
  if (drift.rowCount) throw new Error('Invoice integrity mismatch');
  console.log('Invoice reconciliation: PASS');
  const payments = await client.query(`SELECT i.id FROM hotel.invoices i WHERE
    (SELECT coalesce(sum(p.amount),0) FROM hotel.payments p WHERE p.invoice_id=i.id AND p.status='COMPLETED')>i.total_amount
    OR (i.status='PAID')<>(i.total_amount=(SELECT coalesce(sum(p.amount),0) FROM hotel.payments p WHERE p.invoice_id=i.id AND p.status='COMPLETED'))`);
  if (payments.rowCount) throw new Error('Payment balance/status mismatch');
  console.log('Payment balance and invoice PAID reconciliation: PASS');
  const checkout = await client.query(`SELECT b.id FROM hotel.bookings b LEFT JOIN hotel.invoices i ON i.booking_id=b.id WHERE b.status='CHECKED_OUT' AND (i.id IS NULL OR i.status<>'PAID')`);
  if (checkout.rowCount) throw new Error('Checked-out booking without a paid invoice');
  console.log('Checkout paid-invoice verification: PASS');
} finally { await client.end(); }
