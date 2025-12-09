/*
  Warnings:

  - You are about to drop the column `patientID` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `prescriptionId` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the column `errorsCount` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the column `fileRef` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the column `preview` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the column `processedAt` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the column `rowsProcessed` on the `Upload` table. All the data in the column will be lost.
  - You are about to drop the `Alert` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Doctor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FeatureFlag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Forecast` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Insurance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Patient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Prescription` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PrescriptionItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Reorder` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReorderItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Reservation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReservationItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StoreHealth` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Upload` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_ackById_fkey";

-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Doctor" DROP CONSTRAINT "Doctor_storeId_fkey";

-- DropForeignKey
ALTER TABLE "FeatureFlag" DROP CONSTRAINT "FeatureFlag_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Forecast" DROP CONSTRAINT "Forecast_medicineId_fkey";

-- DropForeignKey
ALTER TABLE "Forecast" DROP CONSTRAINT "Forecast_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_insuranceId_fkey";

-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_patientID_fkey";

-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_physID_fkey";

-- DropForeignKey
ALTER TABLE "Prescription" DROP CONSTRAINT "Prescription_storeId_fkey";

-- DropForeignKey
ALTER TABLE "PrescriptionItem" DROP CONSTRAINT "PrescriptionItem_medicineId_fkey";

-- DropForeignKey
ALTER TABLE "PrescriptionItem" DROP CONSTRAINT "PrescriptionItem_prescriptionId_fkey";

-- DropForeignKey
ALTER TABLE "Reorder" DROP CONSTRAINT "Reorder_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Reorder" DROP CONSTRAINT "Reorder_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Reorder" DROP CONSTRAINT "Reorder_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "ReorderItem" DROP CONSTRAINT "ReorderItem_medicineId_fkey";

-- DropForeignKey
ALTER TABLE "ReorderItem" DROP CONSTRAINT "ReorderItem_reorderId_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_storeId_fkey";

-- DropForeignKey
ALTER TABLE "ReservationItem" DROP CONSTRAINT "ReservationItem_inventoryBatchId_fkey";

-- DropForeignKey
ALTER TABLE "ReservationItem" DROP CONSTRAINT "ReservationItem_reservationId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_patientID_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_prescriptionId_fkey";

-- DropForeignKey
ALTER TABLE "StoreHealth" DROP CONSTRAINT "StoreHealth_storeId_fkey";

-- DropForeignKey
ALTER TABLE "Upload" DROP CONSTRAINT "Upload_createdById_fkey";

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "patientID",
DROP COLUMN "prescriptionId";

-- AlterTable
ALTER TABLE "Upload" DROP COLUMN "createdById",
DROP COLUMN "errorsCount",
DROP COLUMN "fileRef",
DROP COLUMN "mimeType",
DROP COLUMN "preview",
DROP COLUMN "processedAt",
DROP COLUMN "rowsProcessed",
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "filename" DROP NOT NULL;

-- DropTable
DROP TABLE "Alert";

-- DropTable
DROP TABLE "Doctor";

-- DropTable
DROP TABLE "FeatureFlag";

-- DropTable
DROP TABLE "Forecast";

-- DropTable
DROP TABLE "Insurance";

-- DropTable
DROP TABLE "Patient";

-- DropTable
DROP TABLE "Prescription";

-- DropTable
DROP TABLE "PrescriptionItem";

-- DropTable
DROP TABLE "Reorder";

-- DropTable
DROP TABLE "ReorderItem";

-- DropTable
DROP TABLE "Reservation";

-- DropTable
DROP TABLE "ReservationItem";

-- DropTable
DROP TABLE "StoreHealth";
