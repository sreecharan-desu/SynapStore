
import prisma from "../lib/prisma";
import { StockMovementReason } from "@prisma/client";

// --- Configuration ---
const SIMULATION_DAYS = 30; // Past 1 month (Optimized for speed)
const START_DATE = new Date();
START_DATE.setDate(START_DATE.getDate() - SIMULATION_DAYS);

// ... (keep lines 10-233 unchanged effectively)


// Medicine Catalog to Ensure
const KEY_MEDICINES = [
    { brand: "Paracetamol", generic: "Paracetamol", category: "Analgesics", baseDemand: 10, seasonality: "steady" },
    { brand: "Amoxil", generic: "Amoxicillin", category: "Antibiotics", baseDemand: 5, seasonality: "winter" },
    { brand: "CoughSyrup", generic: "Dextromethorphan", category: "Respiratory", baseDemand: 8, seasonality: "winter" },
    { brand: "Loratadine", generic: "Loratadine", category: "Antihistamines", baseDemand: 6, seasonality: "spring" },
    { brand: "Ibuprofen", generic: "Ibuprofen", category: "Analgesics", baseDemand: 9, seasonality: "steady" },
    { brand: "Vitamin C", generic: "Ascorbic Acid", category: "Vitamins", baseDemand: 4, seasonality: "any" },
    { brand: "Amlodipine", generic: "Amlodipine", category: "Cardiovascular", baseDemand: 7, seasonality: "steady" },
    { brand: "Metformin", generic: "Metformin", category: "Diabetes", baseDemand: 8, seasonality: "steady" },
    { brand: "Omeprazole", generic: "Omeprazole", category: "Gastrointestinal", baseDemand: 6, seasonality: "steady" },
    { brand: "Atorvastatin", generic: "Atorvastatin", category: "Cholesterol", baseDemand: 7, seasonality: "steady" },
    { brand: "Sertraline", generic: "Sertraline", category: "Antidepressants", baseDemand: 5, seasonality: "steady" },
    { brand: "Levothyroxine", generic: "Levothyroxine", category: "Thyroid", baseDemand: 6, seasonality: "steady" },
    { brand: "Ventolin", generic: "Albuterol", category: "Respiratory", baseDemand: 7, seasonality: "winter" },
    { brand: "Prednisone", generic: "Prednisone", category: "Corticosteroids", baseDemand: 5, seasonality: "any" },
    { brand: "Gabapentin", generic: "Gabapentin", category: "Neurology", baseDemand: 4, seasonality: "steady" },
    { brand: "Hydrochlorothiazide", generic: "Hydrochlorothiazide", category: "Diuretics", baseDemand: 5, seasonality: "steady" },
    { brand: "Losartan", generic: "Losartan", category: "Cardiovascular", baseDemand: 6, seasonality: "steady" },
    { brand: "Citalopram", generic: "Citalopram", category: "Antidepressants", baseDemand: 4, seasonality: "steady" },
    { brand: "Montelukast", generic: "Montelukast", category: "Respiratory", baseDemand: 5, seasonality: "spring" },
    { brand: "Furosemide", generic: "Furosemide", category: "Diuretics", baseDemand: 4, seasonality: "steady" },
    { brand: "Tramadol", generic: "Tramadol", category: "Analgesics", baseDemand: 5, seasonality: "steady" },
    { brand: "Warfarin", generic: "Warfarin", category: "Anticoagulants", baseDemand: 3, seasonality: "steady" },
    { brand: "Clonazepam", generic: "Clonazepam", category: "Anxiolytics", baseDemand: 3, seasonality: "steady" },
    { brand: "Tamsulosin", generic: "Tamsulosin", category: "Urology", baseDemand: 4, seasonality: "steady" },
    { brand: "Escitalopram", generic: "Escitalopram", category: "Antidepressants", baseDemand: 5, seasonality: "steady" },
    { brand: "Fluoxetine", generic: "Fluoxetine", category: "Antidepressants", baseDemand: 6, seasonality: "steady" },
    { brand: "Naproxen", generic: "Naproxen", category: "Analgesics", baseDemand: 7, seasonality: "steady" },
    { brand: "Diclofenac", generic: "Diclofenac", category: "Analgesics", baseDemand: 6, seasonality: "steady" },
    { brand: "Meloxicam", generic: "Meloxicam", category: "Analgesics", baseDemand: 5, seasonality: "steady" },
    { brand: "Cetirizine", generic: "Cetirizine", category: "Antihistamines", baseDemand: 8, seasonality: "spring" },
    { brand: "Fexofenadine", generic: "Fexofenadine", category: "Antihistamines", baseDemand: 7, seasonality: "spring" },
    { brand: "Pseudoephedrine", generic: "Pseudoephedrine", category: "Decongestants", baseDemand: 9, seasonality: "winter" },
    { brand: "Doxycycline", generic: "Doxycycline", category: "Antibiotics", baseDemand: 4, seasonality: "any" },
    { brand: "Azithromycin", generic: "Azithromycin", category: "Antibiotics", baseDemand: 6, seasonality: "winter" },
    { brand: "Ciprofloxacin", generic: "Ciprofloxacin", category: "Antibiotics", baseDemand: 5, seasonality: "any" },
    { brand: "Augmentin", generic: "Amoxicillin/Clavulanate", category: "Antibiotics", baseDemand: 7, seasonality: "winter" },
    { brand: "Cephalexin", generic: "Cephalexin", category: "Antibiotics", baseDemand: 6, seasonality: "any" },
    { brand: "Mupirocin", generic: "Mupirocin", category: "Topical Antibiotics", baseDemand: 3, seasonality: "any" },
    { brand: "Clotrimazole", generic: "Clotrimazole", category: "Antifungals", baseDemand: 4, seasonality: "summer" },
    { brand: "Fluconazole", generic: "Fluconazole", category: "Antifungals", baseDemand: 3, seasonality: "any" },
    { brand: "Ranitidine", generic: "Ranitidine", category: "Gastrointestinal", baseDemand: 5, seasonality: "steady" },
    { brand: "Famotidine", generic: "Famotidine", category: "Gastrointestinal", baseDemand: 4, seasonality: "steady" },
    { brand: "Lansoprazole", generic: "Lansoprazole", category: "Gastrointestinal", baseDemand: 5, seasonality: "steady" },
    { brand: "Bisacodyl", generic: "Bisacodyl", category: "Laxatives", baseDemand: 3, seasonality: "steady" },
    { brand: "Loperamide", generic: "Loperamide", category: "Antidiarrheals", baseDemand: 6, seasonality: "summer" },
    { brand: "Polyethylene Glycol", generic: "PEG", category: "Laxatives", baseDemand: 4, seasonality: "steady" },
    { brand: "Simethicone", generic: "Simethicone", category: "Gastrointestinal", baseDemand: 5, seasonality: "steady" },
    { brand: "Ondansetron", generic: "Ondansetron", category: "Antiemetics", baseDemand: 4, seasonality: "any" },
    { brand: "Meclizine", generic: "Meclizine", category: "Antiemetics", baseDemand: 3, seasonality: "summer" },
    { brand: "Diphenhydramine", generic: "Diphenhydramine", category: "Antihistamines", baseDemand: 7, seasonality: "spring" },
    { brand: "Hydroxyzine", generic: "Hydroxyzine", category: "Antihistamines", baseDemand: 4, seasonality: "steady" },
    { brand: "Claritin-D", generic: "Loratadine/Pseudoephedrine", category: "Antihistamines", baseDemand: 6, seasonality: "spring" },
    { brand: "Zyrtec-D", generic: "Cetirizine/Pseudoephedrine", category: "Antihistamines", baseDemand: 6, seasonality: "spring" },
    { brand: "Robitussin", generic: "Guaifenesin", category: "Cough & Cold", baseDemand: 8, seasonality: "winter" },
    { brand: "Mucinex", generic: "Guaifenesin", category: "Cough & Cold", baseDemand: 7, seasonality: "winter" },
    { brand: "Benadryl", generic: "Diphenhydramine", category: "Antihistamines", baseDemand: 7, seasonality: "spring" },
    { brand: "Tylenol PM", generic: "Acetaminophen/Diphenhydramine", category: "Sleep Aid", baseDemand: 5, seasonality: "steady" },
    { brand: "Aleve", generic: "Naproxen", category: "Analgesics", baseDemand: 6, seasonality: "steady" },
    { brand: "Excedrin", generic: "Acetaminophen/Aspirin/Caffeine", category: "Analgesics", baseDemand: 5, seasonality: "steady" },
    { brand: "Advil", generic: "Ibuprofen", category: "Analgesics", baseDemand: 9, seasonality: "steady" },
    { brand: "Voltaren", generic: "Diclofenac", category: "Topical Analgesics", baseDemand: 4, seasonality: "steady" },
    { brand: "Flexeril", generic: "Cyclobenzaprine", category: "Muscle Relaxants", baseDemand: 3, seasonality: "steady" },
    { brand: "Valium", generic: "Diazepam", category: "Anxiolytics", baseDemand: 3, seasonality: "steady" },
    { brand: "Xanax", generic: "Alprazolam", category: "Anxiolytics", baseDemand: 4, seasonality: "steady" },
    { brand: "Ambien", generic: "Zolpidem", category: "Sleep Aid", baseDemand: 4, seasonality: "steady" },
    { brand: "Lunesta", generic: "Eszopiclone", category: "Sleep Aid", baseDemand: 3, seasonality: "steady" },
    { brand: "Prozac", generic: "Fluoxetine", category: "Antidepressants", baseDemand: 5, seasonality: "steady" },
    { brand: "Zoloft", generic: "Sertraline", category: "Antidepressants", baseDemand: 5, seasonality: "steady" },
    { brand: "Lexapro", generic: "Escitalopram", category: "Antidepressants", baseDemand: 5, seasonality: "steady" },
    { brand: "Wellbutrin", generic: "Bupropion", category: "Antidepressants", baseDemand: 4, seasonality: "steady" },
    { brand: "Cymbalta", generic: "Duloxetine", category: "Antidepressants", baseDemand: 4, seasonality: "steady" },
    { brand: "Effexor", generic: "Venlafaxine", category: "Antidepressants", baseDemand: 3, seasonality: "steady" },
    { brand: "Lyrica", generic: "Pregabalin", category: "Neurology", baseDemand: 4, seasonality: "steady" },
    { brand: "Neurontin", generic: "Gabapentin", category: "Neurology", baseDemand: 4, seasonality: "steady" },
    { brand: "Topamax", generic: "Topiramate", category: "Neurology", baseDemand: 3, seasonality: "steady" },
    { brand: "Keppra", generic: "Levetiracetam", category: "Neurology", baseDemand: 3, seasonality: "steady" },
    { brand: "Dilantin", generic: "Phenytoin", category: "Neurology", baseDemand: 2, seasonality: "steady" },
    { brand: "Tegretol", generic: "Carbamazepine", category: "Neurology", baseDemand: 2, seasonality: "steady" },
    { brand: "Depakote", generic: "Divalproex", category: "Neurology", baseDemand: 3, seasonality: "steady" },
    { brand: "Lisinopril", generic: "Lisinopril", category: "Cardiovascular", baseDemand: 7, seasonality: "steady" },
    { brand: "Ramipril", generic: "Ramipril", category: "Cardiovascular", baseDemand: 6, seasonality: "steady" },
    { brand: "Valsartan", generic: "Valsartan", category: "Cardiovascular", baseDemand: 5, seasonality: "steady" },
    { brand: "Metoprolol", generic: "Metoprolol", category: "Cardiovascular", baseDemand: 7, seasonality: "steady" },
    { brand: "Carvedilol", generic: "Carvedilol", category: "Cardiovascular", baseDemand: 6, seasonality: "steady" },
    { brand: "Atenolol", generic: "Atenolol", category: "Cardiovascular", baseDemand: 5, seasonality: "steady" },
    { brand: "Clopidogrel", generic: "Clopidogrel", category: "Anticoagulants", baseDemand: 4, seasonality: "steady" },
    { brand: "Eliquis", generic: "Apixaban", category: "Anticoagulants", baseDemand: 3, seasonality: "steady" },
    { brand: "Xarelto", generic: "Rivaroxaban", category: "Anticoagulants", baseDemand: 3, seasonality: "steady" },
    { brand: "Coumadin", generic: "Warfarin", category: "Anticoagulants", baseDemand: 3, seasonality: "steady" },
    { brand: "Januvia", generic: "Sitagliptin", category: "Diabetes", baseDemand: 4, seasonality: "steady" },
    { brand: "Trulicity", generic: "Dulaglutide", category: "Diabetes", baseDemand: 3, seasonality: "steady" },
    { brand: "Ozempic", generic: "Semaglutide", category: "Diabetes", baseDemand: 3, seasonality: "steady" },
    { brand: "Victoza", generic: "Liraglutide", category: "Diabetes", baseDemand: 3, seasonality: "steady" },
    { brand: "Humalog", generic: "Insulin Lispro", category: "Diabetes", baseDemand: 4, seasonality: "steady" },
    { brand: "Lantus", generic: "Insulin Glargine", category: "Diabetes", baseDemand: 4, seasonality: "steady" },
    { brand: "Novolog", generic: "Insulin Aspart", category: "Diabetes", baseDemand: 4, seasonality: "steady" },
    { brand: "Synthroid", generic: "Levothyroxine", category: "Thyroid", baseDemand: 6, seasonality: "steady" },
    { brand: "Cytomel", generic: "Liothyronine", category: "Thyroid", baseDemand: 2, seasonality: "steady" },
    { brand: "Armour Thyroid", generic: "Thyroid Desiccated", category: "Thyroid", baseDemand: 2, seasonality: "steady" },
    { brand: "Viagra", generic: "Sildenafil", category: "Erectile Dysfunction", baseDemand: 3, seasonality: "steady" },
    { brand: "Cialis", generic: "Tadalafil", category: "Erectile Dysfunction", baseDemand: 3, seasonality: "steady" },
    { brand: "Propecia", generic: "Finasteride", category: "Hair Loss", baseDemand: 2, seasonality: "steady" },
    { brand: "Rogaine", generic: "Minoxidil", category: "Hair Loss", baseDemand: 2, seasonality: "steady" },
    { brand: "Accutane", generic: "Isotretinoin", category: "Dermatology", baseDemand: 1, seasonality: "any" },
    { brand: "Retin-A", generic: "Tretinoin", category: "Dermatology", baseDemand: 2, seasonality: "any" },
    { brand: "Dermovate", generic: "Clobetasol", category: "Dermatology", baseDemand: 3, seasonality: "any" },
    { brand: "Hydrocortisone", generic: "Hydrocortisone", category: "Dermatology", baseDemand: 5, seasonality: "any" },
    { brand: "Neosporin", generic: "Bacitracin/Neomycin/Polymyxin B", category: "Topical Antibiotics", baseDemand: 7, seasonality: "any" },
    {
        brand: "Band-Aid", generic: "Adhesive Bandage", category: "First Aid", baseDemand: 10,
    }]

const PAYMENT_METHODS: any[] = ["CASH", "CARD", "UPI"];

// Helpers
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const addDays = (date: Date, days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

// --- In-Memory Inventory Tracker ---
// Map<StoreId, Map<MedicineId, Array<Batch>>>
// Batch: { id, qtyAvailable, expiry, ... }
type SimulatedBatch = {
    id: string;
    medicineId: string;
    qtyAvailable: number;
    mrp: number;
    expiryDate: Date;
};

interface Deduction {
    batchId: string;
    amount: number;
    mrp: number;
}

interface SeedLineItem {
    medicineId: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    deductions: Deduction[];
}

async function main() {
  console.log("🌱 Starting Realistic Flow Seed...");

  // 1. Fetch Existing Context
  const allStores = await prisma.store.findMany({ include: { users: true } });
  const allSuppliers = await prisma.supplier.findMany();

  if (allStores.length === 0) { console.error("❌ No stores found!"); return; }
  if (allSuppliers.length === 0) { console.error("❌ No suppliers found!"); return; }

  console.log(`Checking ${allStores.length} stores and ${allSuppliers.length} suppliers.`);

  // 2. Process Per Store
  for (const store of allStores) {
    console.log(`\n🏪 Simulating Store: ${store.name}`);
    const owner = store.users.find(u => u.role === "STORE_OWNER") || store.users[0];
    const ownerId = owner?.userId;
    
    // 2.1 Ensure Key Medicines Exist
    console.log("   💊 Verifying Catalog (Bulk Mode)...");
    const medicineMap = new Map<string, string>(); // Name -> ID
    
    // Fetch all existing medicines for this store
    const existingMedicines = await prisma.medicine.findMany({
        where: { storeId: store.id }
    });
    
    const existingBrandMap = new Map<string, string>();
    existingMedicines.forEach(m => existingBrandMap.set(m.brandName, m.id));

    const missingItems = [];
    for (const item of KEY_MEDICINES) {
        if (existingBrandMap.has(item.brand)) {
             medicineMap.set(item.brand, existingBrandMap.get(item.brand)!);
        } else {
             missingItems.push(item);
        }
    }

    if (missingItems.length > 0) {
        console.log(`      Creating ${missingItems.length} missing medicines...`);
        await prisma.medicine.createMany({
            data: missingItems.map(item => ({
                storeId: store.id,
                brandName: item.brand,
                genericName: item.generic,
                category: item.category,
                strength: "500mg",
                dosageForm: "Tablet",
                uom: "Strip",
                sku: `SKU-${getRandomInt(1000, 9999)}`,
                isActive: true
            }))
        });

        // Re-fetch to get IDs of newly created items
        const newMedicines = await prisma.medicine.findMany({
             where: { 
                 storeId: store.id,
                 brandName: { in: missingItems.map(m => m.brand) }
             }
        });
        
        newMedicines.forEach(m => medicineMap.set(m.brandName, m.id));
    }
    
    // 2.2 Wipe Clean for Simulation (Optional? No, let's keep it additive but logical)
    // "No random adding" -> implies if data exists, work with it? 
    // But to ensure "perfect flow", we often need a clean slate or at least clear recent history.
    // For now, we will ADD to existing data but ensure we create enough "Past" data.

    // Inventory State (In-Memory)
    const inventoryState = new Map<string, SimulatedBatch[]>(); 
    // Load existing inventory into state to be safe
    const existingBatches = await prisma.inventoryBatch.findMany({
        where: { storeId: store.id, qtyAvailable: { gt: 0 } }
    });
    for(const b of existingBatches) {
        if(!inventoryState.has(b.medicineId)) inventoryState.set(b.medicineId, []);
        inventoryState.get(b.medicineId)!.push({
            id: b.id,
            medicineId: b.medicineId,
            qtyAvailable: b.qtyAvailable,
            mrp: b.mrp ? Number(b.mrp) : 10,
            expiryDate: b.expiryDate ?? addDays(new Date(), 365)
        });
    }


    // 3. Time Loop
    console.log("   ⏳ Running Time Simulation...");
    let currentDate = new Date(START_DATE);
    const today = new Date();
    
    // To minimize database spam, we'll transactions per day or week
    // We'll advance day by day
    while (currentDate <= today) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (currentDate.getDate() % 10 === 0 || currentDate.getDate() === 1) {
             console.log(`   🗓️  Simulating date: ${dateStr}`);
        }
        
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const currentMonth = currentDate.getMonth(); // 0-11

        // --- A. Procurement (Supplier -> Store) ---
        // Every ~15 days random, resupply low stock items
        if (Math.random() < 0.1) { // 10% chance per day (~ every 10 days)
            const supplier = allSuppliers[Math.floor(Math.random() * allSuppliers.length)];
            
            // Pick medicines to reorder
            const itemsToReorder = [];
            for (const [name, id] of medicineMap.entries()) {
                // Check stock
                const batches = inventoryState.get(id) || [];
                const totalStock = batches.reduce((sum, b) => sum + b.qtyAvailable, 0);
                
                // Reorder if stock is sufficient low OR random push
                if (totalStock < 50) { // Reorder threshold
                    itemsToReorder.push({ id, name, qty: getRandomInt(100, 300) });
                }
            }

            if (itemsToReorder.length > 0) {
                // 1. Create Request
                const request = await prisma.supplierRequest.create({
                    data: {
                        supplierId: supplier.id,
                        storeId: store.id,
                        status: "ACCEPTED", // Skip PENDING step for simulation speed
                        createdById: ownerId, 
                        createdAt: currentDate,
                        updatedAt: currentDate,
                        message: "System Auto-Reorder"
                    }
                });

                // 2. Fulfill (Create Batches)
                // We do this manually to simulate the "Service" logic but allow setting custom 'createdAt' dates
                const batchInserts = [];
                const movementInserts = [];
                const newSimBatches = [];

                for (const item of itemsToReorder) {
                    const expiry = addDays(currentDate, 365); // 1 year expiry
                    const mrp = getRandomInt(10, 50);
                    const purchase = mrp * 0.7;
                    const batchNo = `BN-${dateStr.replace(/-/g,'')}-${getRandomInt(100,999)}`;
                    
                    // Create Batch
                    const batch = await prisma.inventoryBatch.create({
                        data: {
                            storeId: store.id,
                            medicineId: item.id,
                            batchNumber: batchNo,
                            qtyReceived: item.qty,
                            qtyAvailable: item.qty,
                            expiryDate: expiry,
                            mrp: mrp,
                            purchasePrice: purchase,
                            receivedAt: currentDate,
                            createdAt: currentDate
                        }
                    });

                    // Track Movement
                    await prisma.stockMovement.create({
                        data: {
                            storeId: store.id,
                            medicineId: item.id,
                            inventoryId: batch.id,
                            delta: item.qty,
                            reason: StockMovementReason.RECEIPT,
                            note: `Reorder ${request.id}`,
                            createdAt: currentDate,
                        }
                    });

                    // Update State
                    if(!inventoryState.has(item.id)) inventoryState.set(item.id, []);
                    inventoryState.get(item.id)!.push({
                        id: batch.id,
                        medicineId: item.id,
                        qtyAvailable: item.qty,
                        mrp: mrp,
                        expiryDate: expiry
                    });
                }
            }
        } // End Procurement


        // --- B. Sales (Store -> Customer) ---
        // Base sales volume depends on "busy-ness" of day
        let dailySalesCount = getRandomInt(2, 5); 
        if (isWeekend) dailySalesCount += 2; 
        
        // Apply Seasonality to demand
        // (Winter: Nov, Dec, Jan)
        const isWinter = [10, 11, 0, 1].includes(currentMonth);
        
        for (let s = 0; s < dailySalesCount; s++) {
            // Pick medicines to buy
            const basketSize = getRandomInt(1, 4);
            const lineItems: SeedLineItem[] = [];
            let saleTotal = 0;

            for (let k = 0; k < basketSize; k++) {
                // Select a medicine weighted by demand
                const medConfig = KEY_MEDICINES[Math.floor(Math.random() * KEY_MEDICINES.length)];
                const medId = medicineMap.get(medConfig.brand);
                if (!medId) continue;

                // Check Seasonality Modifier
                let demandMod = 1;
                if (medConfig.seasonality === "winter" && isWinter) demandMod = 2.0;

                // Determine Qty
                const qtyNeeded = Math.ceil(getRandomInt(1, 3) * demandMod);

                // Fulfill from Inventory (FIFO)
                const batches = inventoryState.get(medId);
                if (!batches || batches.length === 0) continue; // Out of stock

                // Simple FIFO logic
                // Sort by expiry (usually roughly FIFO)
                batches.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

                let qtyRemaining = qtyNeeded;
                let cost = 0;
                const deductions: Deduction[] = [];

                for (const batch of batches) {
                    if (qtyRemaining <= 0) break;
                    const take = Math.min(batch.qtyAvailable, qtyRemaining);
                    batch.qtyAvailable -= take;
                    qtyRemaining -= take;
                    cost += (take * batch.mrp);
                    
                    deductions.push({ batchId: batch.id, amount: take, mrp: batch.mrp });
                }

                // Cleanup empty batches from state
                const validBatches = batches.filter(b => b.qtyAvailable > 0);
                inventoryState.set(medId, validBatches);

                if (deductions.length > 0) {
                    const fulfilledQty = qtyNeeded - qtyRemaining;
                    lineItems.push({
                        medicineId: medId,
                        qty: fulfilledQty,
                        unitPrice: deductions[0].mrp, // simplified unit pricing for line item display
                        lineTotal: cost,
                        deductions // Store for post-processing
                    });
                    saleTotal += cost;
                }
            }

            if (lineItems.length > 0) {
                // Create Sale Record
                // Use transaction to ensure consistency
                const saleTime = new Date(currentDate);
                saleTime.setHours(getRandomInt(9, 21), getRandomInt(0, 59));

                await prisma.$transaction(async (tx) => {
                    const sale = await tx.sale.create({
                        data: {
                            storeId: store.id,
                            createdById: ownerId,
                            subtotal: saleTotal,
                            totalValue: saleTotal,
                            paymentMethod: PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)],
                            paymentStatus: "PAID",
                            createdAt: saleTime,
                            items: {
                                create: lineItems.map(l => ({
                                    medicineId: l.medicineId,
                                    qty: l.qty,
                                    unitPrice: l.unitPrice,
                                    lineTotal: l.lineTotal,
                                    inventoryBatchId: l.deductions[0].batchId // simple link to primary batch
                                }))
                            }
                        },
                        include: { items: true }
                    });

                    // Create Stock Movements & Update API Batches
                    for (let i = 0; i < lineItems.length; i++) {
                        const line = lineItems[i];
                        const saleItem = sale.items[i]; // trusting order preservation or map by ID if needed

                        for (const ded of line.deductions) {
                           await tx.inventoryBatch.update({
                               where: { id: ded.batchId },
                               data: { qtyAvailable: { decrement: ded.amount } }
                           });

                           await tx.stockMovement.create({
                               data: {
                                   storeId: store.id,
                                   inventoryId: ded.batchId,
                                   medicineId: line.medicineId,
                                   delta: -ded.amount,
                                   reason: StockMovementReason.SALE,
                                   performedById: ownerId,
                                   saleItemId: saleItem.id,
                                   createdAt: saleTime
                               }
                           });
                        }
                    }
                }, { timeout: 45000 });
            }
        } // End Sales

        // Advance Day
        currentDate = addDays(currentDate, 1);
    }
  }

  console.log("✅ Seed Completed Successfully with Realistic Flows!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
