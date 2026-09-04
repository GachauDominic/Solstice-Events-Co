import amqplib from "amqplib";

const PRINT_REQUEST_QUEUE = "vendor.print_requests";

export type PrintRequestMessage = {
  jobId: string; // our print_jobs.id (PK)
  idempotencyKey: string; // print_jobs.idempotency_key, vendor must echo it back
  attendeeId: string;
  attendeeName: string;
  role: string;
  callbackUrl: string; // our webhook URL for this deployment
};

/**
 * Publishes a print request onto the vendor's queue.
 *
 * Vercel serverless functions cannot hold a long-lived AMQP connection
 * between invocations, so we open a connection, publish, and close it
 * within the same request — this is the recommended pattern for
 * publish-only serverless producers. (A persistent consumer, which we
 * don't need here since the vendor consumes this queue, would instead
 * run on a long-lived worker — see scripts/mock-vendor-worker.ts for the
 * local dev stand-in for the vendor's own consumer.)
 */
export async function publishPrintRequest(
  message: PrintRequestMessage
): Promise<void> {
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error("RABBITMQ_URL is not set");

  const connection = await amqplib.connect(url);
  try {
    // A confirm channel lets us await broker acknowledgment of the publish
    // before closing the connection — important since this connection is
    // torn down immediately after, unlike a long-lived consumer.
    const channel = await connection.createConfirmChannel();
    try {
      await channel.assertQueue(PRINT_REQUEST_QUEUE, { durable: true });

      await new Promise<void>((resolve, reject) => {
        channel.sendToQueue(
          PRINT_REQUEST_QUEUE,
          Buffer.from(JSON.stringify(message)),
          {
            persistent: true, // survive a RabbitMQ restart before the vendor consumes it
            messageId: message.idempotencyKey,
            contentType: "application/json",
          },
          (err) => (err ? reject(err) : resolve())
        );
      });
    } finally {
      await channel.close();
    }
  } finally {
    await connection.close();
  }
}

export { PRINT_REQUEST_QUEUE };
