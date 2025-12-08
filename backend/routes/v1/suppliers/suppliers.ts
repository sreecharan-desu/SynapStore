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
 * Supplier CRUD
 */
const supplierSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  contactName: z.string().optional(),
  defaultLeadTime: z.number().int().optional(),
  defaultMOQ: z.number().int().optional(),
});

/* Create */
router.post(
  "/",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = supplierSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const store = req.store!;
      const user = req.user!;

      const s = await prisma.supplier.create({
        data: {
          storeId: store.id,
          name: parsed.data.name,
          address: parsed.data.address ?? undefined,
          phone: parsed.data.phone ?? undefined,
          contactName: parsed.data.contactName ?? undefined,
          defaultLeadTime: parsed.data.defaultLeadTime ?? undefined,
          defaultMOQ: parsed.data.defaultMOQ ?? undefined,
        },
      });

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "supplier_created",
          payload: { supplierId: s.id },
        },
      });

      return res.status(201).json({ success: true, data: { supplier: s } });
    } catch (err) {
      next(err);
    }
  }
);

/* List */
router.get(
  "/",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = req.store!;
      const suppliers = await prisma.supplier.findMany({
        where: { storeId: store.id },
        orderBy: { name: "asc" },
      });
      return res.json({ success: true, data: { suppliers } });
    } catch (err) {
      next(err);
    }
  }
);

/* Update */
router.put(
  "/:id",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = supplierSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const store = req.store!;
      const user = req.user!;
      const id = String(req.params.id);

      const existing = await prisma.supplier.findUnique({
        where: { id },
        select: { id: true, storeId: true },
      });
      if (!existing || existing.storeId !== store.id)
        return res
          .status(404)
          .json({ success: false, error: "supplier_not_found" });

      const updated = await prisma.supplier.update({
        where: { id },
        data: {
          name: parsed.data.name,
          address: parsed.data.address ?? undefined,
          phone: parsed.data.phone ?? undefined,
          contactName: parsed.data.contactName ?? undefined,
          defaultLeadTime: parsed.data.defaultLeadTime ?? undefined,
          defaultMOQ: parsed.data.defaultMOQ ?? undefined,
        },
      });

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "supplier_updated",
          payload: { supplierId: id },
        },
      });

      return res.json({ success: true, data: { supplier: updated } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/suppliers/:id/receive
 * Receive a shipment for a supplier: creates InventoryBatch + StockMovement + links medicine if needed.
 * Body: { items: [{ medicineId, sku?, brandName?, batchNumber?, qtyReceived, mrp?, purchasePrice?, expiryDate?, location? }] }
 */
const receiveSchema = z.object({
  items: z
    .array(
      z.object({
        medicineId: z.string().uuid().optional(),
        sku: z.string().optional(),
        brandName: z.string().optional(),
        batchNumber: z.string().optional(),
        qtyReceived: z.number().int().nonnegative(),
        mrp: z.number().optional(),
        purchasePrice: z.number().optional(),
        expiryDate: z.string().optional(),
        location: z.string().optional(),
      })
    )
    .min(1),
});

router.post(
  "/:id/receive",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const supplierId = String(req.params.id);
      const parsed = receiveSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const store = req.store!;
      const user = req.user!;

      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier || supplier.storeId !== store.id)
        return res
          .status(404)
          .json({ success: false, error: "supplier_not_found" });

      const results: any[] = [];

      for (const it of parsed.data.items) {
        // resolve medicine: prefer provided medicineId else try sku/brand
        let medicine: any = null;
        if (it.medicineId) {
          medicine = await prisma.medicine.findUnique({
            where: { id: it.medicineId },
            select: { id: true },
          });
        } else if (it.sku) {
          medicine = await prisma.medicine.findFirst({
            where: { storeId: store.id, sku: it.sku },
            select: { id: true },
          });
        } else if (it.brandName) {
          medicine = await prisma.medicine.findFirst({
            where: { storeId: store.id, brandName: it.brandName },
            select: { id: true },
          });
        }

        if (!medicine) {
          // create minimal medicine
          const createdMed = await prisma.medicine.create({
            data: {
              storeId: store.id,
              brandName: String(it.brandName ?? "Unknown"),
            },
            select: { id: true },
          });
          medicine = createdMed;
        }

        const qty = Number(it.qtyReceived ?? 0);
        const batch = await prisma.inventoryBatch.create({
          data: {
            storeId: store.id,
            medicineId: medicine.id,
            batchNumber: it.batchNumber ?? undefined,
            qtyReceived: qty,
            qtyAvailable: qty,
            expiryDate: it.expiryDate ? new Date(it.expiryDate) : undefined,
            purchasePrice: it.purchasePrice ?? undefined,
            mrp: it.mrp ?? undefined,
            receivedAt: new Date(),
            location: it.location ?? undefined,
          },
          select: { id: true, qtyAvailable: true },
        });

        await prisma.stockMovement.create({
          data: {
            storeId: store.id,
            inventoryId: batch.id,
            medicineId: medicine.id,
            delta: qty,
            reason: "RECEIPT",
            note: `Received from supplier ${supplier.name}`,
            performedById: user.id,
          },
        });

        // connect supplier -> medicine (best-effort)
        await prisma.supplier
          .update({
            where: { id: supplierId },
            data: { medicines: { connect: { id: medicine.id } } },
          })
          .catch(() => {});

        results.push({ medicineId: medicine.id, batchId: batch.id, qty });
      }

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "supplier_receive",
          payload: { supplierId, count: results.length },
        },
      });

      return res
        .status(201)
        .json({ success: true, data: { received: results } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
