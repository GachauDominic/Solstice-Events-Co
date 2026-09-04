import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attendees } from "@/db/schema";
import { toQrPayload, renderQrDataUrl } from "@/lib/qr";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [attendee] = await db
    .select()
    .from(attendees)
    .where(eq(attendees.id, params.id))
    .limit(1);

  if (!attendee) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  const qrDataUrl = await renderQrDataUrl(toQrPayload(attendee.qrCode));

  return NextResponse.json({
    attendee: {
      id: attendee.id,
      name: attendee.name,
      status: attendee.status,
    },
    qrDataUrl,
  });
}
