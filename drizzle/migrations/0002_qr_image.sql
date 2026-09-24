-- Persists the rendered QR badge image (PNG data URL) alongside the code
-- itself, so a badge can be downloaded/printed at any time after an
-- attendee is created, not just in the immediate creation response.
--
-- Nullable: existing rows created before this migration have no image on
-- file. app/api/attendees/[id]/qr/route.ts regenerates and backfills it
-- lazily on first access instead of requiring a blocking data migration.
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "qr_image" text;
