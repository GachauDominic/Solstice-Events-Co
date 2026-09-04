ALTER TABLE attendees
ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone;