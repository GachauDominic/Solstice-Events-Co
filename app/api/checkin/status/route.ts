import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { attendees, checkIns } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const attendeeId = req.nextUrl.searchParams.get("attendeeId");
  if (!attendeeId) {
    return NextResponse.json(
      { error: "attendeeId is required" },
      { status: 400 }
    );
  }

  const [attendee] = await db
    .select()
    .from(attendees)
    .where(eq(attendees.id, attendeeId))
    .limit(1);

  if (!attendee) {
    return NextResponse.json({ error: "Unknown attendee" }, { status: 404 });
  }

  const [checkIn] = await db
    .select()
    .from(checkIns)
    .where(
      and(
        eq(checkIns.attendeeId, attendee.id),
        inArray(checkIns.status, ["PENDING", "FAILED", "CONFIRMED"])
      )
    )
    .orderBy(desc(checkIns.requestedAt))
    .limit(1);

  return NextResponse.json({
    name: attendee.name,
    status: attendee.status.toLowerCase(),
    failureReason: checkIn?.failureReason ?? null,
  });
}
