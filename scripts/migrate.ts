import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

loadEnvConfig(process.cwd());

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local or set it in the shell before running pnpm db:migrate."
    );
  }

  const sql = neon(databaseUrl);
  const dir = path.join(process.cwd(), "drizzle", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    console.log(`Applying ${file}...`);
    const contents = readFileSync(path.join(dir, file), "utf8");
    const statements = contents
      .split(/--> statement-breakpoint/)
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await sql(statement);
    }
  }
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
