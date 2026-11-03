BEGIN;
ALTER TABLE hotel.service_orders ADD COLUMN requested_payment_method hotel."PaymentMethod";
CREATE OR REPLACE FUNCTION hotel.guard_order() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE b bookings;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Cancel service orders instead of deleting' USING ERRCODE='23514'; END IF;
  SELECT * INTO b FROM bookings WHERE id=NEW.booking_id FOR UPDATE;
  IF NOT FOUND OR b.status <> 'CHECKED_IN' OR (NEW.requested_payment_method IS NULL AND EXISTS(SELECT 1 FROM invoices WHERE booking_id=b.id))
    THEN RAISE EXCEPTION 'Service order requires checked-in, unbilled stay' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' AND (NEW.status <> 'PENDING' OR NEW.payment_method IS NOT NULL OR NEW.refunded_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Order must start PENDING without payment' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.requested_payment_method IS DISTINCT FROM OLD.requested_payment_method THEN RAISE EXCEPTION 'Payment choice is immutable' USING ERRCODE='23514'; END IF;
    IF ROW(NEW.id,NEW.booking_id,NEW.ordered_at) IS DISTINCT FROM ROW(OLD.id,OLD.booking_id,OLD.ordered_at)
      OR OLD.status='CANCELLED' THEN RAISE EXCEPTION 'Order identity and cancelled orders are immutable' USING ERRCODE='23514'; END IF;
    IF OLD.status='COMPLETED' AND NEW.status NOT IN ('COMPLETED','CANCELLED')
      THEN RAISE EXCEPTION 'Recorded order cannot return to pending' USING ERRCODE='23514'; END IF;
    IF OLD.payment_method IS NOT NULL AND ROW(NEW.payment_method,NEW.paid_at,NEW.received_by) IS DISTINCT FROM ROW(OLD.payment_method,OLD.paid_at,OLD.received_by)
      THEN RAISE EXCEPTION 'Counter receipt is immutable' USING ERRCODE='23514'; END IF;
    IF OLD.payment_method IS NULL AND NEW.payment_method IS NOT NULL THEN
      IF NEW.status <> 'COMPLETED' OR NOT (EXISTS(SELECT 1 FROM users WHERE id=NEW.received_by AND role IN ('RECEPTIONIST','ADMIN')) OR (NEW.payment_method='BANK_TRANSFER' AND NEW.payos_status='PAID' AND NEW.payos_created_by=NEW.received_by AND NEW.received_by=b.user_id AND NEW.requested_payment_method IS NOT NULL))
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

CREATE OR REPLACE FUNCTION hotel.guard_item() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE o service_orders; b bookings; s services; oid uuid;
BEGIN
  oid := CASE WHEN TG_OP='DELETE' THEN OLD.service_order_id ELSE NEW.service_order_id END;
  SELECT * INTO o FROM service_orders WHERE id=oid FOR UPDATE;
  IF NOT FOUND OR o.status <> 'PENDING' THEN RAISE EXCEPTION 'Items require pending order' USING ERRCODE='23514'; END IF;
  SELECT * INTO b FROM bookings WHERE id=o.booking_id FOR UPDATE;
  IF b.status <> 'CHECKED_IN' OR (o.requested_payment_method IS NULL AND EXISTS(SELECT 1 FROM invoices WHERE booking_id=b.id))
    THEN RAISE EXCEPTION 'Stay already billed or not checked in' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_OP='INSERT' THEN
    SELECT * INTO s FROM services WHERE id=NEW.service_id FOR SHARE;
    IF NOT FOUND OR NOT s.is_active THEN RAISE EXCEPTION 'Active service required' USING ERRCODE='23514'; END IF;
    IF NEW.unit_price < 0 THEN RAISE EXCEPTION 'Negative unit price' USING ERRCODE='23514'; END IF;
    NEW.unit_price := s.current_price;
  ELSIF ROW(NEW.id,NEW.service_order_id,NEW.service_id,NEW.unit_price) IS DISTINCT FROM ROW(OLD.id,OLD.service_order_id,OLD.service_id,OLD.unit_price)
    THEN RAISE EXCEPTION 'Item identity and snapshot are immutable' USING ERRCODE='23514'; END IF;
  NEW.subtotal := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END $$;
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('hotel.guard_invoice()'::regprocedure) INTO definition;
 definition := replace(definition, 'o.payment_method IS NULL', 'o.payment_method IS NULL AND o.requested_payment_method IS NULL');
 EXECUTE definition;
END $$;
COMMIT;
