-- CreateEnum
CREATE TYPE "SupplierRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "SupplierStore" ADD COLUMN     "linkedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupplierRequest" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "message" TEXT,
    "status" "SupplierRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierRequest_storeId_status_idx" ON "SupplierRequest"("storeId", "status");

-- CreateIndex
CREATE INDEX "SupplierRequest_supplierId_status_idx" ON "SupplierRequest"("supplierId", "status");

-- CreateIndex
CREATE INDEX "SupplierStore_supplierId_idx" ON "SupplierStore"("supplierId");

-- AddForeignKey
ALTER TABLE "SupplierRequest" ADD CONSTRAINT "SupplierRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierRequest" ADD CONSTRAINT "SupplierRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
