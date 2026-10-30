BEGIN;
ALTER TABLE hotel.housekeeping_tasks ADD COLUMN manual_completed_by uuid;
ALTER TABLE hotel.housekeeping_tasks ADD CONSTRAINT housekeeping_tasks_manual_completed_by_fkey
  FOREIGN KEY (manual_completed_by) REFERENCES hotel.users(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE hotel.housekeeping_tasks ADD CONSTRAINT manual_completion_requires_done
  CHECK (manual_completed_by IS NULL OR status='DONE');

CREATE TABLE hotel.room_status_changes (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES hotel.rooms(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  actor_id uuid NOT NULL REFERENCES hotel.users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  condition varchar(20) NOT NULL CHECK (condition IN ('CLEAN','MAINTENANCE')),
  previous_operational_status hotel."OperationalStatus" NOT NULL,
  previous_housekeeping_status hotel."HousekeepingStatus" NOT NULL,
  completed_task_ids uuid[] NOT NULL,
  note varchar(500),
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX room_status_changes_room_id_created_at_idx ON hotel.room_status_changes(room_id, created_at);

CREATE OR REPLACE FUNCTION hotel.guard_task() RETURNS trigger LANGUAGE plpgsql SET search_path = hotel, public AS $$
DECLARE staff users; rid uuid; manual_completion boolean;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Task history cannot be deleted' USING ERRCODE='23514'; END IF;
  rid := NEW.room_id;
  PERFORM 1 FROM rooms WHERE id=rid FOR UPDATE;
  manual_completion := TG_OP='UPDATE' AND NEW.status='DONE' AND NEW.manual_completed_by IS NOT NULL;
  IF manual_completion THEN
    SELECT * INTO staff FROM users WHERE id=NEW.manual_completed_by FOR SHARE;
    IF NOT FOUND OR staff.role NOT IN ('RECEPTIONIST','ADMIN') OR staff.status <> 'ACTIVE'
      THEN RAISE EXCEPTION 'Active front desk staff required for manual completion' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.assigned_staff_id IS NOT NULL AND NOT manual_completion THEN
    SELECT * INTO staff FROM users WHERE id=NEW.assigned_staff_id FOR SHARE;
    IF NOT FOUND OR staff.role <> 'HOUSEKEEPING' OR staff.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Active housekeeping staff required' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status <> 'TODO' OR NEW.manual_completed_by IS NOT NULL THEN RAISE EXCEPTION 'Task must start TODO' USING ERRCODE='23514'; END IF;
  ELSE
    IF ROW(NEW.id,NEW.room_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.room_id,OLD.created_at) OR OLD.status='DONE'
      THEN RAISE EXCEPTION 'Task identity or completed task is immutable' USING ERRCODE='23514'; END IF;
    IF NEW.status <> OLD.status AND NOT ((OLD.status='TODO' AND NEW.status='IN_PROGRESS') OR (OLD.status='IN_PROGRESS' AND NEW.status='DONE') OR (OLD.status='TODO' AND manual_completion))
      THEN RAISE EXCEPTION 'Invalid task transition' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.status='IN_PROGRESS' AND NEW.assigned_staff_id IS NULL THEN RAISE EXCEPTION 'Assign staff before cleaning' USING ERRCODE='23514'; END IF;
  NEW.completed_at := CASE WHEN NEW.status='DONE' THEN clock_timestamp() ELSE NULL END;
  RETURN NEW;
END $$;
COMMIT;
