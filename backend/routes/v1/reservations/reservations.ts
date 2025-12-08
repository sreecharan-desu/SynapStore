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
 * POST /v1/reservations
 * Create reservation (hold stock). Body: { expiresAt, items: [{ medicineId, qty }] }
 */
const createResSchema = z.object({
  expiresAt: z.string().optional(),
  items: z
    .array(
      z.object({
        medicineId: z.string().uuid(),
        qty: z.number().int().positive(),
      })
    )
    .min(1),
});

router.post(
  "/",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = createResSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const store = req.store!;
      const user = req.user!;
      const expiresAt = parsed.data.expiresAt
        ? new Date(parsed.data.expiresAt)
        : new Date(Date.now() + 30 * 60 * 1000); // default 30m

      // perform allocation FEFO for each item and reserve qtyReserved on inventoryBatch
      const reservation = await prisma.$transaction(async (tx) => {
        const r = await tx.reservation.create({
          data: {
            storeId: store.id,
            createdById: user.id,
            expiresAt,
            status: "PENDING",
          },
        });

        for (const it of parsed.data.items) {
          // get batches FEFO
          const batches = await tx.inventoryBatch.findMany({
            where: {
              storeId: store.id,
              medicineId: it.medicineId,
              qtyAvailable: { gt: 0 },
            },
            orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
            select: { id: true, qtyAvailable: true },
            take: 50,
          });

          let remaining = it.qty;
          for (const b of batches) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, b.qtyAvailable);
            // update qtyReserved and qtyAvailable atomically
            await tx.inventoryBatch.update({
              where: { id: b.id },
              data: {
                qtyReserved: { increment: take },
                qtyAvailable: { decrement: take },
                version: { increment: 1 },
              },
            });

            await tx.reservationItem.create({
              data: { reservationId: r.id, inventoryBatchId: b.id, qty: take },
            });

            remaining -= take;
          }

          if (remaining > 0) throw new Error("insufficient_stock");
        }

        await tx.activityLog.create({
          data: {
            storeId: store.id,
            userId: user.id,
            action: "reservation_created",
            payload: { reservationId: r.id },
          },
        });

        return r;
      });

      return res.status(201).json({ success: true, data: { reservation } });
    } catch (err: any) {
      if (String(err.message) === "insufficient_stock")
        return res
          .status(400)
          .json({ success: false, error: "insufficient_stock" });
      next(err);
    }
  }
);

/**
 * POST /v1/reservations/:id/confirm
 * Confirm reservation -> mark status CONFIRMED (keeps reserved quantities reserved until sale or release)
 */
router.post(
  "/:id/confirm",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const store = req.store!;
      const user = req.user!;

      const r = await prisma.reservation.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!r || r.storeId !== store.id)
        return res
          .status(404)
          .json({ success: false, error: "reservation_not_found" });

      if (r.status === "CONFIRMED")
        return res.json({ success: true, message: "already_confirmed" });

      await prisma.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
      });

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "reservation_confirmed",
          payload: { reservationId: id },
        },
      });

      return res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/reservations/:id/cancel
 * Cancel -> release reserved qty back to qtyAvailable and mark CANCELLED
 */
router.post(
  "/:id/cancel",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const store = req.store!;
      const user = req.user!;

      const r = await prisma.reservation.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!r || r.storeId !== store.id)
        return res
          .status(404)
          .json({ success: false, error: "reservation_not_found" });

      if (r.status === "CANCELLED")
        return res.json({ success: true, message: "already_cancelled" });

      await prisma.$transaction(async (tx) => {
        for (const it of r.items) {
          await tx.inventoryBatch.update({
            where: { id: it.inventoryBatchId },
            data: {
              qtyReserved: { decrement: it.qty },
              qtyAvailable: { increment: it.qty },
              version: { increment: 1 },
            },
          });
        }
        await tx.reservation.update({
          where: { id },
          data: { status: "CANCELLED" },
        });
        await tx.activityLog.create({
          data: {
            storeId: store.id,
            userId: user.id,
            action: "reservation_cancelled",
            payload: { reservationId: id },
          },
        });
      });

      return res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
