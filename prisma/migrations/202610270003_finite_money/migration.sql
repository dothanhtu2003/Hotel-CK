BEGIN;
-- PostgreSQL NUMERIC considers NaN greater than every finite value, including Infinity.
-- >= 0 alone therefore does not reject NaN. Monetary values must also be finite.
ALTER TABLE hotel.room_types ADD CONSTRAINT room_price_finite CHECK (nightly_price < 'Infinity'::numeric);
ALTER TABLE hotel.bookings ADD CONSTRAINT booking_prices_finite CHECK (nightly_price < 'Infinity'::numeric AND total_room_amount < 'Infinity'::numeric),
  ADD CONSTRAINT booking_reference_nonempty CHECK (length(trim(reference)) > 0);
ALTER TABLE hotel.services ADD CONSTRAINT service_price_finite CHECK (current_price < 'Infinity'::numeric);
ALTER TABLE hotel.service_orders ADD CONSTRAINT order_total_finite CHECK (total_amount < 'Infinity'::numeric);
ALTER TABLE hotel.service_order_items ADD CONSTRAINT item_prices_finite CHECK (unit_price < 'Infinity'::numeric AND subtotal < 'Infinity'::numeric);
ALTER TABLE hotel.invoices ADD CONSTRAINT invoice_amounts_finite CHECK (room_amount < 'Infinity'::numeric AND service_amount < 'Infinity'::numeric AND total_amount < 'Infinity'::numeric);
ALTER TABLE hotel.payments ADD CONSTRAINT payment_amount_finite CHECK (amount < 'Infinity'::numeric);
COMMIT;
