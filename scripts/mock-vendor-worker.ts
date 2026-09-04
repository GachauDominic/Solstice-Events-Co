/**
 * This script does NOT ship to production — it simulates the badge-printer
 * vendor's side of the integration for local development and the duplicate
 * / out-of-order test scenarios described in the brief:
 *
 *   - Consumes vendor.print_requests from RabbitMQ (this is normally the
 *     vendor's own consumer, not ours — we only ever publish to it).
 *   - Waits a random delay per job (so jobs can complete OUT OF ORDER
 *     relative to how they were queued).
 *   - POSTs a signed callback to our /api/webhooks/print-complete.
 *
 * Run with: pnpm mock-vendor  (requires RABBITMQ_URL, VENDOR_WEBHOOK_SECRET,
 * and KIOSK_BASE_URL — e.g. http://localhost:3000 — in the environment)
 */
import amqplib from "amqplib";
import { createHmac } from "node:crypto";
import { PRINT_REQUEST_QUEUE, type PrintRequestMessage } from "../lib/queue";

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const SECRET = process.env.VENDOR_WEBHOOK_SECRET;
const KIOSK_BASE_URL = process.env.KIOSK_BASE_URL ?? "http://localhost:3000";
const FAILURE_RATE = Number(process.env.MOCK_VENDOR_FAILURE_RATE ?? "0.1");

if (!RABBITMQ_URL || !SECRET) {
  throw new Error("RABBITMQ_URL and VENDOR_WEBHOOK_SECRET must be set");
}

async function sendCallback(message: PrintRequestMessage, succeeded: boolean) {
  const payload = {
    jobId: message.jobId,
    idempotencyKey: message.idempotencyKey,
    status: succeeded ? "succeeded" : "failed",
    vendorJobId: `vendor-${message.jobId.slice(0, 8)}`,
    ...(succeeded ? {} : { failureReason: "printer_jam" }),
  };
  const rawBody = JSON.stringify(payload);
  const signature = createHmac("sha256", SECRET!).update(rawBody).digest("hex");

  const res = await fetch(message.callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Vendor-Signature": signature,
    },
    body: rawBody,
  });

  console.log(
    `[mock-vendor] callback for job ${message.jobId} (${payload.status}) -> HTTP ${res.status}`
  );
}

async function main() {
  const connection = await amqplib.connect(RABBITMQ_URL!);
  const channel = await connection.createChannel();
  await channel.assertQueue(PRINT_REQUEST_QUEUE, { durable: true });

  console.log(`[mock-vendor] listening on ${PRINT_REQUEST_QUEUE} …`);

  channel.consume(PRINT_REQUEST_QUEUE, (msg) => {
    if (!msg) return;
    const message = JSON.parse(msg.content.toString()) as PrintRequestMessage;

    // Random per-job delay (0.5s–4s) to deliberately produce out-of-order
    // completions relative to queue order, per the pivot's requirement that
    // duplicate-scan protection must hold even when confirmations arrive
    // out of order.
    const delayMs = 500 + Math.random() * 3500;
    const succeeded = Math.random() > FAILURE_RATE;

    console.log(
      `[mock-vendor] picked up job ${message.jobId} for ${message.attendeeName}, will confirm in ${Math.round(delayMs)}ms`
    );

    setTimeout(() => {
      sendCallback(message, succeeded).catch((err) =>
        console.error("[mock-vendor] callback failed", err)
      );
    }, delayMs);

    channel.ack(msg);
  });
}

main().catch((err) => {
  console.error("[mock-vendor] fatal error", err);
  process.exit(1);
});
