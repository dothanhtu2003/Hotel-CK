ALTER TABLE hotel.room_types ADD COLUMN bed_count integer NOT NULL DEFAULT 1;
ALTER TABLE hotel.room_types ADD CONSTRAINT room_type_bed_count_positive CHECK (bed_count > 0);
-- Initial configuration for the existing sample room categories.
UPDATE hotel.room_types SET bed_count = 2 WHERE name ~* '(Deluxe|Family|Suite)$';
