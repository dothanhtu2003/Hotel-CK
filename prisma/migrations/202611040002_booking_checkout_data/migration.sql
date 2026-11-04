ALTER TABLE hotel.booking_payments ADD COLUMN checkout_data JSONB;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hotel_runtime') THEN
  GRANT UPDATE(checkout_data) ON hotel.booking_payments TO hotel_runtime;
 END IF;
END $$;
