
import prisma from "../lib/prisma";
import { crypto$ } from "../lib/crypto";

// Helpers
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const getRandomElement = <T>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];
const subDays = (date: Date, days: number) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

// Data Sources
const MEDICINE_CATEGORIES = ["Antibiotics", "Analgesics", "Antipyretics", "Antiseptics", "Vitamins", "Supplements", "Cardiology", "Dermatology", "Neurology", "Gastroenterology"];
const DOSAGE_FORMS = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Gel", "Ointment", "Drop", "Spray"];
const DRUG_NAMES = [
  { brand: "Amoxil", generic: "Amoxicillin" },
  { brand: "Panadol", generic: "Paracetamol" },
  { brand: "Advil", generic: "Ibuprofen" },
  { brand: "Augmentin", generic: "Amoxicillin/Clavulanate" },
  { brand: "Ciprobay", generic: "Ciprofloxacin" },
  { brand: "Lipitor", generic: "Atorvastatin" },
  { brand: "Zocor", generic: "Simvastatin" },
  { brand: "Nexium", generic: "Esomeprazole" },
  { brand: "Plavix", generic: "Clopidogrel" },
  { brand: "Singulair", generic: "Montelukast" },
  { brand: "Crestor", generic: "Rosuvastatin" },
  { brand: "Lyrica", generic: "Pregabalin" },
  { brand: "Humira", generic: "Adalimumab" },
  { brand: "Enbrel", generic: "Etanercept" },
  { brand: "Remicade", generic: "Infliximab" },
  { brand: "Lantus", generic: "Insulin Glargine" },
  { brand: "Herceptin", generic: "Trastuzumab" },
  { brand: "Avastin", generic: "Bevacizumab" },
  { brand: "Rituxan", generic: "Rituximab" },
  { brand: "Metformin", generic: "Metformin" },
  { brand: "Aspirin", generic: "Acetylsalicylic Acid" },
  { brand: "Omeprazole", generic: "Omeprazole" },
  { brand: "Losartan", generic: "Losartan" },
  { brand: "Amlodipine", generic: "Amlodipine" },
  { brand: "Gabapentin", generic: "Gabapentin" },
  { brand: "Hydrochlorothiazide", generic: "Hydrochlorothiazide" },
  { brand: "Sertraline", generic: "Sertraline" },
  { brand: "Simvastatin", generic: "Simvastatin" },
  { brand: "Metoprolol", generic: "Metoprolol" },
  { brand: "Pantoprazole", generic: "Pantoprazole" },
  { brand: "Azithromycin", generic: "Azithromycin" },
  { brand: "Doxycycline", generic: "Doxycycline" },
  { brand: "Cephalexin", generic: "Cephalexin" },
  { brand: "Prednisone", generic: "Prednisone" },
  { brand: "Tramadol", generic: "Tramadol" },
  { brand: "Clonazepam", generic: "Clonazepam" },
  { brand: "Lorazepam", generic: "Lorazepam" },
  { brand: "Alprazolam", generic: "Alprazolam" },
  { brand: "Zolpidem", generic: "Zolpidem" },
  { brand: "Citalopram", generic: "Citalopram" }
];

async function main() {
  console.log("🌱 Starting rich seed for EXISTING data...");

  // 1. Fetch Existing Context
  const allStores = await prisma.store.findMany({
    include: { 
        users: true // To get store owner ID for `createdById` fields
    } 
  });
  
  const allSuppliers = await prisma.supplier.findMany();

  if (allStores.length === 0) {
    console.warn("⚠️ No stores found! Please ensure users/stores exist first.");
    return;
  }
  
  if (allSuppliers.length === 0) {
      console.warn("⚠️ No suppliers found! Some features like supplier linking will be skipped.");
  }

  console.log(`Found ${allStores.length} Stores and ${allSuppliers.length} Suppliers.`);

  // 2. Iterate through EACH Store to enrich data
  for (const store of allStores) {
    console.log(`\n🏪 Processing Store: ${store.name} (${store.slug})...`);
    
    // Determine a primary user (owner) for this store to attribute actions to
    // If no explicit role, pick any linked user, or null
    const owner = store.users.find(u => u.role === "STORE_OWNER") || store.users[0];
    const ownerId = owner?.userId;

    if (!ownerId) {
        console.warn(`   ⚠️ No owner found for store ${store.name}, skipping transactional data creation (sales, requests) that requires user ID.`);
        // potentially continue, but creating sales/requests without createdById might fail if schema requires it or logic needs it
        // Schema: Sale.createdById is nullable? Yes. But good to have.
    }

    // --- Medicines ---
    const existingMedsCount = await prisma.medicine.count({ where: { storeId: store.id } });
    const targetMeds = 50;
    const medsToCreate = targetMeds - existingMedsCount;
    
    if (medsToCreate > 0) {
        console.log(`   💊 Creating ${medsToCreate} additional medicines...`);
        const medsData = [];
        for(let i=0; i<medsToCreate; i++) {
             const drug = getRandomElement(DRUG_NAMES)!;
             const strength = getRandomElement(["10mg", "20mg", "50mg", "100mg", "250mg", "500mg"]);
             const form = getRandomElement(DOSAGE_FORMS);
             
             medsData.push({
                storeId: store.id,
                brandName: `${drug.brand} ${strength}`, // Append random strength to ensure uniqueness if needed
                genericName: drug.generic,
                dosageForm: form,
                strength: strength,
                category: getRandomElement(MEDICINE_CATEGORIES),
                sku: `SKU-${getRandomInt(10000, 99999)}`,
                uom: "Pack",
                isActive: true,
                taxInfo: { rate: 5 },
             });
        }
        // Use createMany if supported or loop
        // Prisma createMany is supported for simple creates
        await prisma.medicine.createMany({ data: medsData });
    } else {
        console.log(`   💊 Sufficient medicines exist (${existingMedsCount}).`);
    }

    // Refetch all medicines for this store to link inventory
    const storeMedicines = await prisma.medicine.findMany({ where: { storeId: store.id } });

    // --- Inventory Batches ---
    // Ensure every medicine has at least 1 batch, some have multiple
    console.log(`   🏭 enriching inventory...`);
    const newBatches = [];
    
    for (const med of storeMedicines) {
        // Check if batches exist
        const batchCount = await prisma.inventoryBatch.count({ where: { medicineId: med.id } });
        if (batchCount === 0 || Math.random() < 0.3) { // Create if missing OR 30% chance to add more
             const numBatches = getRandomInt(1, 3);
             for (let j = 0; j < numBatches; j++) {
                  const isExpired = Math.random() < 0.15; // 15% chance
                  const lowStock = Math.random() < 0.2; // 20% chance
                  
                  const expiryDate = isExpired 
                    ? subDays(new Date(), getRandomInt(10, 300))
                    : addDays(new Date(), getRandomInt(30, 700));

                  const qtyReceived = getRandomInt(100, 1000);
                  // For low stock: < 20
                  const qtyAvailable = lowStock ? getRandomInt(0, 15) : getRandomInt(20, qtyReceived);
                  
                  newBatches.push({
                      storeId: store.id,
                      medicineId: med.id,
                      batchNumber: `BN-${getRandomInt(100000, 999999)}`,
                      qtyReceived: qtyReceived,
                      qtyAvailable: qtyAvailable, 
                      qtyReserved: 0,
                      expiryDate: expiryDate,
                      purchasePrice: getRandomFloat(10, 500),
                      mrp: getRandomFloat(50, 1000),
                      receivedAt: subDays(new Date(), getRandomInt(1, 100)),
                      location: `Shelf ${getRandomElement(['A', 'B', 'C'])}-${getRandomInt(1, 10)}`,
                  });
             }
        }
    }
    if (newBatches.length > 0) {
        await prisma.inventoryBatch.createMany({ data: newBatches });
        console.log(`      Created ${newBatches.length} new inventory batches.`);
    }

    // Refetch batches for Sales generation
    const storeBatches = await prisma.inventoryBatch.findMany({ where: { storeId: store.id } });

    // --- Historical Sales ---
    // Generate sales if low count
    const salesCount = await prisma.sale.count({ where: { storeId: store.id } });
    if (salesCount < 50 && storeBatches.length > 0) {
         console.log(`   💰 Generating historical sales...`);
         const salesToCreate = 150 - salesCount; 
         const PAYMENT_METHODS: any[] = ["CASH", "CARD", "UPI"];
         
         const salePromises = [];
         
         for(let i=0; i<salesToCreate; i++) {
            const saleDate = subDays(new Date(), getRandomInt(0, 60)); 
            
            // Build items
            const numItems = getRandomInt(1, 5);
            let subtotal = 0;
            const itemsData = [];
            
            for(let k=0; k<numItems; k++) {
                const batch = getRandomElement(storeBatches)!;
                const qty = getRandomInt(1, 4);
                const unitPrice = Number(batch.mrp);
                const lineTotal = unitPrice * qty;
                subtotal += lineTotal;
                
                itemsData.push({
                    medicineId: batch.medicineId,
                    inventoryBatchId: batch.id,
                    qty: qty,
                    unitPrice: unitPrice,
                    lineTotal: lineTotal
                });
            }
            
            const tax = subtotal * 0.05;
            const total = subtotal + tax;

            salePromises.push(prisma.sale.create({
                data: {
                    storeId: store.id,
                    createdById: ownerId,
                    subtotal: subtotal,
                    tax: tax,
                    discounts: 0,
                    totalValue: total,
                    paymentMethod: getRandomElement(PAYMENT_METHODS),
                    paymentStatus: "PAID",
                    createdAt: saleDate, 
                    updatedAt: saleDate,
                    items: {
                        create: itemsData
                    }
                }
            }));
         }
         
         // Batch execute
         const chunkSize = 10;
         for (let i = 0; i < salePromises.length; i += chunkSize) {
            await Promise.all(salePromises.slice(i, i + chunkSize));
         }
         console.log(`      Generated ${salesToCreate} sales.`);
    }

    // --- Suppliers Linking ---
    if (allSuppliers.length > 0) {
        console.log(`   🤝 Ensuring Supplier Connections...`);
        // Ensure at least 50% of suppliers are connected or pending
        for (const supplier of allSuppliers) {
            // Check existence
            const existingLink = await prisma.supplierStore.findUnique({
                where: { supplierId_storeId: { supplierId: supplier.id, storeId: store.id } }
            });
            
            const existingReq = await prisma.supplierRequest.findFirst({
                where: { supplierId: supplier.id, storeId: store.id }
            });

            if (!existingLink && !existingReq) {
                // Randomly Decide to link, pending, or ignore
                const action = Math.random();
                if (action < 0.4) {
                    // Create Link
                    await prisma.supplierStore.create({
                        data: {
                            supplierId: supplier.id,
                            storeId: store.id,
                            linkedAt: subDays(new Date(), getRandomInt(1, 60))
                        }
                    });
                    // And create an archived request for it
                    if (ownerId) {
                        await prisma.supplierRequest.create({
                            data: {
                                supplierId: supplier.id,
                                storeId: store.id,
                                status: "ACCEPTED",
                                message: "Auto-generated acceptance from seed",
                                createdById: ownerId,
                                createdAt: subDays(new Date(), 60)
                            }
                        });
                    }
                } else if (action < 0.7 && ownerId) {
                    // Create Pending Request (Inbound from Supplier? or Outbound?)
                    // Let's create an "Incoming" request example (CreatedBy = Supplier User)
                    if (supplier.userId) {
                         await prisma.supplierRequest.create({
                            data: {
                                supplierId: supplier.id,
                                storeId: store.id,
                                status: "PENDING",
                                message: "I would like to partner with your pharmacy.",
                                createdById: supplier.userId,
                                createdAt: subDays(new Date(), getRandomInt(0, 5))
                            }
                        });
                    }
                }
            }
        }
    }
  }

  console.log("\n✅ Rich Seed Completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
