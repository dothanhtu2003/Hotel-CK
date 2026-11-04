BEGIN;
DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('hotel.guard_booking()'::regprocedure) INTO definition;
 definition := replace(definition,
 $$THEN RAISE EXCEPTION 'Booking identity, dates and price snapshots are immutable; cancel and rebook'$$,
 $$AND NOT (
 OLD.status='CHECKED_IN' AND NEW.status='CHECKED_IN'
 AND NEW.check_out_date > OLD.check_out_date
 AND NOT EXISTS (SELECT 1 FROM hotel.invoices WHERE booking_id=OLD.id)
 AND ROW(NEW.id,NEW.reference,NEW.user_id,NEW.room_id,NEW.check_in_date,NEW.guest_count,NEW.nightly_price,NEW.created_at)
 IS NOT DISTINCT FROM ROW(OLD.id,OLD.reference,OLD.user_id,OLD.room_id,OLD.check_in_date,OLD.guest_count,OLD.nightly_price,OLD.created_at)
 AND NEW.total_room_amount=OLD.total_room_amount+(NEW.check_out_date-OLD.check_out_date)*OLD.nightly_price
 ) THEN RAISE EXCEPTION 'Booking identity, dates and price snapshots are immutable; cancel and rebook'$$);
 EXECUTE definition;
END $migration$;
COMMIT;
