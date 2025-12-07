// routes/v1/inventory.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";

const router = Router();

/**
 * Response helper
 */
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

/* -----------------------
   Validation schemas
   ----------------------- */

const createBatchSchema = z.object({
  medicineId: z.string().uuid(),
  batchNumber: z.string().optional().nullable(),
  qtyReceived: z.number().int().nonnegative(),
  expiryDate: z.string().optional().nullable(), // ISO string expected
  purchasePrice: z.number().optional().nullable(),
  mrp: z.number().optional().nullable(),
  receivedAt: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});

const adjustBatchSchema = z.object({
  delta: z.number().int(),
  reason: z.enum([
    "SALE",
    "ADJUSTMENT",
    "RETURN",
    "DAMAGE",
    "RECEIPT",
    "TRANSFER",
    "IMPORT",
  ]),
  note: z.string().optional().nullable(),
});

/* -----------------------
   Middleware chain
   ----------------------- */
router.use(authenticate);
router.use(storeContext);
router.use(requireStore);

/* -----------------------
   Routes
   ----------------------- */

/**
 * POST /v1/stores/:id/inventory
 * Create a new inventory batch and emit a StockMovement with reason RECEIPT
 * Allowed roles: STORE_OWNER, ADMIN, MANAGER
 */
router.post(
  "/:id/inventory",
  requireRole(["STORE_OWNER", "ADMIN", "MANAGER"]),
  async (req: any, res) => {
    try {
      const parsed = createBatchSchema.safeParse(req.body);
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
      const userId = req.user?.id ?? null;
      const payload = parsed.data;

      // confirm medicine exists and belongs to store
      const med = await prisma.medicine.findUnique({
        where: { id: payload.medicineId },
        select: { id: true, storeId: true },
      });
      if (!med || med.storeId !== storeId) {
        return respond(res, 404, {
          success: false,
          error: "medicine_not_found_for_store",
        });
      }

      // parse optional dates
      const expiryDate = payload.expiryDate
        ? new Date(payload.expiryDate)
        : undefined;
      const receivedAt = payload.receivedAt
        ? new Date(payload.receivedAt)
        : undefined;

      // Use transaction to create batch and movement atomically
      const result = await prisma.$transaction(async (tx) => {
        const batch = await tx.inventoryBatch.create({
          data: {
            storeId,
            medicineId: payload.medicineId,
            batchNumber: payload.batchNumber ?? undefined,
            qtyReceived: payload.qtyReceived,
            qtyAvailable: payload.qtyReceived,
            qtyReserved: 0,
            expiryDate: expiryDate ?? undefined,
            purchasePrice: payload.purchasePrice ?? undefined,
            mrp: payload.mrp ?? undefined,
            receivedAt: receivedAt ?? undefined,
            location: payload.location ?? undefined,
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            storeId,
            inventoryId: batch.id,
            medicineId: payload.medicineId,
            delta: payload.qtyReceived,
            reason: "RECEIPT",
            note: `Batch received: ${payload.batchNumber ?? "n/a"}`,
            performedById: userId ?? undefined,
          },
        });

        return { batch, movement };
      });

      return respond(res, 201, {
        success: true,
        data: { batchId: result.batch.id },
      });
    } catch (err: any) {
      console.error("POST /stores/:id/inventory error:", err);
      // Prisma unique/constraint handling
      if (err?.code === "P2002") {
        return respond(res, 409, { success: false, error: "conflict_error" });
      }
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * PATCH /v1/stores/:id/inventory/:batchId/adjust
 * Adjust quantity for a batch (delta positive or negative), create StockMovement
 * Allowed roles: STORE_OWNER, ADMIN, MANAGER
 * NOTE: STAFF adjustments via POS should call stock-movements/sale endpoint instead.
 */
router.patch(
  "/:id/inventory/:batchId/adjust",
  requireRole(["STORE_OWNER", "ADMIN", "MANAGER"]),
  async (req: any, res) => {
    try {
      const parsed = adjustBatchSchema.safeParse(req.body);
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
      const batchId = String(req.params.batchId);
      const userId = req.user?.id ?? null;
      const { delta, reason, note } = parsed.data;

      // Fetch current batch
      const batch = await prisma.inventoryBatch.findUnique({
        where: { id: batchId },
        select: {
          id: true,
          qtyAvailable: true,
          qtyReceived: true,
          storeId: true,
          medicineId: true,
        },
      });
      if (!batch || batch.storeId !== storeId) {
        return respond(res, 404, { success: false, error: "batch_not_found" });
      }

      const newQtyAvailable = batch.qtyAvailable + delta;
      if (newQtyAvailable < 0) {
        return respond(res, 400, {
          success: false,
          error: "insufficient_stock",
          details: { available: batch.qtyAvailable },
        });
      }

      // transactionally update batch and create movement
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.inventoryBatch.update({
          where: { id: batchId },
          data: {
            qtyAvailable: newQtyAvailable,
            // optionally adjust qtyReceived for positive RECEIPT/IMPORT
            qtyReceived:
              delta > 0 && (reason === "RECEIPT" || reason === "IMPORT")
                ? { increment: delta }
                : undefined,
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            storeId,
            inventoryId: batchId,
            medicineId: batch.medicineId,
            delta,
            reason: reason as any,
            note: note ?? undefined,
            performedById: userId ?? undefined,
          },
        });

        return { updated, movement };
      });

      return respond(res, 200, {
        success: true,
        data: { inventory: result.updated, movement: result.movement },
      });
    } catch (err: any) {
      console.error("PATCH /stores/:id/inventory/:batchId/adjust error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/inventory/:batchId
 * Return batch detail including recent movements
 */
router.get("/:id/inventory/:batchId", async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const batchId = String(req.params.batchId);

    const batch = await prisma.inventoryBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        storeId: true,
        medicineId: true,
        batchNumber: true,
        qtyReceived: true,
        qtyAvailable: true,
        qtyReserved: true,
        expiryDate: true,
        purchasePrice: true,
        mrp: true,
        receivedAt: true,
        location: true,
        createdAt: true,
        updatedAt: true,
        movements: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            delta: true,
            reason: true,
            note: true,
            performedById: true,
            createdAt: true,
          },
        },
      },
    });

    if (!batch || batch.storeId !== storeId) {
      return respond(res, 404, { success: false, error: "batch_not_found" });
    }

    // Optionally fetch medicine basic info
    const medicine = await prisma.medicine.findUnique({
      where: { id: batch.medicineId },
      select: { id: true, brandName: true, genericName: true, sku: true },
    });

    return respond(res, 200, { success: true, data: { batch, medicine } });
  } catch (err) {
    console.error("GET /stores/:id/inventory/:batchId error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

/**
 * GET /v1/stores/:id/inventory
 * List batches with filters (medicineId?, batchNumber?, expiryBefore?, limit, offset)
 */
router.get("/:id/inventory", async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const medicineId =
      typeof req.query.medicineId === "string" ? req.query.medicineId : null;
    const batchNumber =
      typeof req.query.batchNumber === "string" ? req.query.batchNumber : null;
    const expiryBefore =
      typeof req.query.expiryBefore === "string"
        ? new Date(req.query.expiryBefore)
        : null;
    const limit = Math.min(Math.max(Number(req.query.limit ?? 25), 1), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const where: any = { storeId };
    if (medicineId) where.medicineId = medicineId;
    if (batchNumber) where.batchNumber = batchNumber;
    if (expiryBefore) where.expiryDate = { lte: expiryBefore };

    // only return batches with qtyAvailable > 0 by default? Provide query param showZero to include zeros
    const includeZeros = req.query.showZero === "true";
    if (!includeZeros) {
      where.qtyAvailable = { gt: 0 };
    }

    const [items, total] = await Promise.all([
      prisma.inventoryBatch.findMany({
        where,
        orderBy: { expiryDate: "asc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          medicineId: true,
          batchNumber: true,
          qtyReceived: true,
          qtyAvailable: true,
          qtyReserved: true,
          expiryDate: true,
          mrp: true,
          purchasePrice: true,
          location: true,
          createdAt: true,
        },
      }),
      prisma.inventoryBatch.count({ where }),
    ]);

    // fetch basic medicine metadata in a single query
    const medIds = Array.from(new Set(items.map((i) => i.medicineId))).filter(
      Boolean
    );
    const meds =
      medIds.length > 0
        ? await prisma.medicine.findMany({
            where: { id: { in: medIds } },
            select: { id: true, brandName: true, genericName: true, sku: true },
          })
        : [];
    const medMap = Object.fromEntries(meds.map((m) => [m.id, m]));

    const result = items.map((it) => ({
      ...it,
      medicine: medMap[it.medicineId] ?? null,
    }));

    return respond(res, 200, {
      success: true,
      data: { items: result, total, limit, offset },
    });
  } catch (err) {
    console.error("GET /stores/:id/inventory error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

export default router;
