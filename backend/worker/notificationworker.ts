// src/workers/notificationWorker.ts
import { createWorker } from "../lib/queue";
import prisma from "../lib/prisma";
import { deliverWebhook } from "../adapters/webhookAdapter";
import { sendEmail } from "../adapters/emailAdapter";
import { ioSingleton } from "./socketSingleton"; // helper below
import { crypto$ } from "../lib/crypto";
// import { WebhookDeliveryStatus } from "@prisma/client"; // optional enum usage
import pino from "pino";

const log = pino({ name: "notification-worker" });

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);
const REQUEST_TIMEOUT = Number(process.env.WEBHOOK_REQUEST_TIMEOUT_MS ?? 10000);
const MAX_RETRIES = 5;

async function processJob(job: any) {
  const { type, notificationId } = job.data as {
    type: string;
    notificationId: string;
  };
  // Load Notification
  const notif = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notif) {
    log.warn({ notificationId }, "notification not found");
    return;
  }

  // Simple in-progress guard - set status to SENT/FAILED later
  try {
    log.info({ notificationId, type, channel: notif.channel }, "Processing notification job");

    if (notif.channel === "email") {
      let to = notif.recipient;
      // If 'to' looks like hex (encrypted), try to decrypt
      if (to && /^[0-9a-fA-F]+$/.test(to) && to.length > 32) {
        try {
           const decrypted = crypto$.decryptCell(to);
           if (decrypted) to = decrypted;
        } catch (e) {
           // ignore, maybe it wasn't encrypted or different key
           log.warn({ to }, "failed to decrypt recipient email, using as-is");
        }
      }
      
      const subject = notif.subject ?? "(no subject)";
      const body = notif.body ?? "";
      log.info({ notificationId, to, subject }, "Sending email...");

      const info = await sendEmail(to, subject, body, notif.body ?? undefined);
      log.info({ notificationId, messageId: info.messageId }, "Email sent successfully");

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "SENT",
          // @ts-ignore
          providerResp: { providerId: info.messageId, raw: info },
        },
      });
      // emit to socket room user:<userId> if relevant
      if (notif.userId)
        ioSingleton()
          .to(`user:${notif.userId}`)
          .emit("notification", { notificationId, channel: "email" });
      return;
    }

    if (notif.channel === "in-app") {
      log.info({ notificationId, userId: notif.userId, storeId: notif.storeId }, "Processing IN-APP notification");
      // mark sent and push to socket room
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "SENT" },
      });
      // Emit to store or user rooms
      if (notif.storeId) {
        const room = `store:${notif.storeId}`;
        log.info({ room }, "Emitting to store room");
        ioSingleton()
          .to(room)
          .emit("notification", { notificationId, payload: notif });
      }
      if (notif.userId) {
        const room = `user:${notif.userId}`;
        log.info({ room }, "Emitting to user room");
        ioSingleton()
          .to(room)
          .emit("notification", { notificationId, payload: notif });
      }
      return;
    }

    if (notif.channel === "webhook") {
      // Find active webhooks for this store that subscribe to this event
      const storeId = notif.storeId;
      if (!storeId) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { status: "FAILED", providerResp: { error: "missing_store" } },
        });
        return;
      }
      const webhooks = await prisma.webhookRegistration.findMany({
        where: { storeId, isActive: true },
      });

      for (const wh of webhooks) {
        // create a delivery row
        const envelope: any = {
          // @ts-ignore
          event: notif.metadata?.event ?? "notification",
          id: notif.id,
          storeId,
          ts: new Date().toISOString(),
          // @ts-ignore
          actor: notif.metadata?.actor ?? null,
          payload: { notification: notif },
        };

        const delivery = await prisma.webhookDelivery.create({
          data: {
            webhookId: wh.id,
            storeId,
            event: envelope.event,
            payload: envelope,
            // @ts-ignore
            headers: null,
            retryCount: 0,
            success: false,
            nextRetryAt: new Date(),
          },
        });

        // attempt immediate delivery
        try {
          const resp = await deliverWebhook(
            wh.url,
            wh.secret ?? null,
            envelope,
            REQUEST_TIMEOUT
          );
          const success = resp.status >= 200 && resp.status < 300;
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              responseCode: resp.status,
              responseBody: resp.data,
              success,
              retryCount: 0,
              nextRetryAt: success
                ? null
                : new Date(Date.now() + 1000 * 60 * 2),
            },
          });
          // mark notification SENT if at least one webhook succeeded
          if (success) {
            await prisma.notification.update({
              where: { id: notificationId },
              data: {
                status: "SENT",
                providerResp: { webhookDeliveryId: delivery.id },
              },
            });
          } else {
            // schedule retry by updating notification to QUEUED with retry meta - simpler: create new job with delay
            // create retry job with delay
            await prisma.notification.update({
              where: { id: notificationId },
              data: { status: "QUEUED" },
            });
            // schedule new job
            await job.queue.add(
              "deliver",
              { type: "webhook", notificationId },
              { delay: 2 * 60 * 1000, attempts: MAX_RETRIES }
            );
          }
        } catch (err: any) {
          // transient failure - update delivery and requeue
          await prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              responseBody: String(err?.message ?? err),
              success: false,
              retryCount: delivery.retryCount + 1,
              nextRetryAt: new Date(Date.now() + 60 * 1000),
            },
          });
          await prisma.notification.update({
            where: { id: notificationId },
            data: { status: "QUEUED" },
          });
          await job.queue.add(
            "deliver",
            { type: "webhook", notificationId },
            { delay: 60 * 1000, attempts: MAX_RETRIES }
          );
        }
      }
    }
  } catch (err) {
    log.error({ err, notificationId }, "failed processing notification job");
    // Mark as failed
    try {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "FAILED",
          // @ts-ignore
          providerResp: { error: String(err?.message ?? err) },
        },
      });
    } catch (_e) {}
  }
}

export const worker = createWorker(
  async (job) => await processJob(job),
  CONCURRENCY
);
