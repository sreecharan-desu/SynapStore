// src/workers/notificationWorker.ts
import { createWorker } from "../lib/queue";
import prisma from "../lib/prisma";
import { sendMail } from "../lib/mailer"; // Use lib/mailer
import { crypto$ } from "../lib/crypto";
import pino from "pino";

const log = pino({ name: "notification-worker" });

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 5);

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

  try {
    log.info({ notificationId, type, channel: notif.channel }, "Processing notification job");

    if (notif.channel === "EMAIL") {
      let to = notif.recipient;
      // If 'to' looks like hex (encrypted), try to decrypt
      if (to && /^[0-9a-fA-F]+$/.test(to) && to.length > 32) {
        try {
           const decrypted = crypto$.decryptCell(to);
           if (decrypted) to = decrypted;
        } catch (e) {
           log.warn({ to }, "failed to decrypt recipient email, using as-is");
        }
      }
      
      const subject = notif.subject ?? "(no subject)";
      const body = notif.body ?? "";
      log.info({ notificationId, to, subject }, "Sending email...");

      // Use lib/mailer sendMail
      const info = await sendMail({
          to, 
          subject, 
          text: body,
          html: body.includes("<") ? body : undefined // naive check for html
      });
      
      log.info({ notificationId, messageId: info.messageId }, "Email sent successfully");

      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "SENT",
          providerResp: { providerId: info.messageId },
        },
      });
      return;
    }

    if (notif.channel === "IN_APP") {
      log.info({ notificationId, userId: notif.userId, storeId: notif.storeId }, "Processing IN-APP notification");
      // Sockets removed as per cleanup. Just mark as sent (persisted to DB).
      // Client polling (GET /notifications) will pick it up.
      await prisma.notification.update({
        where: { id: notificationId },
        data: { status: "SENT" },
      });
      return;
    }

    // Webhooks removed as per cleanup (adapters deleted) - mark unhandled channels as FAILED or skip
    if (notif.channel === "WEBHOOK") {
        log.warn({ notificationId }, "Webhook channel not supported in this version");
        await prisma.notification.update({
            where: { id: notificationId },
            data: { status: "FAILED", providerResp: { error: "channel_not_supported" } },
        });
        return;
    }

  } catch (err: any) {
    log.error({ err, notificationId }, "failed processing notification job");
    try {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "FAILED",
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
