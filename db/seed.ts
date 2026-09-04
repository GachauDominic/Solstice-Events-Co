/**
 * Seeds a few demo attendees with real, signed QR payloads so you have
 * something to scan/test with immediately. Run with: pnpm db:seed
 * (requires DATABASE_URL and QR_SIGNING_SECRET in the environment)
 */
import { db } from "./client";
import { attendees } from "./schema";
import { generateQrToken, renderQrDataUrl } from "../lib/qr";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DEMO_ATTENDEES = [
  { firstName: "Amara", lastName: "Odhiambo", contact: "amara@example.com", role: "attendee" as const },
  { firstName: "Brian", lastName: "Kiptoo", contact: "brian@example.com", role: "guest" as const },
  { firstName: "Chloe", lastName: "Wanjiru", contact: "chloe@example.com", role: "staff" as const },
];

function toAttendeeInsert(person: (typeof DEMO_ATTENDEES)[number], qrToken: string) {
  return {
    name: `${person.firstName} ${person.lastName}`,
    qrCode: qrToken,
    status: "NOT_CHECKED_IN" as const,
  };
}

async function main() {
  const outDir = join(process.cwd(), ".seed-qr-codes");
  mkdirSync(outDir, { recursive: true });

  for (const person of DEMO_ATTENDEES) {
    const { token, payload } = generateQrToken();
    const insert = toAttendeeInsert(person, token);

    const [row] = await db.insert(attendees).values(insert).returning();
    if (!row) throw new Error(`Failed to insert attendee: ${person.firstName} ${person.lastName}`);

    const dataUrl = await renderQrDataUrl(payload);
    const pngBuffer = Buffer.from(dataUrl.split(",")[1]!, "base64");
    const filename = `${row.name}.png`.replace(/\s+/g, "-");
    writeFileSync(join(outDir, filename), pngBuffer);

    console.log(`${row.name} (${person.role})`);
    console.log(`  QR payload (scan target): ${payload}`);
    console.log(`  Saved: .seed-qr-codes/${filename}`);
  }

  console.log(
    "\nScan any of the saved PNGs with the kiosk camera, or paste the payload into the kiosk's manual-entry fallback."
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
