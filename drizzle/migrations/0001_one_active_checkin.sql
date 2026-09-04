CREATE UNIQUE INDEX IF NOT EXISTS one_active_checkin_per_attendee
  ON check_ins (attendee_id)
  WHERE status IN ('PENDING', 'CONFIRMED');
