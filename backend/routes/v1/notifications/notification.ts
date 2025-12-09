// src/routes/v1/notifications.ts
import { Router } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import {
  storeContext,
  requireStore,
  RequestWithUser,
} from "../../../middleware/store";
import { notificationQueue } from "../../../lib/queue";
import { z } from "zod";

const router = Router();

const enqueueSchema = z.object({
  channel: z.enum(["email", "in-app", "webhook"]),
  recipient: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  metadata: z.any().optional(),
  storeId: z.string().optional(), // allow superadmin to pass storeId
});

router.post(
  "/queue",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res) => {
    const parsed = enqueueSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid" });

    const user = req.user!;
    const storeId = parsed.data.storeId ?? req.store!.id;

    // write notification in db (transactional outbox pattern - caller should call in same tx in real usage)
    const notif = await prisma.notification.create({
      data: {
        storeId,
        userId: user.id,
        channel: parsed.data.channel,
        recipient: parsed.data.recipient ?? "",
        subject: parsed.data.subject ?? null,
        body: parsed.data.body ?? null,
        metadata: parsed.data.metadata ?? null,
        status: "QUEUED",
      },
    });

    // enqueue job
    await notificationQueue.add("deliver", {
      type: parsed.data.channel,
      notificationId: notif.id,
    });

    return res.json({ success: true, notificationId: notif.id });
  }
);

router.get(
  "/",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res) => {
    const storeId = req.store!.id;
    const rows = await prisma.notification.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return res.json({ success: true, rows });
  }
);

export default router;
