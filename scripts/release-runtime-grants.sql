-- Reviewed template: execute as migration owner only on the intended database.
-- Replace hotel_runtime with an existing dedicated non-owner runtime role.
-- This file does not create a login, password, cloud connection, or migration.
GRANT USAGE ON SCHEMA hotel TO hotel_runtime;
GRANT SELECT ON hotel.users, hotel.room_types, hotel.rooms, hotel.room_images,
  hotel.bookings, hotel.services, hotel.service_orders, hotel.service_order_items,
  hotel.housekeeping_tasks, hotel.invoices, hotel.payments, hotel.booking_payments TO hotel_runtime;
GRANT INSERT ON hotel.users, hotel.bookings, hotel.service_orders,
  hotel.service_order_items, hotel.housekeeping_tasks, hotel.invoices,
  hotel.payments, hotel.booking_payments TO hotel_runtime;
GRANT UPDATE (full_name, phone, updated_at) ON hotel.users TO hotel_runtime;
-- FOR SHARE in existing invoker triggers requires UPDATE on at least one column.
-- Grant only id for read-only catalogs; price/name/status updates remain denied.
GRANT UPDATE (id) ON hotel.room_types, hotel.services TO hotel_runtime;
GRANT UPDATE (housekeeping_status, updated_at) ON hotel.rooms TO hotel_runtime;
GRANT UPDATE (status, updated_at) ON hotel.bookings TO hotel_runtime;
GRANT UPDATE (status, total_amount) ON hotel.service_orders TO hotel_runtime;
GRANT UPDATE (status, assigned_staff_id) ON hotel.housekeeping_tasks TO hotel_runtime;
GRANT UPDATE (status) ON hotel.invoices TO hotel_runtime;
GRANT UPDATE (status, checkout_url) ON hotel.payments, hotel.booking_payments TO hotel_runtime;
-- No ownership, CREATE, DELETE, TRUNCATE, sequence, migration-table privileges,
-- payment identity/amount or item UPDATE, role/status UPDATE on users, or catalog-price UPDATE.
-- Trigger EXECUTE is checked at trigger creation; runtime needs no blanket grant.

GRANT UPDATE (hold_state,payment_check_at) ON hotel.bookings TO hotel_runtime;
GRANT UPDATE (received_amount,review_reason,review_resolved_at,refund_reference,resolved_by_id) ON hotel.booking_payments TO hotel_runtime;

-- Stay audit records use UUID defaults; no sequence privileges are required.
GRANT SELECT, INSERT ON hotel.stay_segments, hotel.stay_extensions, hotel.room_status_changes TO hotel_runtime;
GRANT UPDATE (ended_at, end_date) ON hotel.stay_segments TO hotel_runtime;
GRANT UPDATE (room_id,current_room_since,check_out_date,total_room_amount) ON hotel.bookings TO hotel_runtime;
GRANT UPDATE (operational_status) ON hotel.rooms TO hotel_runtime;
GRANT UPDATE (manual_completed_by) ON hotel.housekeeping_tasks TO hotel_runtime;
GRANT UPDATE (checkout_data) ON hotel.booking_payments TO hotel_runtime;
GRANT UPDATE (checkout_requested_at) ON hotel.bookings TO hotel_runtime;
GRANT UPDATE (payment_method,paid_at,received_by,refunded_at,refunded_by,
  payos_order_code,payos_checkout_url,payos_qr_code,payos_status,payos_created_by,delivered_at)
  ON hotel.service_orders TO hotel_runtime;
GRANT UPDATE (checkout_on_paid) ON hotel.payments TO hotel_runtime;
