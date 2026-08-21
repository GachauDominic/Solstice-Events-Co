-- Run this after the initial drizzle-kit generated migration
-- (drizzle-kit generate produces the base CREATE TABLE statements for
-- schema.ts; this partial index is the actual duplicate-scan guarantee
-- and is written by hand because drizzle-kit does not emit partial
-- indexes from the schema DSL).
--
-- At most one PENDING or CONFIRMED check-in row may exist per attendee
-- at any time. A second concurrent scan attempt's INSERT will violate
-- this and fail with Postgres error 23505, which app/api/checkin/route.ts
-- catches and turns into "already pending / already checked in" instead
-- of a second print job.
CREATE UNIQUE INDEX IF NOT EXISTS one_active_checkin_per_attendee
  ON check_ins (attendee_id)
  WHERE status IN ('PENDING', 'CONFIRMED');
