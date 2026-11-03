ALTER TABLE hotel.bookings ADD COLUMN online_payment_required BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE hotel.booking_payments (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES hotel.bookings(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0 AND amount < 'Infinity'::numeric),
  status hotel."PaymentStatus" NOT NULL DEFAULT 'PENDING',
  payos_order_code BIGINT NOT NULL UNIQUE,
  checkout_url VARCHAR(2048),
  paid_at TIMESTAMPTZ(3),
  CHECK ((status='COMPLETED') = (paid_at IS NOT NULL))
);
CREATE INDEX booking_payments_booking_id_status_idx ON hotel.booking_payments(booking_id,status);
CREATE UNIQUE INDEX booking_payments_one_active ON hotel.booking_payments(booking_id) WHERE status IN ('PENDING','COMPLETED');
ALTER TABLE hotel.booking_payments ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION hotel.guard_online_booking() RETURNS trigger LANGUAGE plpgsql SET search_path=hotel,public AS $$
BEGIN
  IF NEW.online_payment_required IS DISTINCT FROM OLD.online_payment_required THEN
    RAISE EXCEPTION 'Online payment requirement is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.online_payment_required AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('CONFIRMED','CHECKED_IN') AND NOT EXISTS (
      SELECT 1 FROM booking_payments WHERE booking_id=NEW.id AND status='COMPLETED' AND amount=NEW.total_room_amount
    ) THEN RAISE EXCEPTION 'Full online room payment required before confirmation' USING ERRCODE='23514'; END IF;
    IF NEW.status='CANCELLED' AND EXISTS (
      SELECT 1 FROM booking_payments WHERE booking_id=NEW.id AND status IN ('PENDING','COMPLETED')
    ) THEN RAISE EXCEPTION 'Resolve pending payment or refund before cancellation' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_online_bookings BEFORE UPDATE ON hotel.bookings FOR EACH ROW EXECUTE FUNCTION hotel.guard_online_booking();

CREATE FUNCTION hotel.guard_booking_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=hotel,public AS $$
DECLARE b bookings;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment history cannot be deleted' USING ERRCODE='23514'; END IF;
  SELECT * INTO b FROM bookings WHERE id=NEW.booking_id FOR UPDATE;
  IF TG_OP='INSERT' THEN
    IF NOT FOUND OR NOT b.online_payment_required OR b.status<>'PENDING' OR NEW.status<>'PENDING' OR NEW.amount<>b.total_room_amount THEN
      RAISE EXCEPTION 'Online payment requires full room amount on pending booking' USING ERRCODE='23514';
    END IF;
  ELSE
    IF OLD.status<>'PENDING' OR ROW(NEW.id,NEW.booking_id,NEW.amount,NEW.payos_order_code) IS DISTINCT FROM ROW(OLD.id,OLD.booking_id,OLD.amount,OLD.payos_order_code) THEN
      RAISE EXCEPTION 'Booking payment immutable except pending outcome' USING ERRCODE='23514';
    END IF;
    IF NEW.status='COMPLETED' AND b.status<>'PENDING' THEN RAISE EXCEPTION 'Booking no longer pending' USING ERRCODE='23514'; END IF;
  END IF;
  NEW.paid_at := CASE WHEN NEW.status='COMPLETED' THEN clock_timestamp() ELSE NULL END;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_booking_payments BEFORE INSERT OR UPDATE OR DELETE ON hotel.booking_payments FOR EACH ROW EXECUTE FUNCTION hotel.guard_booking_payment();
CREATE FUNCTION hotel.confirm_paid_booking() RETURNS trigger LANGUAGE plpgsql SET search_path=hotel,public AS $$
BEGIN
  IF NEW.status='COMPLETED' THEN UPDATE bookings SET status='CONFIRMED' WHERE id=NEW.booking_id AND status='PENDING'; END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER confirm_paid_booking AFTER UPDATE ON hotel.booking_payments FOR EACH ROW EXECUTE FUNCTION hotel.confirm_paid_booking();

-- Transfer the room prepayment to the final folio once, leaving only extra services due.
CREATE FUNCTION hotel.credit_booking_prepayment() RETURNS trigger LANGUAGE plpgsql SET search_path=hotel,public AS $$
BEGIN
  INSERT INTO payments(id,invoice_id,amount,method,status)
    SELECT id,NEW.id,amount,'BANK_TRANSFER','COMPLETED' FROM booking_payments WHERE booking_id=NEW.booking_id AND status='COMPLETED';
  RETURN NULL;
END $$;
CREATE TRIGGER credit_booking_prepayment AFTER INSERT ON hotel.invoices FOR EACH ROW EXECUTE FUNCTION hotel.credit_booking_prepayment();
