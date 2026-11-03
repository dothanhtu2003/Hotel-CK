ALTER TABLE hotel.service_orders
 ADD COLUMN payos_order_code bigint UNIQUE,
 ADD COLUMN payos_checkout_url text,
 ADD COLUMN payos_qr_code text,
 ADD COLUMN payos_status text,
 ADD COLUMN payos_created_by uuid REFERENCES hotel.users(id);
