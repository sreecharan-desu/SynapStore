import prisma from "../lib/prisma";
import { StockMovementReason, PaymentMethod, PaymentStatus, SupplierRequestStatus } from "@prisma/client";

/* =========================================================
   CONFIG
========================================================= */
const SIMULATION_DAYS = 30; // 1 month of heavy data
const START_DATE = new Date();
START_DATE.setDate(START_DATE.getDate() - SIMULATION_DAYS);

const PAYMENT_METHODS: PaymentMethod[] = [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.UPI, PaymentMethod.OTHER];

/* =========================================================
   CATALOG
========================================================= */
type ForecastProfile = {
  baseDemand: number;
  weeklyPattern?: boolean;
  seasonality?: "winter" | "summer" | "spring" | "steady" | "any";
  trend?: "up" | "down" | "flat";
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
    forecast: { baseDemand: 15, weeklyPattern: true, seasonality: "steady" },
  },
  {
    brand: "Amoxicillin",
    generic: "Amoxicillin",
    category: "Antibiotics",
    forecast: { baseDemand: 8, weeklyPattern: true, seasonality: "winter" },
  },
  {
    brand: "Cetirizine",
    generic: "Cetirizine",
    category: "Antihistamines",
    forecast: { baseDemand: 12, weeklyPattern: true, seasonality: "spring" },
  },
  {
    brand: "Ibuprofen",
    generic: "Ibuprofen",
    category: "Analgesics",
    forecast: { baseDemand: 10, weeklyPattern: false, seasonality: "steady" },
  },
  {
    brand: "Metformin",
    generic: "Metformin",
    category: "Diabetes",
    forecast: { baseDemand: 18, weeklyPattern: false, seasonality: "steady" },
  },
  {
    brand: "Pantoprazole",
    generic: "Pantoprazole",
    category: "Gastrointestinal",
    forecast: { baseDemand: 14, weeklyPattern: false, seasonality: "steady" },
  },
    ];

console.log("Starting DB Cleanup...");
    const cleanDB = async () => {
      await prisma.$transaction([
        prisma.medicine.deleteMany(),
        prisma.inventoryBatch.deleteMany(),
        prisma.stockMovement.deleteMany(),
        prisma.sale.deleteMany(),
        prisma.saleItem.deleteMany(),
 
      ]);
        
        console.log("DB Cleaned");
    };

cleanDB();

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

// Demand Curve Calculation
function calculateDailyDemand(base: number, date: Date, profile: ForecastProfile) {
  let demand = base;
  const day = date.getDay();
  const month = date.getMonth(); // 0-11

  // 1. Weekly Pattern (Busier Weekends)
  if (profile.weeklyPattern && (day === 0 || day === 6)) {
    demand *= 1.4;
  }

  // 2. Seasonality
  const isWinter = [10, 11, 0, 1].includes(month);
  const isSpring = [2, 3, 4].includes(month);
  
  if (profile.seasonality === "winter" && isWinter) demand *= 1.8;
  if (profile.seasonality === "spring" && isSpring) demand *= 1.5;

  // 3. Noise
  demand += rand(-2, 5); 
  return Math.max(1, Math.round(demand));
}

/* =========================================================
   MAIN SEED
========================================================= */
async function main() {
  console.log("🌱 Starting Targeted Sales Verification Seed...");
  
  // 1. Fetch Stores
  const stores = await prisma.store.findMany({ 
      include: { users: true } 
  });

  if (!stores.length) throw new Error("No Store Found.");

  const TARGET_SALES_PER_MEDICINE = 55; // > 50 constraint
  
  for (const store of stores) {
    console.log(`\n🏪 Processing Store: ${store.name}`);
    
    const ownerId = store.users[0]?.userId;
    if (!ownerId) {
      console.warn("   ⚠️ Skipping store (no owner link)");
      continue;
    }

    // 2. Fetch Medicines for this store
    let medicines = await prisma.medicine.findMany({
        where: { storeId: store.id }
    });

    if (medicines.length === 0) {
        console.log("   ⚠️ No medicines found in this store. Attempting to seed catalog...");
        
        // Need a supplier to link to
        const supplierStore = await prisma.supplierStore.findFirst({
            where: { storeId: store.id },
            include: { supplier: true }
        });

        if (!supplierStore) {
            console.warn("      ❌ No connected supplier found. Cannot seed medicines.");
            continue;
        }
        
        const activeSupplier = supplierStore.supplier;
        console.log(`      ✅ Using Supplier: ${activeSupplier.name} to populate catalog.`);

        for (const med of KEY_MEDICINES) {
             await prisma.medicine.create({
                 data: {
                     storeId: store.id,
                     brandName: med.brand,
                     genericName: med.generic,
                     category: med.category,
                     strength: "500mg",
                     dosageForm: "Tablet",
                     uom: "Strip",
                     sku: `SKU-${rand(10000, 99999)}`,
                     isActive: true,
                     suppliers: {
                         connect: { id: activeSupplier.id }
                     }
                 }
             });
        }
        
        // Refresh medicines list
        medicines = await prisma.medicine.findMany({ where: { storeId: store.id } });
    }

    if (medicines.length === 0) {
        console.warn("   ⚠️ Still no medicines. Skipping.");
        continue;
    }

    console.log(`   💊 Generating ${TARGET_SALES_PER_MEDICINE} sales for each of ${medicines.length} medicines...`);

    const endDate = new Date();
    // Spread sales over 60 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60);

    for (const med of medicines) {
        // Ensure Stock Exists for this massive sale volume
        // We need 55 * avg_qty (e.g. 2) = ~110 units minimum.
        // Let's create a "Foundation Batch" to ensure we don't fail on stock.
        const foundationBatch = await prisma.inventoryBatch.create({
            data: {
                storeId: store.id,
                medicineId: med.id,
                batchNumber: `SEED-FND-${rand(1000, 9999)}`,
                qtyReceived: 500, // Plenty
                qtyAvailable: 500,
                mrp: 20, // Default pricing
                purchasePrice: 15,
                expiryDate: addDays(new Date(), 365),
                receivedAt: startDate,
                createdAt: startDate
            }
        });
        
        // Log Receipt
        await prisma.stockMovement.create({
            data: {
                storeId: store.id,
                medicineId: med.id,
                inventoryId: foundationBatch.id,
                delta: 500,
                reason: StockMovementReason.RECEIPT,
                note: "Seed Foundation Stock",
                performedById: ownerId,
                createdAt: startDate
            }
        });

        // 3. Generate Sales
        let salesCreated = 0;
        let currentBatchQty = 500;
        
        // We create strictly TARGET_SALES_PER_MEDICINE individual transactions
        for (let i = 0; i < TARGET_SALES_PER_MEDICINE; i++) {
             const qty = rand(1, 4);
             const unitPrice = 20; // Matches batch
             const total = qty * unitPrice;
             
             // Random date between start and end
             const saleDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
             
             await prisma.$transaction(async (tx) => {
                 // Create Sale
                 const sale = await tx.sale.create({
                     data: {
                         storeId: store.id,
                         createdById: ownerId,
                         subtotal: total,
                         totalValue: total,
                         paymentMethod: PAYMENT_METHODS[rand(0, PAYMENT_METHODS.length - 1)],
                         paymentStatus: PaymentStatus.PAID,
                         createdAt: saleDate,
                         items: {
                             create: {
                                 medicineId: med.id,
                                 qty,
                                 unitPrice,
                                 lineTotal: total,
                                 inventoryBatchId: foundationBatch.id // Always draw from foundation
                             }
                         }
                     },
                     include: { items: true }
                 });

                 const saleItem = sale.items[0];

                 // Update Batch
                 await tx.inventoryBatch.update({
                     where: { id: foundationBatch.id },
                     data: { qtyAvailable: { decrement: qty } }
                 });

                 // Stock Movement
                 await tx.stockMovement.create({
                     data: {
                         storeId: store.id,
                         inventoryId: foundationBatch.id,
                         medicineId: med.id,
                         delta: -qty,
                         reason: StockMovementReason.SALE,
                         saleItemId: saleItem.id,
                         performedById: ownerId,
                         createdAt: saleDate
                     }
                 });
             });
             
             salesCreated++;
             currentBatchQty -= qty;
        }
        process.stdout.write("."); // Progress dot
    }
  }

  console.log("\n✅ Sales Verification Seed Completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });