import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const app = express();
// Middleware
app.use(express.json({ limit: "10mb" })); // Increase limit to 10MB
app.use(cors());

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
app.get("/", async (req, res) => {
  res.send({ msg: "Hello from backend", count: await prisma.user.count() });
});

// Start the server
app.listen(3000, () => {
  console.log(`Listening on Port number ${3000}`);
});
