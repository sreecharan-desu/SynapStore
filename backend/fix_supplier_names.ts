
import prisma from "./lib/prisma";
import crypto from "crypto";

function dekFromEnv(): Buffer {
    const b64 = process.env.DATA_KEY_B64;
    if (!b64) throw new Error("DATA_KEY_B64 not set");
    return Buffer.from(b64, "base64");
}

function decryptCell(b64: string, dek: Buffer): string | null {
    if (!b64 || b64 === "") return null;
    try {
        const buf = Buffer.from(b64, "base64");
        if (buf.length < 12 + 16 + 1) return null;
        const nonce = buf.slice(0, 12);
        const ct = buf.slice(12, buf.length - 16);
        const tag = buf.slice(buf.length - 16);
        const decipher = crypto.createDecipheriv("aes-256-gcm", dek, nonce);
        decipher.setAuthTag(tag);
        const res = Buffer.concat([decipher.update(ct), decipher.final()]);
        return res.toString("utf8");
    } catch (err) {
        return null;
    }
}

async function main() {
    console.log("Fixing Supplier Names...");
    const dek = dekFromEnv();

    const suppliers = await prisma.supplier.findMany();
    console.log(`Found ${suppliers.length} suppliers.`);

    for (const s of suppliers) {
        if (s.name.startsWith("Supplier ") && s.name.length > 30) {
            const blob = s.name.replace("Supplier ", "");
            // Try to decrypt the blob
            const decrypted = decryptCell(blob, dek);

            if (decrypted) {
                console.log(`Fixing supplier ${s.id}:`);
                console.log(`  Current: ${s.name}`);
                console.log(`  Decrypted: ${decrypted}`);

                // Update with the plaintext name. 
                // The middleware is active on 'prisma' instance (from lib/prisma), 
                // so it will automatically encrypt this plaintext value when saving!
                await prisma.supplier.update({
                    where: { id: s.id },
                    data: { name: decrypted }
                });
                console.log("  Updated successfully.");
            } else {
                console.log(`Skipping ${s.id}: Could not decrypt suffix.`);
            }
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
