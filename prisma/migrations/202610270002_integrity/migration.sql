BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
SET LOCAL search_path = hotel, public, extensions;

ALTER TABLE users ADD CONSTRAINT users_name_nonempty CHECK (length(trim(full_name)) > 0),
  ADD CONSTRAINT users_email_normalized CHECK (email = lower(trim(email)) AND email LIKE '%_@_%._%'),
  ADD CONSTRAINT users_password_hash CHECK (password_hash ~ '^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$' OR password_hash ~ '^\$argon2id\$' OR password_hash ~ '^\$2[aby]\$');
ALTER TABLE room_types ADD CONSTRAINT room_type_values CHECK (nightly_price >= 0 AND max_guests > 0 AND length(trim(name)) > 0);
ALTER TABLE rooms ADD CONSTRAINT room_number_nonempty CHECK (length(trim(room_number)) > 0);
ALTER TABLE room_images ADD CONSTRAINT image_values CHECK (secure_url ~ '^https://res\.cloudinary\.com/[^/]+/image/' AND length(trim(public_id)) > 0 AND display_order >= 0);
CREATE UNIQUE INDEX room_images_one_primary ON room_images(room_id) WHERE is_primary;
ALTER TABLE bookings ADD CONSTRAINT booking_values CHECK (check_out_date > check_in_date AND guest_count > 0 AND nightly_price >= 0 AND total_room_amount >= 0),
  ADD CONSTRAINT booking_room_math CHECK (total_room_amount = (check_out_date - check_in_date) * nightly_price),
  ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist
    (room_id WITH =, daterange(check_in_date, check_out_date, '[)') WITH &&)
    WHERE (status IN ('PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT'));
CREATE UNIQUE INDEX bookings_one_checked_in_per_room ON bookings(room_id) WHERE status = 'CHECKED_IN';
ALTER TABLE services ADD CONSTRAINT service_values CHECK (current_price >= 0 AND length(trim(name)) > 0);
ALTER TABLE service_orders ADD CONSTRAINT order_amount_nonnegative CHECK (total_amount >= 0);
ALTER TABLE service_order_items ADD CONSTRAINT item_values CHECK (quantity > 0 AND unit_price >= 0 AND subtotal >= 0 AND subtotal = quantity * unit_price);
CREATE UNIQUE INDEX housekeeping_one_open_task ON housekeeping_tasks(room_id) WHERE status <> 'DONE';
ALTER TABLE housekeeping_tasks ADD CONSTRAINT task_completion CHECK ((status = 'DONE') = (completed_at IS NOT NULL));
ALTER TABLE invoices ADD CONSTRAINT invoice_values CHECK (room_amount >= 0 AND service_amount >= 0 AND total_amount >= 0 AND total_amount = room_amount + service_amount);
ALTER TABLE payments ADD CONSTRAINT payment_values CHECK (amount > 0 AND ((status = 'COMPLETED') = (paid_at IS NOT NULL)));

CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER touch_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_room_types BEFORE UPDATE ON room_types FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_rooms BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER touch_bookings BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE FUNCTION guard_booking() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE r rooms; t room_types; u users; today date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Booking history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDING' THEN RAISE EXCEPTION 'Booking must start PENDING' USING ERRCODE='23514'; END IF;
    SELECT * INTO u FROM users WHERE id=NEW.user_id FOR SHARE;
    IF NOT FOUND OR u.role <> 'GUEST' OR u.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Active guest required' USING ERRCODE='23514'; END IF;
    SELECT * INTO r FROM rooms WHERE id=NEW.room_id FOR SHARE;
    IF NOT FOUND OR r.operational_status <> 'ACTIVE' THEN RAISE EXCEPTION 'Active room required' USING ERRCODE='23514'; END IF;
    SELECT * INTO t FROM room_types WHERE id=r.room_type_id FOR SHARE;
    IF NEW.guest_count > t.max_guests THEN RAISE EXCEPTION 'Capacity exceeded' USING ERRCODE='23514'; END IF;
    IF NEW.nightly_price < 0 THEN RAISE EXCEPTION 'Negative nightly price' USING ERRCODE='23514'; END IF;
    NEW.nightly_price := t.nightly_price;
    NEW.total_room_amount := (NEW.check_out_date - NEW.check_in_date) * NEW.nightly_price;
  ELSE
    IF ROW(NEW.id,NEW.reference,NEW.user_id,NEW.room_id,NEW.check_in_date,NEW.check_out_date,NEW.guest_count,NEW.nightly_price,NEW.total_room_amount,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.reference,OLD.user_id,OLD.room_id,OLD.check_in_date,OLD.check_out_date,OLD.guest_count,OLD.nightly_price,OLD.total_room_amount,OLD.created_at)
      THEN RAISE EXCEPTION 'Booking identity, dates and price snapshots are immutable; cancel and rebook' USING ERRCODE='23514'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      (OLD.status='PENDING' AND NEW.status IN ('CONFIRMED','CANCELLED')) OR
      (OLD.status='CONFIRMED' AND NEW.status IN ('CHECKED_IN','CANCELLED')) OR
      (OLD.status='CHECKED_IN' AND NEW.status='CHECKED_OUT'))
      THEN RAISE EXCEPTION 'Invalid booking transition' USING ERRCODE='23514'; END IF;
    IF OLD.status <> NEW.status AND NEW.status='CHECKED_IN' THEN
      SELECT * INTO r FROM rooms WHERE id=NEW.room_id FOR UPDATE;
      SELECT * INTO u FROM users WHERE id=NEW.user_id FOR SHARE;
      IF r.operational_status <> 'ACTIVE' OR r.housekeeping_status <> 'CLEAN' OR u.status <> 'ACTIVE'
        OR today < NEW.check_in_date OR today >= NEW.check_out_date
        OR EXISTS (SELECT 1 FROM housekeeping_tasks WHERE room_id=r.id AND status <> 'DONE')
        THEN RAISE EXCEPTION 'Check-in requires active guest, active clean room, no open task and current stay date' USING ERRCODE='23514'; END IF;
    END IF;
    IF OLD.status <> NEW.status AND NEW.status='CHECKED_OUT' THEN
      IF NOT EXISTS (SELECT 1 FROM invoices WHERE booking_id=NEW.id) THEN RAISE EXCEPTION 'Checkout requires final invoice in same transaction' USING ERRCODE='23514'; END IF;
      UPDATE rooms SET housekeeping_status='DIRTY' WHERE id=NEW.room_id;
      INSERT INTO housekeeping_tasks(id, room_id, notes) VALUES(gen_random_uuid(), NEW.room_id, 'Check-out cleaning')
        ON CONFLICT (room_id) WHERE status <> 'DONE' DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_bookings BEFORE INSERT OR UPDATE OR DELETE ON bookings FOR EACH ROW EXECUTE FUNCTION guard_booking();

CREATE FUNCTION guard_order() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE b bookings;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Cancel service orders instead of deleting' USING ERRCODE='23514'; END IF;
  SELECT * INTO b FROM bookings WHERE id=NEW.booking_id FOR UPDATE;
  IF NOT FOUND OR b.status <> 'CHECKED_IN' OR EXISTS(SELECT 1 FROM invoices WHERE booking_id=b.id)
    THEN RAISE EXCEPTION 'Service order requires checked-in, unbilled stay' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' AND NEW.status <> 'PENDING' THEN RAISE EXCEPTION 'Order must start PENDING' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.id,NEW.booking_id,NEW.ordered_at) IS DISTINCT FROM ROW(OLD.id,OLD.booking_id,OLD.ordered_at)
      OR OLD.status <> 'PENDING' THEN RAISE EXCEPTION 'Final order is immutable' USING ERRCODE='23514'; END IF;
  END IF;
  SELECT COALESCE(sum(subtotal),0) INTO NEW.total_amount FROM service_order_items WHERE service_order_id=NEW.id;
  IF NEW.status='COMPLETED' AND NOT EXISTS(SELECT 1 FROM service_order_items WHERE service_order_id=NEW.id)
    THEN RAISE EXCEPTION 'Cannot complete empty order' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_orders BEFORE INSERT OR UPDATE OR DELETE ON service_orders FOR EACH ROW EXECUTE FUNCTION guard_order();

CREATE FUNCTION guard_item() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE o service_orders; b bookings; s services; oid uuid;
BEGIN
  oid := CASE WHEN TG_OP='DELETE' THEN OLD.service_order_id ELSE NEW.service_order_id END;
  SELECT * INTO o FROM service_orders WHERE id=oid FOR UPDATE;
  IF NOT FOUND OR o.status <> 'PENDING' THEN RAISE EXCEPTION 'Items require pending order' USING ERRCODE='23514'; END IF;
  SELECT * INTO b FROM bookings WHERE id=o.booking_id FOR UPDATE;
  IF b.status <> 'CHECKED_IN' OR EXISTS(SELECT 1 FROM invoices WHERE booking_id=b.id)
    THEN RAISE EXCEPTION 'Stay already billed or not checked in' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_OP='INSERT' THEN
    SELECT * INTO s FROM services WHERE id=NEW.service_id FOR SHARE;
    IF NOT FOUND OR NOT s.is_active THEN RAISE EXCEPTION 'Active service required' USING ERRCODE='23514'; END IF;
    IF NEW.unit_price < 0 THEN RAISE EXCEPTION 'Negative unit price' USING ERRCODE='23514'; END IF;
    NEW.unit_price := s.current_price;
  ELSIF ROW(NEW.id,NEW.service_order_id,NEW.service_id,NEW.unit_price) IS DISTINCT FROM ROW(OLD.id,OLD.service_order_id,OLD.service_id,OLD.unit_price)
    THEN RAISE EXCEPTION 'Item identity and snapshot are immutable' USING ERRCODE='23514'; END IF;
  NEW.subtotal := NEW.quantity * NEW.unit_price;
  RETURN NEW;
END $$;
CREATE FUNCTION sum_order() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
BEGIN
  UPDATE service_orders SET total_amount=total_amount WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.service_order_id ELSE NEW.service_order_id END;
  RETURN NULL;
END $$;
CREATE TRIGGER guard_items BEFORE INSERT OR UPDATE OR DELETE ON service_order_items FOR EACH ROW EXECUTE FUNCTION guard_item();
CREATE TRIGGER sum_items AFTER INSERT OR UPDATE OR DELETE ON service_order_items FOR EACH ROW EXECUTE FUNCTION sum_order();

CREATE FUNCTION guard_task() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE staff users; rid uuid;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Task history cannot be deleted' USING ERRCODE='23514'; END IF;
  rid := NEW.room_id;
  PERFORM 1 FROM rooms WHERE id=rid FOR UPDATE;
  IF NEW.assigned_staff_id IS NOT NULL THEN
    SELECT * INTO staff FROM users WHERE id=NEW.assigned_staff_id FOR SHARE;
    IF NOT FOUND OR staff.role <> 'HOUSEKEEPING' OR staff.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Active housekeeping staff required' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status <> 'TODO' THEN RAISE EXCEPTION 'Task must start TODO' USING ERRCODE='23514'; END IF;
  ELSE
    IF ROW(NEW.id,NEW.room_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.room_id,OLD.created_at) OR OLD.status='DONE'
      THEN RAISE EXCEPTION 'Task identity or completed task is immutable' USING ERRCODE='23514'; END IF;
    IF NEW.status <> OLD.status AND NOT ((OLD.status='TODO' AND NEW.status='IN_PROGRESS') OR (OLD.status='IN_PROGRESS' AND NEW.status='DONE'))
      THEN RAISE EXCEPTION 'Invalid task transition' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.status='IN_PROGRESS' AND NEW.assigned_staff_id IS NULL THEN RAISE EXCEPTION 'Assign staff before cleaning' USING ERRCODE='23514'; END IF;
  NEW.completed_at := CASE WHEN NEW.status='DONE' THEN clock_timestamp() ELSE NULL END;
  RETURN NEW;
END $$;
CREATE FUNCTION sync_task_room() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
BEGIN
  UPDATE rooms SET housekeeping_status=CASE NEW.status WHEN 'TODO' THEN 'DIRTY'::"HousekeepingStatus" WHEN 'IN_PROGRESS' THEN 'CLEANING'::"HousekeepingStatus" ELSE 'CLEAN'::"HousekeepingStatus" END WHERE id=NEW.room_id;
  RETURN NULL;
END $$;
CREATE TRIGGER guard_tasks BEFORE INSERT OR UPDATE OR DELETE ON housekeeping_tasks FOR EACH ROW EXECUTE FUNCTION guard_task();
CREATE TRIGGER sync_tasks AFTER INSERT OR UPDATE ON housekeeping_tasks FOR EACH ROW EXECUTE FUNCTION sync_task_room();

CREATE FUNCTION guard_room_cleanliness() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE expected "HousekeepingStatus";
BEGIN
  SELECT CASE status WHEN 'TODO' THEN 'DIRTY'::"HousekeepingStatus" ELSE 'CLEANING'::"HousekeepingStatus" END INTO expected
    FROM housekeeping_tasks WHERE room_id=NEW.id AND status <> 'DONE';
  IF FOUND AND NEW.housekeeping_status <> expected THEN RAISE EXCEPTION 'Room cleanliness must match open task' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_room_cleanliness BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION guard_room_cleanliness();

CREATE FUNCTION guard_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE b bookings; paid numeric;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Invoice history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    SELECT * INTO b FROM bookings WHERE id=NEW.booking_id FOR UPDATE;
    IF NOT FOUND OR b.status <> 'CHECKED_IN' THEN RAISE EXCEPTION 'Invoice requires checked-in booking' USING ERRCODE='23514'; END IF;
    IF EXISTS(SELECT 1 FROM service_orders WHERE booking_id=b.id AND status='PENDING') THEN RAISE EXCEPTION 'Resolve pending orders before checkout' USING ERRCODE='23514'; END IF;
    NEW.room_amount := b.total_room_amount;
    SELECT COALESCE(sum(i.subtotal),0) INTO NEW.service_amount FROM service_order_items i JOIN service_orders o ON o.id=i.service_order_id WHERE o.booking_id=b.id AND o.status='COMPLETED';
    NEW.total_amount := NEW.room_amount + NEW.service_amount;
    NEW.status := CASE WHEN NEW.total_amount=0 THEN 'PAID'::"InvoiceStatus" ELSE 'ISSUED'::"InvoiceStatus" END;
  ELSE
    IF ROW(NEW.id,NEW.booking_id,NEW.room_amount,NEW.service_amount,NEW.total_amount,NEW.issued_at) IS DISTINCT FROM ROW(OLD.id,OLD.booking_id,OLD.room_amount,OLD.service_amount,OLD.total_amount,OLD.issued_at)
      THEN RAISE EXCEPTION 'Final invoice amounts are immutable' USING ERRCODE='23514'; END IF;
    SELECT COALESCE(sum(amount),0) INTO paid FROM payments WHERE invoice_id=NEW.id AND status='COMPLETED';
    NEW.status := CASE WHEN paid=NEW.total_amount THEN 'PAID'::"InvoiceStatus" ELSE 'ISSUED'::"InvoiceStatus" END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_invoices BEFORE INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION guard_invoice();
CREATE FUNCTION invoice_checkout_consistency() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM bookings WHERE id=NEW.booking_id AND status='CHECKED_OUT') THEN RAISE EXCEPTION 'Invoice and checkout must commit together' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER invoice_checkout_consistency AFTER INSERT ON invoices DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION invoice_checkout_consistency();

CREATE FUNCTION guard_payment() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE inv invoices; paid numeric;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Payment history cannot be deleted' USING ERRCODE='23514'; END IF;
  SELECT * INTO inv FROM invoices WHERE id=NEW.invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice required' USING ERRCODE='23503'; END IF;
  IF TG_OP='UPDATE' AND (OLD.status <> 'PENDING' OR ROW(NEW.id,NEW.invoice_id,NEW.amount,NEW.method) IS DISTINCT FROM ROW(OLD.id,OLD.invoice_id,OLD.amount,OLD.method))
    THEN RAISE EXCEPTION 'Payment immutable except pending outcome' USING ERRCODE='23514'; END IF;
  IF NEW.status='COMPLETED' THEN
    SELECT COALESCE(sum(amount),0) INTO paid FROM payments WHERE invoice_id=NEW.invoice_id AND status='COMPLETED' AND id<>NEW.id;
    IF paid + NEW.amount > inv.total_amount THEN RAISE EXCEPTION 'Payment exceeds outstanding balance' USING ERRCODE='23514'; END IF;
    NEW.paid_at := clock_timestamp();
  ELSE NEW.paid_at := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION sync_payment_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
BEGIN UPDATE invoices SET status=status WHERE id=NEW.invoice_id; RETURN NULL; END $$;
CREATE TRIGGER guard_payments BEFORE INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION guard_payment();
CREATE TRIGGER sync_payments AFTER INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION sync_payment_invoice();

-- Internal schema: application users cannot access these tables through Supabase Data API.
REVOKE ALL ON SCHEMA hotel FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA hotel FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hotel FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA hotel FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA hotel FROM %I',role_name);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hotel FROM %I',role_name);
    END IF;
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA hotel REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
COMMIT;
