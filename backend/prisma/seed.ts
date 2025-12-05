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
  MEDICINES_PER_STORE: 50,
  BATCHES_PER_MEDICINE: 2,
  PRESCRIPTIONS: 80,
};

/**
 * Helper utilities
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
  await prisma.prescription.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.medicine.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.insurance.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.userStoreRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.store.deleteMany();
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
      isverified: true, // explicitly verified for testing
    },
    select: { id: true, email: true, username: true },
  });

  return user;
}

/**
 * Create stores and some users per store.
 * All created user identity fields are encrypted to match runtime behavior.
 * Assign the test user as STORE_OWNER on the first store.
 */
async function createStoresAndUsers(testUserId: string) {
  const stores: { id: string; slug: string }[] = [];

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
      select: { id: true, slug: true },
    });

    stores.push(store);

    // create some users for this store (besides the test user)
    for (let u = 0; u < SEED.USERS_PER_STORE; u++) {
      const usernamePlain = (
        faker.internet.username() + `${i}${u}`
      ).toLowerCase();
      const emailPlain = `${usernamePlain}@example.com`;
      const password = "Password123!"; // seeded password for dev
      const passwordHash = await hashPw(password);

      const encUsername = crypto$.encryptCellDeterministic(usernamePlain);
      const encEmail = crypto$.encryptCellDeterministic(emailPlain);
      // optional image - encrypt non-deterministically if present
      const imagePlain = faker.image.avatar();
      const encImage = crypto$.encryptCell(imagePlain);

      const user = await prisma.user.create({
        data: {
          username: encUsername,
          email: encEmail,
          passwordHash,
          imageUrl: encImage ?? undefined,
          phone: faker.phone.number({ style: "international" }),
          isActive: true,
          isverified: true, // seeded users are verified to ease dev login
        },
        select: { id: true },
      });

      // assign roles: first user is STORE_OWNER, next ADMIN, rest STAFF / MANAGER
      const role =
        u === 0
          ? "STORE_OWNER"
          : u === 1
          ? "ADMIN"
          : u === 2
          ? "MANAGER"
          : "STAFF";

      await prisma.userStoreRole.create({
        data: {
          userId: user.id,
          storeId: store.id,
          role,
        },
      });
    }
  }

  // assign the testing user as STORE_OWNER on the first store (so you can exercise everything)
  if (stores.length > 0) {
    try {
      await prisma.userStoreRole.create({
        data: {
          userId: testUserId,
          storeId: stores[0].id,
          role: "STORE_OWNER",
        },
      });
    } catch (e) {
      // ignore unique constraint errors if role already exists
      console.warn(
        "Could not assign test user to first store:",
        (e as any).message ?? e
      );
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
    const s = await prisma.supplier.create({
      data: {
        storeId,
        name: `${faker.company.name()} Supplies`,
        address: faker.location.streetAddress(),
        phone: faker.phone.number({ style: "international" }),
        contactName: faker.person.fullName(),
        defaultLeadTime: rndInt(1, 14),
        defaultMOQ: rndInt(1, 50),
        externalMeta: {},
      },
      select: { id: true },
    });
    ids.push(s.id);
  }
  return ids;
}

/**
 * Create doctors (shared)
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
 * Create insurances (shared)
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
 * Create patients (shared)
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
  count = 50
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

    // create a couple of inventory batches per medicine
    for (let b = 0; b < SEED.BATCHES_PER_MEDICINE; b++) {
      const qtyReceived = rndInt(10, 200);
      const expiryDate = faker.date.soon({ days: rndInt(30, 365 * 2) });
      await prisma.inventoryBatch.create({
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
    }
  }
  return meds;
}

/**
 * Create prescriptions (shared), distributed across given storeIds
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
 * Main seeding flow
 */
async function main() {
  console.log("Starting seed... (development only)");

  await clearAll();

  // create testing user first (encrypted)
  const testUser = await createTestingUser();
  console.log("Created test user:", "sreecharan309@gmail.com");

  const stores = await createStoresAndUsers(testUser.id);
  console.log(`Created ${stores.length} stores`);

  // create shared resources
  const doctorIds = await createDoctors(SEED.DOCTORS);
  console.log(`Created ${doctorIds.length} doctors`);

  const insuranceNames = await createInsurances(SEED.INSURANCES);
  console.log(`Created ${insuranceNames.length} insurance providers`);

  const patientIds = await createPatients(SEED.PATIENTS, insuranceNames);
  console.log(`Created ${patientIds.length} patients`);

  // per-store suppliers, medicines, batches, prescriptions
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

    // create some prescriptions referencing these medicines for this store
    await createPrescriptions(
      Math.floor(SEED.PRESCRIPTIONS / stores.length),
      patientIds,
      doctorIds,
      meds,
      [s.id]
    );
    console.log(`[store ${s.slug}] created prescriptions`);
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
