BEGIN;
ALTER TABLE hotel.service_orders
  ADD COLUMN payment_method hotel."PaymentMethod",
  ADD COLUMN paid_at timestamptz(3),
  ADD COLUMN received_by uuid REFERENCES hotel.users(id),
  ADD COLUMN refunded_at timestamptz(3),
  ADD COLUMN refunded_by uuid REFERENCES hotel.users(id),
  ADD CONSTRAINT order_counter_receipt CHECK (
    (payment_method IS NULL AND paid_at IS NULL AND received_by IS NULL AND refunded_at IS NULL AND refunded_by IS NULL)
    OR (payment_method IS NOT NULL AND paid_at IS NOT NULL AND received_by IS NOT NULL
      AND ((status='COMPLETED' AND refunded_at IS NULL AND refunded_by IS NULL)
        OR (status='CANCELLED' AND refunded_at IS NOT NULL AND refunded_by IS NOT NULL AND refunded_at >= paid_at)))
  );

CREATE OR REPLACE FUNCTION hotel.guard_order() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE b bookings;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Cancel service orders instead of deleting' USING ERRCODE='23514'; END IF;
  SELECT * INTO b FROM bookings WHERE id=NEW.booking_id FOR UPDATE;
  IF NOT FOUND OR b.status <> 'CHECKED_IN' OR EXISTS(SELECT 1 FROM invoices WHERE booking_id=b.id)
    THEN RAISE EXCEPTION 'Service order requires checked-in, unbilled stay' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' AND (NEW.status <> 'PENDING' OR NEW.payment_method IS NOT NULL OR NEW.refunded_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Order must start PENDING without payment' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.id,NEW.booking_id,NEW.ordered_at) IS DISTINCT FROM ROW(OLD.id,OLD.booking_id,OLD.ordered_at)
      OR OLD.status='CANCELLED' THEN RAISE EXCEPTION 'Order identity and cancelled orders are immutable' USING ERRCODE='23514'; END IF;
    IF OLD.status='COMPLETED' AND NEW.status NOT IN ('COMPLETED','CANCELLED')
      THEN RAISE EXCEPTION 'Recorded order cannot return to pending' USING ERRCODE='23514'; END IF;
    IF OLD.payment_method IS NOT NULL AND ROW(NEW.payment_method,NEW.paid_at,NEW.received_by) IS DISTINCT FROM ROW(OLD.payment_method,OLD.paid_at,OLD.received_by)
      THEN RAISE EXCEPTION 'Counter receipt is immutable' USING ERRCODE='23514'; END IF;
    IF OLD.payment_method IS NULL AND NEW.payment_method IS NOT NULL THEN
      IF NEW.status <> 'COMPLETED' OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.received_by AND role IN ('RECEPTIONIST','ADMIN'))
        THEN RAISE EXCEPTION 'Staff counter receipt required' USING ERRCODE='23514'; END IF;
      NEW.paid_at := clock_timestamp();
    END IF;
    IF OLD.refunded_at IS DISTINCT FROM NEW.refunded_at OR OLD.refunded_by IS DISTINCT FROM NEW.refunded_by THEN
      IF OLD.payment_method IS NULL OR NEW.status <> 'CANCELLED' OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.refunded_by AND role IN ('RECEPTIONIST','ADMIN'))
        THEN RAISE EXCEPTION 'Staff refund required to cancel a paid order' USING ERRCODE='23514'; END IF;
      NEW.refunded_at := clock_timestamp();
    END IF;
  END IF;
  SELECT COALESCE(sum(subtotal),0) INTO NEW.total_amount FROM service_order_items WHERE service_order_id=NEW.id;
  IF NEW.status='COMPLETED' AND NOT EXISTS(SELECT 1 FROM service_order_items WHERE service_order_id=NEW.id)
    THEN RAISE EXCEPTION 'Cannot record empty order' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

-- Keep final invoices immutable; counter-paid services have their own receipt.
CREATE OR REPLACE FUNCTION hotel.guard_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE b bookings; paid numeric;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Invoice history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    SELECT * INTO b FROM bookings WHERE id=NEW.booking_id FOR UPDATE;
    IF NOT FOUND OR b.status <> 'CHECKED_IN' THEN RAISE EXCEPTION 'Invoice requires checked-in booking' USING ERRCODE='23514'; END IF;
    IF EXISTS(SELECT 1 FROM service_orders WHERE booking_id=b.id AND status='PENDING') THEN RAISE EXCEPTION 'Resolve pending requests before invoice' USING ERRCODE='23514'; END IF;
    NEW.room_amount := b.total_room_amount;
    SELECT COALESCE(sum(i.subtotal),0) INTO NEW.service_amount FROM service_order_items i JOIN service_orders o ON o.id=i.service_order_id
      WHERE o.booking_id=b.id AND o.status='COMPLETED' AND o.payment_method IS NULL;
    NEW.total_amount := NEW.room_amount + NEW.service_amount;
    NEW.status := CASE WHEN NEW.total_amount=0 THEN 'PAID'::"InvoiceStatus" ELSE 'ISSUED'::"InvoiceStatus" END;
  ELSE
    IF ROW(NEW.id,NEW.booking_id,NEW.room_amount,NEW.service_amount,NEW.total_amount,NEW.issued_at) IS DISTINCT FROM ROW(OLD.id,OLD.booking_id,OLD.room_amount,OLD.service_amount,OLD.total_amount,OLD.issued_at)
      THEN RAISE EXCEPTION 'Final invoice amounts are immutable' USING ERRCODE='23514'; END IF;
    SELECT COALESCE(sum(amount),0) INTO paid FROM payments WHERE invoice_id=NEW.id AND status='COMPLETED';
    NEW.status := CASE WHEN paid=NEW.total_amount THEN 'PAID'::"InvoiceStatus" ELSE 'ISSUED'::"InvoiceStatus" END;
  END IF;
  RETURN NEW;
END $$;
COMMIT;
