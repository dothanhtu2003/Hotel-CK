BEGIN;
-- Permit verified expiry of unpaid guest transfers after a stay has ended.
DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('hotel.guard_order()'::regprocedure) INTO definition;
 definition := replace(definition,
   $$IF NOT FOUND OR b.status <> 'CHECKED_IN' OR$$,
   $$IF NOT FOUND OR (b.status <> 'CHECKED_IN' AND NOT (
     TG_OP='UPDATE' AND OLD.status='PENDING' AND NEW.status='CANCELLED'
     AND OLD.requested_payment_method='BANK_TRANSFER' AND OLD.payment_method IS NULL
     AND NEW.payment_method IS NULL AND NEW.payos_status='CLOSED'
   )) OR$$);
 EXECUTE definition;
END $migration$;
COMMIT;
