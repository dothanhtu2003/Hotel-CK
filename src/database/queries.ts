// $1 check-in date, $2 check-out date, $3 guest count; caller validates date strings.
// Exclusion constraint remains authoritative when inserting after this search.
export const availabilitySql = `
SELECT r.id,r.room_number,t.name,t.nightly_price,t.max_guests
FROM hotel.rooms r JOIN hotel.room_types t ON t.id=r.room_type_id
WHERE $1::date < $2::date AND $3::int > 0
  AND r.operational_status='ACTIVE' AND t.max_guests >= $3
  AND NOT EXISTS (
    SELECT 1 FROM hotel.bookings b
    WHERE b.room_id=r.id
      AND b.status IN ('PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT')
      AND daterange(b.check_in_date,b.check_out_date,'[)') && daterange($1::date,$2::date,'[)')
  )
ORDER BY t.nightly_price,r.room_number`;
