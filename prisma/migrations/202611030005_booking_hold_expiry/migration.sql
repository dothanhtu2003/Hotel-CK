BEGIN;
ALTER TABLE hotel.bookings ADD COLUMN hold_expires_at TIMESTAMPTZ(3), ADD COLUMN hold_state VARCHAR(24), ADD COLUMN payment_check_at TIMESTAMPTZ(3), ADD COLUMN client_ip_hash VARCHAR(64);
ALTER TABLE hotel.booking_payments ADD COLUMN received_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(received_amount>=0), ADD COLUMN review_reason VARCHAR(80), ADD COLUMN review_resolved_at TIMESTAMPTZ(3), ADD COLUMN refund_reference VARCHAR(200), ADD COLUMN resolved_by_id UUID REFERENCES hotel.users(id);
-- Legacy links may lack a remote deadline. Give existing bookings a fresh window,
-- then the worker cancels and verifies every remote link before releasing a room.
UPDATE hotel.bookings SET hold_expires_at=clock_timestamp()+interval '15 minutes', hold_state='ACTIVE' WHERE online_payment_required AND status='PENDING';
CREATE INDEX bookings_hold_sweep_idx ON hotel.bookings(hold_expires_at,payment_check_at) WHERE online_payment_required AND status IN ('PENDING','CANCELLED');
CREATE FUNCTION hotel.initialize_booking_hold() RETURNS trigger LANGUAGE plpgsql SET search_path=hotel,public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.online_payment_required THEN
   PERFORM pg_advisory_xact_lock(hashtextextended(k,0)) FROM (
    SELECT 'guest:'||NEW.user_id::text AS k UNION
    SELECT 'phone:'||regexp_replace(regexp_replace(phone,'[^0-9]','','g'),'^84','0') FROM users WHERE id=NEW.user_id AND phone IS NOT NULL UNION
    SELECT 'ip:'||NEW.client_ip_hash WHERE NEW.client_ip_hash IS NOT NULL
   ) identities ORDER BY k;
   IF (SELECT count(*) FROM bookings b JOIN users u ON u.id=b.user_id WHERE b.online_payment_required AND b.status='PENDING' AND (b.user_id=NEW.user_id OR (u.phone IS NOT NULL AND regexp_replace(regexp_replace(u.phone,'[^0-9]','','g'),'^84','0')=(SELECT regexp_replace(regexp_replace(phone,'[^0-9]','','g'),'^84','0') FROM users WHERE id=NEW.user_id)))) >= 2 THEN RAISE EXCEPTION 'HOLD_LIMIT' USING ERRCODE='P0001'; END IF;
   IF (SELECT count(*) FROM bookings b JOIN users u ON u.id=b.user_id WHERE b.online_payment_required AND b.created_at>clock_timestamp()-interval '1 hour' AND (b.user_id=NEW.user_id OR (u.phone IS NOT NULL AND regexp_replace(regexp_replace(u.phone,'[^0-9]','','g'),'^84','0')=(SELECT regexp_replace(regexp_replace(phone,'[^0-9]','','g'),'^84','0') FROM users WHERE id=NEW.user_id)))) >= 10 THEN RAISE EXCEPTION 'HOLD_LIMIT' USING ERRCODE='P0001'; END IF;
   IF NEW.client_ip_hash IS NOT NULL AND ((SELECT count(*) FROM bookings WHERE online_payment_required AND status='PENDING' AND client_ip_hash=NEW.client_ip_hash)>=5 OR (SELECT count(*) FROM bookings WHERE online_payment_required AND client_ip_hash=NEW.client_ip_hash AND created_at>clock_timestamp()-interval '1 hour')>=30) THEN RAISE EXCEPTION 'HOLD_LIMIT' USING ERRCODE='P0001'; END IF;
   NEW.hold_expires_at:=clock_timestamp()+interval '15 minutes'; NEW.hold_state:='ACTIVE';
  ELSE NEW.hold_expires_at:=NULL; NEW.hold_state:=NULL; END IF;
 ELSE
  IF NEW.hold_expires_at IS DISTINCT FROM OLD.hold_expires_at OR NEW.client_ip_hash IS DISTINCT FROM OLD.client_ip_hash THEN RAISE EXCEPTION 'Hold deadline and source are immutable' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER initialize_booking_hold BEFORE INSERT OR UPDATE ON hotel.bookings FOR EACH ROW EXECUTE FUNCTION hotel.initialize_booking_hold();
ALTER TABLE hotel.bookings ADD CONSTRAINT booking_hold_state CHECK(hold_state IS NULL OR hold_state IN ('ACTIVE','CHECKING_PAYMENT','EXPIRED','PAID'));
CREATE OR REPLACE FUNCTION hotel.guard_booking() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE r rooms; t room_types; u users; today date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Booking history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDING' THEN RAISE EXCEPTION 'Booking must start PENDING' USING ERRCODE='23514'; END IF;
    SELECT * INTO u FROM users WHERE id=NEW.user_id FOR SHARE;
    IF NOT FOUND OR u.role <> 'GUEST' OR u.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Active guest required' USING ERRCODE='23514'; END IF;
    SELECT * INTO r FROM rooms WHERE id=NEW.room_id FOR SHARE;
    IF NOT FOUND OR r.operational_status <> 'ACTIVE' THEN RAISE EXCEPTION 'Active room required' USING ERRCODE='23514'; END IF;
    SELECT * INTO t FROM room_types WHERE id=r.room_type_id FOR SHARE;
    IF NEW.guest_count > t.max_guests THEN RAISE EXCEPTION 'Capacity exceeded' USING ERRCODE='23514'; END IF;
    IF NEW.nightly_price < 0 THEN RAISE EXCEPTION 'Negative nightly price' USING ERRCODE='23514'; END IF;
    NEW.nightly_price := t.nightly_price;
    NEW.total_room_amount := (NEW.check_out_date - NEW.check_in_date) * NEW.nightly_price;
  ELSE
    IF ROW(NEW.id,NEW.reference,NEW.user_id,NEW.room_id,NEW.check_in_date,NEW.check_out_date,NEW.guest_count,NEW.nightly_price,NEW.total_room_amount,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.reference,OLD.user_id,OLD.room_id,OLD.check_in_date,OLD.check_out_date,OLD.guest_count,OLD.nightly_price,OLD.total_room_amount,OLD.created_at)
      THEN RAISE EXCEPTION 'Booking identity, dates and price snapshots are immutable; cancel and rebook' USING ERRCODE='23514'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      (OLD.status='PENDING' AND NEW.status IN ('CONFIRMED','CANCELLED')) OR
      (OLD.status='CONFIRMED' AND NEW.status IN ('CHECKED_IN','CANCELLED')) OR
      (OLD.status='CHECKED_IN' AND NEW.status='CHECKED_OUT') OR
      (OLD.status='CANCELLED' AND NEW.status='CONFIRMED' AND OLD.hold_state='EXPIRED' AND NEW.online_payment_required AND
        EXISTS(SELECT 1 FROM booking_payments WHERE booking_id=NEW.id AND status='COMPLETED' AND amount=NEW.total_room_amount)))
      THEN RAISE EXCEPTION 'Invalid booking transition' USING ERRCODE='23514'; END IF;
    IF OLD.status <> NEW.status AND NEW.status='CHECKED_IN' THEN
      SELECT * INTO r FROM rooms WHERE id=NEW.room_id FOR UPDATE;
      SELECT * INTO u FROM users WHERE id=NEW.user_id FOR SHARE;
      IF r.operational_status <> 'ACTIVE' OR r.housekeeping_status <> 'CLEAN' OR u.status <> 'ACTIVE'
        OR today < NEW.check_in_date OR today >= NEW.check_out_date
        OR EXISTS (SELECT 1 FROM housekeeping_tasks WHERE room_id=r.id AND status <> 'DONE')
        THEN RAISE EXCEPTION 'Check-in requires active guest, active clean room, no open task and current stay date' USING ERRCODE='23514'; END IF;
    END IF;
    IF OLD.status <> NEW.status AND NEW.status='CHECKED_OUT' THEN
      IF NOT EXISTS (SELECT 1 FROM invoices WHERE booking_id=NEW.id) THEN RAISE EXCEPTION 'Checkout requires final invoice in same transaction' USING ERRCODE='23514'; END IF;
      UPDATE rooms SET housekeeping_status='DIRTY' WHERE id=NEW.room_id;
      INSERT INTO housekeeping_tasks(id, room_id, notes) VALUES(gen_random_uuid(), NEW.room_id, 'Check-out cleaning')
        ON CONFLICT (room_id) WHERE status <> 'DONE' DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION hotel.guard_booking_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=hotel,public AS $$
DECLARE b bookings;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment history cannot be deleted' USING ERRCODE='23514'; END IF;
  SELECT * INTO b FROM bookings WHERE id=NEW.booking_id FOR UPDATE;
  IF TG_OP='INSERT' THEN
    IF NOT FOUND OR NOT b.online_payment_required OR b.status<>'PENDING' OR NEW.status<>'PENDING' OR NEW.amount<>b.total_room_amount THEN
      RAISE EXCEPTION 'Online payment requires full room amount on pending booking' USING ERRCODE='23514';
    END IF;
  ELSE
    IF (OLD.status='COMPLETED' AND NEW.status<>'COMPLETED') OR (OLD.status='FAILED' AND NEW.status NOT IN ('FAILED','COMPLETED')) OR ROW(NEW.id,NEW.booking_id,NEW.amount,NEW.payos_order_code) IS DISTINCT FROM ROW(OLD.id,OLD.booking_id,OLD.amount,OLD.payos_order_code) THEN
      RAISE EXCEPTION 'Booking payment immutable except pending outcome' USING ERRCODE='23514';
    END IF;
    IF NEW.status='COMPLETED' AND OLD.status<>'COMPLETED' AND NOT (b.status='PENDING' OR (b.status='CANCELLED' AND b.hold_state='EXPIRED')) THEN RAISE EXCEPTION 'Booking no longer pending' USING ERRCODE='23514'; END IF;
  END IF;
  NEW.paid_at := CASE WHEN NEW.status='COMPLETED' THEN COALESCE(OLD.paid_at,clock_timestamp()) ELSE NULL END;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION hotel.confirm_paid_booking() RETURNS trigger LANGUAGE plpgsql SET search_path=hotel,public AS $$
BEGIN
 IF NEW.status='COMPLETED' AND OLD.status<>'COMPLETED' THEN
  UPDATE bookings SET status='CONFIRMED',hold_state='PAID' WHERE id=NEW.booking_id AND (status='PENDING' OR (status='CANCELLED' AND hold_state='EXPIRED'));
 END IF;
 RETURN NULL;
END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hotel_runtime') THEN
  GRANT UPDATE(hold_state,payment_check_at) ON hotel.bookings TO hotel_runtime;
  GRANT UPDATE(received_amount,review_reason,review_resolved_at,refund_reference,resolved_by_id) ON hotel.booking_payments TO hotel_runtime;
 END IF;
END $$;
COMMIT;
