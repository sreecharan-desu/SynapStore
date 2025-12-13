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

  const username = "SUPERADMIN";
  // These encrypted versions are for manual lookups or detecting double-encryption
  const encEmail = crypto$.encryptCellDeterministic(email);
  const encUsername = crypto$.encryptCellDeterministic(username);
  const hashed = await hashPassword(password);

  console.log(`Ensuring admin user: ${email} / ${username}`);

  // 1. Search among existing SUPERADMINs
  // We use findMany because findUnique doesn't work well if signatures are messed up
  const superAdmins = await prisma.user.findMany({
    where: { globalRole: "SUPERADMIN" },
  });

  let targetUser = superAdmins.find(u => 
      u.username === username || 
      u.email === email || 
      u.username === encUsername || // Hit if stored as double-encrypted
      u.email === encEmail          // Hit if stored as double-encrypted
  );

  // 2. If not found in SUPERADMINs, try generic lookup by username (manual enc required for lookup)
  if (!targetUser) {
    targetUser = await prisma.user.findUnique({
      where: { username: encUsername },
    }) || undefined;
  }
  
  // 3. If still not found, try generic lookup by email (manual enc required for lookup)
  if (!targetUser) {
    targetUser = await prisma.user.findUnique({
      where: { email: encEmail },
    }) || undefined;
  }

  if (targetUser) {
    console.log(`Updating existing admin user (ID: ${targetUser.id})...`);
    // Update using PLAINTEXT fields. Middleware will encrypt them.
    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        username: username,
        email: email,
        passwordHash: hashed,
        globalRole: "SUPERADMIN",
        isActive: true,
        isverified: true,
      },
    });
    console.log("Admin user updated.");
  } else {
    console.log("Creating new admin user...");
    // Create using PLAINTEXT fields. Middleware will encrypt them.
    try {
        await prisma.user.create({
            data: {
                username: username,
                email: email,
                passwordHash: hashed,
                globalRole: "SUPERADMIN",
                isActive: true,
                isverified: true,
            },
        });
        console.log("Admin user created.");
    } catch(e) {
        console.error("Creation failed even after checks.", e);
    }
  }

  // 4. Demote duplicates
  // Refresh generic list
  const allSuperAdmins = await prisma.user.findMany({
    where: { globalRole: "SUPERADMIN" },
  });
  
  for (const admin of allSuperAdmins) { 
     // We expect the correct admin to now have username === "SUPERADMIN" (decrypted)
     // If middleware is working, `admin.username` should be "SUPERADMIN".
     // If `admin.email` is email.
     
     const isTarget = admin.username === username && admin.email === email;
     
     if (!isTarget) {
         console.log(`Demoting extra SUPERADMIN ${admin.id} (${admin.username})...`);
         await prisma.user.update({
             where: { id: admin.id },
             data: { globalRole: "STORE_OWNER" } 
         }).catch(e => console.error(`Failed to demote ${admin.id}`, e));
     }
  }
}
