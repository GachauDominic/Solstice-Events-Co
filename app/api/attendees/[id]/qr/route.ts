import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendees } from "@/db/schema";
import { toQrPayload, renderQrDataUrl } from "@/lib/qr";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const [attendee] = await db
    .select()
    .from(attendees)
    .where(eq(attendees.id, id))
    .limit(1);

  if (!attendee) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  // Fast path: serve the image already on file. Falls back to regenerating
  // (and backfilling) only for rows created before the qr_image column
  // existed - every attendee created going forward always has one.
  let qrDataUrl = attendee.qrImage;
  if (!qrDataUrl) {
    qrDataUrl = await renderQrDataUrl(toQrPayload(attendee.qrCode));
    await db
      .update(attendees)
      .set({ qrImage: qrDataUrl, updatedAt: new Date() })
      .where(eq(attendees.id, attendee.id));
  }

  return NextResponse.json({
    attendee: {
      id: attendee.id,
      name: attendee.name,
      status: attendee.status,
    },
    qrDataUrl,
  });
}
