import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies the vendor's webhook signature.
 * Convention (document this with the vendor): they sign the raw request
 * body with HMAC-SHA256 using a shared secret, sent as `X-Vendor-Signature`.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.VENDOR_WEBHOOK_SECRET;
  if (!secret) throw new Error("VENDOR_WEBHOOK_SECRET is not set");
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(signatureHeader, "utf-8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
