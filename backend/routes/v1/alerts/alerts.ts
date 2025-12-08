import { Router, Request, Response, NextFunction } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import {
  storeContext,
  requireStore,
  RequestWithUser,
} from "../../../middleware/store";
import { z } from "zod";

const router = Router();

/**
 * GET /v1/alerts
 * Query: status?, type?, limit?, since?
 */
router.get(
  "/",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = req.store!;
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const type =
        typeof req.query.type === "string" ? req.query.type : undefined;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 500);
      const since = req.query.since
        ? new Date(String(req.query.since))
        : undefined;

      const where: any = { storeId: store.id };
      if (status) where.status = status;
      if (type) where.type = type;
      if (since) where.createdAt = { gte: since };

      const alerts = await prisma.alert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          acknowledgedBy: { select: { id: true, username: true, email: true } },
        },
      });

      return res.json({ success: true, data: { alerts } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/alerts
 * Create a custom alert (admin/store owner/manager)
 */
const createAlertSchema = z.object({
  type: z.string(),
  metadata: z.any().optional(),
  severity: z.number().int().min(0).max(10).optional(),
});

router.post(
  "/",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = createAlertSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const store = req.store!;
      const user = req.user!;
      const alert = await prisma.alert.create({
        data: {
          storeId: store.id,
          type: parsed.data.type as any,
          metadata: parsed.data.metadata ?? undefined,
          severity: parsed.data.severity ?? undefined,
        },
      });

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "alert_created",
          payload: { id: alert.id, type: parsed.data.type },
        },
      });

      return res.status(201).json({ success: true, data: { alert } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /v1/alerts/:id/ack
 * Acknowledge or resolve an alert: { status: "ACKNOWLEDGED" | "RESOLVED" }
 */
const ackSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "RESOLVED"]),
});

router.patch(
  "/:id/ack",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = ackSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const store = req.store!;
      const user = req.user!;
      const alertId = String(req.params.id);

      const alert = await prisma.alert.findUnique({ where: { id: alertId } });
      if (!alert || alert.storeId !== store.id)
        return res
          .status(404)
          .json({ success: false, error: "alert_not_found" });

      const updated = await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: parsed.data.status as any,
          acknowledgedBy:
            parsed.data.status === "ACKNOWLEDGED"
              ? { connect: { id: user.id } }
              : undefined,
          acknowledgedAt:
            parsed.data.status === "ACKNOWLEDGED" ? new Date() : undefined,
        },
      });

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "alert_ack",
          payload: { id: updated.id, status: updated.status },
        },
      });

      return res.json({ success: true, data: { alert: updated } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
