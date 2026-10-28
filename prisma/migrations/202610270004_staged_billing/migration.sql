BEGIN;
-- Required for separate invoice -> counter payment -> checkout HTTP requests.
-- Previous deferred contract required invoice and checkout to commit together.
-- No tables, columns, enums, amounts or existing business rows are changed.
CREATE OR REPLACE FUNCTION hotel.invoice_checkout_consistency() RETURNS trigger
LANGUAGE plpgsql SET search_path = hotel, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bookings WHERE id=NEW.booking_id AND status IN ('CHECKED_IN','CHECKED_OUT'))
    THEN RAISE EXCEPTION 'Invoice requires a checked-in or checked-out stay' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION hotel.guard_paid_checkout() RETURNS trigger
LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE invoice_status "InvoiceStatus";
BEGIN
  SELECT status INTO invoice_status FROM invoices WHERE booking_id=NEW.id FOR UPDATE;
  IF NOT FOUND OR invoice_status <> 'PAID' THEN RAISE EXCEPTION 'Checkout requires a fully paid invoice' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM service_orders WHERE booking_id=NEW.id AND status='PENDING')
    THEN RAISE EXCEPTION 'Resolve pending service orders before checkout' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
-- Alphabetical trigger order: validate/lock invoice before guard_bookings touches room/task.
CREATE TRIGGER billing_guard_paid_checkout BEFORE UPDATE ON hotel.bookings
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status='CHECKED_OUT')
EXECUTE FUNCTION hotel.guard_paid_checkout();
REVOKE ALL ON FUNCTION hotel.guard_paid_checkout() FROM PUBLIC;
COMMIT;
