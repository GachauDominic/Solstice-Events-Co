import { db } from "../db/client";
import { attendees } from "../db/schema";

async function main() {
  const rows = await db
    .insert(attendees)
    .values([
      { qrCode: "QR-ALICE-001", name: "Alice Nkirote" },
      { qrCode: "QR-BEN-002", name: "Ben Otieno" },
      { qrCode: "QR-CARA-003", name: "Cara Wanjiru" },
    ])
    .onConflictDoNothing()
    .returning();

  console.log(`Seeded ${rows.length} attendees.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
