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
 * POST /v1/reorders
 * Create a reorder draft (from client or auto-generated from alerts)
 */
const createReorderSchema = z.object({
  supplierId: z.string().uuid(),
  items: z
    .array(
      z.object({
        medicineId: z.string().uuid(),
        qty: z.number().int().positive(),
        price: z.number().optional(),
      })
    )
    .min(1),
  externalRef: z.string().optional(),
});

router.post(
  "/",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = createReorderSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const store = req.store!;
      const user = req.user!;

      const totalValue = parsed.data.items.reduce(
        (s, i) => s + Number(i.price ?? 0) * i.qty,
        0
      );

      const created = await prisma.$transaction(async (tx) => {
        const r = await tx.reorder.create({
          data: {
            storeId: store.id,
            supplierId: parsed.data.supplierId,
            createdById: user.id,
            totalValue,
            status: "DRAFT",
            externalRef: parsed.data.externalRef ?? undefined,
          },
        });

        const items = parsed.data.items.map((it) => ({
          reorderId: r.id,
          medicineId: it.medicineId,
          qty: it.qty,
          price: it.price ?? undefined,
        }));
        await tx.reorderItem.createMany({ data: items });

        await tx.activityLog.create({
          data: {
            storeId: store.id,
            userId: user.id,
            action: "reorder_created",
            payload: { reorderId: r.id, items: items.length },
          },
        });

        return tx.reorder.findUnique({
          where: { id: r.id },
          include: { items: true },
        });
      });

      return res
        .status(201)
        .json({ success: true, data: { reorder: created } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /v1/reorders/:id
 * Update reorder status or items (partial support). Body can contain: status, items[] (replace).
 */
const patchReorderSchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "SENT",
      "CONFIRMED",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      "CANCELLED",
      "FAILED",
    ])
    .optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        medicineId: z.string().uuid(),
        qty: z.number().int().positive(),
        price: z.number().optional(),
      })
    )
    .optional(),
});

router.patch(
  "/:id",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const reorderId = String(req.params.id);
      const parsed = patchReorderSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const store = req.store!;
      const user = req.user!;

      const existing = await prisma.reorder.findUnique({
        where: { id: reorderId },
        select: { id: true, storeId: true, status: true },
      });
      if (!existing || existing.storeId !== store.id)
        return res
          .status(404)
          .json({ success: false, error: "reorder_not_found" });

      const updated = await prisma.$transaction(async (tx) => {
        if (parsed.data.items) {
          // simple replace: delete existing items then insert new ones
          await tx.reorderItem.deleteMany({ where: { reorderId } });
          const items = parsed.data.items.map((it) => ({
            reorderId,
            medicineId: it.medicineId,
            qty: it.qty,
            price: it.price ?? undefined,
          }));
          await tx.reorderItem.createMany({ data: items });
        }

        if (parsed.data.status) {
          await tx.reorder.update({
            where: { id: reorderId },
            data: { status: parsed.data.status },
          });
        }

        await tx.activityLog.create({
          data: {
            storeId: store.id,
            userId: user.id,
            action: "reorder_updated",
            payload: {
              reorderId,
              status: parsed.data.status ?? existing.status,
            },
          },
        });

        return tx.reorder.findUnique({
          where: { id: reorderId },
          include: { items: true },
        });
      });

      return res.json({ success: true, data: { reorder: updated } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/reorders
 * list reorders for store (filter by status)
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
      const where: any = { storeId: store.id };
      if (status) where.status = status;

      const reorders = await prisma.reorder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              medicine: { select: { brandName: true, genericName: true } },
            },
          },
          supplier: true,
        },
      });

      return res.json({ success: true, data: { reorders } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
