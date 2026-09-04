import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { attendees } from "@/db/schema";
import { generateQrToken, renderQrDataUrl } from "@/lib/qr";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1).max(256),
});

/**
 * Creating an attendee record is the ONLY place a QR token is minted.
 * The token never depends on name/role/contact, so two attendees with
 * identical details still get distinct, unguessable codes, and editing an
 * attendee's details later never changes their existing badge.
 */
export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { token, payload } = generateQrToken();
  const qrImage = await renderQrDataUrl(payload);

  const [attendee] = await db
    .insert(attendees)
    .values({ name: parsed.data.name, qrCode: token, qrImage })
    .returning();

  if (!attendee) {
    return NextResponse.json({ error: "Could not create attendee" }, { status: 500 });
  }

  return NextResponse.json(
    {
      attendee: {
        id: attendee.id,
        name: attendee.name,
        qrCode: attendee.qrCode,
        revokedAt: attendee.revokedAt,
        status: attendee.status,
      },
      // Served straight from the row we just persisted - this is exactly
      // what GET /api/attendees/:id/qr will return later, so "create" and
      // "re-fetch after the fact" always agree.
      qrDataUrl: attendee.qrImage,
    },
    { status: 201 }
  );
}

export async function GET() {
  const rows = await db
    .select({
      id: attendees.id,
      name: attendees.name,
      qrCode: attendees.qrCode,
      qrImage: attendees.qrImage,
      revokedAt: attendees.revokedAt,
      status: attendees.status,
      createdAt: attendees.createdAt,
    })
    .from(attendees)
    .orderBy(desc(attendees.createdAt))
    .limit(200);

  return NextResponse.json({ attendees: rows });
}
