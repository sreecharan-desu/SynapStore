import prisma from "./lib/prisma";

async function main() {
    console.log("Inspecting Supplier Data...");

    const suppliers = await prisma.supplier.findMany({
        take: 5
    });

    console.log("Found suppliers:", suppliers.length);

    for (const s of suppliers) {
        console.log("------------------------------------------------");
        console.log(`ID: ${s.id}`);
        console.log(`Raw Name: ${s.name}`);
        console.log(`Decoded Name (if base64):`);

        try {
            if (s.name.includes("Supplier ")) {
                // Check if the part after "Supplier " is base64
                const b64 = s.name.replace("Supplier ", "");
                if (b64.length > 20) {
                    console.log("  Looks like 'Supplier ' + Encrypted Blob");
                }
            }
        } catch (e) {
            console.log("  Not base64 or failed to check");
        }
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
