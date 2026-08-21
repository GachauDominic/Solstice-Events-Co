import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies the vendor's webhook signature over the raw request body.
 * Assumes an HMAC-SHA256 scheme (`X-Vendor-Signature: <hex digest>`) -
 * adjust to match whatever the vendor's actual webhook docs specify.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(signatureHeader, "hex");

  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
