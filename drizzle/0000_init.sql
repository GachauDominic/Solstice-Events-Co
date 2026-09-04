-- Solstice Events Co. — Kiosk check-in schema
-- Run via `pnpm db:migrate` (dev) — see db/migrate.ts

CREATE TYPE "attendee_status" AS ENUM ('not_checked_in', 'pending', 'checked_in');
CREATE TYPE "print_job_status" AS ENUM ('queued', 'printing', 'succeeded', 'failed');

-- Extend with ALTER TYPE attendee_role ADD VALUE 'xxx' as new badge types
-- are needed. Kept as a curated enum (not free text) since role can drive
-- print template / access level downstream.
CREATE TYPE "attendee_role" AS ENUM ('host', 'guest', 'attendee', 'staff', 'speaker', 'organizer');

CREATE TABLE "attendees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "first_name" varchar(128) NOT NULL,
  "last_name" varchar(128) NOT NULL,
  "contact" varchar(256) NOT NULL,
  "role" attendee_role NOT NULL,
  "qr_token" varchar(64) NOT NULL,
  "revoked_at" timestamptz,
  "status" attendee_status NOT NULL DEFAULT 'not_checked_in',
  "current_print_job_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "attendees_qr_token_unique" ON "attendees" ("qr_token");

CREATE TABLE "print_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "attendee_id" uuid NOT NULL REFERENCES "attendees"("id") ON DELETE CASCADE,
  "status" print_job_status NOT NULL DEFAULT 'queued',
  "idempotency_key" uuid NOT NULL DEFAULT gen_random_uuid(),
  "vendor_job_id" varchar(256),
  "failure_reason" varchar(512),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "print_jobs_idempotency_key_unique" ON "print_jobs" ("idempotency_key");
CREATE INDEX "print_jobs_attendee_id_idx" ON "print_jobs" ("attendee_id");

-- THE CORE DUPLICATE-SCAN GUARD.
-- An attendee may have at most one print job that is queued, printing, or
-- succeeded at any time. Only 'failed' rows are excluded, so a failed print
-- can be retried with a brand-new job row. Enforced by Postgres at commit
-- time regardless of how many kiosk instances/requests race concurrently.
CREATE UNIQUE INDEX "one_active_job_per_attendee"
  ON "print_jobs" ("attendee_id")
  WHERE "status" IN ('queued', 'printing', 'succeeded');

ALTER TABLE "attendees"
  ADD CONSTRAINT "attendees_current_print_job_fk"
  FOREIGN KEY ("current_print_job_id") REFERENCES "print_jobs"("id") ON DELETE SET NULL;
