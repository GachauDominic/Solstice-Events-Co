import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db, isUniqueViolation } from "@/db/client";
import { attendees, checkIns } from "@/db/schema";
import { publishPrintJob } from "@/lib/printerVendor";
import { verifyQrPayload } from "@/lib/qr";

export const runtime = "nodejs";

interface CheckInRequestBody {
  qrCode: string;
}

export async function POST(req: Request) {
  const { qrCode } = (await req.json()) as CheckInRequestBody;

  if (!qrCode || typeof qrCode !== "string") {
    return NextResponse.json({ error: "qrCode is required" }, { status: 400 });
  }

  // The printed/displayed QR encodes the signed payload (token.signature),
  // not the bare token stored in attendees.qr_code - this verifies the
  // signature and recovers the token to look up, rejecting a malformed or
  // tampered scan before ever hitting the database.
  const token = verifyQrPayload(qrCode);
  if (!token) {
    return NextResponse.json({ error: "Unknown QR code" }, { status: 404 });
  }

  const attendee = await db.query.attendees.findFirst({
    where: eq(attendees.qrCode, token),
  });

  if (!attendee) {
    return NextResponse.json({ error: "Unknown QR code" }, { status: 404 });
  }

  if (attendee.revokedAt) {
    return NextResponse.json({ error: "This QR code has been revoked" }, { status: 410 });
  }

  // Fast path: attendee already fully checked in. No print, no new row.
  if (attendee.status === "CHECKED_IN") {
    return NextResponse.json({
      result: "ALREADY_CHECKED_IN",
      attendee: { id: attendee.id, name: attendee.name },
    });
  }

  const checkInId = crypto.randomUUID();

  try {
    await db.insert(checkIns).values({
      id: checkInId,
      attendeeId: attendee.id,
      status: "PENDING",
      idempotencyKey: checkInId,
    });
  } catch (err) {
    // The partial unique index (one_active_checkin_per_attendee) rejected
    // this insert: a PENDING or CONFIRMED check-in already exists for this
    // attendee. This is the duplicate-scan case, including the race where
    // two scans land at nearly the same instant - only one insert wins.
    if (isUniqueViolation(err)) {
      const existing = await db.query.checkIns.findFirst({
        where: and(
          eq(checkIns.attendeeId, attendee.id),
          inArray(checkIns.status, ["PENDING", "CONFIRMED"])
        ),
      });
      return NextResponse.json({
        result: existing?.status === "CONFIRMED" ? "ALREADY_CHECKED_IN" : "PENDING",
        checkInId: existing?.id,
        note: "Check-in already in progress for this attendee; no new print job created.",
      });
    }
    throw err;
  }

  // Best-effort UX state; the source of truth for "checked in" is only
  // ever flipped by the webhook handler on confirmed success.
  await db.update(attendees).set({ status: "PENDING" }).where(eq(attendees.id, attendee.id));

  try {
    await publishPrintJob({
      idempotencyKey: checkInId,
      attendeeName: attendee.name,
      callbackUrl: `${process.env.APP_BASE_URL}/api/webhooks/print-callback`,
    });
  } catch (err) {
    // Publishing to the vendor's queue failed outright (not a print
    // failure - the job never even got queued). Roll the check-in back
    // to FAILED so a rescan is allowed instead of getting stuck PENDING.
    await db
      .update(checkIns)
      .set({ status: "FAILED", failureReason: "queue_publish_failed" })
      .where(eq(checkIns.id, checkInId));
    await db.update(attendees).set({ status: "NOT_CHECKED_IN" }).where(eq(attendees.id, attendee.id));

    return NextResponse.json(
      { error: "Could not queue print job", checkInId },
      { status: 502 }
    );
  }

  return NextResponse.json({ result: "PENDING", checkInId });
}
