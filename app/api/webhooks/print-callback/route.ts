import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, isUniqueViolation } from "@/db/client";
import { checkIns, attendees, webhookEvents } from "@/db/schema";
import { verifyWebhookSignature } from "@/lib/signature";

export const runtime = "nodejs";

interface VendorCallbackPayload {
  event_id: string; // unique per webhook delivery attempt-group, per vendor docs
  idempotency_key: string; // echoes what we sent when publishing the job
  vendor_job_id: string;
  result: "SUCCESS" | "FAILED";
  reason?: string;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-vendor-signature");

  if (!verifyWebhookSignature(rawBody, signature, process.env.VENDOR_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as VendorCallbackPayload;

  // Dedupe the raw delivery first. Vendors with at-least-once delivery
  // will redeliver the identical event on timeout/retry; this ensures we
  // only ever act on it once, regardless of arrival order relative to
  // other events.
  try {
    await db.insert(webhookEvents).values({
      vendorEventId: payload.event_id,
      payload: rawBody,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ ok: true, deduped: true });
    }
    throw err;
  }

  const checkIn = await db.query.checkIns.findFirst({
    where: eq(checkIns.idempotencyKey, payload.idempotency_key),
  });

  if (!checkIn) {
    // Unknown idempotency key - log and ack so the vendor doesn't retry
    // forever, but don't touch any attendee state.
    console.error("Webhook for unknown check-in", payload.idempotency_key);
    return NextResponse.json({ ok: true, unknown: true });
  }

  // The check-in already reached a terminal state. This covers
  // out-of-order or duplicate *result* delivery for the same job (e.g. a
  // stale retry arriving after a later attempt already resolved it) -
  // it's a no-op rather than a second print or a state flip-flop.
  if (checkIn.status !== "PENDING") {
    return NextResponse.json({ ok: true, alreadyTerminal: checkIn.status });
  }

  await db.transaction(async (tx) => {
    if (payload.result === "SUCCESS") {
      await tx
        .update(checkIns)
        .set({ status: "CONFIRMED", vendorJobId: payload.vendor_job_id, confirmedAt: new Date() })
        .where(eq(checkIns.id, checkIn.id));

      // This is the only place "Checked In" ever becomes true.
      await tx
        .update(attendees)
        .set({ status: "CHECKED_IN" })
        .where(eq(attendees.id, checkIn.attendeeId));
    } else {
      await tx
        .update(checkIns)
        .set({
          status: "FAILED",
          vendorJobId: payload.vendor_job_id,
          failureReason: payload.reason ?? "vendor_reported_failure",
        })
        .where(eq(checkIns.id, checkIn.id));

      // Printing failed - release the attendee so a rescan is allowed
      // to create a fresh check-in row.
      await tx
        .update(attendees)
        .set({ status: "NOT_CHECKED_IN" })
        .where(eq(attendees.id, checkIn.attendeeId));
    }
  });

  return NextResponse.json({ ok: true });
}
