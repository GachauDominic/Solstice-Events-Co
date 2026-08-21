/**
 * Exercises the required test scenario end-to-end against a running
 * `pnpm dev` instance:
 *   - 3 attendees scan in
 *   - one of them (Alice) is scanned twice before her webhook confirms
 *     -> the second scan must NOT trigger a second print job
 *   - webhook confirmations are delivered out of order (Cara's arrives
 *     before Ben's, and Alice's single confirmation is redelivered once
 *     to simulate a vendor retry)
 *
 * This script plays the role of both the kiosk (calling /api/checkin)
 * and the vendor (calling /api/webhooks/print-callback), since in this
 * simulation nothing is actually listening on a real vendor queue.
 *
 * Usage: BASE_URL=http://localhost:3000 pnpm simulate
 */
import { createHmac } from "node:crypto";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.VENDOR_WEBHOOK_SECRET ?? "replace-me";

function sign(body: string) {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

async function scan(qrCode: string) {
  const res = await fetch(`${BASE_URL}/api/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qrCode }),
  });
  return res.json();
}

async function sendWebhook(eventId: string, idempotencyKey: string, vendorJobId: string) {
  const body = JSON.stringify({
    event_id: eventId,
    idempotency_key: idempotencyKey,
    vendor_job_id: vendorJobId,
    result: "SUCCESS",
  });
  const res = await fetch(`${BASE_URL}/api/webhooks/print-callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Vendor-Signature": sign(body) },
    body,
  });
  return res.json();
}

async function main() {
  console.log("--- Scanning 3 attendees ---");
  const alice1 = await scan("QR-ALICE-001");
  console.log("Alice scan #1:", alice1);

  const ben = await scan("QR-BEN-002");
  console.log("Ben scan:", ben);

  const cara = await scan("QR-CARA-003");
  console.log("Cara scan:", cara);

  console.log("\n--- Duplicate scan: Alice again, before her print confirms ---");
  const alice2 = await scan("QR-ALICE-001");
  console.log("Alice scan #2 (duplicate):", alice2);
  if (alice2.checkInId && alice2.checkInId !== alice1.checkInId) {
    console.error("FAIL: duplicate scan created a second check-in / print job");
    process.exitCode = 1;
  } else {
    console.log("OK: duplicate scan did not create a new print job");
  }

  console.log("\n--- Webhook confirmations arriving out of order ---");
  // Cara's confirmation arrives first even though she scanned last.
  console.log("Cara webhook:", await sendWebhook("evt-cara-1", cara.checkInId, "job-cara-1"));
  console.log("Ben webhook:", await sendWebhook("evt-ben-1", ben.checkInId, "job-ben-1"));
  console.log("Alice webhook:", await sendWebhook("evt-alice-1", alice1.checkInId, "job-alice-1"));

  console.log("\n--- Vendor retries Alice's webhook delivery (duplicate event) ---");
  const aliceRetry = await sendWebhook("evt-alice-1", alice1.checkInId, "job-alice-1");
  console.log("Alice webhook retry:", aliceRetry);
  if (!aliceRetry.deduped) {
    console.error("FAIL: duplicate webhook delivery was not deduped");
    process.exitCode = 1;
  } else {
    console.log("OK: duplicate webhook delivery was a no-op");
  }

  console.log("\n--- Post-condition: a third scan of Alice must be ALREADY_CHECKED_IN ---");
  const alice3 = await scan("QR-ALICE-001");
  console.log("Alice scan #3:", alice3);
  if (alice3.result !== "ALREADY_CHECKED_IN") {
    console.error("FAIL: Alice should be ALREADY_CHECKED_IN after confirmation");
    process.exitCode = 1;
  } else {
    console.log("OK: Alice correctly shows ALREADY_CHECKED_IN, no further print");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
