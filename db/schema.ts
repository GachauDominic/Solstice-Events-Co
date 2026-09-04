import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const attendeeStatus = pgEnum("attendee_status", [
  "NOT_CHECKED_IN",
  "PENDING",
  "CHECKED_IN",
]);

export const checkInStatus = pgEnum("check_in_status", [
  "PENDING",
  "CONFIRMED",
  "FAILED",
]);

export const attendees = pgTable("attendees", {
  id: uuid("id").defaultRandom().primaryKey(),
  qrCode: varchar("qr_code", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  status: attendeeStatus("status").notNull().default("NOT_CHECKED_IN"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per print *attempt*. The partial unique index added in the
// hand-written migration (drizzle/0001_one_active_checkin.sql) is what
// actually enforces "no second badge for an already-checked-in attendee" -
// it forbids more than one PENDING or CONFIRMED row per attendee at the
// database level, so it holds even under concurrent scans.
export const checkIns = pgTable("check_ins", {
  id: uuid("id").defaultRandom().primaryKey(),
  attendeeId: uuid("attendee_id")
    .notNull()
    .references(() => attendees.id),
  status: checkInStatus("status").notNull().default("PENDING"),
  // Sent to the vendor when the print job is queued; the vendor echoes it
  // back on the webhook callback. Doubles as our idempotency key.
  idempotencyKey: varchar("idempotency_key", { length: 256 }).notNull().unique(),
  vendorJobId: varchar("vendor_job_id", { length: 256 }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
});

// Raw record of every inbound webhook delivery, keyed by the vendor's own
// event id. This is what makes the webhook handler safe against the
// vendor's at-least-once retry behavior (duplicate deliveries of the
// exact same event, independent of check-in state).
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  vendorEventId: varchar("vendor_event_id", { length: 256 }).notNull().unique(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  payload: text("payload").notNull(),
});
