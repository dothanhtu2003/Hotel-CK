ALTER TABLE hotel.bookings ADD COLUMN created_by_id uuid REFERENCES hotel.users(id) ON DELETE RESTRICT;
CREATE INDEX bookings_created_by_idx ON hotel.bookings(created_by_id);
CREATE FUNCTION hotel.guard_booking_creator() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
BEGIN
 IF TG_OP = 'INSERT' AND NEW.created_by_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.created_by_id AND role IN ('RECEPTIONIST','ADMIN') AND status='ACTIVE') THEN
 RAISE EXCEPTION 'Active front desk creator required' USING ERRCODE='23514';
 END IF;
 IF TG_OP = 'UPDATE' AND NEW.created_by_id IS DISTINCT FROM OLD.created_by_id THEN
 RAISE EXCEPTION 'Booking creator is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_booking_creator BEFORE INSERT OR UPDATE ON hotel.bookings FOR EACH ROW EXECUTE FUNCTION hotel.guard_booking_creator();
