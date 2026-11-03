-- Existing self-service bookings still awaiting confirmation follow the new policy too.
-- Keep staff-created and previously confirmed stays on their original terms.
BEGIN;
ALTER TABLE hotel.bookings DISABLE TRIGGER guard_online_bookings;
UPDATE hotel.bookings b SET online_payment_required=true
WHERE b.status='PENDING' AND b.created_by_id IS NULL AND NOT b.online_payment_required
  AND NOT EXISTS (SELECT 1 FROM hotel.invoices i WHERE i.booking_id=b.id)
  AND NOT EXISTS (SELECT 1 FROM hotel.booking_payments p WHERE p.booking_id=b.id);
ALTER TABLE hotel.bookings ENABLE TRIGGER guard_online_bookings;
COMMIT;
