-- Reviewed template: execute as migration owner only on the intended database.
-- Replace hotel_runtime with an existing dedicated non-owner runtime role.
-- This file does not create a login, password, cloud connection, or migration.
GRANT USAGE ON SCHEMA hotel TO hotel_runtime;
GRANT SELECT ON hotel.users, hotel.room_types, hotel.rooms, hotel.room_images,
  hotel.bookings, hotel.services, hotel.service_orders, hotel.service_order_items,
  hotel.housekeeping_tasks, hotel.invoices, hotel.payments TO hotel_runtime;
GRANT INSERT ON hotel.users, hotel.bookings, hotel.service_orders,
  hotel.service_order_items, hotel.housekeeping_tasks, hotel.invoices,
  hotel.payments TO hotel_runtime;
GRANT UPDATE (full_name, phone, updated_at) ON hotel.users TO hotel_runtime;
-- FOR SHARE in existing invoker triggers requires UPDATE on at least one column.
-- Grant only id for read-only catalogs; price/name/status updates remain denied.
GRANT UPDATE (id) ON hotel.room_types, hotel.services TO hotel_runtime;
GRANT UPDATE (housekeeping_status, updated_at) ON hotel.rooms TO hotel_runtime;
GRANT UPDATE (status, updated_at) ON hotel.bookings TO hotel_runtime;
GRANT UPDATE (status, total_amount) ON hotel.service_orders TO hotel_runtime;
GRANT UPDATE (status, assigned_staff_id) ON hotel.housekeeping_tasks TO hotel_runtime;
GRANT UPDATE (status) ON hotel.invoices TO hotel_runtime;
-- No ownership, CREATE, DELETE, TRUNCATE, sequence, migration-table privileges,
-- payment/item UPDATE, role/status UPDATE on users, or catalog-price UPDATE.
-- Trigger EXECUTE is checked at trigger creation; runtime needs no blanket grant.
