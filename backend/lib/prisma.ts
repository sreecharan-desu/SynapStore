import dotenv from "dotenv"
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import setupPrismaCrypto from "../middleware/prisma_crypto_middleware";

dotenv.config()
const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Create adapter and Prisma client
const adapter = new PrismaPg({
  connectionString,
});

const basePrisma = new PrismaClient({ adapter });

// Apply encryption middleware for transparent field-level encryption
// This encrypts sensitive fields on write and decrypts on read
const prisma = setupPrismaCrypto(basePrisma);

export default prisma;





