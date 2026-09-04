import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const DEMO_NAMES = ["Alice Nkirote", "Ben Otieno", "Cara Wanjiru"];

async function main() {
  const [{ db }, { attendees }, { generateQrToken, renderQrDataUrl }] =
    await Promise.all([
      import("../db/client"),
      import("../db/schema"),
      import("../lib/qr"),
    ]);

  const seeded: { name: string; payload: string }[] = [];

  for (const name of DEMO_NAMES) {
    // Generated the same way a real registration is, so these demo
    // attendees scan and check in exactly like any other attendee -
    // no special-cased fake codes.
    const { token, payload } = generateQrToken();
    const qrImage = await renderQrDataUrl(payload);

    const [row] = await db
      .insert(attendees)
      .values({ name, qrCode: token, qrImage })
      .onConflictDoNothing()
      .returning();

    if (row) seeded.push({ name, payload });
  }

  console.log(`Seeded ${seeded.length} attendees.\n`);
  for (const { name, payload } of seeded) {
    console.log(`${name}`);
    console.log(`  Scan payload: ${payload}\n`);
  }
  console.log(
    "Paste a payload above into the kiosk's manual-entry field, or run `pnpm simulate` to exercise the full flow."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
