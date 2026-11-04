BEGIN;
-- Unpaid transfer attempts are not reception orders and must not block billing.
DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('hotel.guard_invoice()'::regprocedure) INTO definition;
 definition := replace(definition,
   $$booking_id=b.id AND status='PENDING'$$,
   $$booking_id=b.id AND status='PENDING' AND (requested_payment_method IS DISTINCT FROM 'BANK_TRANSFER'::hotel."PaymentMethod" OR payment_method IS NOT NULL)$$);
 EXECUTE definition;
 SELECT pg_get_functiondef('hotel.guard_paid_checkout()'::regprocedure) INTO definition;
 definition := replace(definition,
   $$booking_id=NEW.id AND (status='PENDING'$$,
   $$booking_id=NEW.id AND (requested_payment_method IS DISTINCT FROM 'BANK_TRANSFER'::hotel."PaymentMethod" OR payment_method IS NOT NULL) AND (status='PENDING'$$);
 EXECUTE definition;
END $migration$;
COMMIT;
