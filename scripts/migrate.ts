import { neon } from "@neondatabase/serverless";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const dir = path.join(process.cwd(), "drizzle");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    console.log(`Applying ${file}...`);
    const contents = readFileSync(path.join(dir, file), "utf8");
    // Split naive statements on ';' - fine for this project's simple DDL.
    const statements = contents.split(";").map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await sql(stmt);
    }
  }
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
