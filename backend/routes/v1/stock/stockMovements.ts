// routes/v1/stockMovements.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";

const router = Router();
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

/* Schemas */
const saleItemSchema = z.object({
  medicineId: z.string().uuid(),
  qty: z.number().int().positive(),
  price: z.number().nullable().optional(),
  batchId: z.string().nullable().optional(),
});

const createMovementSchema = z.object({
  items: z.array(saleItemSchema).min(1),
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

/* Middleware */
router.use(authenticate);
router.use(storeContext);
router.use(requireStore);

/**
 * POST /v1/stores/:id/stock-movements
 * roles allowed: STAFF, MANAGER, ADMIN, STORE_OWNER
 *
 * For SALE:
 *  - consumes FEFO batches for each medicineId
 *  - creates StockMovement rows for each batch consumed
 *  - updates inventoryBatch.qtyAvailable
 *  - writes ActivityLog as a small receipt (receiptId)
 *
 * For other reasons:
 *  - if batchId provided on item -> adjust that batch only
 *  - otherwise apply to FEFO batches similarly
 */
router.post(
  "/:id/stock-movements",
  requireRole(["STAFF", "MANAGER", "ADMIN", "STORE_OWNER"]),
  async (req: any, res) => {
    try {
      const parsed = createMovementSchema.safeParse(req.body);
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
      const { items, reason, note } = parsed.data;

      // Aggregate total required per medicine
      const totalsByMedicine = new Map<string, number>();
      for (const it of items) {
        totalsByMedicine.set(
          it.medicineId,
          (totalsByMedicine.get(it.medicineId) || 0) + it.qty
        );
      }

      // Check total availability for each medicine
      for (const [medicineId, required] of totalsByMedicine.entries()) {
        const agg = await prisma.inventoryBatch.aggregate({
          where: { storeId, medicineId, qtyAvailable: { gt: 0 } },
          _sum: { qtyAvailable: true },
        });
        const available = Number(agg._sum.qtyAvailable ?? 0);
        if (available < required) {
          return respond(res, 400, {
            success: false,
            error: "insufficient_stock",
            details: { medicineId, required, available },
          });
        }
      }

      // We'll accumulate movements and batch updates to return
      const movementsCreated: any[] = [];

      // Transaction: consume batches and create movements atomically
      const result = await prisma.$transaction(async (tx) => {
        // For each item, consume either the provided batchId or FEFO batches
        for (const item of items) {
          let qtyToConsume = item.qty;

          if (item.batchId) {
            // adjust the specific batch
            const batch = await tx.inventoryBatch.findUnique({
              where: { id: item.batchId },
            });
            if (!batch || batch.storeId !== storeId) {
              throw new Error(`batch_not_found:${item.batchId}`);
            }
            if (
              reason === "SALE" ||
              reason === "DAMAGE" ||
              reason === "RETURN" ||
              reason === "ADJUSTMENT"
            ) {
              const newQty = batch.qtyAvailable - qtyToConsume;
              if (newQty < 0) {
                throw new Error(`insufficient_stock_batch:${item.batchId}`);
              }
              await tx.inventoryBatch.update({
                where: { id: item.batchId },
                data: { qtyAvailable: newQty },
              });
              const mv = await tx.stockMovement.create({
                data: {
                  storeId,
                  inventoryId: item.batchId,
                  medicineId: item.medicineId,
                  delta: -qtyToConsume,
                  reason: reason as any,
                  note: note ?? undefined,
                  performedById: userId ?? undefined,
                },
              });
              movementsCreated.push(mv);
              qtyToConsume = 0;
            } else {
              // receipt/import etc - positive delta
              const newQty = batch.qtyAvailable + qtyToConsume;
              await tx.inventoryBatch.update({
                where: { id: item.batchId },
                data: {
                  qtyAvailable: newQty,
                  qtyReceived: { increment: qtyToConsume },
                },
              });
              const mv = await tx.stockMovement.create({
                data: {
                  storeId,
                  inventoryId: item.batchId,
                  medicineId: item.medicineId,
                  delta: qtyToConsume,
                  reason: reason as any,
                  note: note ?? undefined,
                  performedById: userId ?? undefined,
                },
              });
              movementsCreated.push(mv);
              qtyToConsume = 0;
            }
          } else {
            // FEFO consumption: order by expiryDate asc (nulls last), then receivedAt asc
            while (qtyToConsume > 0) {
              // pick next batch with qtyAvailable > 0
              const nextBatch = await tx.inventoryBatch.findFirst({
                where: {
                  storeId,
                  medicineId: item.medicineId,
                  qtyAvailable: { gt: 0 },
                },
                orderBy: [
                  { expiryDate: "asc" as const },
                  { receivedAt: "asc" as const },
                  { createdAt: "asc" as const },
                ],
                select: { id: true, qtyAvailable: true },
              });

              if (!nextBatch) {
                throw new Error(`insufficient_stock_fefo:${item.medicineId}`);
              }

              const take = Math.min(qtyToConsume, nextBatch.qtyAvailable);
              const newQty = nextBatch.qtyAvailable - take;

              await tx.inventoryBatch.update({
                where: { id: nextBatch.id },
                data: { qtyAvailable: newQty },
              });

              const mv = await tx.stockMovement.create({
                data: {
                  storeId,
                  inventoryId: nextBatch.id,
                  medicineId: item.medicineId,
                  delta: -take,
                  reason: reason as any,
                  note: note ?? undefined,
                  performedById: userId ?? undefined,
                },
              });

              movementsCreated.push(mv);
              qtyToConsume -= take;
            }
          }
        }

        // Create a lightweight ActivityLog as a receipt/transaction record
        const receipt = await tx.activityLog.create({
          data: {
            storeId,
            userId: userId ?? undefined,
            action: reason === "SALE" ? "SALE_RECEIPT" : `STOCK_${reason}`,
            payload: {
              items: items.map((it) => ({
                medicineId: it.medicineId,
                qty: it.qty,
                price: it.price ?? null,
              })),
              movements: movementsCreated.map((m) => ({
                id: m.id,
                inventoryId: m.inventoryId,
                delta: m.delta,
              })),
              note: note ?? null,
            },
          },
        });

        return { receiptId: receipt.id, movements: movementsCreated };
      });

      return respond(res, 201, { success: true, data: result });
    } catch (err: any) {
      console.error("POST /stores/:id/stock-movements error:", err);

      // Map thrown errors to client-friendly responses
      const msg = String(err?.message ?? "");
      if (msg.startsWith("batch_not_found:")) {
        return respond(res, 404, {
          success: false,
          error: "batch_not_found",
          details: { batchId: msg.split(":")[1] },
        });
      }
      if (
        msg.startsWith("insufficient_stock_batch:") ||
        msg.startsWith("insufficient_stock_fefo:") ||
        msg.startsWith("insufficient_stock:")
      ) {
        // normalize
        const parts = msg.split(":");
        return respond(res, 400, {
          success: false,
          error: "insufficient_stock",
          details: { reason: parts[0], id: parts[1] ?? null },
        });
      }

      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/stock-movements
 * list movements with filters
 * query: medicineId?, from?, to?, limit, offset
 */
router.get("/:id/stock-movements", async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const medicineId =
      typeof req.query.medicineId === "string" ? req.query.medicineId : null;
    const from =
      typeof req.query.from === "string" ? new Date(req.query.from) : null;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : null;
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const where: any = { storeId };
    if (medicineId) where.medicineId = medicineId;
    if (from || to) where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          inventoryId: true,
          medicineId: true,
          delta: true,
          reason: true,
          note: true,
          performedById: true,
          createdAt: true,
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return respond(res, 200, {
      success: true,
      data: { items, total, limit, offset },
    });
  } catch (err) {
    console.error("GET /stores/:id/stock-movements error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

export default router;
