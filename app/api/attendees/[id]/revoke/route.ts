import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendees } from "@/db/schema";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const [updated] = await db
    .update(attendees)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(attendees.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  return NextResponse.json({
    revoked: true,
    attendeeId: updated.id,
    message:
      "This attendee's existing QR code will now be rejected at check-in. Issue a new attendee record and QR if a replacement badge is needed.",
  });
}
