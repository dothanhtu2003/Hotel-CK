ALTER TABLE hotel.payments
  ADD COLUMN payos_order_code BIGINT UNIQUE,
  ADD COLUMN checkout_url VARCHAR(2048);
CREATE UNIQUE INDEX payments_one_pending_payos_per_invoice
  ON hotel.payments(invoice_id) WHERE payos_order_code IS NOT NULL AND status='PENDING';
