import prisma from "../lib/prisma";
import {
  StockMovementReason,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";

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


async function seedSalesForForecasting() {
  console.log("📈 Seeding forecast-ready sales (20 unique days)");

  const store = await prisma.store.findFirst({
    where: { isActive: true , id : 'daca5fe7-a868-4e81-899c-98918d5910ae'},
  });
  if (!store) throw new Error("No store found");

  const owner = await prisma.user.findFirst({
    where: { stores: { some: { storeId: store.id } } },
  });

  if (!owner) throw new Error("No store owner found");

  const medicines = await prisma.medicine.findMany({
    where: { storeId: store.id, isActive: true },
    include: {
      inventory: {
        where: { qtyAvailable: { gt: 0 } },
        orderBy: { expiryDate: "asc" },
      },
    },
  });

  if (!medicines.length) {
    throw new Error("No medicines found for sales seeding");
  }

  const START = addDays(new Date(), -30); // past 30 days
  const UNIQUE_DAYS = 50;

  for (const med of medicines) {
    console.log(`💊 Seeding sales for ${med.brandName}`);

    /* --------------------------------------------------
       Ensure inventory exists
    -------------------------------------------------- */
    if (!med.inventory.length) {
      const batch = await prisma.inventoryBatch.create({
        data: {
          storeId: store.id,
          medicineId: med.id,
          batchNumber: `AUTO-${rand(1000, 9999)}`,
          qtyReceived: 500,
          qtyAvailable: 500,
          mrp: rand(15, 40),
          purchasePrice: rand(10, 25),
          expiryDate: addDays(new Date(), 365),
          receivedAt: START,
          createdAt: START,
        },
      });

      await prisma.stockMovement.create({
        data: {
          storeId: store.id,
          inventoryId: batch.id,
          medicineId: med.id,
          delta: 500,
          reason: StockMovementReason.RECEIPT,
          performedById: owner.id,
          createdAt: START,
        },
      });

      med.inventory.push(batch);
    }

    /* --------------------------------------------------
       Create 20 UNIQUE DAY SALES
    -------------------------------------------------- */
    for (let i = 0; i < UNIQUE_DAYS; i++) {
      const saleDate = addDays(START, i + rand(0, 2)); // slight randomness
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

      // Reduce stock
      await prisma.inventoryBatch.update({
        where: { id: batch.id },
        data: { qtyAvailable: { decrement: qty } },
      });

      // Stock movement (THIS IS WHAT FORECAST USES)
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
  }

  console.log("✅ Sales seeding complete (forecast-safe)");
}

async function main() {
  try {
    
    // await prisma.medicine.deleteMany();
    // console.log("Deleted medicines");
    await seedSalesForForecasting();
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();