/**
 * One-off migration runner. Run with:  pnpm db:migrate
 * Applies the committed current-schema migrations against DATABASE_URL.
 * Not deployed to Vercel — this is a local/CI operational script.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const migrations = [
    "0000_quiet_black_knight.sql",
    "0001_one_active_checkin.sql",
    "0002_add_attendee_revocation.sql",
  ];

  const pool = new Pool({ connectionString });
  try {
    for (const migration of migrations) {
      await pool.query(readFileSync(join(process.cwd(), "drizzle", migration), "utf-8"));
      console.log(`Applied ${migration}.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
