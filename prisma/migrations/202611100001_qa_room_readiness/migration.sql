BEGIN;
-- Serialize same-day web arrivals with reception check-in/room-condition changes.
CREATE FUNCTION hotel.guard_web_arrival_readiness() RETURNS trigger
LANGUAGE plpgsql SET search_path=hotel,public AS $$
DECLARE r rooms;
BEGIN
 IF NEW.online_payment_required AND NEW.created_by_id IS NULL
 AND NEW.check_in_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
  SELECT * INTO r FROM rooms WHERE id=NEW.room_id FOR UPDATE;
  IF FOUND AND (r.housekeeping_status<>'CLEAN'
    OR EXISTS(SELECT 1 FROM housekeeping_tasks WHERE room_id=NEW.room_id AND status<>'DONE')
    OR EXISTS(SELECT 1 FROM bookings WHERE room_id=NEW.room_id AND status='CHECKED_IN')) THEN
   RAISE EXCEPTION 'Room is not ready for arrival today' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER aaa_web_arrival_readiness BEFORE INSERT ON hotel.bookings
FOR EACH ROW EXECUTE FUNCTION hotel.guard_web_arrival_readiness();
REVOKE ALL ON FUNCTION hotel.guard_web_arrival_readiness() FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hotel_runtime') THEN
  GRANT SELECT,INSERT ON hotel.stay_segments,hotel.stay_extensions,hotel.room_status_changes TO hotel_runtime;
  GRANT UPDATE(ended_at,end_date) ON hotel.stay_segments TO hotel_runtime;
  GRANT UPDATE(room_id,current_room_since,check_out_date,total_room_amount) ON hotel.bookings TO hotel_runtime;
  GRANT UPDATE(operational_status) ON hotel.rooms TO hotel_runtime;
  GRANT UPDATE(manual_completed_by) ON hotel.housekeeping_tasks TO hotel_runtime;
  GRANT UPDATE(checkout_data) ON hotel.booking_payments TO hotel_runtime;
 END IF;
END $$;
COMMIT;
