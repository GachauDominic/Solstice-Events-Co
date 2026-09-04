import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";

/**
 * QR payload format: `${token}.${signature}`
 *
 *  - token: 16 random bytes, base64url-encoded (128 bits of entropy) —
 *    this is what's stored in attendees.qr_token and looked up in the DB.
 *  - signature: first 12 hex chars of HMAC-SHA256(secret, token) — lets us
 *    reject obviously forged or corrupted codes (bad photocopy, someone
 *    hand-typing a guess) BEFORE hitting the database, without weakening
 *    security: the token itself is already unguessable, the signature is
 *    a cheap tamper-evidence layer on top, not the sole line of defense.
 *
 * The DB is always the final authority (a valid signature with a
 * since-revoked or deleted token is still rejected) — signing just avoids
 * wasted DB round-trips for garbage input.
 */

const TOKEN_BYTES = 16;
const SIGNATURE_HEX_LENGTH = 12;

function getSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret) throw new Error("QR_SIGNING_SECRET is not set");
  return secret;
}

function sign(token: string): string {
  return createHmac("sha256", getSecret())
    .update(token)
    .digest("hex")
    .slice(0, SIGNATURE_HEX_LENGTH);
}

export function generateQrToken(): { token: string; payload: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, payload: `${token}.${sign(token)}` };
}

/** Reconstructs the full signed payload for a token already stored in the DB. */
export function toQrPayload(token: string): string {
  return `${token}.${sign(token)}`;
}

/**
 * Parses and verifies a scanned QR payload. Returns the bare token on
 * success, or null if the payload is malformed or the signature doesn't
 * match — either case should be treated by the caller as "not in the
 * system" without a DB lookup.
 */
export function verifyQrPayload(scanned: string): string | null {
  const trimmed = scanned.trim();
  const separatorIndex = trimmed.lastIndexOf(".");
  if (separatorIndex === -1) return null;

  const token = trimmed.slice(0, separatorIndex);
  const providedSig = trimmed.slice(separatorIndex + 1);
  if (!token || providedSig.length !== SIGNATURE_HEX_LENGTH) return null;

  const expectedSig = sign(token);
  const a = Buffer.from(expectedSig, "utf-8");
  const b = Buffer.from(providedSig, "utf-8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return token;
}

/** Renders the signed payload as a PNG data URL, ready for <img src=...>. */
export async function renderQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });
}
