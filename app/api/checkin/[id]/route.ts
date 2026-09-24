import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { checkIns, attendees } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const checkIn = await db.query.checkIns.findFirst({
    where: eq(checkIns.id, id),
  });

  if (!checkIn) {
    return NextResponse.json({ error: "Unknown check-in id" }, { status: 404 });
  }

  const attendee = await db.query.attendees.findFirst({
    where: eq(attendees.id, checkIn.attendeeId),
  });

  return NextResponse.json({
    checkInStatus: checkIn.status, // PENDING | CONFIRMED | FAILED
    attendeeStatus: attendee?.status,
    attendeeName: attendee?.name,
    failureReason: checkIn.failureReason,
  });
}
