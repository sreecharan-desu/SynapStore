// prisma/seed.ts
import "dotenv/config";
import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma";
import { crypto$ } from "../lib/crypto";

if (process.env.NODE_ENV === "production") {
  console.error("Seeding aborted: NODE_ENV=production");
  process.exit(1);
}

const SEED = {
  STORES: 2,
  USERS_PER_STORE: 4,
  SUPPLIERS_PER_STORE: 6,
  DOCTORS: 12,
  INSURANCES: 8,
  PATIENTS: 40,
  MEDICINES_PER_STORE: 40,
  BATCHES_PER_MEDICINE: 2,
  PRESCRIPTIONS: 80,
  REORDERS_PER_STORE: 8,
  NOTIFICATIONS_PER_STORE: 6,
  WEBHOOKS_PER_STORE: 2,
  UPLOADS_PER_STORE: 2,
  ALERTS_PER_STORE: 6,
  FORECASTS_PER_STORE: 6,
};

/**
 * Helpers
 */
async function hashPw(plain: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

function rndInt(min: number, max: number) {
  return faker.number.int({ min, max });
}

/**
 * DB cleanup - development only
 */
async function clearAll() {
  // Delete in dependency order (safe for dev only)
  await prisma.auditLog.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.webhookRegistration.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.reorderItem.deleteMany();
  await prisma.reorder.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.medicine.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.insurance.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.userStoreRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
  await prisma.storeHealth.deleteMany();
  await prisma.forecast.deleteMany();
  await prisma.alert.deleteMany();
}

/**
 * Create a dedicated testing user at the very top
 * Email: sreecharan309@gmail.com
 * Password: 12345678
 *
 * Uses deterministic encryption for username/email to match app lookups.
 */
async function createTestingUser() {
  const emailPlain = "sreecharan309@gmail.com";
  const usernamePlain = "sreecharan";
  const plain = "12345678";
  const passwordHash = await hashPw(plain);

  const encEmail = crypto$.encryptCellDeterministic(emailPlain);

  // If user already exists (by encrypted email), return it
  const existing = await prisma.user.findUnique({ where: { email: encEmail } });
  if (existing) return existing;

  const encUsername = crypto$.encryptCellDeterministic(usernamePlain);
  // no image for test user - leave null
  const user = await prisma.user.create({
    data: {
      username: encUsername,
      email: encEmail,
      passwordHash,
      imageUrl: null,
      phone: null,
      isActive: true,
      isverified: true,
    },
    select: { id: true, email: true, username: true },
  });

  return user;
}

/**
 * Create stores and some users per store.
 */
async function createStoresAndUsers(testUserId: string) {
  const stores: { id: string; slug: string; name: string }[] = [];

  for (let i = 0; i < SEED.STORES; i++) {
    const name = `${faker.company.name()} Pharmacy`;
    const slug = faker.helpers.slugify(name).toLowerCase() + `-${i + 1}`;

    const store = await prisma.store.create({
      data: {
        name,
        slug,
        timezone: "Asia/Kolkata",
        currency: "INR",
        settings: {},
      },
      select: { id: true, slug: true, name: true },
    });

    stores.push(store);

    // create some users for this store (besides the test user)
    for (let u = 0; u < SEED.USERS_PER_STORE; u++) {
      const usernamePlain = (
        faker.internet.username() + `${i}${u}`
      ).toLowerCase();
      const emailPlain = `${usernamePlain}@example.com`;
      const password = "Password123!";
      const passwordHash = await hashPw(password);

      const encUsername = crypto$.encryptCellDeterministic(usernamePlain);
      const encEmail = crypto$.encryptCellDeterministic(emailPlain);
      const encImage = crypto$.encryptCell(faker.image.avatar());

      let user;
      try {
        user = await prisma.user.create({
          data: {
            username: encUsername,
            email: encEmail,
            passwordHash,
            imageUrl: encImage ?? undefined,
            phone: faker.phone.number({ style: "international" }),
            isActive: true,
            isverified: true,
          },
          select: { id: true },
        });
      } catch (e: any) {
        const found = await prisma.user.findUnique({
          where: { email: encEmail },
          select: { id: true },
        });
        if (found) user = found;
        else throw e;
      }

      const role =
        u === 0
          ? "STORE_OWNER"
          : u === 1
          ? "ADMIN"
          : u === 2
          ? "MANAGER"
          : "STAFF";

      try {
        await prisma.userStoreRole.create({
          data: {
            userId: user.id,
            storeId: store.id,
            role,
          },
        });
      } catch {
        // ignore duplicates
      }
    }
  }

  // assign the testing user as STORE_OWNER on the first store
  if (stores.length > 0) {
    try {
      await prisma.userStoreRole.create({
        data: {
          userId: testUserId,
          storeId: stores[0].id,
          role: "STORE_OWNER",
        },
      });
    } catch {
      // ignore
    }
  }

  return stores;
}

/**
 * Create per-store suppliers
 */
async function createSuppliersForStore(storeId: string, count = 6) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const supplierName = `${faker.company.name()} Supplies`;
    const willHaveUser = Math.random() < 0.3;
    let userId: string | undefined = undefined;

    if (willHaveUser) {
      const usernamePlain =
        faker.helpers.slugify(supplierName).slice(0, 24).toLowerCase() +
        `${i}${storeId.slice(0, 4)}`;
      const emailPlain = `${usernamePlain}@supplier.example.com`;
      const passwordPlain = "Supplier123!";
      const passwordHash = await hashPw(passwordPlain);

      const encUsername = crypto$.encryptCellDeterministic(usernamePlain);
      const encEmail = crypto$.encryptCellDeterministic(emailPlain);
      const encImage = crypto$.encryptCell(faker.image.avatar());

      try {
        const supplierUser = await prisma.user.create({
          data: {
            username: encUsername,
            email: encEmail,
            passwordHash,
            imageUrl: encImage,
            phone: faker.phone.number({ style: "international" }),
            isActive: true,
            isverified: true,
            globalRole: "SUPPLIER",
          },
          select: { id: true },
        });
        userId = supplierUser.id;
      } catch {
        const found = await prisma.user.findUnique({
          where: { email: crypto$.encryptCellDeterministic(emailPlain) },
          select: { id: true },
        });
        if (found) userId = found.id;
      }
    }

    try {
      const s = await prisma.supplier.create({
        data: {
          storeId,
          name: supplierName,
          address: faker.location.streetAddress(),
          phone: faker.phone.number({ style: "international" }),
          contactName: faker.person.fullName(),
          defaultLeadTime: rndInt(1, 14),
          defaultMOQ: rndInt(1, 50),
          externalMeta: {},
          userId: userId ?? undefined,
        },
        select: { id: true },
      });
      ids.push(s.id);
    } catch (e: any) {
      console.warn("Failed to create supplier row:", e?.message ?? e);
    }
  }
  return ids;
}

/**
 * Create doctors
 */
async function createDoctors(count = 12) {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const d = await prisma.doctor.create({
      data: {
        name: faker.person.fullName(),
        address: faker.location.streetAddress(),
        phone: faker.phone.number({ style: "international" }),
      },
      select: { physID: true },
    });
    ids.push(d.physID);
  }
  return ids;
}

/**
 * Create insurances
 */
async function createInsurances(count = 8) {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = `${faker.company.name()} Insurance`;
    await prisma.insurance.create({
      data: {
        name,
        phone: faker.phone.number({ style: "international" }),
        coPay: faker.helpers.arrayElement(["Yes", "No"]),
      },
    });
    names.push(name);
  }
  return names;
}

/**
 * Create patients
 */
async function createPatients(count = 40, insuranceNames: string[]) {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const insurance = faker.helpers.arrayElement([
      ...insuranceNames,
      null,
      null,
    ]);
    const birth = faker.date.birthdate({ min: 1, max: 90, mode: "age" });
    const p = await prisma.patient.create({
      data: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        birthdate: birth,
        address: faker.location.streetAddress(),
        phone: faker.phone.number({ style: "international" }),
        gender: faker.helpers.arrayElement(["Male", "Female", "Other"]),
        insuranceProvider: insurance
          ? { connect: { name: insurance } }
          : undefined,
      },
      select: { patientID: true },
    });
    ids.push(p.patientID);
  }
  return ids;
}

/**
 * Create medicines + inventory batches for a store
 */
async function createMedicinesForStore(
  storeId: string,
  supplierIds: string[],
  count = 40
) {
  const meds: string[] = [];
  for (let i = 0; i < count; i++) {
    const ndc = faker.string.numeric(10);
    const med = await prisma.medicine.create({
      data: {
        ndc,
        storeId,
        sku: faker.helpers.slugify(faker.commerce.product()).slice(0, 32),
        brandName: faker.commerce.productName(),
        genericName: faker.commerce.productAdjective() + "ine",
        dosageForm: faker.helpers.arrayElement([
          "tablet",
          "syrup",
          "injection",
        ]),
        strength: `${rndInt(1, 500)} mg`,
        uom: "mg",
        category: faker.commerce.department(),
        taxInfo: {},
      },
      select: { id: true },
    });
    meds.push(med.id);

    // create inventory batches
    for (let b = 0; b < SEED.BATCHES_PER_MEDICINE; b++) {
      const qtyReceived = rndInt(10, 200);
      const expiryDate = faker.date.soon({ days: rndInt(30, 365 * 2) });
      const batch = await prisma.inventoryBatch.create({
        data: {
          storeId,
          medicineId: med.id,
          batchNumber: `BATCH-${faker.string.alphanumeric(6).toUpperCase()}`,
          qtyReceived,
          qtyAvailable: Math.max(0, qtyReceived - rndInt(0, 5)),
          qtyReserved: 0,
          expiryDate,
          purchasePrice: parseFloat(
            faker.commerce.price({ min: 10, max: 200, dec: 2 })
          ),
          mrp: parseFloat(faker.commerce.price({ min: 200, max: 500, dec: 2 })),
          receivedAt: faker.date.past(),
          location: faker.helpers.arrayElement(["Main", "Shelf A", "Coldroom"]),
        },
      });

      // record a RECEIPT stock movement for audit
      await prisma.stockMovement.create({
        data: {
          storeId,
          inventoryId: batch.id,
          medicineId: med.id,
          delta: batch.qtyReceived,
          reason: "RECEIPT",
          note: "seed: initial receipt",
        },
      });
    }
  }
  return meds;
}

/**
 * Create reorders (drafts) with items. Some will be SENT with externalRef.
 */
async function createReordersForStore(
  storeId: string,
  supplierIds: string[],
  medicineIds: string[]
) {
  const reorderIds: string[] = [];
  for (let i = 0; i < SEED.REORDERS_PER_STORE; i++) {
    const supplierId = faker.helpers.arrayElement(supplierIds);
    const itemsCount = rndInt(1, 4);
    const items: any[] = [];
    for (let j = 0; j < itemsCount; j++) {
      items.push({
        medicineId: faker.helpers.arrayElement(medicineIds),
        qty: rndInt(5, 50),
        price: parseFloat(faker.commerce.price({ min: 10, max: 200, dec: 2 })),
        sku: null,
        batchPref: null,
      });
    }

    const totalValue = items.reduce((s, it) => s + (it.price ?? 0) * it.qty, 0);

    const created = await prisma.reorder.create({
      data: {
        storeId,
        supplierId,
        totalValue: totalValue || undefined,
        status: Math.random() < 0.4 ? "SENT" : "DRAFT",
        externalRef:
          Math.random() < 0.4
            ? `PO-${faker.string.alphanumeric(8).toUpperCase()}`
            : undefined,
        items: { create: items },
      },
      select: { id: true },
    });

    reorderIds.push(created.id);
  }
  return reorderIds;
}

/**
 * For some SENT reorders, perform a 'receive' to create inventory batches and stock movements.
 */
async function receiveSomeReorders(storeId: string) {
  const sentReorders = await prisma.reorder.findMany({
    where: { storeId, status: "SENT" },
    include: { items: true },
  });

  for (const r of sentReorders.slice(0, 3)) {
    const receivedItems: any[] = [];

    for (const it of r.items) {
      // Safely coerce qty to a number
      const baseQty = Number(it.qty ?? 0);
      const factor = 0.8 + Math.random() * 0.5; // between 0.8 and 1.3
      const qtyReceived = Math.max(1, Math.floor(baseQty * factor));

      // Safely coerce price to a number
      const basePrice = it.price != null ? Number(it.price) : 0;

      const batch = await prisma.inventoryBatch.create({
        data: {
          storeId,
          medicineId: it.medicineId,
          batchNumber: `RECV-${faker.string.alphanumeric(6).toUpperCase()}`,
          qtyReceived,
          qtyAvailable: qtyReceived,
          qtyReserved: 0,
          expiryDate: faker.date.soon({ days: rndInt(90, 365 * 2) }),
          purchasePrice: it.price != null ? Number(it.price) : undefined,
          mrp: basePrice * 1.5,
          receivedAt: new Date(),
          location: "Main",
        },
      });

      await prisma.stockMovement.create({
        data: {
          storeId,
          inventoryId: batch.id,
          medicineId: it.medicineId,
          delta: qtyReceived,
          reason: "RECEIPT",
          note: `seed: receive for reorder ${r.id}`,
        },
      });

      receivedItems.push({
        reorderItemId: it.id,
        qtyReceived,
        batchId: batch.id,
      });
    }

    await prisma.reorder.update({
      where: { id: r.id },
      data: { status: "RECEIVED" },
    });

    await prisma.activityLog.create({
      data: {
        storeId,
        action: "REORDER_RECEIVE",
        payload: { reorderId: r.id, receivedItems },
      },
    });
  }
}

/**
 * Create uploads (simulate preview and applied)
 */
async function createUploadsForStore(storeId: string, createdById: string) {
  const uploads: string[] = [];
  for (let i = 0; i < SEED.UPLOADS_PER_STORE; i++) {
    const filename = `inventory_seed_${storeId.slice(0, 6)}_${i}.xlsx`;
    const status = i % 2 === 0 ? "PREVIEW_READY" : "APPLIED";
    const preview = { rows: rndInt(2, 8), errors: [] };
    const up = await prisma.upload.create({
      data: {
        storeId,
        filename,
        fileRef: `/tmp/${filename}`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        status: status as any,
        rowsProcessed: status === "APPLIED" ? rndInt(2, 8) : 0,
        errorsCount: 0,
        preview,
        createdById,
        processedAt: status === "APPLIED" ? new Date() : undefined,
      },
    });
    uploads.push(up.id);
  }
  return uploads;
}

/**
 * Create notifications and webhook registrations
 */
async function createNotificationsAndWebhooks(
  storeId: string,
  createdById: string
) {
  // webhooks
  for (let i = 0; i < SEED.WEBHOOKS_PER_STORE; i++) {
    await prisma.webhookRegistration.create({
      data: {
        storeId,
        name: `webhook-${i + 1}`,
        url: `https://example.com/hook/${faker.string.alphanumeric(8)}`,
        secret: faker.string.alphanumeric(24),
        events: ["REORDER_CREATED", "ALERT_CREATED", "PRESCRIPTION_CREATED"],
        isActive: true,
      },
    });
  }

  // notifications
  for (let i = 0; i < SEED.NOTIFICATIONS_PER_STORE; i++) {
    const channel = faker.helpers.arrayElement(["email", "sms", "webhook"]);
    const recipient =
      channel === "email"
        ? `${faker.internet.email()}`
        : faker.phone.number({ style: "international" });
    await prisma.notification.create({
      data: {
        storeId,
        userId: createdById,
        channel,
        recipient,
        subject: channel === "email" ? "Seed notification" : undefined,
        body: `This is a seed ${channel} notification`,
        metadata: { seed: true },
        status: i % 3 === 0 ? "SENT" : "QUEUED",
        providerResp: i % 3 === 0 ? { result: "ok" } : undefined,
        sentAt: i % 3 === 0 ? new Date() : undefined,
      },
    });
  }
}

/**
 * Create some alerts and forecasts and store health
 */
async function createAlertsForecastsHealth(
  storeId: string,
  medicineIds: string[]
) {
  for (let i = 0; i < SEED.ALERTS_PER_STORE; i++) {
    const type = faker.helpers.arrayElement([
      "LOW_STOCK",
      "EXPIRY_SOON",
      "CUSTOM",
    ]);
    await prisma.alert.create({
      data: {
        storeId,
        type: type as any,
        status: "ACTIVE",
        metadata: { note: `seed alert ${i + 1}` },
        severity: rndInt(1, 5),
      },
    });
  }

  for (let i = 0; i < SEED.FORECASTS_PER_STORE; i++) {
    const med = faker.helpers.arrayElement(medicineIds);
    await prisma.forecast.create({
      data: {
        storeId,
        medicineId: med,
        model: faker.helpers.arrayElement(["ets", "lgbm", "prophet"]),
        params: { horizon: 30 },
        result: { forecast: Array.from({ length: 7 }, () => rndInt(0, 20)) },
      },
    });
  }

  await prisma.storeHealth.create({
    data: {
      storeId,
      score: parseFloat((Math.random() * 100).toFixed(2)),
      metrics: { expiryRisk: rndInt(0, 100), stockCoverageDays: rndInt(1, 60) },
    },
  });
}

/**
 * Create prescriptions referencing the store's medicines
 */
async function createPrescriptions(
  count = 80,
  patientIds: number[],
  doctorIds: number[],
  medicineIds: string[],
  storeIds: string[]
) {
  for (let i = 0; i < count; i++) {
    const patientID = faker.helpers.arrayElement(patientIds);
    const physID = faker.helpers.arrayElement(doctorIds);
    const medicineId = faker.helpers.arrayElement(medicineIds);
    const storeId = faker.helpers.arrayElement(storeIds);
    await prisma.prescription.create({
      data: {
        storeId,
        patientID,
        physID,
        medicineId,
        qty: rndInt(1, 30),
        days: rndInt(1, 30),
        refills: rndInt(0, 3),
        status: faker.helpers.arrayElement([
          "active",
          "completed",
          "cancelled",
        ]),
        issuedAt: faker.date.recent(),
      },
    });
  }
}

/**
 * Create some sale stock movements to simulate POS activity
 */
async function createSomeSales(storeId: string, medicineIds: string[]) {
  // pick random inventory batches and create SALE movements
  const batches = await prisma.inventoryBatch.findMany({
    where: { storeId },
    take: 50,
  });
  for (const b of batches.slice(0, Math.min(batches.length, 30))) {
    const qty = Math.min(
      b.qtyAvailable,
      rndInt(1, Math.max(1, Math.floor(b.qtyAvailable * 0.3)))
    );
    if (qty <= 0) continue;
    // create movement and decrement qtyAvailable
    await prisma.stockMovement.create({
      data: {
        storeId,
        inventoryId: b.id,
        medicineId: b.medicineId,
        delta: -qty,
        reason: "SALE",
        note: "seed: sale simulation",
      },
    });
    try {
      await prisma.inventoryBatch.update({
        where: { id: b.id },
        data: { qtyAvailable: Math.max(0, b.qtyAvailable - qty) },
      });
    } catch {
      // ignore
    }
  }
}

/**
 * main seeding flow
 */
async function main() {
  console.log("Starting seed... (development only)");

  await clearAll();

  // create testing user first (encrypted)
  const testUser = await createTestingUser();
  console.log("Created test user:", "sreecharan309@gmail.com");

  // stores + per-store users
  const stores = await createStoresAndUsers(testUser.id);
  console.log(`Created ${stores.length} stores`);

  // shared resources
  const doctorIds = await createDoctors(SEED.DOCTORS);
  console.log(`Created ${doctorIds.length} doctors`);

  const insuranceNames = await createInsurances(SEED.INSURANCES);
  console.log(`Created ${insuranceNames.length} insurance providers`);

  const patientIds = await createPatients(SEED.PATIENTS, insuranceNames);
  console.log(`Created ${patientIds.length} patients`);

  // per-store suppliers, medicines, batches, reorders, uploads, notifications, webhooks, forecasts, alerts
  const allMedicineIds: string[] = [];
  const storeIds = stores.map((s) => s.id);

  for (const s of stores) {
    const supplierIds = await createSuppliersForStore(
      s.id,
      SEED.SUPPLIERS_PER_STORE
    );
    console.log(`[store ${s.slug}] created ${supplierIds.length} suppliers`);

    const meds = await createMedicinesForStore(
      s.id,
      supplierIds,
      SEED.MEDICINES_PER_STORE
    );
    console.log(`[store ${s.slug}] created ${meds.length} medicines + batches`);
    allMedicineIds.push(...meds);

    const reorders = await createReordersForStore(s.id, supplierIds, meds);
    console.log(
      `[store ${s.slug}] created ${reorders.length} reorders (some SENT)`
    );

    // receive some SENT reorders to create inventory and movements
    await receiveSomeReorders(s.id);

    // create uploads for the store created by the store owner (test user assigned to first store)
    const createdById = testUser.id;
    await createUploadsForStore(s.id, createdById);
    await createNotificationsAndWebhooks(s.id, createdById);
    await createAlertsForecastsHealth(s.id, meds);
    await createSomeSales(s.id, meds);

    console.log(
      `[store ${s.slug}] seeded uploads, notifications, webhooks, alerts, forecasts and some sales`
    );
  }

  // create prescriptions across stores
  await createPrescriptions(
    SEED.PRESCRIPTIONS,
    patientIds,
    doctorIds,
    allMedicineIds,
    storeIds
  );
  console.log(`Created ${SEED.PRESCRIPTIONS} prescriptions across stores`);

  // final small activity logs
  for (const s of stores) {
    await prisma.activityLog.create({
      data: {
        storeId: s.id,
        userId: testUser.id,
        action: "SEED_COMPLETE",
        payload: { message: "seed completed", store: s.slug },
      },
    });
  }

  console.log("Seeding finished successfully");
  console.log(
    "Test credentials - email:",
    "sreecharan309@gmail.com",
    " password:",
    "12345678"
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
