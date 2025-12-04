/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "Doctor" (
    "physID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("physID")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "supID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("supID")
);

-- CreateTable
CREATE TABLE "Drugs" (
    "NDC" INTEGER NOT NULL,
    "brandName" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "dosage" INTEGER NOT NULL,
    "expDate" TEXT NOT NULL,
    "supID" INTEGER NOT NULL,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "sellPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Drugs_pkey" PRIMARY KEY ("NDC")
);

-- CreateTable
CREATE TABLE "Insurance" (
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "coPay" TEXT NOT NULL,

    CONSTRAINT "Insurance_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Patient" (
    "patientID" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthdate" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "gender" TEXT,
    "insurance" TEXT,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("patientID")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" SERIAL NOT NULL,
    "patientID" INTEGER NOT NULL,
    "physID" INTEGER NOT NULL,
    "NDC" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "refills" INTEGER NOT NULL,
    "status" TEXT,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prescription_patientID_idx" ON "Prescription"("patientID");

-- CreateIndex
CREATE INDEX "Prescription_physID_idx" ON "Prescription"("physID");

-- CreateIndex
CREATE INDEX "Prescription_NDC_idx" ON "Prescription"("NDC");

-- AddForeignKey
ALTER TABLE "Drugs" ADD CONSTRAINT "Drugs_supID_fkey" FOREIGN KEY ("supID") REFERENCES "Supplier"("supID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_insurance_fkey" FOREIGN KEY ("insurance") REFERENCES "Insurance"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientID_fkey" FOREIGN KEY ("patientID") REFERENCES "Patient"("patientID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_physID_fkey" FOREIGN KEY ("physID") REFERENCES "Doctor"("physID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_NDC_fkey" FOREIGN KEY ("NDC") REFERENCES "Drugs"("NDC") ON DELETE RESTRICT ON UPDATE CASCADE;
