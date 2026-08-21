/**
 * Adapter around the badge-printer vendor's new async API.
 *
 * Old (deprecated) model: POST /print, block for the HTTP response.
 * New model: publish a message onto the vendor's queue and return
 * immediately; the vendor calls our webhook later with the result.
 *
 * Keeping this behind an interface means the route handlers never touch
 * vendor-specific request/response shapes directly, which matters here
 * because the vendor already deprecated one API shape with no notice -
 * the next change should only require editing this file.
 */

export interface PublishPrintJobInput {
  idempotencyKey: string;
  attendeeName: string;
  callbackUrl: string;
}

export interface PublishPrintJobResult {
  /** Vendor's queue message / job id, if returned synchronously on publish */
  vendorAcceptedJobId?: string;
}

export async function publishPrintJob(
  input: PublishPrintJobInput
): Promise<PublishPrintJobResult> {
  const res = await fetch(process.env.PRINTER_VENDOR_QUEUE_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.PRINTER_VENDOR_API_KEY}`,
      // Ask the vendor's queue to dedupe on their side too, in case our
      // own request retries (e.g. a Vercel function timeout/retry) before
      // we get a chance to record the result.
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      attendee_name: input.attendeeName,
      callback_url: input.callbackUrl,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Printer vendor rejected the queue publish: ${res.status} ${await res.text()}`
    );
  }

  const body = (await res.json().catch(() => ({}))) as {
    job_id?: string;
  };

  return { vendorAcceptedJobId: body.job_id };
}
