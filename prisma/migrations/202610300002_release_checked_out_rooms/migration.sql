BEGIN;
SET LOCAL search_path = hotel, public, extensions;
ALTER TABLE hotel.bookings DROP CONSTRAINT bookings_no_overlap;
ALTER TABLE hotel.bookings ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist
(room_id WITH =, daterange(check_in_date, check_out_date, '[)') WITH &&)
WHERE (status IN ('PENDING','CONFIRMED','CHECKED_IN'));
COMMIT;
