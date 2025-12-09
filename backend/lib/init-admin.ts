import prisma from "./prisma";
import { hashPassword } from "./auth";
import { crypto$ } from "./crypto";

export async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("No ADMIN_EMAIL/ADMIN_PASSWORD env vars found; skipping admin creation.");
    return;
  }

  // Check if admin exists (deterministic encryption for lookup)
  const encEmail = crypto$.encryptCellDeterministic(email);
  const existing = await prisma.user.findUnique({
    where: { email: encEmail },
  });

  if (existing) {
    if (existing.globalRole !== "SUPERADMIN") {
        console.log("User found with admin email but incorrect role. Promoting to SUPERADMIN.");
        await prisma.user.update({
            where: { id: existing.id },
            data: { globalRole: "SUPERADMIN" }
        });
    }
    return;
  }

  console.log("Creating default admin user...");
  // create a default username
  const username = "admin";
  const encUsername = crypto$.encryptCellDeterministic(username);
  const hashed = await hashPassword(password);

  try {
      await prisma.user.create({
        data: {
            username: encUsername,
            email: encEmail,
            passwordHash: hashed,
            isverified: true,
            globalRole: "SUPERADMIN",
            isActive: true
        }
      });
      console.log("Admin user created.");
  } catch (err) {
      console.error("Failed to create admin user:", err);
  }
}
