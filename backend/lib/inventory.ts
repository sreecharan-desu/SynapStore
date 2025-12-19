
import prisma from "./prisma";
import { StockMovementReason } from "@prisma/client";

export interface InventoryItemInput {
  medicineId: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: Date;
  purchasePrice?: number;
  mrp?: number;
  location?: string;
}

/**
 * Service to handle inventory operations ensuring integrity.
 */
export const InventoryService = {
  /**
   * Adds inventory from a supplier fulfillment (Reorder).
   * Creates InventoryBatch, StockMovement, and records the Upload.
   */
  async fulfillReorder(
    storeId: string,
    supplierId: string,
    requestId: string,
    items: InventoryItemInput[],
    performedById?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Create Upload Record to track this batch
      const upload = await tx.upload.create({
        data: {
          storeId,
          filename: `reorder_fulfillment_${requestId}.json`,
          status: "APPLIED",
          metadata: {
            source: "supplier_reorder_fulfillment",
            requestId,
            supplierId,
            itemCount: items.length
          }
        }
      });

      const results = [];

      for (const item of items) {
        // 2. Create InventoryBatch
        // We create a new batch for each item received. 
        // Logic: specific batches are good for tracking expiry/supplier.
        const batch = await tx.inventoryBatch.create({
          data: {
            storeId,
            medicineId: item.medicineId,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            qtyReceived: item.quantity,
            qtyAvailable: item.quantity,
            qtyReserved: 0,
            purchasePrice: item.purchasePrice,
            mrp: item.mrp,
            receivedAt: new Date(),
            location: item.location,
            version: 0
          }
        });

        // 3. Create StockMovement (RECEIPT)
        await tx.stockMovement.create({
          data: {
            storeId,
            inventoryId: batch.id,
            medicineId: item.medicineId,
            delta: item.quantity,
            reason: StockMovementReason.RECEIPT,
            note: `Reorder Fulfillment (Req: ${requestId})`,
            performedById: performedById, // Triggered by supplier user or system
          }
        });

        results.push(batch);
      }

      // 4. Update SupplierRequest Status to FULFILLED
      await tx.supplierRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" } // Added in recent schema update
      });

      await tx.activityLog.create({
        data: {
          storeId,
          userId: performedById,
          action: "reorder_received",
          payload: {
            requestId,
            supplierId,
            uploadId: upload.id,
            batchesCreated: results.length
          }
        }
      });

      return { upload, batches: results };
    }, { timeout: 45000 });
  }
};
