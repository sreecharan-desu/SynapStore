/*
  Warnings:

  - The `status` column on the `Notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `items` on the `Reorder` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,storeId]` on the table `UserStoreRole` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- DropIndex
DROP INDEX "Medicine_ndc_key";

-- DropIndex
DROP INDEX "UserStoreRole_userId_storeId_role_key";

-- AlterTable
ALTER TABLE "Medicine" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "status",
ADD COLUMN     "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED';

-- AlterTable
ALTER TABLE "Reorder" DROP COLUMN "items";

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "globalRole" "Role";

-- CreateTable
CREATE TABLE "ReorderItem" (
    "id" TEXT NOT NULL,
    "reorderId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DECIMAL(12,2),
    "sku" TEXT,
    "batchPref" TEXT,

    CONSTRAINT "ReorderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryBatch_storeId_expiryDate_medicineId_idx" ON "InventoryBatch"("storeId", "expiryDate", "medicineId");

-- CreateIndex
CREATE INDEX "Notification_storeId_status_idx" ON "Notification"("storeId", "status");

-- CreateIndex
CREATE INDEX "Reorder_supplierId_status_idx" ON "Reorder"("supplierId", "status");

-- CreateIndex
CREATE INDEX "StockMovement_storeId_createdAt_idx" ON "StockMovement"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_userId_key" ON "Supplier"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStoreRole_userId_storeId_key" ON "UserStoreRole"("userId", "storeId");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderItem" ADD CONSTRAINT "ReorderItem_reorderId_fkey" FOREIGN KEY ("reorderId") REFERENCES "Reorder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderItem" ADD CONSTRAINT "ReorderItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
