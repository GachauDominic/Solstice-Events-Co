# Solstice Events - Async Check-In Kiosk

Rebuilt around the badge-printer vendor's new async model: publish to their
queue, get confirmation via our own webhook, instead of a synchronous
request/response print call.

## How the pivot's requirements are met

| Requirement | Where |
|---|---|
| No more synchronous print call | `lib/printerVendor.ts` only *publishes* a job and returns; it never waits for print completion. |
| UI shows pending, not instant "Checked In" | `app/page.tsx` shows "Pending — printing badge…" immediately, then polls `GET /api/checkin/:id` until the webhook flips status. |
| "Checked In" only after printing actually succeeds | Only `app/api/webhooks/print-callback/route.ts` ever sets `attendees.status = 'CHECKED_IN'`, and only on a `SUCCESS` result. |
| Duplicate scan must not print twice, even with out-of-order confirmations | A **partial unique index** (`drizzle/0001_one_active_checkin.sql`) allows at most one `PENDING`/`CONFIRMED` check-in row per attendee at the database level. The webhook handler is separately idempotent (dedupes raw deliveries via `webhook_events`, and no-ops if the check-in is already terminal), so retries or reordering can't cause a second badge. |
| 3+ test attendees incl. duplicate scan | `scripts/seed.ts` + `scripts/simulate.ts` — the simulation scans 3 attendees, duplicate-scans one of them mid-flight, delivers webhooks out of order, and retries one webhook delivery. |

## Stack

- **Next.js (App Router)** deployed as **Vercel serverless functions** for `app/api/*`
- **TypeScript** during development, compiled to JS by Next's build (no manual build step needed)
- **pnpm** for local development, **npm** for the production/CI build (see below)
- **Neon Postgres** + **Drizzle ORM**, using `@neondatabase/serverless`'s HTTP driver (fits stateless serverless invocations)

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, vendor creds, webhook secret
pnpm db:generate              # drizzle-kit: generates base table SQL from db/schema.ts
pnpm db:migrate                # applies drizzle/*.sql in order, including the partial unique index
pnpm db:seed                   # creates the 3 test attendees
pnpm dev
```

In a second terminal, with the dev server running:

```bash
BASE_URL=http://localhost:3000 pnpm simulate
```

This plays both the kiosk and the vendor's webhook caller, and exits non-zero if the duplicate-scan or idempotency guarantees are violated.

## Production build

Per the project's convention, production installs/builds use npm against the committed `package-lock.json` (generate one with `npm i --package-lock-only` after any pnpm-driven dependency change), while day-to-day development uses pnpm and `pnpm-lock.yaml`. On Vercel this just means: commit both lockfiles, and set the project's install command to `npm ci` / build command to `npm run build` in Vercel's project settings (Vercel otherwise auto-detects the package manager from whichever lockfile is present, so being explicit avoids ambiguity between the two).

```bash
npm ci
npm run build
```

## Environment variables (Vercel project settings)

- `DATABASE_URL` — Neon **pooled** connection string
- `APP_BASE_URL` — public URL of this deployment, used as the webhook callback URL handed to the vendor
- `PRINTER_VENDOR_QUEUE_URL`, `PRINTER_VENDOR_API_KEY` — vendor's async queue publish endpoint
- `VENDOR_WEBHOOK_SECRET` — HMAC secret for verifying `X-Vendor-Signature` on inbound webhook calls (rotate per Solstice's usual secret rotation policy)

## Things worth deciding before go-live (not yet built here)

- **Realtime instead of polling**: current UI polls every ~1.2s, which is fine for a kiosk with a handful of concurrent scans but would need Pusher/Ably/SSE for a much larger conference.
- **Stuck-pending recovery**: if the vendor's queue silently drops a job (never calls back), a check-in stays `PENDING` forever. Add a cron (Vercel Cron) that flags/expires check-ins pending longer than N minutes and allows rescanning.
- **Vendor payload shape**: `VendorCallbackPayload` in the webhook route and the signature scheme in `lib/signature.ts` are written to a plausible shape — swap in the vendor's actual webhook contract once their new API docs are final.
