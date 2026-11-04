BEGIN;
ALTER TABLE hotel.booking_payments ALTER COLUMN payos_order_code DROP NOT NULL;
ALTER TABLE hotel.booking_payments ADD COLUMN method hotel."PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER', ADD COLUMN collected_by_id UUID REFERENCES hotel.users(id);
ALTER TABLE hotel.booking_payments ADD CONSTRAINT booking_payment_method CHECK (method IN ('CASH','BANK_TRANSFER'));
CREATE OR REPLACE FUNCTION hotel.guard_booking_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=hotel,public AS $$
DECLARE b bookings;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment history cannot be deleted' USING ERRCODE='23514'; END IF;
  SELECT * INTO b FROM bookings WHERE id=NEW.booking_id FOR UPDATE;
  IF TG_OP='INSERT' THEN
    IF NOT FOUND OR (NOT b.online_payment_required AND NEW.method<>'CASH') OR b.status<>'PENDING' OR NEW.status<>'PENDING' OR NEW.amount<>b.total_room_amount OR (NEW.method='CASH' AND (NEW.payos_order_code IS NOT NULL OR NEW.collected_by_id IS NULL)) OR (NEW.method='BANK_TRANSFER' AND NEW.payos_order_code IS NULL) THEN
      RAISE EXCEPTION 'Online payment requires full room amount on pending booking' USING ERRCODE='23514';
    END IF;
  ELSE
    IF (OLD.status='COMPLETED' AND NEW.status<>'COMPLETED') OR (OLD.status='FAILED' AND NEW.status NOT IN ('FAILED','COMPLETED')) OR ROW(NEW.id,NEW.booking_id,NEW.amount,NEW.payos_order_code,NEW.method,NEW.collected_by_id) IS DISTINCT FROM ROW(OLD.id,OLD.booking_id,OLD.amount,OLD.payos_order_code,OLD.method,OLD.collected_by_id) THEN
      RAISE EXCEPTION 'Booking payment immutable except pending outcome' USING ERRCODE='23514';
    END IF;
    IF NEW.status='COMPLETED' AND OLD.status<>'COMPLETED' AND NOT (b.status='PENDING' OR (b.status='CANCELLED' AND b.hold_state='EXPIRED')) THEN RAISE EXCEPTION 'Booking no longer pending' USING ERRCODE='23514'; END IF;
  END IF;
  NEW.paid_at := CASE WHEN NEW.status='COMPLETED' THEN COALESCE(OLD.paid_at,clock_timestamp()) ELSE NULL END;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION hotel.credit_booking_prepayment() RETURNS trigger LANGUAGE plpgsql SET search_path=hotel,public AS $$
BEGIN
 INSERT INTO payments(id,invoice_id,amount,method,status)
 SELECT id,NEW.id,amount,method,'COMPLETED' FROM booking_payments WHERE booking_id=NEW.booking_id AND status='COMPLETED';
 RETURN NULL;
END $$;
COMMIT;
