import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { attendees, checkIns } from "@/db/schema";
import { verifyWebhookSignature } from "@/lib/verify-webhook";

export const runtime = "nodejs";

const payloadSchema = z.object({
  jobId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
  vendorJobId: z.string().optional(),
  failureReason: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifyWebhookSignature(rawBody, req.headers.get("x-vendor-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { jobId, idempotencyKey, status, vendorJobId, failureReason } = parsed.data;
  const checkIn = await db.query.checkIns.findFirst({ where: eq(checkIns.id, jobId) });
  if (!checkIn || checkIn.idempotencyKey !== idempotencyKey || checkIn.status !== "PENDING") {
    return NextResponse.json({ received: true, applied: false });
  }

  const succeeded = status === "succeeded";
  await db.transaction(async (tx) => {
    await tx.update(checkIns).set({
      status: succeeded ? "CONFIRMED" : "FAILED",
      vendorJobId: vendorJobId ?? null,
      confirmedAt: succeeded ? new Date() : null,
      failureReason: succeeded ? null : failureReason ?? "unspecified",
    }).where(eq(checkIns.id, jobId));
    await tx.update(attendees).set({
      status: succeeded ? "CHECKED_IN" : "NOT_CHECKED_IN",
    }).where(eq(attendees.id, checkIn.attendeeId));
  });

  return NextResponse.json({ received: true, applied: true });
}
