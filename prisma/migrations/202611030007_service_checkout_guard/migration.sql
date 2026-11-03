CREATE OR REPLACE FUNCTION hotel.guard_paid_checkout() RETURNS trigger
LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE invoice_status "InvoiceStatus";
BEGIN
 SELECT status INTO invoice_status FROM invoices WHERE booking_id=NEW.id FOR UPDATE;
 IF NOT FOUND OR invoice_status <> 'PAID' THEN RAISE EXCEPTION 'Checkout requires a fully paid invoice' USING ERRCODE='23514'; END IF;
 IF EXISTS (SELECT 1 FROM service_orders WHERE booking_id=NEW.id AND (status='PENDING' OR (requested_payment_method IS NOT NULL AND payment_method IS NULL AND status <> 'CANCELLED')))
 THEN RAISE EXCEPTION 'Resolve unpaid service orders before checkout' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
