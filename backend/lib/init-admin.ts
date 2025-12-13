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

  const encEmail = crypto$.encryptCellDeterministic(email);

  // Find all current SUPERADMINs
  const currentSuperAdmins = await prisma.user.findMany({
    where: { globalRole: "SUPERADMIN" },
  });

  let targetAdminUser = null;

  // Identify the target admin among current SUPERADMINs or as a regular user
  for (const user of currentSuperAdmins) {
    // Middleware decrypts user.email, so compare with plaintext email
    if (user.email === email) {
      targetAdminUser = user;
      break;
    }
  }

  if (!targetAdminUser) {
    // If not found in current SUPERADMINs, check if they exist as a regular user
    // We search by encrypted email because the DB stores it encrypted
    targetAdminUser = await prisma.user.findUnique({
      where: { email: encEmail },
    });
  }

  // Demote any SUPERADMINs that are not the target admin
  for (const user of currentSuperAdmins) {
    // Compare plaintext emails
    if (user.email !== email) {
      console.log(`Demoting user ${user.id} from SUPERADMIN role.`);
      await prisma.user.update({
        where: { id: user.id },
        data: { globalRole: "STORE_OWNER" },
      });
    }
  }

  // Now ensure the target admin user exists and has the SUPERADMIN role
  if (targetAdminUser) {
    if (targetAdminUser.globalRole !== "SUPERADMIN") {
      console.log("User found with admin email but incorrect role. Promoting to SUPERADMIN.");
      await prisma.user.update({
        where: { id: targetAdminUser.id },
        data: { globalRole: "SUPERADMIN" },
      });
    } else {
      console.log("Admin user already exists and has SUPERADMIN role.");
    }
  } else {
    // If target admin user does not exist, create them
    console.log("Creating default admin user...");
    const username = "SUPERADMIN"; // You might want to make this configurable or unique
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
          isActive: true,
        },
      });
      console.log("Admin user created.");
    } catch (err) {
      console.error("Failed to create admin user:", err);
    }
  }
}
