/**
 * Migration script to encrypt existing plaintext data
 * 
 * Usage: npx ts-node migrate_all_encrypt.ts
 */

import dotenv from "dotenv";
dotenv.config();

import prisma from "./lib/prisma";
import { crypto$ } from "./lib/crypto";

const encryptFields: Record<string, string[]> = {
  User: ["username", "email", "imageUrl", "OtpCode"],
  Doctor: ["name", "address", "phone"],
  Supplier: ["name", "address", "phone"],
  Drugs: ["brandName", "genericName"],
  Insurance: ["phone"],
  Patient: ["firstName", "lastName", "address", "phone", "gender"],
  Prescription: ["status"],
};

async function migrateUsers() {
  console.log("Starting user migration to encrypted fields...");
  try {
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users to encrypt`);

    for (const user of users) {
        // First decrypt existing values (in case they are already encrypted)
        const plain = crypto$.decryptObject(user, encryptFields.User);
        // For username/email use deterministic encryption so DB uniqueness works
        const dataToSet: Record<string, any> = {};
        if (plain.username !== undefined && plain.username !== null) {
          dataToSet.username = crypto$.encryptCellDeterministic(plain.username);
        }
        if (plain.email !== undefined && plain.email !== null) {
          dataToSet.email = crypto$.encryptCellDeterministic(plain.email);
        }
        // Other fields remain non-deterministic
        if (plain.imageUrl !== undefined && plain.imageUrl !== null) {
          dataToSet.imageUrl = crypto$.encryptCell(plain.imageUrl);
        }
        if (plain.OtpCode !== undefined && plain.OtpCode !== null) {
          dataToSet.OtpCode = crypto$.encryptCell(plain.OtpCode);
        }

        // Check for uniqueness collisions before updating
        if (dataToSet.email) {
          const conflict = await prisma.user.findFirst({ where: { email: dataToSet.email } });
          if (conflict && conflict.id !== user.id) {
            console.warn(`Skipping user ${user.id}: deterministic email conflicts with user ${conflict.id}`);
            continue;
          }
        }

        await prisma.user.update({
          where: { id: user.id },
          data: dataToSet,
        });
        console.log(`✓ Encrypted user: ${user.id}`);
    }
    console.log("✓ User migration complete!");
  } catch (error) {
    console.error("User migration failed:", error);
  }
}

async function migrateDoctors() {
  console.log("Starting doctor migration to encrypted fields...");
  try {
    const doctors = await prisma.doctor.findMany();
    console.log(`Found ${doctors.length} doctors to encrypt`);

    for (const doctor of doctors) {
      const encrypted = crypto$.encryptObject(doctor, encryptFields.Doctor);
      await prisma.doctor.update({
        where: { physID: doctor.physID },
        data: encrypted,
      });
      console.log(`✓ Encrypted doctor: ${doctor.physID}`);
    }
    console.log("✓ Doctor migration complete!");
  } catch (error) {
    console.error("Doctor migration failed:", error);
  }
}

async function migrateSuppliers() {
  console.log("Starting supplier migration to encrypted fields...");
  try {
    const suppliers = await prisma.supplier.findMany();
    console.log(`Found ${suppliers.length} suppliers to encrypt`);

    for (const supplier of suppliers) {
      const encrypted = crypto$.encryptObject(supplier, encryptFields.Supplier);
      await prisma.supplier.update({
        where: { supID: supplier.supID },
        data: encrypted,
      });
      console.log(`✓ Encrypted supplier: ${supplier.supID}`);
    }
    console.log("✓ Supplier migration complete!");
  } catch (error) {
    console.error("Supplier migration failed:", error);
  }
}

async function migratePatients() {
  console.log("Starting patient migration to encrypted fields...");
  try {
    const patients = await prisma.patient.findMany();
    console.log(`Found ${patients.length} patients to encrypt`);

    for (const patient of patients) {
      const encrypted = crypto$.encryptObject(patient, encryptFields.Patient);
      await prisma.patient.update({
        where: { patientID: patient.patientID },
        data: encrypted,
      });
      console.log(`✓ Encrypted patient: ${patient.patientID}`);
    }
    console.log("✓ Patient migration complete!");
  } catch (error) {
    console.error("Patient migration failed:", error);
  }
}

async function migrateDrugs() {
  console.log("Starting drugs migration to encrypted fields...");
  try {
    const drugs = await prisma.drugs.findMany();
    console.log(`Found ${drugs.length} drugs to encrypt`);

    for (const drug of drugs) {
      const encrypted = crypto$.encryptObject(drug, encryptFields.Drugs);
      await prisma.drugs.update({
        where: { NDC: drug.NDC },
        data: encrypted,
      });
      console.log(`✓ Encrypted drug: ${drug.NDC}`);
    }
    console.log("✓ Drugs migration complete!");
  } catch (error) {
    console.error("Drugs migration failed:", error);
  }
}

async function runAllMigrations() {
  console.log("======================================");
  console.log("Starting full encryption migration");
  console.log("======================================\n");

  await migrateUsers();
  await migrateDoctors();
  await migrateSuppliers();
  await migratePatients();
  await migrateDrugs();

  console.log("\n======================================");
  console.log("All migrations complete!");
  console.log("======================================");
  
  await prisma.$disconnect();
}

if (require.main === module) {
  runAllMigrations().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export {
  migrateUsers,
  migrateDoctors,
  migrateSuppliers,
  migratePatients,
  migrateDrugs,
};

