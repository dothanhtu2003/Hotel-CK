BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hotel_runtime') THEN
  GRANT UPDATE(checkout_requested_at) ON hotel.bookings TO hotel_runtime;
  GRANT UPDATE(payment_method,paid_at,received_by,refunded_at,refunded_by,
    payos_order_code,payos_checkout_url,payos_qr_code,payos_status,payos_created_by,delivered_at)
    ON hotel.service_orders TO hotel_runtime;
  GRANT UPDATE(checkout_on_paid) ON hotel.payments TO hotel_runtime;
 END IF;
END $$;
COMMIT;
