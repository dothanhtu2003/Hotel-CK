-- Match the existing private hotel schema: access is controlled by explicit backend grants.
-- Invoker triggers must also work for the restricted, non-owner runtime role.
ALTER TABLE hotel.booking_payments DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON hotel.booking_payments FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hotel_runtime') THEN
    GRANT SELECT,INSERT ON hotel.booking_payments TO hotel_runtime;
    GRANT UPDATE(status,checkout_url) ON hotel.booking_payments TO hotel_runtime;
    GRANT UPDATE(status,checkout_url) ON hotel.payments TO hotel_runtime;
  END IF;
END $$;
