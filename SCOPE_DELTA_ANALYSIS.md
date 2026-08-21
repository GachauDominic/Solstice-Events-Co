# Scope Delta Analysis

**Project:** Solstice Events Check-In Kiosk  
**Reporting date:** August 21, 2026  
**Delivery model:** Next.js App Router deployed through Vercel serverless functions

## Executive Summary

The project pivoted from synchronous badge printing to an asynchronous print workflow. The kiosk now submits a print job to the vendor queue, waits in a visible `PENDING` state, and confirms check-in only after the vendor webhook reports a successful print. This protected the deadline by keeping the existing kiosk workflow and database model while changing the print integration and confirmation path at the system boundary.

The core pivot scope was delivered. To stay within the deadline, large-scale realtime updates, automated recovery for jobs that never receive a vendor callback, and final vendor payload-contract alignment were deferred. The user-facing kiosk was subsequently strengthened with responsive styling, submission guards, error handling, retry behavior, accessibility feedback, and a bounded pending timeout.

## Scope Changes

| Area | Original or expected scope | Delta | Status and deadline rationale |
|---|---|---|---|
| Print execution | Synchronous request/response print call | Replaced with queue submission through `lib/printerVendor.ts`; the request returns before printing completes | **Modified and delivered.** Required for the vendor API pivot and kept serverless requests short-lived. |
| Check-in confirmation | Treat a successful print request as check-in completion | Check-in remains pending until the signed vendor callback reports `SUCCESS` | **Modified and delivered.** Prevents a person from being marked checked in when a badge was not actually printed. |
| Vendor callback handling | No asynchronous callback workflow | Added signed webhook endpoint, HMAC verification, event deduplication, terminal-state protection, and success/failure transitions | **Added and delivered.** Necessary to close the asynchronous workflow reliably. |
| Duplicate scans | Basic duplicate handling | Added a database partial unique index allowing only one active `PENDING` or `CONFIRMED` check-in per attendee | **Added and delivered.** Prevents duplicate badge jobs during concurrent or repeated scans. |
| Webhook retries and ordering | Not covered by the synchronous flow | Added webhook event deduplication and no-op behavior for already-terminal check-ins | **Added and delivered.** Handles at-least-once delivery and out-of-order results without reopening scope elsewhere. |
| Test coverage | At least three test attendees | Added seed data and a simulation covering three attendees, duplicate scanning, out-of-order callbacks, and a repeated webhook | **Added and delivered.** Provides a deadline-appropriate validation path for the highest-risk pivot behavior. |
| Status updates | Immediate success-style kiosk feedback | Kiosk displays `Reading`, `Printing`, confirmed, duplicate, and failure states while polling the check-in status endpoint | **Modified and delivered.** Makes asynchronous behavior understandable to the attendee. |
| Realtime transport | Potential realtime/event-driven client updates | Retained polling at approximately 1.2-second intervals | **Deferred.** Polling is sufficient for a kiosk and avoids adding a realtime provider or persistent connection complexity before the deadline. |
| Stuck print recovery | Automatic recovery if a queue job never calls back | Added a client-side 30-second timeout; server-side expiry/cleanup remains deferred | **Partially modified; backend work deferred.** The kiosk no longer waits forever, but a Vercel Cron job is still needed to reconcile abandoned `PENDING` rows. |
| Vendor contract integration | Final production payload and callback contract | Implemented against the documented/plausible contract shape; actual vendor field and signature details still need confirmation | **Deferred validation.** The adapter boundary isolates this risk, but production launch requires contract verification. |
| Kiosk visual design | Functional, plain prototype screen | Added branded responsive layout, visual state hierarchy, mobile behavior, live status messaging, focus management, and retry action | **Added and delivered.** Improved the operator/attendee experience without changing backend scope. |
| Dependency and deployment setup | Local pnpm workflow and Vercel serverless target | Kept Next.js/Vercel/Neon/Drizzle architecture; documented separate pnpm development and npm production conventions | **Retained with clarification.** Avoided an infrastructure migration during the pivot. |

## Dropped or Deferred Items

These items were not included in the deadline release, rather than being removed from the product direction:

- **Realtime client updates:** The kiosk uses HTTP polling instead of Pusher, Ably, SSE, or another persistent update channel.
- **Server-side stuck-pending reconciliation:** There is no Vercel Cron process yet to expire jobs that remain pending after a vendor outage or silent queue drop.
- **Production vendor-contract finalization:** The webhook payload and signature implementation must be checked against the vendor's final API documentation.
- **Large-conference scaling work:** The current polling approach is intended for a small number of concurrent kiosk scans, not a high-volume multi-kiosk deployment.
- **Additional operational tooling:** No admin dashboard, manual override flow, print queue monitoring screen, or historical reporting view was added in this release.

## Delivered Scope at Deadline

- Vercel-compatible Next.js serverless API routes.
- Neon Postgres with Drizzle ORM for attendee and check-in state.
- Asynchronous vendor print queue publishing.
- Signed webhook confirmation for print success or failure.
- Idempotent webhook processing and duplicate-scan protection.
- Seed and simulation scripts for the critical async scenarios.
- Kiosk polling, responsive UI, loading/error/retry states, and accessibility-oriented status announcements.
- Production build and TypeScript validation passing with `pnpm build` and `pnpm typecheck`.

## Remaining Risks and Recommended Follow-Up

1. Confirm the vendor's production webhook payload, signature algorithm, header name, and retry semantics before go-live.
2. Add a Vercel Cron or equivalent scheduled job to expire stale `PENDING` check-ins and restore rescanning.
3. Reassess polling when the number of kiosks or simultaneous scans grows; move to SSE or a managed realtime service if database/request volume warrants it.
4. Add operational visibility for failed queue submissions, stale jobs, webhook failures, and printer availability.
5. Run an end-to-end production-like test with the actual printer vendor sandbox and deployed Vercel environment.

## Scope Decision

The release prioritizes correctness of the new asynchronous printing contract and protection against duplicate badges. Larger platform and operations features were intentionally deferred so the core check-in experience could remain deployable within the deadline.
