import prisma from "../lib/prisma";
import {
  StockMovementReason,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";

/* =========================================================
   HELPERS
========================================================= */
const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.UPI,
];

/* =========================================================
   MAIN SEED FUNCTION
========================================================= */
async function seedSalesForForecasting() {
  console.log("📈 Seeding forecast-ready price + demand data");

  const store = await prisma.store.findFirst({
    where: {
      isActive: true,
      id: "daca5fe7-a868-4e81-899c-98918d5910ae", // 👈 your store
    },
  });
  if (!store) throw new Error("No store found");

  const owner = await prisma.user.findFirst({
    where: { stores: { some: { storeId: store.id } } },
  });
  if (!owner) throw new Error("No store owner found");

  const medicines = await prisma.medicine.findMany({
    where: { storeId: store.id, isActive: true },
  });

  if (!medicines.length) {
    throw new Error("No medicines found");
  }

  /* =========================================================
     DATE CONFIG
  ========================================================= */
  const START = addDays(new Date(), -40); // 40 days back
  const PRICE_POINTS = 15;               // >=10 required for Prophet
  const SALES_DAYS = 20;                 // unique sales days

  for (const med of medicines) {
    console.log(`💊 Processing ${med.brandName}`);

    /* =====================================================
       1️⃣ PRICE HISTORY (INVENTORY REPLENISHMENT)
       👉 THIS FIXES "NOT ENOUGH PRICE DATA"
    ===================================================== */
    let priceDate = START;

    for (let p = 0; p < PRICE_POINTS; p++) {
      const mrp = rand(18, 40) + rand(-2, 3); // realistic fluctuation

      const batch = await prisma.inventoryBatch.create({
        data: {
          storeId: store.id,
          medicineId: med.id,
          batchNumber: `PRICE-${p}-${rand(100, 999)}`,
          qtyReceived: 200,
          qtyAvailable: 200,
          mrp,
          purchasePrice: mrp * 0.7,
          expiryDate: addDays(priceDate, 365),
          receivedAt: priceDate,
          createdAt: priceDate,
        },
      });

      await prisma.stockMovement.create({
        data: {
          storeId: store.id,
          inventoryId: batch.id,
          medicineId: med.id,
          delta: 200,
          reason: StockMovementReason.RECEIPT,
          performedById: owner.id,
          createdAt: priceDate,
        },
      });

      priceDate = addDays(priceDate, 2); // every 2 days
    }

    /* =====================================================
       2️⃣ SALES (DEMAND SIGNAL — WHAT PROPHET USES)
    ===================================================== */
    for (let i = 0; i < SALES_DAYS; i++) {
      const saleDate = addDays(START, i + rand(0, 2));
      const qty = rand(3, 10);

      const batch = await prisma.inventoryBatch.findFirst({
        where: {
          medicineId: med.id,
          qtyAvailable: { gte: qty },
        },
        orderBy: { expiryDate: "asc" },
      });

      if (!batch) continue;

      const unitPrice = Number(batch.mrp);
      const total = qty * unitPrice;

      const sale = await prisma.sale.create({
        data: {
          storeId: store.id,
          createdById: owner.id,
          subtotal: total,
          totalValue: total,
          paymentMethod:
            PAYMENT_METHODS[rand(0, PAYMENT_METHODS.length - 1)],
          paymentStatus: PaymentStatus.PAID,
          createdAt: saleDate,
          items: {
            create: {
              medicineId: med.id,
              qty,
              unitPrice,
              lineTotal: total,
              inventoryBatchId: batch.id,
            },
          },
        },
        include: { items: true },
      });

      await prisma.inventoryBatch.update({
        where: { id: batch.id },
        data: { qtyAvailable: { decrement: qty } },
      });

      // 🔥 THIS IS WHAT YOUR FORECAST READS
      await prisma.stockMovement.create({
        data: {
          storeId: store.id,
          inventoryId: batch.id,
          medicineId: med.id,
          delta: -qty,
          reason: StockMovementReason.SALE,
          saleItemId: sale.items[0].id,
          performedById: owner.id,
          createdAt: saleDate,
        },
      });
    }

    console.log(`   ✔ Price points: ${PRICE_POINTS}`);
    console.log(`   ✔ Sales days: ${SALES_DAYS}`);
  }

  console.log("✅ Forecast-ready seed completed");
}

/* =========================================================
   RUN
========================================================= */
async function main() {
  try {
    await seedSalesForForecasting();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();