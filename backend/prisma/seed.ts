import prisma from "../lib/prisma";
import {
  StockMovementReason,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";

/* =========================================================
   CONFIG
========================================================= */
const SIMULATION_DAYS = 90; // 3 months (Prophet-friendly)
const START_DATE = new Date();
START_DATE.setDate(START_DATE.getDate() - SIMULATION_DAYS);

const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.UPI,
];

/* =========================================================
   MEDICINE DEMAND + PRICE PROFILE
========================================================= */
type ForecastProfile = {
  baseDemand: number;
  weeklyPattern?: boolean;
  seasonality?: "winter" | "spring" | "steady";
  priceTrend?: "up" | "flat";
};

const KEY_MEDICINES: {
  brand: string;
  generic: string;
  category: string;
  forecast: ForecastProfile;
}[] = [
  {
    brand: "Paracetamol",
    generic: "Paracetamol",
    category: "Analgesics",
    forecast: { baseDemand: 18, weeklyPattern: true, seasonality: "steady", priceTrend: "flat" },
  },
  {
    brand: "Amoxicillin",
    generic: "Amoxicillin",
    category: "Antibiotics",
    forecast: { baseDemand: 10, weeklyPattern: true, seasonality: "winter", priceTrend: "up" },
  },
  {
    brand: "Cetirizine",
    generic: "Cetirizine",
    category: "Antihistamines",
    forecast: { baseDemand: 14, weeklyPattern: true, seasonality: "spring", priceTrend: "up" },
  },
  {
    brand: "Metformin",
    generic: "Metformin",
    category: "Diabetes",
    forecast: { baseDemand: 20, weeklyPattern: false, seasonality: "steady", priceTrend: "flat" },
    },
      
    
];

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

function calculateDailyDemand(
  base: number,
  date: Date,
  profile: ForecastProfile
) {
  let demand = base;
  const day = date.getDay();
  const month = date.getMonth();

  if (profile.weeklyPattern && (day === 0 || day === 6)) {
    demand *= 1.4;
  }

  const isWinter = [10, 11, 0, 1].includes(month);
  const isSpring = [2, 3, 4].includes(month);

  if (profile.seasonality === "winter" && isWinter) demand *= 1.6;
  if (profile.seasonality === "spring" && isSpring) demand *= 1.4;

  demand += rand(-3, 4);
  return Math.max(1, Math.round(demand));
}

function calculateMRP(base: number, dayIndex: number, trend?: "up" | "flat") {
  if (trend === "up") {
    return Math.round(base * (1 + dayIndex * 0.003)); // ~9% rise over 30 days
  }
  return base;
}

/* =========================================================
   CLEAN DB
========================================================= */
async function cleanDB() {
  process.stdout.write("🧹 Cleaning database... ");
  await prisma.stockMovement.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.medicine.deleteMany();
  process.stdout.write("Done\n");
}

/* =========================================================
   MAIN SEED
========================================================= */
async function main() {
  console.log("🌱 Starting Forecast-Ready Seed...");
  await cleanDB();

  // const stores = await prisma.store.findMany({ include: { users: true } });
  // if (!stores.length) throw new Error("No stores found");
  // console.log(`🔍 Found ${stores.length} stores to seed\n`);

  // for (const store of stores) {
  //   const owner = store.users[0];
  //   if (!owner) continue;

  //   console.log(`🏪 Store: ${store.name}`);

  //   /* -----------------------------------------
  //      Create medicines
  //   ------------------------------------------ */
  //   const medicineMap = new Map<string, string>();

  //   for (const med of KEY_MEDICINES) {
  //     process.stdout.write(`  Creating ${med.brand}... `);
  //     const m = await prisma.medicine.create({
  //       data: {
  //         storeId: store.id,
  //         brandName: med.brand,
  //         genericName: med.generic,
  //         category: med.category,
  //         strength: "500mg",
  //         dosageForm: "Tablet",
  //         uom: "Strip",
  //         sku: `SKU-${rand(10000, 99999)}`,
  //         isActive: true,
  //       },
  //     });
  //     medicineMap.set(med.brand, m.id);
  //     process.stdout.write("Done\n");
  //   }
  //   console.log(`💊 All medicines created`);

  //   /* -----------------------------------------
  //      Time simulation
  //   ------------------------------------------ */
  //   let currentDate = new Date(START_DATE);
  //   const today = new Date();

  //   let dayIndex = 0;
  //   let totalSales = 0;
  //   let totalBatches = 0;
  //   process.stdout.write(`⏳ Simulating ${SIMULATION_DAYS} days: `);

  //   while (currentDate <= today) {
  //     const progress = Math.round((dayIndex / SIMULATION_DAYS) * 100);
  //     if (dayIndex % 10 === 0 && dayIndex !== 0) {
  //       process.stdout.write(`${progress}%... `);
  //     }
  //     for (const med of KEY_MEDICINES) {
  //       const medicineId = medicineMap.get(med.brand)!;

  //       // 1️⃣ Create batch every ~10 days with new price
  //       if (dayIndex % 10 === 0) {
  //         const baseMRP = rand(18, 30);
  //         const mrp = calculateMRP(baseMRP, dayIndex, med.forecast.priceTrend);

  //         const batch = await prisma.inventoryBatch.create({
  //           data: {
  //             storeId: store.id,
  //             medicineId,
  //             batchNumber: `B-${dayIndex}-${rand(100, 999)}`,
  //             qtyReceived: 300,
  //             qtyAvailable: 300,
  //             mrp,
  //             purchasePrice: mrp * 0.7,
  //             expiryDate: addDays(currentDate, 365),
  //             receivedAt: currentDate,
  //             createdAt: currentDate,
  //           },
  //         });

  //         totalBatches++;

  //         await prisma.stockMovement.create({
  //           data: {
  //             storeId: store.id,
  //             inventoryId: batch.id,
  //             medicineId,
  //             delta: 300,
  //             reason: StockMovementReason.RECEIPT,
  //             createdAt: currentDate,
  //           },
  //         });
  //       }

  //       // 2️⃣ Daily sales
  //       const dailyQty = calculateDailyDemand(
  //         med.forecast.baseDemand,
  //         currentDate,
  //         med.forecast
  //       );

  //       if (dailyQty > 0) {
  //         const batch = await prisma.inventoryBatch.findFirst({
  //           where: { medicineId, qtyAvailable: { gt: dailyQty } },
  //           orderBy: { expiryDate: "asc" },
  //         });

  //         if (!batch) continue;

  //         const total = dailyQty * Number(batch.mrp);

  //         const sale = await prisma.sale.create({
  //           data: {
  //             storeId: store.id,
  //             totalValue: total,
  //             paymentMethod: PAYMENT_METHODS[rand(0, PAYMENT_METHODS.length - 1)],
  //             paymentStatus: PaymentStatus.PAID,
  //             createdAt: currentDate,
  //             items: {
  //               create: {
  //                 medicineId,
  //                 qty: dailyQty,
  //                 unitPrice: batch.mrp,
  //                 lineTotal: total,
  //                 inventoryBatchId: batch.id,
  //               },
  //             },
  //           },
  //           include: { items: true },
  //         });

  //         totalSales++;

  //         await prisma.inventoryBatch.update({
  //           where: { id: batch.id },
  //           data: { qtyAvailable: { decrement: dailyQty } },
  //         });

  //         await prisma.stockMovement.create({
  //           data: {
  //             storeId: store.id,
  //             inventoryId: batch.id,
  //             medicineId,
  //             delta: -dailyQty,
  //             reason: StockMovementReason.SALE,
  //             saleItemId: sale.items[0].id,
  //             createdAt: currentDate,
  //           },
  //         });
  //       }
  //     }

  //     currentDate = addDays(currentDate, 1);
  //     dayIndex++;
  //   }
  //   process.stdout.write("100%! Done.\n");
  //   console.log(`📊 Stats for ${store.name}:`);
  //   console.log(`   - Batches created: ${totalBatches}`);
  //   console.log(`   - Sales generated: ${totalSales}`);
  //   console.log(`✨ Store simulation complete\n`);
  // }

  console.log("✅ Forecast-ready seed completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());