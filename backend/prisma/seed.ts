
import prisma from "../lib/prisma";
import bcrypt from "bcrypt";
import { crypto$ } from "../lib/crypto";

// Helpers
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min: number, max: number) => parseFloat((Math.random() * (max - min) + min).toFixed(2));
const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const subDays = (date: Date, days: number) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

// Data Sources
const MEDICINE_CATEGORIES = ["Antibiotics", "Analgesics", "Antipyretics", "Antiseptics", "Vitamins", "Supplements", "Cardiology", "Dermatology"];
const DOSAGE_FORMS = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Gel", "Ointment"];
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
  { brand: "Pantoprazole", generic: "Pantoprazole" }
];

async function main() {
  console.log("🌱 Starting seed...");

  // ---------------------------------------------------------
  // 1. Ensure Base Users & Store (Existing logic preserved)
  // ---------------------------------------------------------

  // Store Owner
  const ownerEmail = "sreecharan309@gmail.com";
  const ownerEmailEnc = crypto$.encryptCellDeterministic(ownerEmail);
  const ownerPasswordHash = await bcrypt.hash("12345678", 10);
  const storeOwner = await prisma.user.upsert({
    where: { email: ownerEmailEnc },
    update: { username: "storeowner1", passwordHash: ownerPasswordHash, globalRole: null, isActive: true, isverified: true },
    create: { username: "storeowner1", email: ownerEmail, passwordHash: ownerPasswordHash, globalRole: null, isActive: true, isverified: true },
  });
  console.log(`Ensured Store Owner: ${ownerEmail}`);

  // Store
  const storeSlug = "sreecharan's-store";
  const store = await prisma.store.upsert({
    where: { slug: storeSlug },
    update: { name: "Demo Pharmacy", timezone: "Asia/Kolkata", currency: "INR" },
    create: { name: "Demo Pharmacy", slug: storeSlug, timezone: "Asia/Kolkata", currency: "INR" },
  });
  console.log(`Ensured Store: ${store.name}`);

  // Role
  await prisma.userStoreRole.upsert({
    where: { userId_storeId: { userId: storeOwner.id, storeId: store.id } },
    update: { role: "STORE_OWNER" },
    create: { userId: storeOwner.id, storeId: store.id, role: "STORE_OWNER" },
  });

  // Supplier User
  const supplierEmail = "bhanuprakashalahari.04@gmail.com";
  const supplierEmailEnc = crypto$.encryptCellDeterministic(supplierEmail);
  const supplierPasswordHash = await bcrypt.hash("123454678", 10);
  const supplierUser = await prisma.user.upsert({
    where: { email: supplierEmailEnc },
    update: { username: "global_supplier", passwordHash: supplierPasswordHash, globalRole: "SUPPLIER", isActive: true, isverified: true },
    create: { username: "global_supplier", email: supplierEmail, passwordHash: supplierPasswordHash, globalRole: "SUPPLIER", isActive: true, isverified: true },
  });
  console.log(`Ensured Supplier User: ${supplierEmail}`);

  // Supplier Profile
  const supplierProfile = await prisma.supplier.upsert({
    where: { userId: supplierUser.id },
    update: { name: "Global Meds Inc.", contactName: "John Doe", phone: "+1234567890", defaultLeadTime: 2, defaultMOQ: 100 },
    create: { name: "Global Meds Inc.", contactName: "John Doe", phone: "+1234567890", userId: supplierUser.id, defaultLeadTime: 2, defaultMOQ: 100 },
  });


  

  // ---------------------------------------------------------
  // 2. Populate Enormous Data (Medicines, Inventory, Sales)
  // ---------------------------------------------------------

  console.log("📦 Generating Medicines...");
  const medicines = [];
  
  // Create ~50 Medicines
  for (let i = 0; i < 50; i++) {
    const drug = getRandomElement(DRUG_NAMES);
    const strength = getRandomElement(["10mg", "20mg", "50mg", "100mg", "250mg", "500mg"]);
    const form = getRandomElement(DOSAGE_FORMS);
    
    // Check if exists to avoid noise in logs or duplicate errors (though ID is uuid)
    // We'll create distinct entries.
    const med = await prisma.medicine.create({
      data: {
        storeId: store.id,
        brandName: `${drug.brand} ${strength}`,
        genericName: drug.generic,
        dosageForm: form,
        strength: strength,
        category: getRandomElement(MEDICINE_CATEGORIES),
        sku: `SKU-${getRandomInt(10000, 99999)}`,
        uom: "Pack",
        isActive: true,
        taxInfo: { rate: 5 },
      }
    });
    medicines.push(med);
  }
  console.log(`✅ Created ${medicines.length} Medicines.`);

  console.log("🏭 Generating Inventory Batches...");
  const inventoryBatches:any[]= [];
  
  for (const med of medicines) {
    // Create 1-4 batches per medicine
    const numBatches = getRandomInt(1, 4);
    for (let j = 0; j < numBatches; j++) {
      const isExpired = Math.random() < 0.1; // 10% chance of expired
      const expiryDate = isExpired 
        ? subDays(new Date(), getRandomInt(10, 300))
        : addDays(new Date(), getRandomInt(30, 700));
        
      const batch = await prisma.inventoryBatch.create({
        data: {
          storeId: store.id,
          medicineId: med.id,
          batchNumber: `BN-${getRandomInt(100000, 999999)}`,
          qtyReceived: getRandomInt(100, 1000),
          qtyAvailable: getRandomInt(20, 800), // Assuming some sold
          qtyReserved: 0,
          expiryDate: expiryDate,
          purchasePrice: getRandomFloat(10, 500),
          mrp: getRandomFloat(50, 1000),
          receivedAt: subDays(new Date(), getRandomInt(1, 100)),
          location: `Shelf ${getRandomElement(['A', 'B', 'C'])}-${getRandomInt(1, 10)}`,
        }
      });
      inventoryBatches.push(batch);
    }
  }
  console.log(`✅ Created ${inventoryBatches.length} Inventory Batches.`);

  console.log("💰 Generating Sales History (This may take a moment)...");
  
  // Generate 200 Sales distributed over last 60 days
  const salePromises = [];
  const PAYMENT_METHODS: any[] = ["CASH", "CARD", "UPI"];
  
  for (let i = 0; i < 200; i++) {
    const saleDate = subDays(new Date(), getRandomInt(0, 60));
    
    // Create Sale
    const createSaleParams = async () => {
        const numItems = getRandomInt(1, 5);
        let subtotal = 0;
        const saleItemsData = [];

        // Select random items
        for(let k=0; k<numItems; k++) {
            const batch = getRandomElement(inventoryBatches);
            const qty = getRandomInt(1, 5);
            const unitPrice = Number(batch.mrp); // Use MRP as price
            const lineTotal = unitPrice * qty;
            
            subtotal += lineTotal;
            
            saleItemsData.push({
                medicineId: batch.medicineId,
                inventoryBatchId: batch.id,
                qty: qty,
                unitPrice: unitPrice,
                lineTotal: lineTotal
            });
        }

        const tax = subtotal * 0.05;
        const total = subtotal + tax;

        await prisma.sale.create({
            data: {
                storeId: store.id,
                createdById: storeOwner.id, // Attributed to owner
                subtotal: subtotal,
                tax: tax,
                discounts: 0,
                totalValue: total,
                paymentMethod: getRandomElement(PAYMENT_METHODS),
                paymentStatus: "PAID",
                createdAt: saleDate, // Past date
                updatedAt: saleDate,
                items: {
                    create: saleItemsData
                }
            }
        });
    };
    salePromises.push(createSaleParams());
  }
  
  // Run in chunks to avoid connection exhaustion if huge
  const chunkSize = 20;
  for (let i = 0; i < salePromises.length; i += chunkSize) {
    await Promise.all(salePromises.slice(i, i + chunkSize));
  }
  
  console.log(`✅ Created 200 Sales.`);

  // ---------------------------------------------------------
  // 3. Supplier Requests & Links
  // ---------------------------------------------------------
  console.log("🤝 Generating Supplier Requests...");
  
  // Link Supplier to Store
  await prisma.supplierStore.upsert({
      where: {
          supplierId_storeId: { supplierId: supplierProfile.id, storeId: store.id }
      },
      create: {
          supplierId: supplierProfile.id,
          storeId: store.id,
          linkedAt: subDays(new Date(), 30)
      },
      update: {}
  });

  // Create a few past requests
  await prisma.supplierRequest.create({
      data: {
          supplierId: supplierProfile.id,
          storeId: store.id,
          status: "ACCEPTED",
          message: "Hi, I'd like to supply your pharmacy.",
          createdById: supplierUser.id,
          createdAt: subDays(new Date(), 31)
      }
  });

   await prisma.supplierRequest.create({
      data: {
          supplierId: supplierProfile.id,
          storeId: store.id,
          status: "PENDING",
          message: "New catalog available for next season.",
          createdById: supplierUser.id,
          createdAt: subDays(new Date(), 2)
      }
  });

  console.log("✅ Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
