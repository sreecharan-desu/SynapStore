// src/routes/v1/medicines.ts
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
 * NOTE:
 * - All routes expect authenticate -> storeContext -> requireStore middleware chain
 * - Single-store mode assumed (storeId resolved from x-store-id header or storeId param)
 */

/* Schemas */
const createMedicineSchema = z.object({
  brandName: z.string().min(1),
  genericName: z.string().optional(),
  sku: z.string().optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  uom: z.string().optional(),
  category: z.string().optional(),
  taxInfo: z.any().optional(),
  isActive: z.boolean().optional(),
});

const updateMedicineSchema = createMedicineSchema.partial();

const createBatchSchema = z.object({
  medicineId: z.string().uuid(),
  batchNumber: z.string().optional(),
  qtyReceived: z.number().int().nonnegative(),
  mrp: z.number().positive().optional(),
  purchasePrice: z.number().positive().optional(),
  expiryDate: z.string().optional(), // ISO date
  receivedAt: z.string().optional(),
  location: z.string().optional(),
});

const updateBatchSchema = z.object({
  qtyAvailable: z.number().int().min(0).optional(),
  qtyReserved: z.number().int().min(0).optional(),
  mrp: z.number().positive().optional(),
  purchasePrice: z.number().positive().optional(),
  expiryDate: z.string().optional(),
  location: z.string().optional(),
  version: z.number().int().min(0), // required for optimistic locking
});

/* Middleware chain for these routes */
const guarded = [authenticate, storeContext, requireStore];

/* Helpers */
function respond(res: Response, status: number, body: object) {
  return res.status(status).json(body);
}

/* Medicines CRUD */

/**
 * GET /v1/medicines
 * query: q, page, perPage
 * returns medicines with aggregated qtyAvailable and active batch count
 */
router.get(
  "/",
  guarded,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store.id as string;
      const q = (req.query.q as string | undefined) ?? undefined;
      const page = Math.max(Number(req.query.page ?? 1), 1);
      const perPage = Math.min(
        Math.max(Number(req.query.perPage ?? 25), 1),
        200
      );

      const where: any = { storeId };
      if (q) {
        where.OR = [
          { brandName: { contains: q, mode: "insensitive" } },
          { genericName: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ];
      }

      const [total, meds] = await Promise.all([
        prisma.medicine.count({ where }),
        prisma.medicine.findMany({
          where,
          orderBy: { brandName: "asc" },
          skip: (page - 1) * perPage,
          take: perPage,
          select: {
            id: true,
            brandName: true,
            genericName: true,
            sku: true,
            dosageForm: true,
            strength: true,
            uom: true,
            category: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            // include aggregated inventory summary (sum across batches)
            inventory: {
              select: { qtyAvailable: true },
            },
          },
        }),
      ]);

      const list = meds.map((m) => {
        const totalAvailable = (m.inventory ?? []).reduce(
          (s, b) => s + (b.qtyAvailable ?? 0),
          0
        );
        return {
          id: m.id,
          brandName: m.brandName,
          genericName: m.genericName,
          sku: m.sku,
          dosageForm: m.dosageForm,
          strength: m.strength,
          uom: m.uom,
          category: m.category,
          isActive: m.isActive,
          totalAvailable,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        };
      });

      return respond(res, 200, {
        success: true,
        data: { total, page, perPage, medicines: list },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/medicines/:id
 * includes inventory batches (paginated)
 */
router.get(
  "/:id",
  guarded,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const storeId = req.store.id as string;

      const med = await prisma.medicine.findUnique({
        where: { id },
        include: {
          inventory: {
            where: { storeId },
            orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
            take: 200,
          },
        },
      });
      if (!med || med.storeId !== storeId)
        return respond(res, 404, { success: false, error: "not_found" });

      return respond(res, 200, { success: true, data: med });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/medicines
 */
router.post(
  "/",
  guarded,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = createMedicineSchema.safeParse(req.body);
      if (!parsed.success)
        return respond(res, 400, {
          success: false,
          error: "validation",
          details: parsed.error.issues,
        });

      const storeId = req.store.id as string;
      const d = parsed.data;

      const created = await prisma.medicine.create({
        data: {
          storeId,
          brandName: d.brandName,
          genericName: d.genericName ?? undefined,
          sku: d.sku ?? undefined,
          dosageForm: d.dosageForm ?? undefined,
          strength: d.strength ?? undefined,
          uom: d.uom ?? undefined,
          category: d.category ?? undefined,
          taxInfo: d.taxInfo ?? undefined,
          isActive: d.isActive ?? true,
        },
      });

      return respond(res, 201, { success: true, data: created });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /v1/medicines/:id
 */
router.put(
  "/:id",
  guarded,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = updateMedicineSchema.safeParse(req.body);
      if (!parsed.success)
        return respond(res, 400, {
          success: false,
          error: "validation",
          details: parsed.error.issues,
        });

      const { id } = req.params;
      const storeId = req.store.id as string;

      // ensure medicine belongs to store
      const existing = await prisma.medicine.findUnique({ where: { id } });
      if (!existing || existing.storeId !== storeId)
        return respond(res, 404, { success: false, error: "not_found" });

      const updated = await prisma.medicine.update({
        where: { id },
        data: {
          brandName: parsed.data.brandName ?? undefined,
          genericName: parsed.data.genericName ?? undefined,
          sku: parsed.data.sku ?? undefined,
          dosageForm: parsed.data.dosageForm ?? undefined,
          strength: parsed.data.strength ?? undefined,
          uom: parsed.data.uom ?? undefined,
          category: parsed.data.category ?? undefined,
          taxInfo: parsed.data.taxInfo ?? undefined,
          isActive: parsed.data.isActive ?? undefined,
        },
      });

      return respond(res, 200, { success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /v1/medicines/:id
 * Soft-delete by isActive=false (hard delete not allowed if batches exist)
 */
router.delete(
  "/:id",
  guarded,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const storeId = req.store.id as string;

      const existing = await prisma.medicine.findUnique({
        where: { id },
        include: { inventory: true },
      });
      if (!existing || existing.storeId !== storeId)
        return respond(res, 404, { success: false, error: "not_found" });

      if ((existing.inventory ?? []).length > 0) {
        // prefer soft-delete
        const soft = await prisma.medicine.update({
          where: { id },
          data: { isActive: false },
        });
        return respond(res, 200, {
          success: true,
          data: soft,
          message: "soft_deleted",
        });
      }

      // safe to delete
      await prisma.medicine.delete({ where: { id } });
      return respond(res, 200, { success: true, message: "deleted" });
    } catch (err) {
      next(err);
    }
  }
);

/* InventoryBatch CRUD + FEFO allocation */

/**
 * GET /v1/medicines/batches
 * query: medicineId, page, perPage, onlyAvailable=true
 */
router.get(
  "/batches/list",
  guarded,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store.id as string;
      const medicineId = req.query.medicineId as string | undefined;
      const onlyAvailable =
        String(req.query.onlyAvailable ?? "true").toLowerCase() === "true";
      const page = Math.max(Number(req.query.page ?? 1), 1);
      const perPage = Math.min(
        Math.max(Number(req.query.perPage ?? 25), 1),
        500
      );

      const where: any = { storeId };
      if (medicineId) where.medicineId = medicineId;
      if (onlyAvailable) where.qtyAvailable = { gt: 0 };

      const [total, batches] = await Promise.all([
        prisma.inventoryBatch.count({ where }),
        prisma.inventoryBatch.findMany({
          where,
          orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
          skip: (page - 1) * perPage,
          take: perPage,
        }),
      ]);

      return respond(res, 200, {
        success: true,
        data: { total, page, perPage, batches },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/medicines/batches
 * create inventory batch (receipt)
 */
router.post(
  "/batches",
  guarded,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = createBatchSchema.safeParse(req.body);
      if (!parsed.success)
        return respond(res, 400, {
          success: false,
          error: "validation",
          details: parsed.error.issues,
        });

      const storeId = req.store.id as string;
      const user = req.user!;
      const d = parsed.data;

      // verify medicine ownership
      const med = await prisma.medicine.findUnique({
        where: { id: d.medicineId },
      });
      if (!med || med.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "medicine_not_found",
        });

      const qty = Number(d.qtyReceived ?? 0);
      const batch = await prisma.$transaction(async (tx) => {
        const created = await tx.inventoryBatch.create({
          data: {
            storeId,
            medicineId: d.medicineId,
            batchNumber: d.batchNumber ?? undefined,
            qtyReceived: qty,
            qtyAvailable: qty,
            qtyReserved: 0,
            expiryDate: d.expiryDate ? new Date(d.expiryDate) : undefined,
            purchasePrice: d.purchasePrice ?? undefined,
            mrp: d.mrp ?? undefined,
            receivedAt: d.receivedAt ? new Date(d.receivedAt) : new Date(),
            location: d.location ?? undefined,
          },
        });

        await tx.stockMovement.create({
          data: {
            storeId,
            inventoryId: created.id,
            medicineId: d.medicineId,
            delta: qty,
            reason: "RECEIPT",
            note: `Manual batch created by ${user.username ?? user.id}`,
            performedById: user.id,
          },
        });

        return created;
      });

      return respond(res, 201, { success: true, data: batch });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /v1/medicines/batches/:id
 * Use optimistic locking: client must send { version } equal to current value; update increments version by 1.
 * If qtyAvailable changes, create StockMovement with delta = new - old (signed).
 */
router.put(
  "/batches/:id",
  guarded,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = updateBatchSchema.safeParse(req.body);
      if (!parsed.success)
        return respond(res, 400, {
          success: false,
          error: "validation",
          details: parsed.error.issues,
        });

      const { id } = req.params;
      const storeId = req.store.id as string;
      const user = req.user!;
      const d = parsed.data;

      // fetch existing
      const existing = await prisma.inventoryBatch.findUnique({
        where: { id },
      });
      if (!existing || existing.storeId !== storeId)
        return respond(res, 404, { success: false, error: "not_found" });

      // optimistic locking check
      if (existing.version !== d.version) {
        return respond(res, 409, {
          success: false,
          error: "version_conflict",
          currentVersion: existing.version,
        });
      }

      // compute updates
      const updates: any = {};
      if (typeof d.qtyAvailable === "number")
        updates.qtyAvailable = d.qtyAvailable;
      if (typeof d.qtyReserved === "number")
        updates.qtyReserved = d.qtyReserved;
      if (d.mrp !== undefined) updates.mrp = d.mrp;
      if (d.purchasePrice !== undefined)
        updates.purchasePrice = d.purchasePrice;
      if (d.expiryDate !== undefined)
        updates.expiryDate = d.expiryDate ? new Date(d.expiryDate) : null;
      if (d.location !== undefined) updates.location = d.location;

      // perform transactional update + optionally stock movement
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.inventoryBatch.update({
          where: { id },
          data: {
            ...updates,
            version: { increment: 1 },
            updatedAt: new Date(),
          },
        });

        // stock movement if qtyAvailable changed
        if (
          typeof d.qtyAvailable === "number" &&
          d.qtyAvailable !== existing.qtyAvailable
        ) {
          const delta = d.qtyAvailable - existing.qtyAvailable;
          await tx.stockMovement.create({
            data: {
              storeId,
              inventoryId: id,
              medicineId: existing.medicineId,
              delta,
              reason: delta < 0 ? "SALE" : "ADJUSTMENT",
              note: `Batch update by ${user.username ?? user.id}`,
              performedById: user.id,
            },
          });
        }

        return updated;
      });

      return respond(res, 200, { success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /v1/medicines/batches/:id
 * Only allow delete when qtyAvailable == 0 to avoid losing stock data.
 */
router.delete(
  "/batches/:id",
  guarded,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const storeId = req.store.id as string;

      const existing = await prisma.inventoryBatch.findUnique({
        where: { id },
      });
      if (!existing || existing.storeId !== storeId)
        return respond(res, 404, { success: false, error: "not_found" });

      if ((existing.qtyAvailable ?? 0) > 0)
        return respond(res, 400, { success: false, error: "batch_not_empty" });

      await prisma.inventoryBatch.delete({ where: { id } });
      return respond(res, 200, { success: true, message: "deleted" });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/medicines/batches/allocate
 * Body: { medicineId: string, qty: number, apply: boolean (default false) }
 * - Finds FEFO-ordered batches (expiryDate asc nulls last, receivedAt asc)
 * - Returns allocation plan
 * - If apply=true -> attempts to atomically decrement qtyAvailable on selected batches (optimistic updates using versions)
 * - Returns allocated batches and any failures (version conflicts or insufficient stock)
 */
router.post(
  "/batches/allocate",
  guarded,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        medicineId: z.string().uuid(),
        qty: z.number().int().positive(),
        apply: z.boolean().optional().default(false),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success)
        return respond(res, 400, {
          success: false,
          error: "validation",
          details: parsed.error.issues,
        });

      const { medicineId, qty, apply } = parsed.data;
      const storeId = req.store.id as string;
      const user = req.user!;

      // fetch eligible batches ordered FEFO
      const batches = await prisma.inventoryBatch.findMany({
        where: { storeId, medicineId, qtyAvailable: { gt: 0 } },
        orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
      });

      let remaining = qty;
      const plan: Array<{
        batchId: string;
        take: number;
        available: number;
        version: number;
      }> = [];

      for (const b of batches) {
        if (remaining <= 0) break;
        const available = Math.max(
          0,
          (b.qtyAvailable ?? 0) - (b.qtyReserved ?? 0)
        );
        if (available <= 0) continue;
        const take = Math.min(available, remaining);
        plan.push({ batchId: b.id, take, available, version: b.version ?? 0 });
        remaining -= take;
      }

      if (remaining > 0) {
        return respond(res, 400, {
          success: false,
          error: "insufficient_stock",
          requested: qty,
          allocated: qty - remaining,
          plan,
        });
      }

      if (!apply) {
        return respond(res, 200, {
          success: true,
          applied: false,
          requested: qty,
          plan,
        });
      }

      // APPLY allocation: iterate plan and update batches atomically with optimistic version check
      const applyResults: Array<{
        batchId: string;
        take: number;
        ok: boolean;
        error?: string;
      }> = [];
      for (const p of plan) {
        const expectedVersion = p.version;
        const newQtyAvailable = p.available - p.take;

        // try conditional update (version check) using updateMany where id & version
        const updatedCount = await prisma.inventoryBatch.updateMany({
          where: { id: p.batchId, version: expectedVersion },
          data: {
            qtyAvailable: newQtyAvailable,
            version: { increment: 1 },
          } as any,
        });

        if (updatedCount.count !== 1) {
          applyResults.push({
            batchId: p.batchId,
            take: p.take,
            ok: false,
            error: "version_conflict",
          });
          continue;
        }

        // create stockMovement record for sale decrement
        await prisma.stockMovement.create({
          data: {
            storeId,
            inventoryId: p.batchId,
            medicineId,
            delta: -p.take,
            reason: "SALE",
            note: `Allocation for sale by ${user.username ?? user.id}`,
            performedById: user.id,
          },
        });

        applyResults.push({ batchId: p.batchId, take: p.take, ok: true });
      }

      const anyFailed = applyResults.some((r) => !r.ok);
      if (anyFailed) {
        return respond(res, 409, {
          success: false,
          error: "partial_failure",
          appliedResults: applyResults,
        });
      }

      return respond(res, 200, {
        success: true,
        applied: true,
        requested: qty,
        appliedResults: applyResults,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
