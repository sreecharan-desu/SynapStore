-- CreateTable
CREATE TABLE "SupplierStore" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierStore_storeId_idx" ON "SupplierStore"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierStore_supplierId_storeId_key" ON "SupplierStore"("supplierId", "storeId");

-- AddForeignKey
ALTER TABLE "SupplierStore" ADD CONSTRAINT "SupplierStore_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierStore" ADD CONSTRAINT "SupplierStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
