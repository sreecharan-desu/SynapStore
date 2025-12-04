// prisma/seed.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker";

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set in .env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function createSuppliers(count = 25) {
  const created: { supID: number }[] = [];
  for (let i = 0; i < count; i++) {
    const sup = await prisma.supplier.create({
      data: {
        name: `${faker.company.name()} ${i + 1}`,
        address: faker.location.streetAddress(),
        phone: faker.phone.number({ style: "human" }),
      },
      select: { supID: true },
    });
    created.push(sup);
  }
  return created.map((c) => c.supID);
}

async function createDoctors(count = 25) {
  const created: { physID: number }[] = [];
  for (let i = 0; i < count; i++) {
    const doc = await prisma.doctor.create({
      data: {
        name: faker.person.fullName(),
        address: faker.location.streetAddress(),
        phone: faker.phone.number({ style: "human" }),
      },
      select: { physID: true },
    });
    created.push(doc);
  }
  return created.map((c) => c.physID);
}

async function createInsurances(count = 25) {
  const created: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = `${faker.company.buzzNoun()}-${faker.number.int({
      min: 1000,
      max: 9999,
    })}`;
    await prisma.insurance.create({
      data: {
        name,
        phone: faker.phone.number({ style: "human" }),
        coPay: faker.helpers.arrayElement(["Yes", "No"]),
      },
    });
    created.push(name);
  }
  return created;
}

async function createPatients(count = 25, insuranceNames: string[]) {
  const created: { patientID: number }[] = [];
  for (let i = 0; i < count; i++) {
    const insurance = faker.helpers.arrayElement([
      ...insuranceNames,
      null,
      undefined,
      null,
    ] as (string | null | undefined)[]); // some patients w/o insurance
    const patient = await prisma.patient.create({
      data: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        birthdate: faker.date
          .birthdate({ min: 18, max: 90, mode: "age" })
          .toISOString()
          .split("T")[0],
        address: faker.location.streetAddress(),
        phone: faker.phone.number({ style: "human" }),
        gender: faker.helpers.arrayElement(["Male", "Female", "Other"]),
        insurance: insurance ?? undefined,
      },
      select: { patientID: true },
    });
    created.push(patient);
  }
  return created.map((c) => c.patientID);
}

async function createDrugs(count = 25, supplierIds: number[]) {
  const created: { NDC: number }[] = [];
  for (let i = 0; i < count; i++) {
    // Create a pseudo NDC (should be unique)
    // generate unique-ish 10-digit-like numbers but within signed 32-bit range
    const ndc = faker.number.int({ min: 1000000, max: 2000000000 });
    const supID = faker.helpers.arrayElement(supplierIds);
    const drug = await prisma.drugs.create({
      data: {
        NDC: ndc,
        brandName: faker.commerce.productName(),
        genericName: faker.commerce.productAdjective() + "ine",
        dosage: faker.number.int({ min: 5, max: 500 }),
        expDate: faker.date.soon({ days: 730 }).toISOString().split("T")[0],
        supID,
        purchasePrice: parseFloat(
          faker.commerce.price({ min: 1, max: 30, dec: 2 })
        ),
        sellPrice: parseFloat(
          faker.commerce.price({ min: 31, max: 120, dec: 2 })
        ),
      },
      select: { NDC: true },
    });
    created.push(drug);
  }
  return created.map((c) => c.NDC);
}

async function createPrescriptions(
  count = 25,
  patientIds: number[],
  doctorIds: number[],
  ndcs: number[]
) {
  for (let i = 0; i < count; i++) {
    const patientID = faker.helpers.arrayElement(patientIds);
    const physID = faker.helpers.arrayElement(doctorIds);
    const NDC = faker.helpers.arrayElement(ndcs);
    await prisma.prescription.create({
      data: {
        patientID,
        physID,
        NDC,
        qty: faker.number.int({ min: 1, max: 120 }),
        days: faker.number.int({ min: 1, max: 90 }),
        refills: faker.number.int({ min: 0, max: 5 }),
        status: faker.helpers.arrayElement([
          "active",
          "completed",
          "cancelled",
        ]),
      },
    });
  }
}

async function main() {
  console.log("Starting seeding...");

  // Clear tables in dependency order (safe for dev). Use with caution in prod.
  await prisma.prescription.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.drugs.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.insurance.deleteMany();

  // Create base data
  const supplierIds = await createSuppliers(25);
  console.log(`Created ${supplierIds.length} suppliers`);

  const doctorIds = await createDoctors(25);
  console.log(`Created ${doctorIds.length} doctors`);

  const insuranceNames = await createInsurances(25);
  console.log(`Created ${insuranceNames.length} insurance providers`);

  const patientIds = await createPatients(25, insuranceNames);
  console.log(`Created ${patientIds.length} patients`);

  const ndcs = await createDrugs(25, supplierIds);
  console.log(`Created ${ndcs.length} drugs`);

  await createPrescriptions(25, patientIds, doctorIds, ndcs);
  console.log(`Created 25 prescriptions`);

  console.log("Seeding finished successfully");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
