
import { PrismaClient } from "@prisma/client";

/**
 * Service to handle deep/cascading deletions and complex entity management at the Application Level.
 * This ensures data integrity even if the database schema does not have ON DELETE CASCADE configured.
 */

// Helper to ensure transaction context
type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export const EntityManager = {
  
  /**
   * Deletes a Store and ALL its dependent entities safely.
   */
  async deleteStore(storeId: string, tx: TxClient) {
    // 1. Delete dependent leaf nodes first to avoid FK violations
    
    // Delete StockMovements (refer: Store, Inventory, Medicine)
    await tx.stockMovement.deleteMany({ where: { storeId } });

    // Delete SaleItems (refer: Sale, Medicine, Inventory)
    // We must find sales first or deletion by sale will handle it if we delete Sales? 
    // Sale -> SaleItem. If we delete Sale, SaleItem must go.
    // But SaleItem also refers to Medicine/Inventory.
    // If we delete Medicine first, SaleItem blocks. 
    // So we delete SaleItems first.
    // Finding all SaleIds for this store:
    const sales = await tx.sale.findMany({ where: { storeId }, select: { id: true } });
    const saleIds = sales.map(s => s.id);
    if (saleIds.length > 0) {
        await tx.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
    }

    // Delete Sales
    await tx.sale.deleteMany({ where: { storeId } });

    // Delete InventoryBatches (refer: Store, Medicine)
    await tx.inventoryBatch.deleteMany({ where: { storeId } });

    // Delete Medicines (refer: Store)
    // Note: Implicit Relation MedicineToSupplier (join table) is handled by Prisma Client usually, 
    // but explicit delete of Medicine is safe.
    await tx.medicine.deleteMany({ where: { storeId } });

    // Delete Supplier Relations
    await tx.supplierRequest.deleteMany({ where: { storeId } });
    await tx.supplierStore.deleteMany({ where: { storeId } });

    // Delete Uploads
    await tx.upload.deleteMany({ where: { storeId } });

    // Delete OTPs
    await tx.otp.deleteMany({ where: { storeId } });

    // Delete ActivityLogs
    await tx.activityLog.deleteMany({ where: { storeId } });

    // Delete UserStoreRoles (access)
    await tx.userStoreRole.deleteMany({ where: { storeId } });

    // Finally, Delete Store
    await tx.store.delete({ where: { id: storeId } });
  },

  /**
   * Deletes a Supplier profile and clean up.
   */
  async deleteSupplier(supplierId: string, tx: TxClient) {
    // Delete Requests
    await tx.supplierRequest.deleteMany({ where: { supplierId } });

    // Delete Connections
    await tx.supplierStore.deleteMany({ where: { supplierId } });

    // Note: Medicine relation is correct (Many-to-Many). Prisma handles join table.
    
    // Delete Supplier
    await tx.supplier.delete({ where: { id: supplierId } });
  },

  /**
   * Deletes a User and handles ownership transfer/deletion of stores.
   */
  async deleteUser(userId: string, tx: TxClient) {
    // 1. Handle Stores Owned by this user
    // Find stores where this user is the only owner?
    // Actually, prompt says "Delete user removes or reassigns ownership".
    // "Delete store if no other owners exist".
    
    const roles = await tx.userStoreRole.findMany({
        where: { userId },
        include: { store: true }
    });

    for (const role of roles) {
        if (role.role === 'STORE_OWNER') {
             // Check if other owners exist
             const otherOwners = await tx.userStoreRole.count({
                 where: { 
                     storeId: role.storeId, 
                     role: 'STORE_OWNER',
                     userId: { not: userId }
                 }
             });
             
             if (otherOwners === 0) {
                 // Sole owner -> Delete the store
                 await EntityManager.deleteStore(role.storeId, tx);
             } else {
                 // Others exist -> Just remove this user's access (happens later via deleteMany)
             }
        }
    }

    // 2. Remove Roles (if not deleted by store deletion above)
    await tx.userStoreRole.deleteMany({ where: { userId } });

    // 3. Delete Supplier Profile if exists
    const supplier = await tx.supplier.findUnique({ where: { userId } });
    if (supplier) {
        await EntityManager.deleteSupplier(supplier.id, tx);
    }

    // 4. Clean up auxiliary data
    await tx.otp.deleteMany({ where: { userId } });
    
    // SetNull for logs/sales/movements
    // "No orphaned rows" -> SetNull prevents orphan error, keeps history anonymous
    await tx.activityLog.updateMany({
        where: { userId },
        data: { userId: null }
    });
    
    await tx.stockMovement.updateMany({
        where: { performedById: userId },
        data: { performedById: null }
    });

    await tx.sale.updateMany({
        where: { createdById: userId },
        data: { createdById: null }
    });

    // 5. Delete User
    await tx.user.delete({ where: { id: userId } });
  }
};
