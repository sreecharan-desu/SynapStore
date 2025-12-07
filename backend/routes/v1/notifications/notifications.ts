// routes/v1/notifications.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";
import axios from "axios";

const router = Router();
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

/* Schemas */
const enqueueSchema = z.object({
  channel: z.string().min(1), // e.g., "email", "sms", "slack", "webhook"
  recipient: z.string().min(1),
  subject: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  metadata: z.any().optional().nullable(),
  // provider hints - optional
  provider: z.string().optional().nullable(),
});

const listQuery = z.object({
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
  status: z.string().optional(),
});

/* middleware chain */
router.use(authenticate);
router.use(storeContext);
router.use(requireStore);

/**
 * POST /v1/stores/:id/notifications
 * - allowed: ADMIN, STORE_OWNER
 * - enqueues a notification record to be picked by async sender worker/process
 */
router.post(
  "/:id/notifications",
  requireRole(["ADMIN", "STORE_OWNER"]),
  async (req: any, res) => {
    try {
      const parsed = enqueueSchema.safeParse(req.body);
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }));
        return respond(res, 400, {
          success: false,
          error: "validation_failed",
          details,
        });
      }

      const storeId = String(req.params.id);
      const userId = req.user?.id ?? undefined;
      const { channel, recipient, subject, body, metadata, provider } =
        parsed.data;

      // persist notification as QUEUED
      const created = await prisma.notification.create({
        data: {
          storeId,
          userId,
          channel,
          recipient,
          subject: subject ?? undefined,
          body: body ?? undefined,
          metadata: metadata ?? undefined,
          status: "QUEUED",
          providerResp: provider ? { provider } : undefined,
        },
      });

      // Optionally kick off immediate delivery attempt for synchronous environments
      // For now we respond quickly and let a worker handle sending.
      return respond(res, 202, {
        success: true,
        data: { notificationId: created.id, status: created.status },
      });
    } catch (err) {
      console.error("POST /notifications error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/notifications
 * - allowed: any authenticated store member
 * - query: status?, limit, offset
 */
router.get("/:id/notifications", async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const q = req.query ?? {};
    const parsed = listQuery.safeParse(q);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return respond(res, 400, {
        success: false,
        error: "validation_failed",
        details,
      });
    }

    const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 200);
    const offset = Math.max(Number(q.offset ?? 0), 0);
    const status = typeof q.status === "string" ? q.status : undefined;

    const where: any = { storeId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          channel: true,
          recipient: true,
          subject: true,
          body: true,
          metadata: true,
          status: true,
          providerResp: true,
          createdAt: true,
          sentAt: true,
        },
      }),
      prisma.notification.count({ where }),
    ]);

    return respond(res, 200, {
      success: true,
      data: { items, total, limit, offset },
    });
  } catch (err) {
    console.error("GET /notifications error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

/**
 * POST /v1/stores/:id/notifications/:notificationId/retry
 * - allowed: ADMIN, STORE_OWNER
 * - attempts a synchronous resend; useful for debugging and small setups.
 * - In production, your worker should handle retries and backoff.
 */
router.post(
  "/:id/notifications/:notificationId/retry",
  requireRole(["ADMIN", "STORE_OWNER"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const nid = String(req.params.notificationId);

      const notif = await prisma.notification.findUnique({
        where: { id: nid },
      });
      if (!notif || notif.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "notification_not_found",
        });

      // Example: if channel === "webhook" and metadata contains url, attempt immediate delivery
      if (notif.channel === "webhook") {
        const meta: any = notif.metadata ?? {};
        const targetUrl = meta.url ?? null;
        if (!targetUrl)
          return respond(res, 400, {
            success: false,
            error: "webhook_url_missing",
          });

        try {
          const resp = await axios.post(
            targetUrl,
            {
              id: notif.id,
              storeId,
              subject: notif.subject,
              body: notif.body,
              metadata: notif.metadata,
            },
            { timeout: 8000 }
          );
          await prisma.notification.update({
            where: { id: nid },
            data: {
              status: "SENT",
              providerResp: { status: resp.status, data: resp.data },
              sentAt: new Date(),
            },
          });
          return respond(res, 200, { success: true, data: { status: "SENT" } });
        } catch (sendErr: any) {
          console.error("Webhook retry failed:", sendErr?.message ?? sendErr);
          await prisma.notification.update({
            where: { id: nid },
            data: {
              status: "FAILED",
              providerResp: { error: String(sendErr?.message ?? sendErr) },
            },
          });
          return respond(res, 502, {
            success: false,
            error: "delivery_failed",
            details: String(sendErr?.message ?? sendErr),
          });
        }
      }

      // For email/sms channels we cannot synchronously send here; mark queued and let worker pick it
      await prisma.notification.update({
        where: { id: nid },
        data: { status: "QUEUED" },
      });
      return respond(res, 200, { success: true, data: { status: "QUEUED" } });
    } catch (err) {
      console.error("POST /notifications/:id/retry error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

export default router;
