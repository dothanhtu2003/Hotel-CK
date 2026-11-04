BEGIN;
ALTER TABLE hotel.bookings ADD COLUMN current_room_since date;
CREATE TABLE hotel.stay_segments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES hotel.bookings(id), room_id uuid NOT NULL REFERENCES hotel.rooms(id),
 started_at timestamptz(3) NOT NULL, ended_at timestamptz(3), start_date date NOT NULL, end_date date NOT NULL,
 estimated_start boolean NOT NULL DEFAULT false,
 CHECK(end_date >= start_date), CHECK(ended_at IS NULL OR ended_at >= started_at)
);
CREATE UNIQUE INDEX stay_segments_one_open ON hotel.stay_segments(booking_id) WHERE ended_at IS NULL;
CREATE INDEX stay_segments_booking_id_started_at_idx ON hotel.stay_segments(booking_id,started_at);
CREATE INDEX stay_segments_room_id_start_date_end_date_idx ON hotel.stay_segments(room_id,start_date,end_date);
CREATE TABLE hotel.stay_extensions (
 id uuid PRIMARY KEY, booking_id uuid NOT NULL REFERENCES hotel.bookings(id), actor_id uuid NOT NULL REFERENCES hotel.users(id),
 old_room_id uuid NOT NULL REFERENCES hotel.rooms(id), new_room_id uuid NOT NULL REFERENCES hotel.rooms(id),
 old_check_out date NOT NULL, new_check_out date NOT NULL, room_since date,
 old_amount numeric(14,2) NOT NULL, new_amount numeric(14,2) NOT NULL,
 overdue_amount numeric(14,2) NOT NULL, extension_amount numeric(14,2) NOT NULL, price_difference numeric(14,2) NOT NULL,
 paid_before numeric(14,2) NOT NULL, created_at timestamptz(3) NOT NULL DEFAULT now(),
 CHECK(new_check_out > old_check_out), CHECK(new_amount=old_amount+overdue_amount+extension_amount+price_difference),
 CHECK(overdue_amount >= 0 AND extension_amount >= 0 AND paid_before >= 0)
);
CREATE INDEX stay_extensions_booking_id_created_at_idx ON hotel.stay_extensions(booking_id,created_at);
-- Old check-in timestamps were not recorded; retain the estimated flag explicitly.
INSERT INTO hotel.stay_segments(booking_id,room_id,started_at,ended_at,start_date,end_date,estimated_start)
 SELECT id,room_id,(check_in_date+time '14:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
 CASE WHEN status='CHECKED_OUT' THEN GREATEST(updated_at,(check_in_date+time '14:00') AT TIME ZONE 'Asia/Ho_Chi_Minh') ELSE NULL END,
 check_in_date,check_out_date,true FROM hotel.bookings WHERE status IN ('CHECKED_IN','CHECKED_OUT');
ALTER TABLE hotel.bookings DROP CONSTRAINT booking_room_math;
ALTER TABLE hotel.bookings DROP CONSTRAINT bookings_no_overlap;
ALTER TABLE hotel.bookings ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist
 (room_id WITH =, daterange(COALESCE(current_room_since,check_in_date),check_out_date,'[)') WITH &&)
 WHERE(status IN ('PENDING','CONFIRMED','CHECKED_IN')); 
DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('hotel.guard_booking()'::regprocedure) INTO definition;
 definition := replace(definition,
 $$THEN RAISE EXCEPTION 'Booking identity, dates and price snapshots are immutable; cancel and rebook'$$,
 $$AND NOT EXISTS (SELECT 1 FROM stay_extensions e WHERE e.booking_id=OLD.id
 AND OLD.status='CHECKED_IN' AND NEW.status='CHECKED_IN'
 AND NOT EXISTS(SELECT 1 FROM invoices WHERE booking_id=OLD.id)
 AND e.old_room_id=OLD.room_id AND e.new_room_id=NEW.room_id
 AND e.old_check_out=OLD.check_out_date AND e.new_check_out=NEW.check_out_date
 AND e.old_amount=OLD.total_room_amount AND e.new_amount=NEW.total_room_amount
 AND e.room_since IS NOT DISTINCT FROM NEW.current_room_since
 AND ROW(NEW.id,NEW.reference,NEW.user_id,NEW.check_in_date,NEW.guest_count,NEW.nightly_price,NEW.created_at)
 IS NOT DISTINCT FROM ROW(OLD.id,OLD.reference,OLD.user_id,OLD.check_in_date,OLD.guest_count,OLD.nightly_price,OLD.created_at)
 ) THEN RAISE EXCEPTION 'Booking identity, dates and price snapshots are immutable; cancel and rebook'$$);
 EXECUTE definition;
END $migration$;
CREATE FUNCTION hotel.guard_stay_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='stay_extensions' OR TG_OP='DELETE' OR OLD.ended_at IS NOT NULL THEN
 RAISE EXCEPTION 'Stay history is immutable' USING ERRCODE='23514'; END IF;
 IF ROW(NEW.id,NEW.booking_id,NEW.room_id,NEW.started_at,NEW.start_date,NEW.estimated_start)
 IS DISTINCT FROM ROW(OLD.id,OLD.booking_id,OLD.room_id,OLD.started_at,OLD.start_date,OLD.estimated_start)
 THEN RAISE EXCEPTION 'Stay identity is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER stay_segments_audit BEFORE UPDATE OR DELETE ON hotel.stay_segments FOR EACH ROW EXECUTE FUNCTION hotel.guard_stay_audit();
CREATE TRIGGER stay_extensions_audit BEFORE UPDATE OR DELETE ON hotel.stay_extensions FOR EACH ROW EXECUTE FUNCTION hotel.guard_stay_audit();
CREATE FUNCTION hotel.record_actual_stay() RETURNS trigger LANGUAGE plpgsql SET search_path=hotel,public AS $$ BEGIN
 IF NEW.status='CHECKED_IN' AND OLD.status IS DISTINCT FROM NEW.status THEN
 INSERT INTO stay_segments(booking_id,room_id,started_at,start_date,end_date) VALUES(NEW.id,NEW.room_id,clock_timestamp(),NEW.check_in_date,NEW.check_out_date);
 ELSIF NEW.status='CHECKED_OUT' AND OLD.status='CHECKED_IN' THEN
 UPDATE stay_segments SET ended_at=clock_timestamp(), end_date=GREATEST(start_date,(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) WHERE booking_id=NEW.id AND ended_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER record_actual_stay AFTER UPDATE OF status ON hotel.bookings FOR EACH ROW EXECUTE FUNCTION hotel.record_actual_stay();
COMMIT;
