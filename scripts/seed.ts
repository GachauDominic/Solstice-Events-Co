import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ db }, { attendees }] = await Promise.all([
    import("../db/client"),
    import("../db/schema"),
  ]);
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
