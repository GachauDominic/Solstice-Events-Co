import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// neon-http is used (rather than a pooled ws driver) because each Vercel
// serverless function invocation is short-lived and stateless - a fresh
// HTTP-based connection per request is the right fit and needs no pool
// lifecycle management. Use DATABASE_URL's pooled Neon endpoint
// (the "-pooler" host) regardless, since concurrent kiosk scans across
// functions can still spike connection count.
const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });

/** Postgres unique_violation - see https://www.postgresql.org/docs/current/errcodes-appendix.html */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}
