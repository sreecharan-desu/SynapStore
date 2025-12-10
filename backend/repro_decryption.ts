
import prisma from "./lib/prisma";

// const prismaWithCrypto = setupPrismaCrypto(prisma); // Already applied in lib/prisma
const prismaWithCrypto = prisma;

async function main() {
    console.log("Running reproduction script...");

    // 1. Create a dummy user and store if not exists (or just fetch existing)
    // For reproduction, we'll try to fetch an existing store with users
    console.log("Fetching stores with nested users...");
    const stores = await prismaWithCrypto.store.findMany({
        take: 1,
        include: {
            users: {
                include: {
                    user: true
                }
            }
        }
    });

    if (stores.length === 0) {
        console.log("No stores found to test.");
        return;
    }

    const store = stores[0];
    console.log(`Found store: ${store.name}`);

    if (store.users.length > 0) {
        const userStoreRole = store.users[0];
        if (userStoreRole.user) {
            const email = userStoreRole.user.email;
            console.log(`User email: ${email}`);

            // Simple check: if it looks like base64 and is long, it's likely encrypted
            const isEncrypted = email.length > 50 && !email.includes("@") && email.endsWith("=");

            if (isEncrypted) {
                console.log("FAILURE: Email is encrypted!");
            } else {
                console.log("SUCCESS: Email is plaintext.");
            }
        } else {
            console.log("Store has user relation but no user loaded?");
        }
    } else {
        console.log("Store has no users.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
