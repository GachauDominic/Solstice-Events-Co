DO $$ BEGIN
 CREATE TYPE "public"."attendee_status" AS ENUM('NOT_CHECKED_IN', 'PENDING', 'CHECKED_IN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."check_in_status" AS ENUM('PENDING', 'CONFIRMED', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qr_code" varchar(128) NOT NULL,
	"name" varchar(256) NOT NULL,
	"revoked_at" timestamp with time zone,
	"status" "attendee_status" DEFAULT 'NOT_CHECKED_IN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendees_qr_code_unique" UNIQUE("qr_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendee_id" uuid NOT NULL,
	"status" "check_in_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" varchar(256) NOT NULL,
	"vendor_job_id" varchar(256),
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"failure_reason" text,
	CONSTRAINT "check_ins_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_event_id" varchar(256) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" text NOT NULL,
	CONSTRAINT "webhook_events_vendor_event_id_unique" UNIQUE("vendor_event_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_attendee_id_attendees_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."attendees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
