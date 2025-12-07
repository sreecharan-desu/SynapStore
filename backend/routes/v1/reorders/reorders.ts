// routes/v1/reorders.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";

const router = Router();
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

/* -----------------------
   Validation schemas
   ----------------------- */

const reorderItemSchema = z.object({
  medicineId: z.string().uuid(),
  qty: z.number().int().min(1),
  price: z.number().optional().nullable(), // expected unit price (purchase)
  sku: z.string().optional().nullable(),
  batchPref: z.string().optional().nullable(),
});

const createReorderSchema = z.object({
  supplierId: z.string().uuid(),
  items: z.array(reorderItemSchema).min(1),
  autoSend: z.boolean().optional().default(false),
  note: z.string().optional().nullable(),
});

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
        id: z.string().uuid().optional(), // existing item id if editing
        medicineId: z.string().uuid(),
        qty: z.number().int().min(1),
        price: z.number().optional().nullable(),
        sku: z.string().optional().nullable(),
        batchPref: z.string().optional().nullable(),
      })
    )
    .optional(),
  note: z.string().optional().nullable(),
});

const receiveSchema = z.object({
  items: z
    .array(
      z.object({
        reorderItemId: z.string().uuid(),
        qtyReceived: z.number().int().min(0),
        batchNumber: z.string().optional().nullable(),
        expiryDate: z.string().optional().nullable(),
        purchasePrice: z.number().optional().nullable(),
        mrp: z.number().optional().nullable(),
      })
    )
    .min(1),
  receiptReference: z.string().optional().nullable(),
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
 * POST /v1/stores/:id/reorders
 * Create reorder (DRAFT by default)
 * Allowed roles: MANAGER, ADMIN, STORE_OWNER
 */
router.post(
  "/:id/reorders",
  requireRole(["MANAGER", "ADMIN", "STORE_OWNER"]),
  async (req: any, res) => {
    try {
      const parsed = createReorderSchema.safeParse(req.body);
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
      const { supplierId, items, autoSend, note } = parsed.data;

      // Validate supplier belongs to store
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, storeId: true, isActive: true },
      });
      if (!supplier || supplier.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "supplier_not_found",
        });

      // Validate medicines exist in store and compute total value
      let totalValue = 0;
      for (const it of items) {
        const med = await prisma.medicine.findUnique({
          where: { id: it.medicineId },
          select: { id: true, storeId: true },
        });
        if (!med || med.storeId !== storeId)
          return respond(res, 404, {
            success: false,
            error: "medicine_not_found",
            details: { medicineId: it.medicineId },
          });
        totalValue += Number(it.price ?? 0) * Number(it.qty);
      }

      // Create reorder and items transactionally
      const reorder = await prisma.$transaction(async (tx) => {
        const created = await tx.reorder.create({
          data: {
            storeId,
            supplierId,
            createdById: userId ?? undefined,
            totalValue: totalValue > 0 ? totalValue : undefined,
            status: "DRAFT",
          },
        });

        const createdItems: any[] = [];
        for (const it of items) {
          const row: any = await tx.reorderItem.create({
            data: {
              reorderId: created.id,
              medicineId: it.medicineId,
              qty: it.qty,
              price: it.price ?? undefined,
              sku: it.sku ?? undefined,
              batchPref: it.batchPref ?? undefined,
            },
          });
          createdItems.push(row);
        }

        return { reorder: created, items: createdItems };
      });

      // Optionally auto-send (attempt to send, but do not fail create if sending fails)
      if (autoSend) {
        try {
          // We call the send endpoint logic here (simple internal send)
          await prisma.reorder.update({
            where: { id: reorder.reorder.id },
            data: { status: "SENT", externalRef: null },
          });
          // In real integration, you would call external API and set externalRef accordingly
        } catch (sendErr) {
          console.error("Auto-send failed for reorder:", sendErr);
        }
      }

      return respond(res, 201, {
        success: true,
        data: { reorderId: reorder.reorder.id },
      });
    } catch (err) {
      console.error("POST /reorders error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * POST /v1/stores/:id/reorders/:reorderId/send
 * Send reorder to supplier (set status SENT and optionally call external provider)
 * Allowed roles: ADMIN, STORE_OWNER
 */
router.post(
  "/:id/reorders/:reorderId/send",
  requireRole(["ADMIN", "STORE_OWNER"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const reorderId = String(req.params.reorderId);
      const userId = req.user?.id ?? null;

      const reorder = await prisma.reorder.findUnique({
        where: { id: reorderId },
        select: { id: true, storeId: true, status: true, supplierId: true },
      });
      if (!reorder || reorder.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "reorder_not_found",
        });

      if (reorder.status !== "DRAFT") {
        return respond(res, 400, {
          success: false,
          error: "invalid_status_transition",
          details: { from: reorder.status, to: "SENT" },
        });
      }

      // For demo: mark SENT and set updatedAt. In real world, try sending via email/SMS/integrated supplier API and set externalRef.
      const updated = await prisma.reorder.update({
        where: { id: reorderId },
        data: { status: "SENT", updatedAt: new Date() },
      });

      // Write activity log
      await prisma.activityLog.create({
        data: {
          storeId,
          userId: userId ?? undefined,
          action: "REORDER_SENT",
          payload: { reorderId },
        },
      });

      return respond(res, 200, { success: true, data: updated });
    } catch (err) {
      console.error("POST /reorders/:reorderId/send error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * PATCH /v1/stores/:id/reorders/:reorderId
 * Edit reorder (items allowed when DRAFT), or change status with validation.
 * Allowed: MANAGER (edit draft), ADMIN/STORE_OWNER (full edits/status transitions)
 */
router.patch(
  "/:id/reorders/:reorderId",
  requireRole(["MANAGER", "ADMIN", "STORE_OWNER"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const reorderId = String(req.params.reorderId);
      const userRole = req.user?.globalRole ?? null; // SUPERADMIN bypass is in requireRole middleware

      const parsed = patchReorderSchema.safeParse(req.body);
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
      const body = parsed.data;

      const existing = await prisma.reorder.findUnique({
        where: { id: reorderId },
        select: { id: true, storeId: true, status: true },
      });
      if (!existing || existing.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "reorder_not_found",
        });

      // If items provided, only allow editing when current status is DRAFT and caller is MANAGER/ADMIN/OWNER
      if (body.items && body.items.length > 0) {
        if (existing.status !== "DRAFT")
          return respond(res, 400, {
            success: false,
            error: "cannot_edit_items_unless_draft",
          });

        // Replace items transactionally: delete old items and create new ones
        await prisma.$transaction(async (tx) => {
          await tx.reorderItem.deleteMany({ where: { reorderId } });
          let total = 0;
          for (const it of body.items!) {
            // assert medicine belongs to store
            const med = await tx.medicine.findUnique({
              where: { id: it.medicineId },
              select: { id: true, storeId: true },
            });
            if (!med || med.storeId !== storeId)
              throw new Error(`medicine_not_found:${it.medicineId}`);
            total += Number(it.price ?? 0) * Number(it.qty);
            await tx.reorderItem.create({
              data: {
                reorderId,
                medicineId: it.medicineId,
                qty: it.qty,
                price: it.price ?? undefined,
                sku: it.sku ?? undefined,
                batchPref: it.batchPref ?? undefined,
              },
            });
          }
          await tx.reorder.update({
            where: { id: reorderId },
            data: { totalValue: total > 0 ? total : undefined },
          });
        });
      }

      // Status transitions: enforce allowed transitions and roles
      if (body.status) {
        const from = existing.status;
        const to = body.status;

        const allowedTransitions: Record<string, string[]> = {
          DRAFT: ["SENT", "CANCELLED"],
          SENT: ["CONFIRMED", "CANCELLED", "FAILED"],
          CONFIRMED: ["PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
          PARTIALLY_RECEIVED: ["RECEIVED", "CANCELLED"],
          RECEIVED: [],
          CANCELLED: [],
          FAILED: [],
        };

        if (!allowedTransitions[from]?.includes(to)) {
          return respond(res, 400, {
            success: false,
            error: "invalid_status_transition",
            details: { from, to },
          });
        }

        // require elevated role for some transitions
        const elevateRequired = [
          "CONFIRMED",
          "RECEIVED",
          "CANCELLED",
          "FAILED",
        ];
        if (
          elevateRequired.includes(to) &&
          !["ADMIN", "STORE_OWNER"].includes(req.user?.globalRole ?? "")
        ) {
          return respond(res, 403, {
            success: false,
            error: "insufficient_role",
          });
        }

        // Apply status change and audit
        await prisma.$transaction(async (tx) => {
          await tx.reorder.update({
            where: { id: reorderId },
            data: { status: to, updatedAt: new Date() },
          });
          await tx.activityLog.create({
            data: {
              storeId,
              userId: req.user?.id ?? undefined,
              action: "REORDER_STATUS_CHANGE",
              payload: { reorderId, from, to, note: body.note ?? null },
            },
          });
        });
      }

      return respond(res, 200, { success: true });
    } catch (err: any) {
      console.error("PATCH /reorders/:reorderId error:", err);
      const msg = String(err?.message ?? "");
      if (msg.startsWith("medicine_not_found:")) {
        return respond(res, 404, {
          success: false,
          error: "medicine_not_found",
          details: { id: msg.split(":")[1] },
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
 * GET /v1/stores/:id/reorders/:reorderId
 * Retrieve reorder with items and audit trail
 * Allowed: any member of store (or supplier if mapped; for now require store membership)
 */
router.get("/:id/reorders/:reorderId", async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const reorderId = String(req.params.reorderId);

    const reorder = await prisma.reorder.findUnique({
      where: { id: reorderId },
      include: {
        items: {
          select: {
            id: true,
            medicineId: true,
            qty: true,
            price: true,
            sku: true,
            batchPref: true,
          },
        },
        supplier: {
          select: { id: true, name: true, phone: true, contactName: true },
        },
        createdBy: { select: { id: true, username: true } },
      },
    });

    if (!reorder || reorder.storeId !== storeId)
      return respond(res, 404, { success: false, error: "reorder_not_found" });

    // fetch audit trail entries for this reorder
    const audit = await prisma.activityLog.findMany({
      where: {
        storeId,
        action: { contains: "REORDER" },
        payload: { path: ["reorderId"], equals: reorderId } as any,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return respond(res, 200, { success: true, data: { reorder, audit } });
  } catch (err) {
    console.error("GET /reorders/:reorderId error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

/**
 * POST /v1/stores/:id/reorders/:reorderId/receive
 * Process a received shipment: create InventoryBatch rows for received items and update reorder status
 * Allowed: ADMIN, STORE_OWNER, MANAGER
 *
 * Request body: { items: [{ reorderItemId, qtyReceived, batchNumber?, expiryDate?, purchasePrice? }], receiptReference? }
 *
 * Behavior:
 * - Validate reorder and reorder items
 * - For each received item: create InventoryBatch (or update existing batch if batchNumber matches)
 * - Create StockMovement(RECEIPT) entries for each created/updated batch
 * - Update Reorder status to PARTIALLY_RECEIVED or RECEIVED based on totals
 * - Transactional
 */
router.post(
  "/:id/reorders/:reorderId/receive",
  requireRole(["ADMIN", "STORE_OWNER", "MANAGER"]),
  async (req: any, res) => {
    try {
      const parsed = receiveSchema.safeParse(req.body);
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
      const reorderId = String(req.params.reorderId);
      const userId = req.user?.id ?? null;
      const { items, receiptReference } = parsed.data;

      const reorder:any = await prisma.reorder.findUnique({
        where: { id: reorderId },
        select: { id: true, storeId: true, status: true },
      });

      if (!reorder || reorder.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "reorder_not_found",
        });

      // Map reorderItemId -> reorder item
      const reorderItemsMap = Object.fromEntries(
        reorder.items.map((it: any) => [it.id, it])
      );

      // Validate each incoming receive row maps to a reorder item
      for (const r of items) {
        if (!reorderItemsMap[r.reorderItemId])
          return respond(res, 404, {
            success: false,
            error: "reorder_item_not_found",
            details: { reorderItemId: r.reorderItemId },
          });
        if (r.qtyReceived <= 0)
          return respond(res, 400, {
            success: false,
            error: "invalid_qty_received",
            details: { reorderItemId: r.reorderItemId },
          });
      }

      // Transaction: create batches & movements, and update reorder status/values
      const result = await prisma.$transaction(async (tx) => {
        const createdBatches: any[] = [];
        let totalReceivedCount = 0;
        let totalOrderedCount = 0;

        // compute totals of ordered qty
        for (const it of reorder.items) totalOrderedCount += Number(it.qty);

        for (const r of items) {
          const orderItem = reorderItemsMap[r.reorderItemId];
          const medicineId = orderItem.medicineId;
          const qtyReceived = r.qtyReceived;
          totalReceivedCount += qtyReceived;

          // If batchNumber provided, try to find an existing batch to update; else create a new batch
          let batch: any = null;
          if (r.batchNumber) {
            batch = await tx.inventoryBatch.findFirst({
              where: { storeId, medicineId, batchNumber: r.batchNumber },
            });
          }

          if (batch) {
            // update existing batch quantities
            const updated = await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: {
                qtyReceived: { increment: qtyReceived },
                qtyAvailable: { increment: qtyReceived },
                purchasePrice: r.purchasePrice ?? undefined,
                mrp: r.mrp ?? undefined,
                expiryDate: r.expiryDate ? new Date(r.expiryDate) : undefined,
              },
            });

            const mv = await tx.stockMovement.create({
              data: {
                storeId,
                inventoryId: updated.id,
                medicineId,
                delta: qtyReceived,
                reason: "RECEIPT",
                note: `Receive for reorder ${reorderId}, item ${r.reorderItemId}`,
                performedById: userId ?? undefined,
              },
            });
            createdBatches.push({
              batchId: updated.id,
              movementId: mv.id,
              qtyReceived,
            });
          } else {
            // create new batch
            const newBatch = await tx.inventoryBatch.create({
              data: {
                storeId,
                medicineId,
                batchNumber: r.batchNumber ?? undefined,
                qtyReceived,
                qtyAvailable: qtyReceived,
                expiryDate: r.expiryDate ? new Date(r.expiryDate) : undefined,
                purchasePrice: r.purchasePrice ?? undefined,
                mrp: r.mrp ?? undefined,
                receivedAt: new Date(),
              },
            });

            const mv = await tx.stockMovement.create({
              data: {
                storeId,
                inventoryId: newBatch.id,
                medicineId,
                delta: qtyReceived,
                reason: "RECEIPT",
                note: `Receive for reorder ${reorderId}, item ${r.reorderItemId}`,
                performedById: userId ?? undefined,
              },
            });

            createdBatches.push({
              batchId: newBatch.id,
              movementId: mv.id,
              qtyReceived,
            });
          }
        }

        // Update reorder status: PARTIALLY_RECEIVED or RECEIVED
        let newStatus: any = reorder.status;
        if (totalReceivedCount >= totalOrderedCount) newStatus = "RECEIVED";
        else newStatus = "PARTIALLY_RECEIVED";

        const updatedReorder = await tx.reorder.update({
          where: { id: reorderId },
          data: { status: newStatus, updatedAt: new Date() },
        });

        // Activity log entry
        await tx.activityLog.create({
          data: {
            storeId,
            userId: userId ?? undefined,
            action: "REORDER_RECEIVE",
            payload: {
              reorderId,
              receiptReference: receiptReference ?? null,
              createdBatches,
            },
          },
        });

        return { createdBatches, updatedReorder };
      });

      return respond(res, 200, { success: true, data: result });
    } catch (err: any) {
      console.error("POST /reorders/:reorderId/receive error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/reorders
 * List reorders for store with filters
 * query: status?, supplierId?, limit, offset
 */
router.get("/:id/reorders", async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const supplierId =
      typeof req.query.supplierId === "string"
        ? req.query.supplierId
        : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const where: any = { storeId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const [items, total] = await Promise.all([
      prisma.reorder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          items: true,
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { id: true, username: true } },
        },
      }),
      prisma.reorder.count({ where }),
    ]);

    return respond(res, 200, {
      success: true,
      data: { items, total, limit, offset },
    });
  } catch (err) {
    console.error("GET /reorders list error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

export default router;
