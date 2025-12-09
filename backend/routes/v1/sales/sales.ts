// src/routes/v1/sales.ts
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
 * Input: create sale
 * items: [{ medicineId, inventoryBatchId? , qty, unitPrice? }]
 * optional: patientID, prescriptionId, paymentMethod (optional - default PENDING)
 */
const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        medicineId: z.string().uuid(),
        inventoryBatchId: z.string().uuid().optional(),
        qty: z.number().int().positive(),
        unitPrice: z.number().positive().optional(),
      })
    )
    .min(1),
  patientID: z.number().int().positive().optional(),
  prescriptionId: z.number().int().optional(),
  paymentMethod: z
    .enum(["CASH", "CARD", "UPI", "INSURANCE", "OTHER"])
    .optional(),
  discounts: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
});

/**
 * Input: pay sale
 */
const paySaleSchema = z.object({
  paymentMethod: z
    .enum(["CASH", "CARD", "UPI", "INSURANCE", "OTHER"])
    .optional(),
  externalRef: z.string().optional(),
});

/**
 * Helper: allocate quantity from FEFO batches for a medicine.
 * Returns array of { batch, qtyTaken } in order.
 */
async function allocateBatchesFefo(
  tx: any,
  storeId: string,
  medicineId: string,
  qtyNeeded: number
) {
  const allocations: Array<{
    batchId: string;
    qty: number;
    batchVersion: number;
  }> = [];
  if (qtyNeeded <= 0) return allocations;

  // fetch available batches ordered by expiry asc then receivedAt asc
  const batches = await tx.inventoryBatch.findMany({
    where: { storeId, medicineId, qtyAvailable: { gt: 0 } },
    orderBy: [{ expiryDate: "asc" }, { receivedAt: "asc" }],
    select: { id: true, qtyAvailable: true, version: true },
    take: 50, // safety cap
  });

  let remaining = qtyNeeded;
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, b.qtyAvailable);
    allocations.push({ batchId: b.id, qty: take, batchVersion: b.version });
    remaining -= take;
  }

  if (remaining > 0) {
    // not enough stock
    throw new Error("insufficient_stock");
  }

  return allocations;
}

/**
 * POST /v1/sales
 * Create sale and decrement inventory (creates stock movements).
 */
router.post(
  "/",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = createSaleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });
      }
      const store = req.store!;
      const user = req.user!;
      const body = parsed.data;

      // Build subtotal + line totals (unitPrice may be provided; fallback to medicine price? we'll require unitPrice if needed)
      // We'll sum unitPrice * qty; if unitPrice missing treat as 0
      let subtotal = 0;
      for (const it of body.items) {
        subtotal += Number(it.unitPrice ?? 0) * it.qty;
      }
      const tax = Number(body.tax ?? 0);
      const discounts = Number(body.discounts ?? 0);
      const totalValue = Math.max(0, subtotal + tax - discounts);

      // perform transaction: create Sale, create SaleItems, allocate batches and decrement qty, create StockMovements, activity log
      const sale = await prisma.$transaction(async (tx) => {
        const saleRow = await tx.sale.create({
          data: {
            storeId: store.id,
            createdById: user.id,
            subtotal,
            tax,
            discounts,
            totalValue,
            paymentMethod: body.paymentMethod ?? undefined,
            paymentStatus: "PENDING",
          },
        });

        // For each item allocate batches (if inventoryBatchId provided -> use that single batch)
        for (const it of body.items) {
          let itemQtyRemaining = it.qty;
          if (it.inventoryBatchId) {
            // single-batch flow: check availability and decrement
            const batch = await tx.inventoryBatch.findUnique({
              where: { id: it.inventoryBatchId },
              select: {
                id: true,
                qtyAvailable: true,
                medicineId: true,
                version: true,
                storeId: true,
              },
            });
            if (!batch || batch.storeId !== store.id)
              throw new Error("invalid_batch");
            if (batch.qtyAvailable < it.qty)
              throw new Error("insufficient_stock");
            // decrement batch and bump version
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: {
                qtyAvailable: { decrement: it.qty },
                version: { increment: 1 },
              },
            });

            // create sale item tied to batch
            const saleItem = await tx.saleItem.create({
              data: {
                saleId: saleRow.id,
                medicineId: it.medicineId,
                inventoryBatchId: batch.id,
                qty: it.qty,
                unitPrice: it.unitPrice ?? undefined,
                lineTotal: (it.unitPrice
                  ? it.unitPrice * it.qty
                  : undefined) as any,
              },
            });

            // create single stock movement
            await tx.stockMovement.create({
              data: {
                storeId: store.id,
                inventoryId: batch.id,
                medicineId: it.medicineId,
                delta: -it.qty,
                reason: "SALE",
                note: `Sale ${saleRow.id} by ${user.username ?? user.id}`,
                performedById: user.id,
                saleItemId: saleItem.id,
              },
            });
          } else {
            // FEFO allocation across batches
            const allocations = await allocateBatchesFefo(
              tx,
              store.id,
              it.medicineId,
              it.qty
            );

            // create a SaleItem record representing the line (we'll keep inventoryBatchId null because allocation may be multiple)
            const saleItemRow = await tx.saleItem.create({
              data: {
                saleId: saleRow.id,
                medicineId: it.medicineId,
                inventoryBatchId: undefined,
                qty: it.qty,
                unitPrice: it.unitPrice ?? undefined,
                lineTotal: (it.unitPrice
                  ? it.unitPrice * it.qty
                  : undefined) as any,
              },
            });

            // for each allocation decrement corresponding batch and create stockMovement linking to saleItemRow
            for (const alloc of allocations) {
              await tx.inventoryBatch.update({
                where: { id: alloc.batchId },
                data: {
                  qtyAvailable: { decrement: alloc.qty },
                  version: { increment: 1 },
                },
              });

              await tx.stockMovement.create({
                data: {
                  storeId: store.id,
                  inventoryId: alloc.batchId,
                  medicineId: it.medicineId,
                  delta: -alloc.qty,
                  reason: "SALE",
                  note: `Sale ${saleRow.id} by ${user.username ?? user.id}`,
                  performedById: user.id,
                  saleItemId: saleItemRow.id,
                },
              });
            }
          }
        }

        // create activity log
        await tx.activityLog.create({
          data: {
            storeId: store.id,
            userId: user.id,
            action: "sale_created",
            payload: { saleId: saleRow.id, itemsCount: body.items.length },
          },
        });

        // return created sale minimal
        return tx.sale.findUnique({
          where: { id: saleRow.id },
          select: {
            id: true,
            paymentStatus: true,
            totalValue: true,
            createdAt: true,
          },
        });
      });

      return res.status(201).json({
        success: true,
        sale,
      });
    } catch (err: any) {
      if (String(err.message) === "insufficient_stock") {
        return res
          .status(400)
          .json({ success: false, error: "insufficient_stock" });
      }
      if (String(err.message) === "invalid_batch") {
        return res.status(400).json({ success: false, error: "invalid_batch" });
      }
      next(err);
    }
  }
);

/**
 * POST /v1/sales/:id/pay
 * Mark sale as paid. Idempotent: if already PAID, just return.
 */
router.post(
  "/:id/pay",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const saleId = String(req.params.id);
      const parsed = paySaleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });
      }
      const { paymentMethod, externalRef } = parsed.data;
      const store = req.store!;
      const user = req.user!;

      // fetch sale & ensure belongs to store
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        select: { id: true, storeId: true, paymentStatus: true },
      });
      if (!sale || sale.storeId !== store.id)
        return res
          .status(404)
          .json({ success: false, error: "sale_not_found" });

      if (sale.paymentStatus === "PAID") {
        return res.json({ success: true, message: "already_paid" });
      }

      const updated = await prisma.sale.update({
        where: { id: saleId },
        data: {
          paymentStatus: "PAID",
          paymentMethod: paymentMethod ?? undefined,
          externalRef: externalRef ?? undefined,
          updatedAt: new Date(),
        },
      });

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "sale_paid",
          payload: { saleId, paymentMethod, externalRef },
        },
      });

      return res.json({
        success: true,
        sale: { id: updated.id, paymentStatus: updated.paymentStatus },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/sales/:id/receipt
 * Returns simple HTML receipt for printing.
 */
router.get(
  "/:id/receipt",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const saleId = String(req.params.id);
      const store = req.store!;
      const user = req.user!;

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          items: {
            include: {
              medicine: {
                select: { brandName: true, genericName: true, sku: true },
              },
              inventoryBatch: { select: { batchNumber: true } },
            },
          },
          createdBy: { select: { id: true, username: true } },
        },
      });

      if (!sale || sale.storeId !== store.id)
        return res
          .status(404)
          .json({ success: false, error: "sale_not_found" });

      // build simple HTML receipt
      const company = store.name ?? "Store";
      const createdAt =
        sale.createdAt?.toISOString() ?? new Date().toISOString();

      const itemsHtml = sale.items
        .map((it) => {
          const med = it.medicine;
          const name = med
            ? `${med.brandName}${
                med.genericName ? ` (${med.genericName})` : ""
              }`
            : "Item";
          const batch = (it as any).inventoryBatch?.batchNumber ?? "";
          const price = Number(it.unitPrice ?? 0).toFixed(2);
          const line = Number(
            it.lineTotal ?? Number(it.unitPrice ?? 0) * it.qty
          ).toFixed(2);
          return `<tr>
            <td>${name}</td>
            <td>${batch}</td>
            <td style="text-align:center">${it.qty}</td>
            <td style="text-align:right">${price}</td>
            <td style="text-align:right">${line}</td>
          </tr>`;
        })
        .join("");

      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Receipt - ${sale.id}</title>
<style>
body { font-family: Arial, sans-serif; margin: 12px; color:#111 }
.header { text-align:center; }
table { width:100%; border-collapse: collapse; margin-top:12px }
td, th { padding:6px; border-bottom:1px solid #eee }
.total { font-weight:700; }
.small { font-size: 12px; color:#666 }
</style>
</head>
<body>
  <div class="header">
    <h2>${company}</h2>
    <div class="small">Receipt: ${sale.id}</div>
    <div class="small">Date: ${new Date(createdAt).toLocaleString()}</div>
  </div>

  <div style="margin-top:12px">
    <strong>Customer:</strong> Walk-in<br/>
    <strong>Cashier:</strong> ${
      sale.createdBy?.username ?? user.username ?? "system"
    }
  </div>

  <table>
    <thead>
      <tr><th>Item</th><th>Batch</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Line</th></tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
    <tfoot>
      <tr><td colspan="4" style="text-align:right">Subtotal</td><td style="text-align:right">${Number(
        sale.subtotal ?? 0
      ).toFixed(2)}</td></tr>
      <tr><td colspan="4" style="text-align:right">Tax</td><td style="text-align:right">${Number(
        sale.tax ?? 0
      ).toFixed(2)}</td></tr>
      <tr><td colspan="4" style="text-align:right">Discounts</td><td style="text-align:right">-${Number(
        sale.discounts ?? 0
      ).toFixed(2)}</td></tr>
      <tr class="total"><td colspan="4" style="text-align:right">Total</td><td style="text-align:right">${Number(
        sale.totalValue ?? 0
      ).toFixed(2)}</td></tr>
    </tfoot>
  </table>

  <div style="margin-top:18px" class="small">
    Payment status: ${sale.paymentStatus} ${
        sale.paymentMethod ? `| Method: ${sale.paymentMethod}` : ""
      }
  </div>

  <div style="margin-top:18px" class="small">
    Thank you for your purchase.
  </div>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
